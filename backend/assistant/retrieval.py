# Standard library
import asyncio
import logging
import re

# Third-party
import httpx

logger = logging.getLogger(__name__)

# Source choice (2026-07): NLM discontinued the RxNav interaction endpoint in
# Jan 2024 with no official replacement. The live free stack is:
#   RxNorm (still maintained) — normalize any entered name to ingredient names
#     ("Advil" -> "ibuprofen"), so brand names match label text.
#   openFDA drug labels — each prescription label carries a drug_interactions
#     section; we scan each drug's section for mentions of the other drugs.
# Limitation: matching is name-level. A label that only says "NSAIDs" won't
# flag ibuprofen — the context section says so instead of implying a full check.
RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"
OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"
REQUEST_TIMEOUT = httpx.Timeout(5.0)
EXCERPT_MAX_CHARS = 250
MAX_MEDS_CHECKED = 8  # caps external-API fan-out per turn
# Names interpolated into the openFDA query must be plain drug-name text —
# anything else could break out of the quoted Lucene phrase and match the
# wrong label (mentioned_medications originates from LLM-extracted free text)
_SAFE_QUERY_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 \-',./]*$")


async def _get_rxcui(client: httpx.AsyncClient, name: str) -> str | None:
    """Resolve a medication name to its RxNorm concept id (rxcui)."""
    response = await client.get(f"{RXNORM_BASE}/rxcui.json", params={"name": name})
    response.raise_for_status()
    rxcuis = response.json().get("idGroup", {}).get("rxnormId", [])
    return rxcuis[0] if rxcuis else None


async def _get_ingredients(client: httpx.AsyncClient, rxcui: str) -> list[str]:
    """Get the ingredient (TTY=IN) names for a concept — 'Advil' -> ['ibuprofen'].

    An ingredient concept returns itself; combo products return one name per
    ingredient.
    """
    response = await client.get(
        f"{RXNORM_BASE}/rxcui/{rxcui}/related.json", params={"tty": "IN"}
    )
    response.raise_for_status()
    groups = response.json().get("relatedGroup", {}).get("conceptGroup") or []
    return [
        concept["name"]
        for group in groups
        for concept in (group.get("conceptProperties") or [])
        if concept.get("name")
    ]


async def _get_label_interactions(client: httpx.AsyncClient, ingredient: str) -> str | None:
    """Fetch the drug_interactions text from an FDA label for this ingredient.

    OTC labels usually lack the section, so the query filters to labels that
    have it (openFDA `_exists_`). openFDA answers 404 for "no results".
    """
    response = await client.get(
        OPENFDA_LABEL_URL,
        params={
            "search": f'openfda.generic_name:"{ingredient}" AND _exists_:drug_interactions',
            "limit": 1,
        },
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    results = response.json().get("results", [])
    sections = results[0].get("drug_interactions", []) if results else []
    return " ".join(sections) or None


def _mention_excerpt(label_text: str, other_names: list[str]) -> tuple[str, str] | None:
    """First sentence of label_text naming any of other_names -> (name, excerpt)."""
    sentences = re.split(r"(?<=[.!?])\s+", label_text)
    for name in other_names:
        pattern = re.compile(rf"\b{re.escape(name)}\b", re.IGNORECASE)
        for sentence in sentences:
            match = pattern.search(sentence)
            if not match:
                continue
            excerpt = sentence.strip()
            if len(excerpt) > EXCERPT_MAX_CHARS:
                # Window around the match — label "sentences" are often long
                # flattened tables, and the excerpt must show its evidence
                start = max(0, match.start() - EXCERPT_MAX_CHARS // 3)
                end = start + EXCERPT_MAX_CHARS
                excerpt = (
                    ("…" if start > 0 else "")
                    + sentence[start:end].strip()
                    + ("…" if end < len(sentence) else "")
                )
            return name, excerpt
    return None


def _display(name: str, ingredients: list[str]) -> str:
    """'Coumadin (warfarin)' when the entered name isn't the ingredient itself."""
    if len(ingredients) == 1 and ingredients[0].lower() == name.lower():
        return name
    return f"{name} ({', '.join(ingredients)})"


async def fetch_medication_context(med_names: list[str]) -> str | None:
    """Build a medication-interaction context section for the given drug names.

    Fail-open by design: retrieval is an enhancement, not a safety gate —
    any error returns None and the caller proceeds without the section
    (clinical-severity turns remain critic-gated regardless).
    """
    try:
        # Case-insensitive dedupe, preserving first-seen spelling
        seen: set[str] = set()
        names: list[str] = []
        for name in med_names:
            if name and name.lower() not in seen:
                seen.add(name.lower())
                names.append(name)
        names = names[:MAX_MEDS_CHECKED]
        if len(names) < 2:
            return None  # nothing to cross-check

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            rxcuis = await asyncio.gather(*(_get_rxcui(client, name) for name in names))
            resolved = [(name, rxcui) for name, rxcui in zip(names, rxcuis) if rxcui]
            if len(resolved) < 2:
                logger.warning(
                    "medication retrieval: only %d/%d names resolved to rxcuis — skipping",
                    len(resolved), len(names),
                )
                return None

            ingredient_lists = await asyncio.gather(
                *(_get_ingredients(client, rxcui) for _, rxcui in resolved)
            )
            # (entered name, ingredient names) — fall back to the entered name
            # so a concept with no IN relation still participates in matching
            meds = [
                (name, ingredients or [name])
                for (name, _), ingredients in zip(resolved, ingredient_lists)
            ]

            # One label per med, looked up by its primary ingredient (skipped
            # if the name isn't plain drug-name text — see _SAFE_QUERY_NAME)
            labels = await asyncio.gather(
                *(
                    _get_label_interactions(client, ingredients[0])
                    if _SAFE_QUERY_NAME.match(ingredients[0])
                    else _none()
                    for _, ingredients in meds
                )
            )

        if not any(labels):
            logger.warning(
                "medication retrieval: no FDA label with interactions found for any of %s",
                [name for name, _ in meds],
            )
            return None  # nothing was actually checked — let the guard note apply

        flags = []
        for (name_i, ingredients_i), label in zip(meds, labels):
            if not label:
                continue
            own = {ing.lower() for ing in ingredients_i}
            for name_j, ingredients_j in meds:
                # Skip self AND meds sharing an ingredient (e.g. Tylenol vs
                # acetaminophen) — a label naming its own generic isn't an
                # interaction, and flagging it would overclaim
                if name_j == name_i or own & {ing.lower() for ing in ingredients_j}:
                    continue
                hit = _mention_excerpt(label, ingredients_j)
                if hit:
                    matched, excerpt = hit
                    flags.append(
                        f"{_display(name_i, ingredients_i)} label mentions {matched}: {excerpt}"
                    )

        checked = ", ".join(
            _display(name, ingredients) for (name, ingredients), label in zip(meds, labels) if label
        )
        lines = [f"Medication Interaction Check (FDA drug labels via openFDA; labels scanned: {checked}):"]
        if flags:
            lines.extend(f"- {flag}" for flag in flags)
        else:
            lines.append(
                "- These drugs do not name each other in their FDA label interaction "
                "sections. This is NOT a guarantee of safety — labels often refer to "
                "drug classes (e.g. 'NSAIDs') rather than specific drugs — the user "
                "should confirm with a pharmacist."
            )
        return "\n".join(lines)
    except Exception:
        logger.warning("medication retrieval failed — proceeding without it", exc_info=True)
        return None


async def _none() -> None:
    """Placeholder awaitable for meds whose label lookup is skipped."""
    return None
