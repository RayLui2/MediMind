# MediMind Assistant

The AI assistant is built with [LangGraph](https://github.com/langchain-ai/langgraph) and powered by Google Gemini. It processes every user message through a pipeline of specialized nodes before producing a response.

---

## Graph Structure

```
                    ┌─────────┐
                    │ fanout  │  ← entry point
                    └────┬────┘
               ┌─────────┴──────────┐
               ▼                    ▼
        ┌────────────┐       ┌────────────┐
        │ summarizer │       │   triage   │
        └─────┬──────┘       └─────┬──────┘
              │                    ▼
              │            ┌───────────────┐
              │            │ context_builder│
              │            └───────┬───────┘
              │                    ▼
              │            ┌───────────────┐
              │            │    chatbot    │◄──────┐
              │            └───────┬───────┘        │
              │              critic_approved         │ (revision loop,
              │              already True?           │  max 2 retry)
              │              no ───┴─── yes          │
              │              ▼           │           │
              │       ┌───────────┐      │           │
              │       │  critic   │──────┼───────────┘
              │       └─────┬─────┘      │  (not approved & < 2 revisions
              │             ▼            ▼   loops back to chatbot)
              │            ┌───────────────┐
              │            │   streaming   │
              │            └───────┬───────┘
              │                    │
              └────────────────────┘
                         ▼
                        END
```

`fanout` kicks off `summarizer` and `triage` in **parallel**. Each branch ends at `END` independently — LangGraph merges state when both branches complete.

`chatbot → critic` is a conditional edge: if `critic_approved` is already `True` (set by `triage` for `general`/`off_topic` messages), the graph routes straight to `streaming`, skipping the critic LLM call entirely. Otherwise it goes to `critic` as normal, which can loop back to `chatbot` up to 2 times before auto-approving (on `emergency` turns a still-unapproved draft is replaced by a 911-first fallback template instead — see the `critic` node below).

That same triage signal decides the **delivery mode** for the turn. The graph contains no transport — the caller (`AssistantService.stream_chat` or `cli_chat.py`) consumes `graph.astream_events(...)` and applies the policy: for `general`/`off_topic` turns (critic bypassed, nothing can veto the text) the chatbot's tokens are forwarded live as they generate; for `clinical`/`emergency` turns the critic must see the complete text before the user does, so the answer is delivered as one whole chunk after the `streaming` (commit) node runs.

---

## Nodes

### `fanout`
Pass-through entry point. Resets `critic_approved` and `revision_count` so each new message starts a fresh critic loop.

### `summarizer` *(parallel branch)*
Runs in parallel with `triage`. Generates a short conversation title (≤ 6 words + emoji) from the user's first message. Runs on the fast model tier (`GEMINI_MODEL_FAST`) — cheap labeling task. Skips if the conversation already has a title.

**Output:** `conversation_title`

### `triage` *(parallel branch)*
Classifies the urgency and topic of the user's message. Uses the user's health profile (conditions, medications, allergies) to escalate severity when relevant. Runs on the fast model tier (`GEMINI_MODEL_FAST`), validated by `evals/run_triage_eval.py` — 100% accuracy (52/52), 12/12 emergency recall, 0 over-escalations on the 52-case set (`gemini-3.1-flash-lite`, 2026-07-14, re-baselined after the §4.7 schema extension below). Re-run the eval before changing this node's model or prompt.

Besides `severity` and the free-text `topic`, the structured output includes two fields that drive retrieval (review §4.7):
- `topic_category` — one of `medication` / `symptom` / `condition` / `mental_health` / `lifestyle` / `other`; read by `context_builder` to decide what to retrieve. (`unclassified` is a seventh value reserved for the error fallback — the LLM is instructed never to use it.)
- `mentioned_medications` — drugs/supplements explicitly named in the message, so interaction lookups can cover a drug the user is asking about but not yet taking.

The eval reports topic-category accuracy and mention extraction as additional metrics (report-only, no gate yet). First baseline (2026-07-14): category accuracy 52/52, mention extraction 4/5 — the one miss is benign: the model included a *profile* medication in `mentioned_medications` (it sees the med list in its prompt's health context), which is a downstream no-op since `context_builder` merges profile meds into the lookup anyway and dedupes.

**Severity levels:**
| Level | Meaning |
|---|---|
| `emergency` | Requires 911 / ER immediately |
| `clinical` | Needs a doctor soon |
| `general` | Health/wellness, no urgency |
| `off_topic` | Not health-related |

For `general` and `off_topic` messages, `critic_approved` is set to `True` immediately (skips the critic loop).

**Failure policy (fail toward safety):** if the triage LLM call errors, the node returns `severity: clinical` (topic `"unclassified (triage error)"`, `topic_category: unclassified`) — never `general` — so the critic stays in the loop and the chatbot recommends professional evaluation. The `unclassified` category additionally makes `context_builder` run the medication interaction lookup over the user's med list: the unclassified question *might* be about medications.

**Output:** `triage_result`, optionally `critic_approved: True`

### `context_builder`
Builds a personalized health context string from the user's profile — conditions, allergies, medications, and vitals — then performs **topic-driven retrieval** based on `triage_result.topic_category` (review §4.7). The result flows to both the chatbot and the critic, so retrieved material is always part of the evidence the critic reviews.

Current retrieval routes (`assistant/retrieval.py`):
| Category | Retrieval |
|---|---|
| `medication` | RxNorm + openFDA: resolve the user's active meds **+** `mentioned_medications` to ingredient names (RxNorm, so "Advil" matches "ibuprofen"), then scan each drug's FDA-label `drug_interactions` section for mentions of the others |
| `unclassified` (triage errored) | Same lookup over the user's med list only (fail-safe — the question might be medication-related) |
| everything else | None yet (condition/symptom retrieval is future work) |

**Failure policy (fail open):** retrieval is an enhancement, not a safety gate. Any lookup error is logged and the turn proceeds — with a guard note in the context ("interaction lookup was unavailable — do not state that interactions were checked") so the chatbot can't imply a check happened. Clinical/emergency turns remain critic-gated regardless.

> **Source note:** NLM discontinued the RxNav drug-interaction endpoint in 2024 with no official replacement, so interactions come from openFDA drug-label `drug_interactions` text (swapped 2026-07-14). Matching is name-level: a label that only says "NSAIDs" won't flag ibuprofen — the context section states this limitation instead of implying a complete check, and the no-hit wording tells the user to confirm with a pharmacist.

**Output:** `retrieved_context`

### `chatbot`
The main response generator. Builds a system prompt that includes:
- Base persona and formatting rules
- Triage severity + topic
- Retrieved health context
- Previous draft response (if revising)
- Critic's critique (if revising)

Sends `[SystemMessage(prompt)] + conversation_history` to Gemini with structured output.

**Output:** `draft_response`

### `critic`
Safety reviewer. Skipped entirely when `triage` already set `critic_approved: True` (`general`/`off_topic`) — see the `chatbot → critic` conditional edge above. Otherwise evaluates the chatbot's draft response for:
1. Safety — does it recommend care at the right level?
2. Contraindications — does it conflict with the user's conditions or medications?
3. Emergency escalation — does it lead with 911/ER guidance when needed?
4. Completeness — does it actually answer the question?

If the draft fails, it returns a one-sentence critique and the chatbot revises. Max **2 revisions** (then auto-approved — except on `emergency` turns, see below).

**Failure policy (fail toward safety):** on `emergency` turns, a draft the critic never approved must not reach the user. If the critic LLM call errors, or a rejection hits the revision cap, the node replaces `draft_response` with a fixed fallback template that leads with the 911/ER instruction (`EMERGENCY_FALLBACK_RESPONSE` in `nodes/critic.py`). For `clinical` severity, a critic error ships the draft unreviewed (it was generated with the severity-aware prompt) rather than looping against a broken critic.

Measured by `evals/run_critic_eval.py`: 24 labeled (message, draft) pairs — 12 unsafe drafts with planted flaws it must reject (missing 911 lead, contraindicated med suggestions, misinformation), 12 clean drafts it must approve (including false-positive traps). Iteration pass on `gemini-3.1-flash-lite`: 24/24 (2026-07-14); production-model (flash) baseline pending. Re-run before changing this node's prompt or strictness levels.

**Output:** `critic_approved`, `critique`, `revision_count`

### `streaming`
The commit node — the single writer of the assistant message per turn. Appends the approved `draft_response` to `messages` as the final `AIMessage`. Despite the name it does no transport: delivery (live tokens vs one whole chunk) is decided by the caller watching `astream_events`, and the canonical text callers persist is this node's output, not re-assembled wire chunks.

**Output:** appends final `AIMessage` to `messages`

---

## State

Defined in `state.py` as a Pydantic `BaseModel`. Key fields:

| Field | Type | Description |
|---|---|---|
| `messages` | `list` (add_messages) | Full conversation history as LangChain messages |
| `conversation_id` | `int` | DB conversation ID |
| `user_id` | `int` | DB user ID |
| `user_data` | `dict` | Basic user info (name, age) |
| `user_instructions` | `dict` | User's custom assistant instructions |
| `health_profile` | `HealthProfile` | Conditions, allergies, family history, etc. |
| `vital_signs` | `VitalSign` | Latest recorded vitals |
| `medications` | `list[Medication]` | Active medications |
| `triage_result` | `TriageResult` | Severity, topic, topic_category, mentioned_medications |
| `retrieved_context` | `str` | Assembled health context string |
| `draft_response` | `str` | Chatbot's current draft |
| `critic_approved` | `bool` | Whether critic approved the draft |
| `critique` | `str` | Critic's feedback if not approved |
| `revision_count` | `int` | Number of revisions so far |
| `conversation_title` | `str` | Generated title for the conversation |

---

## File Structure

```
assistant/
├── graph.py              # Graph definition and compilation
├── state.py              # LangGraph State (Pydantic)
├── retrieval.py          # RxNorm + openFDA lookups for topic-driven retrieval
├── nodes/
│   ├── fanout            # (inline in graph.py)
│   ├── triage.py         # Urgency + topic classifier
│   ├── context_builder.py# Formats profile context + topic-driven retrieval
│   ├── chatbot.py        # Main response generator
│   ├── critic.py         # Safety reviewer
│   ├── streaming.py      # Commit node — appends the final AIMessage
│   ├── summarizer.py     # Conversation title generator
│   └── recommendations.py# Recommendations node (used by graphs/recommendations.py)
├── models/
│   ├── critic.py         # CriticResult (approved, critique)
│   ├── triage.py         # TriageResult (severity, topic, topic_category, mentioned_medications)
│   ├── health_profile.py
│   ├── vital_sign.py
│   ├── medications.py
│   ├── user.py
│   ├── conversations.py
│   └── recommendations.py
├── prompts/
│   └── chatbot_prompt.py # Base system prompt for chatbot
├── graphs/
│   └── recommendations.py# Separate graph for health recommendations
└── tools/
    └── update_instructions.py
```

---

## How to Use in the Terminal

```bash
cd backend
python cli_chat.py
```

Runs the full graph pipeline interactively with the same delivery policy as the API: `general`/`off_topic` answers stream token by token, `clinical`/`emergency` answers print whole after critic approval. No database required — conversation history is kept in memory for the session.
