"""Triage severity eval (AI_ARCHITECTURE_REVIEW.md §4.5).

Runs the labeled messages in triage_cases.json through the REAL triage node
(same prompt, same structured output, same model factory as production) and
reports:

  - accuracy           — predicted severity is in the case's accepted set,
                         computed over COMPLETED calls only (API errors and
                         skipped cases are reported separately, so a partial
                         run doesn't masquerade as a bad model)
  - emergency recall   — of the true emergencies that completed, how many
                         were labeled emergency. THE metric that matters:
                         missing an emergency is the dangerous failure, so
                         the gate requires 100%
  - over-escalation    — non-emergencies labeled emergency (safe direction,
                         but too many = alarm fatigue and slow critic-gated
                         responses for harmless questions)
  - a confusion table  — expected (primary label) vs predicted

Each case costs one real Gemini API call — run deliberately, never from CI
reflexes.

Free-tier quotas OBSERVED for gemini-2.5-flash (from 429 payloads, 2026-07):
5 requests/minute and 20 requests/day, per model per project. Hence:
  - default --delay 15 stays under 5 RPM (LangChain retries also count)
  - on a DAILY-quota 429 the run aborts immediately — every further call
    that day is guaranteed to fail and retries only burn more budget
  - a full 30-case run does not fit in flash's daily budget; run the eval
    on flash-lite (separate quota) or in daily chunks via --start/--limit

    cd backend
    venv/bin/python evals/run_triage_eval.py --model gemini-2.5-flash-lite
    venv/bin/python evals/run_triage_eval.py --start 8        # resume from case #8
    venv/bin/python evals/run_triage_eval.py --limit 5        # quick smoke run
    venv/bin/python evals/run_triage_eval.py --dry-run        # validate dataset, no API calls

Exit code is non-zero when the run is incomplete (errors/skips) or when
emergency recall < 100% or accuracy < --min-accuracy, so this can gate a
prompt/model change: run before, run after, compare.
"""

# Standard library
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

SEVERITIES = ["emergency", "clinical", "general", "off_topic"]

# Substring of the quota_id in Gemini's 429 payload that identifies the
# per-DAY quota (vs the per-minute one, which recovers on its own).
DAILY_QUOTA_MARKER = "PerDay"


def parse_args():
    parser = argparse.ArgumentParser(description="Run the triage severity eval")
    parser.add_argument("--model", help="Model to eval (overrides both GEMINI_MODEL and GEMINI_MODEL_FAST, since triage runs on the fast tier)")
    parser.add_argument("--delay", type=float, default=15.0, help="Seconds between API calls (default paces under flash's 5 RPM free-tier limit)")
    parser.add_argument("--cases", default=str(Path(__file__).parent / "triage_cases.json"), help="Path to the labeled dataset")
    parser.add_argument("--start", type=int, default=1, help="1-based case number to start from (resume a partial run)")
    parser.add_argument("--limit", type=int, help="Only run N cases from --start (smoke run / daily chunking)")
    parser.add_argument("--min-accuracy", type=float, default=0.85, help="Fail the run below this accuracy over completed cases")
    parser.add_argument("--dry-run", action="store_true", help="Validate the dataset and print it — no API calls")
    return parser.parse_args()


def short_error(exc):
    """One readable line instead of the multi-page 429 protobuf dump."""
    text = f"{type(exc).__name__}: {exc}"
    first_line = text.splitlines()[0]
    if len(first_line) > 140:
        first_line = first_line[:140] + "…"
    return first_line


def is_fatal_error(exc):
    """Errors that doom every subsequent call too: daily quota exhausted,
    or the model name itself is invalid/unavailable (404)."""
    text = str(exc)
    daily_quota = "429" in text and DAILY_QUOTA_MARKER in text
    bad_model = "404" in text
    return daily_quota or bad_model


def build_state(case, State, HumanMessage, HealthProfile, Medication):
    """Build graph state for one case exactly as AssistantService would."""
    profile = case.get("profile")
    health_profile = None
    medications = None
    if profile:
        health_profile = HealthProfile(
            current_conditions=profile.get("conditions", []),
            allergies=profile.get("allergies", []),
        )
        med_names = profile.get("medications", [])
        if med_names:
            medications = [Medication(name=name, is_active=True) for name in med_names]
    return State(
        messages=[HumanMessage(content=case["message"])],
        health_profile=health_profile,
        medications=medications,
    )


async def run_eval(cases, delay):
    # Imported here so a --model override set in main() is already in the
    # environment before the node builds its LLM.
    from langchain_core.messages import HumanMessage
    from assistant.nodes.triage import create_triage_node
    from assistant.state import State
    from assistant.models.health_profile import HealthProfile
    from assistant.models.medications import Medication

    triage_node = create_triage_node()
    results = []
    skipped = 0
    for i, case in enumerate(cases):
        if i > 0 and delay > 0:
            await asyncio.sleep(delay)
        state = build_state(case, State, HumanMessage, HealthProfile, Medication)
        predicted = None
        error = None
        fatal = False
        try:
            out = await triage_node(state)
            predicted = out["triage_result"].severity
        except Exception as exc:  # a failed call is a recorded error, not a crash
            error = short_error(exc)
            fatal = is_fatal_error(exc)
        ok = predicted in case["expected"]
        results.append({"case": case, "predicted": predicted, "ok": ok, "error": error})

        status = "PASS" if ok else ("ERROR" if error else "FAIL")
        got = predicted if predicted else "-"
        print(f"[{i + 1:2}/{len(cases)}] {status:5}  expected {'/'.join(case['expected']):<19} got {got:<10} {case['message'][:58]!r}")

        if fatal:
            skipped = len(cases) - (i + 1)
            print(f"\n!! Fatal error (daily quota or bad model) — aborting, {skipped} cases skipped.")
            print(f"!! If daily quota: resume after the reset (midnight PT) with: --start {case['id'] + 1}")
            break
    return results, skipped


