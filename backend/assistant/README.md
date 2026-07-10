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

---

## Nodes

### `fanout`
Pass-through entry point. Resets `critic_approved` and `revision_count` so each new message starts a fresh critic loop.

### `summarizer` *(parallel branch)*
Runs in parallel with `triage`. Generates a short conversation title (≤ 6 words + emoji) from the user's first message using Gemini. Skips if the conversation already has a title.

**Output:** `conversation_title`

### `triage` *(parallel branch)*
Classifies the urgency and topic of the user's message. Uses the user's health profile (conditions, medications, allergies) to escalate severity when relevant.

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

**Output:** `critic_approved`, `critique`, `revision_count`

### `streaming`
Emits the approved `draft_response` token by token into an `asyncio.Queue` keyed by `conversation_id`. The API layer (SSE) or CLI consumes this queue and sends tokens to the client in real time.

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
│   ├── fanout            # (inline in chat.py)
│   ├── triage.py         # Urgency + topic classifier
│   ├── context_builder.py# Retrieves relevant health context
│   ├── chatbot.py        # Main response generator
│   ├── critic.py         # Safety reviewer
│   ├── streaming.py      # Token streaming via asyncio.Queue
│   └── summarizer.py     # Conversation title generator
├── models/
│   ├── critic.py         # CriticResult (approved, critique)
│   ├── triage.py         # TriageResult (severity, topic)
│   ├── health_profile.py
│   ├── vital_sign.py
│   ├── medications.py
│   ├── user.py
│   └── conversations.py
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

Runs the full graph pipeline interactively. Streams tokens to the terminal as the streaming node emits them. No database required — conversation history is kept in memory for the session.
