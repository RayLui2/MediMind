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

`chatbot → critic` is a conditional edge: if `critic_approved` is already `True` (set by `triage` for `general`/`off_topic` messages), the graph routes straight to `streaming`, skipping the critic LLM call entirely. Otherwise it goes to `critic` as normal, which can loop back to `chatbot` up to 2 times before auto-approving.

That same triage signal decides the **delivery mode** for the turn. The graph contains no transport — the caller (`AssistantService.stream_chat` or `cli_chat.py`) consumes `graph.astream_events(...)` and applies the policy: for `general`/`off_topic` turns (critic bypassed, nothing can veto the text) the chatbot's tokens are forwarded live as they generate; for `clinical`/`emergency` turns the critic must see the complete text before the user does, so the answer is delivered as one whole chunk after the `streaming` (commit) node runs.

---

## Nodes

### `fanout`
Pass-through entry point. Resets `critic_approved` and `revision_count` so each new message starts a fresh critic loop.

### `summarizer` *(parallel branch)*
Runs in parallel with `triage`. Generates a short conversation title (≤ 6 words + emoji) from the user's first message. Runs on the fast model tier (`GEMINI_MODEL_FAST`) — cheap labeling task. Skips if the conversation already has a title.

**Output:** `conversation_title`

### `triage` *(parallel branch)*
Classifies the urgency and topic of the user's message. Uses the user's health profile (conditions, medications, allergies) to escalate severity when relevant. Runs on the fast model tier (`GEMINI_MODEL_FAST`), validated by `evals/run_triage_eval.py` — 98% accuracy (51/52), 12/12 emergency recall, 0 over-escalations on the 52-case set (2026-07-14). Re-run the eval before changing this node's model or prompt.

**Severity levels:**
| Level | Meaning |
|---|---|
| `emergency` | Requires 911 / ER immediately |
| `clinical` | Needs a doctor soon |
| `general` | Health/wellness, no urgency |
| `off_topic` | Not health-related |

For `general` and `off_topic` messages, `critic_approved` is set to `True` immediately (skips the critic loop).

**Output:** `triage_result`, optionally `critic_approved: True`

### `context_builder`
Builds a personalized health context string from the user's profile. Includes all available data — conditions, allergies, medications, and vitals.

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

If the draft fails, it returns a one-sentence critique and the chatbot revises. Max **2 revision** (then auto-approved).

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
| `triage_result` | `TriageResult` | Severity + topic from triage node |
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
├── nodes/
│   ├── fanout            # (inline in graph.py)
│   ├── triage.py         # Urgency + topic classifier
│   ├── context_builder.py# Retrieves relevant health context
│   ├── chatbot.py        # Main response generator
│   ├── critic.py         # Safety reviewer
│   ├── streaming.py      # Commit node — appends the final AIMessage
│   ├── summarizer.py     # Conversation title generator
│   └── recommendations.py# Recommendations node (used by graphs/recommendations.py)
├── models/
│   ├── critic.py         # CriticResult (approved, critique)
│   ├── triage.py         # TriageResult (severity, topic)
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