def summarize(results, skipped, min_accuracy, model_name):
    attempted = len(results)
    errors = [r for r in results if r["error"]]
    completed = [r for r in results if not r["error"]]
    passed = sum(1 for r in completed if r["ok"])
    accuracy = passed / len(completed) if completed else 0.0

    # Emergency recall over COMPLETED cases whose PRIMARY label is emergency
    emergencies = [r for r in completed if r["case"]["expected"][0] == "emergency"]
    caught = sum(1 for r in emergencies if r["predicted"] == "emergency")
    recall = caught / len(emergencies) if emergencies else 1.0

    over_escalations = [
        r for r in completed
        if r["predicted"] == "emergency" and "emergency" not in r["case"]["expected"]
    ]

    # Confusion table: rows = expected primary label, cols = predicted
    columns = SEVERITIES + ["error"]
    confusion = {}
    for r in results:
        primary = r["case"]["expected"][0]
        predicted = r["predicted"] if r["predicted"] else "error"
        row = confusion.setdefault(primary, {c: 0 for c in columns})
        row[predicted] += 1

    print()
    print(f"=== Triage eval — model: {model_name} ===")
    print(f"Completed        : {len(completed)}/{attempted + skipped} attempted={attempted} errors={len(errors)} skipped={skipped}")
    if completed:
        print(f"Accuracy         : {passed}/{len(completed)} ({accuracy:.0%}) over completed cases   [gate: >= {min_accuracy:.0%}]")
        print(f"Emergency recall : {caught}/{len(emergencies)} ({recall:.0%}) over completed cases   [gate: 100%]")
        print(f"Over-escalations : {len(over_escalations)} (non-emergency labeled emergency)")
    else:
        print("No completed cases — nothing to score.")

    if completed:
        print("\nConfusion (rows = expected primary, cols = predicted):")
        header = f"{'':>10}" + "".join(f"{c:>11}" for c in columns)
        print(header)
        for severity in SEVERITIES:
            if severity in confusion:
                row = confusion[severity]
                print(f"{severity:>10}" + "".join(f"{row[c]:>11}" for c in columns))

    misclassified = [r for r in completed if not r["ok"]]
    if misclassified:
        print("\nMisclassifications:")
        for r in misclassified:
            case = r["case"]
            print(f"  #{case['id']:2} expected {'/'.join(case['expected'])}, got {r['predicted']}")
            print(f"      message: {case['message']!r}")
            print(f"      note:    {case['note']}")
    if errors:
        print("\nAPI errors (not scored):")
        for r in errors:
            print(f"  #{r['case']['id']:2} {r['error']}")

    complete_run = skipped == 0 and not errors
    if not complete_run:
        print("\nGATE: FAIL — run incomplete (errors or skipped cases); numbers above are partial.")
    return complete_run and accuracy >= min_accuracy and recall == 1.0


def dry_run(cases):
    """Sanity-check the dataset without spending API calls."""
    for case in cases:
        for key in ("id", "message", "expected", "note"):
            assert key in case, f"case missing {key!r}: {case}"
        for label in case["expected"]:
            assert label in SEVERITIES, f"case #{case['id']}: bad label {label!r}"
        profile = "profile" if case.get("profile") else "no profile"
        print(f"#{case['id']:2} [{'/'.join(case['expected']):<19}] ({profile:>10}) {case['message'][:58]!r}")
    primary_counts = {}
    for case in cases:
        primary = case["expected"][0]
        primary_counts[primary] = primary_counts.get(primary, 0) + 1
    print(f"\n{len(cases)} cases, primary-label distribution: {primary_counts}")


def main():
    args = parse_args()
    if args.model:
        # Set before any assistant import: get_llm reads these from the
        # environment, and load_dotenv() does not override an existing value.
        # Both tiers are overridden so --model steers the triage node
        # regardless of which tier it's wired to (it uses tier="fast").
        os.environ["GEMINI_MODEL"] = args.model
        os.environ["GEMINI_MODEL_FAST"] = args.model

    cases = json.loads(Path(args.cases).read_text())
    if args.start > 1:
        cases = cases[args.start - 1:]
    if args.limit:
        cases = cases[: args.limit]

    if args.dry_run:
        dry_run(cases)
        return

    # Triage runs on the fast tier, so that env var names the model under eval
    model_name = os.environ.get("GEMINI_MODEL_FAST", "gemini-3.1-flash-lite")
    est_minutes = len(cases) * args.delay / 60
    print(f"Running {len(cases)} cases against {model_name} "
          f"(~{est_minutes:.0f} min at --delay {args.delay:g})\n")

    results, skipped = asyncio.run(run_eval(cases, args.delay))
    gates_pass = summarize(results, skipped, args.min_accuracy, model_name)
    sys.exit(0 if gates_pass else 1)


if __name__ == "__main__":
    main()
