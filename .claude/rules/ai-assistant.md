# AI Assistant Rules — MediMind

## Core principle

The LangGraph graph in `backend/assistant/` is the product's heart and the owner's primary learning vehicle. Changes here should be correct, measured, and explained — `AI_ARCHITECTURE_REVIEW.md` is the canonical list of known bugs, design issues, and the improvement roadmap. Read its §3 before touching any node.

---

## Graph shape

```
fanout → [summarizer ∥ triage] ; triage → context_builder → chatbot ⇄ critic (max 2 revisions) → streaming → END
```

* Wiring in `graph.py`; shared state in `state.py` (Pydantic); node logic in `nodes/`
* Second single-node graph: `graphs/recommendations.py` (request-scoped, needs a DB session)
* Invoked ONLY via `AssistantService` (`stream_chat`, `invoke_graph`, `generate_recommendations`)
* Dev loop without the web stack: `cd backend && python cli_chat.py`

---

## Graph rules

### Control flow

* Routing decisions live in EDGES (conditional edges), not in flags that nodes may or may not read — a state flag nothing reads fails silently
* Every cycle must have a guaranteed exit (`revision_count` cap is the existing pattern)

### State discipline

* `messages` uses the `add_messages` reducer — everything returned for it accumulates forever; know what merges before returning it
* Only ONE node should commit the final `AIMessage` to `messages` per turn — do not add more writers
* Every `Optional` state field can be `None` (new users have no profile/vitals/medications) — every node must handle that
* State annotations are the contract between nodes; fix a wrong annotation, don't code around it

### Persistence (current reality)

* NO checkpointer in production — `thread_id` in config is currently inert
* Conversation memory = last 10 messages loaded from the DB per request by `AssistantService`
* Don't assume graph state survives between turns; don't half-adopt the checkpointer — enabling it is a deliberate migration (see review §3.7)

---

## LLM call rules

* Model via `os.getenv("GEMINI_MODEL", "gemini-2.5-flash")` + `GEMINI_API_KEY` — never hardcode a model name in a node
* Structured outputs: Pydantic models with `Literal` types and `Field(description=...)` — descriptions double as prompt engineering; keep that pattern
* Structured output disables token streaming — never wrap a plain-text response in a single-string schema
* Per-node temperatures are deliberate (≈0.05 classifier / 0.2 generation & critique / 0.3 titles) — keep the distinction
* Prompts live in `prompts/` or node-local `generate_system_prompt` functions — not inline in graph wiring

---

## Safety rules (medical domain)

* Fail toward safety: triage errors escalate (default `clinical`), never default to `general`
* `emergency` responses must lead with 911/ER guidance — the critic enforces this; don't weaken its strictness levels without asking
* An evaluator must see the evidence it judges — the critic needs the user's question, not just the draft
* Changes trading safety strictness for latency/UX must be surfaced, not decided silently

---

## Quality bar for AI changes

* Prompt changes to triage or critic should come with a way to check them (even a handful of labeled examples) — "seems better" is not a measurement
* When the graph structure changes, update `backend/assistant/README.md` (diagram + node table) in the same change — doc drift is a documented problem here
* Tests that call the real Gemini API cost money: never run them unprompted

---

## Anti-patterns

* No transport concerns (SSE, queues) added inside nodes — the existing `asyncio.Queue` streaming node is a documented legacy exception (review §4.2), not a pattern to extend
* No DB access from chat-graph nodes; data enters through state built by `AssistantService`
* No module-level mutable state beyond what exists
* No dead exploration code left behind (empty node files, unused tools, unread state fields) — the repo has been burned by this before
