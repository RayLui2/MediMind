# MediMind AI Architecture Review

A learning-focused review of the LangGraph assistant in `backend/assistant/`, written for someone building their first agent architecture. It covers what's done well, what's broken, what to improve, and lessons that carry over to future AI projects.

---

## TL;DR

**For a first LangGraph project, this is well above average.** Most first projects are a single prompt wrapped in one node. You built a multi-node graph with parallel branches, conditional routing, a self-correction loop, structured outputs, and a clean service layer — those are real agent-architecture patterns, applied in a domain (health) where they actually make sense.

The weaknesses were the classic first-project ones: a key optimization that silently never ran, "streaming" that was simulated rather than real, framework features (checkpointer) adopted halfway, transport concerns leaking into graph nodes, several crash paths on missing data, and no way to measure whether the AI components actually worked. Most of that list is now fixed (see §3 status markers) — real token streaming shipped, model routing landed, a triage eval exists, failure now escalates instead of defaulting to "fine" (§4.4), and LangSmith tracing is wired up (§4.6). What's left is a handful of dead files (§3.8), a pending critic-eval baseline (§4.5), and a real test suite (§4.8).

None of that diminishes the learning value — in fact, the bugs here are *exactly* the bugs that teach you the most about how LangGraph and LLM systems behave.

---

## 1. The Architecture (as built)

```
             ┌─────────┐
             │ fanout  │  resets critic state each turn
             └────┬────┘
        ┌─────────┴──────────┐         (parallel)
        ▼                    ▼
 ┌────────────┐       ┌────────────┐
 │ summarizer │       │   triage   │  severity: emergency/clinical/general/off_topic
 └─────┬──────┘       └─────┬──────┘
       │                    ▼
       │           ┌─────────────────┐
       │           │ context_builder │  assembles health context string
       │           └────────┬────────┘
       │                    ▼
       │           ┌─────────────────┐
       │           │     chatbot     │◄──┐
       │           └────────┬────────┘   │  revision loop
       │                    ▼            │  (max 2 retries)
       │           ┌─────────────────┐   │
       │           │     critic      │───┘
       │           └────────┬────────┘
       │                    ▼
       │           ┌─────────────────┐
       │           │    streaming    │  word-by-word into asyncio.Queue
       │           └────────┬────────┘
       └────────────────────┴──► END
```

- **State**: Pydantic `BaseModel` with `add_messages` reducer (`state.py`)
- **LLM**: Gemini 2.5 Flash for every node, per-node temperatures
- **Serving**: `AssistantService` runs the graph as a background task; SSE endpoint consumes a per-conversation `asyncio.Queue`
- **History**: last 10 messages loaded from PostgreSQL per request (no checkpointer in production)
- **Second graph**: single-node recommendations graph, created per-request with a DB session

---

## 2. What You Did Well

These are worth keeping and worth talking about in interviews.

### 2.1 You used the graph for what graphs are for
Parallel fanout (`summarizer` ∥ `triage`), a linear pipeline with a **cycle** (chatbot ⇄ critic), and a conditional edge to break the cycle. That's the core LangGraph vocabulary — most tutorials never get past a straight line. The revision loop with a hard cap (`revision_count >= 2`) shows you already understand the #1 rule of cyclic agent graphs: **every loop needs a guaranteed exit.**

### 2.2 Triage-first is the right design for this domain
Classifying severity *before* generating the answer, and injecting severity-specific instructions into the chatbot prompt (`chatbot.py:32-37`), is a genuinely good pattern. Even better: the triage prompt uses the user's conditions and medications to *escalate* severity ("dizzy" → clinical if diabetic, `triage.py:56-60`). That's context-aware classification — a real safety-engineering idea, not a toy.

### 2.3 The critic is the evaluator-optimizer pattern
Generate → evaluate → revise is a named, industry-standard pattern (sometimes called "reflection"). Applying it to a *safety* check in a medical assistant is exactly where it earns its cost. The severity-conditional strictness levels in the critic prompt (`critic.py:19-24`) are a nice touch.

### 2.4 Structured outputs, done idiomatically
`TriageResult` with a `Literal[...]` severity and descriptive `Field(description=...)` text is the right way to constrain an LLM classifier — the field descriptions double as prompt engineering. Same for `CriticResult` with its example-bearing critique description. This is best practice.

### 2.5 Deliberate per-node model configuration
Temperature 0.05 for the classifier, 0.2 for generation and critique, 0.3 for creative titles. Small thing, but it shows you're thinking about determinism vs. creativity per task rather than using one global setting.

### 2.6 Clean separation of concerns
- `nodes/`, `models/`, `prompts/`, `graphs/`, `tools/` — navigable structure
- `AssistantService` isolates FastAPI from LangGraph — routes never touch the graph directly
- Pydantic mirror models (`assistant/models/*`) decouple graph state from SQLAlchemy ORM objects, bridged with `model_validate`. Keeping ORM objects out of graph state is a real gotcha you avoided.

### 2.7 A CLI harness (`cli_chat.py`)
Being able to exercise the full graph without the web app or database is a professional habit. Most people can only test their agent through the UI, which makes iteration slow and debugging miserable.

### 2.8 Documentation with a diagram
The `assistant/README.md` with an ASCII graph diagram and node-by-node explanation is more documentation than most production codebases have. (It has drifted from the code — see §3.9 — but the instinct is right.)

---

## 3. Bugs Found (concrete, verified in code)

These are ordered roughly by how much they teach you.

### 3.1 The critic "skip" for general/off_topic messages never happens
**Status: ✅ Fixed** — a conditional edge (`route_critic` in `graph.py`) now sits between `chatbot` and `critic`. When `critic_approved` is already `True` (set by `triage` for `general`/`off_topic`), the graph routes straight to `streaming`, skipping the critic call entirely; otherwise it goes to `critic` as before.

`triage.py:97-98` sets `critic_approved: True` for `general`/`off_topic` messages, intending to skip the critic. But:

- The `chatbot → critic` edge is **unconditional** (`graph.py:77`), so the critic node always runs.
- `critic_node` never checks `state.critic_approved` (`critic.py:52` only checks `revision_count`), so it makes its LLM call and **overwrites** the flag with its own verdict.

Result: the flag triage sets is dead — every message pays the full critic LLM call. Your README documents the intended behavior, which means the optimization silently regressed (or was never wired up).

**Fix**: either a conditional edge after `chatbot` that routes straight to `streaming` when `critic_approved` is already true, or an early-return at the top of `critic_node`. The conditional edge is more idiomatic LangGraph — the *graph* should express the control flow, not hidden checks inside nodes.

**Lesson**: in graph frameworks, control flow lives in the edges. A state flag no edge or node reads is a no-op, and nothing warns you.

### 3.2 Streaming is simulated, and it destroys your markdown
**Status: ✅ Fixed** — `llmResponseStructure` is gone; `chatbot_node` (`chatbot.py`) now calls the plain LLM with `streaming=True` and returns raw `response.content` as `draft_response`. `assistant_service.stream_chat` consumes `astream_events` directly: for `general`/`off_topic` turns (where triage already set `critic_approved`, §3.1) it forwards the chatbot's real tokens live, filtered to `langgraph_node == "chatbot"`; for `clinical`/`emergency` turns it buffers and sends the critic-approved text as one chunk once the `streaming` commit node finishes. No `.split()`/rejoin, no markdown mangling — this is §4.1's "gate by severity" option, implemented.

Two compounding issues (historical — both resolved above):

1. `chatbot.py:60` wraps the response in `with_structured_output(llmResponseStructure)` — a Pydantic model whose only field is `content: str`. Structured output works via function-calling, which means **no plain text tokens ever stream from the LLM**. The `streaming=True` flag on the model (`chatbot.py:57`) buys you nothing. The whole response must complete before anything moves.
2. The streaming node then fakes it: `draft_response.split()` and re-joining with single spaces (`streaming.py:42-43`). `.split()` swallows **all newlines**. Your chatbot prompt explicitly demands markdown with blank lines between sections and numbered lists (`prompts/chatbot_prompt.py`) — and then the streaming node flattens every response to one long line. Because the API layer rebuilds `full_response` from these mangled chunks (`assistant_service.py:201-204`) and saves that to the DB (`chat.py:167-171`), the **stored** message loses its formatting too.

**Fix**: delete `llmResponseStructure` — a structured wrapper around a single string field has no benefit and real costs. Let the chatbot emit plain text and use LangGraph's native streaming (`astream_events` filtered to the chatbot node, or `stream_mode="messages"`). See §4.1 for how this interacts with the critic.

**Lesson**: structured output and token streaming are fundamentally in tension. Only pay for structure when you need actual structure.

### 3.3 `context_builder` crashes on missing data
**Status: ✅ Fixed** — `None` guards added for `health_profile`/`medications`/`vital_signs`, the unclosed-parenthesis vitals line is fixed and now actually includes the collected `vitals_lines` values, and `user_info` is preserved (`retrieved_context +=` instead of `=`).

`context_builder.py` dereferences optional state without guards:

- `health_profile.current_conditions` (line 66) → `AttributeError` if the user has no health profile
- `for m in medications` (line 74) → `TypeError` if `medications` is `None`
- `vital_signs.systolic_bp` (line 83) → `AttributeError` if the user has never logged vitals

A brand-new user who signs up and immediately opens the chat hits at least one of these. There are also two logic bugs in the same function:

- The vitals values are collected into `vitals_lines` but **never added to the output** — line 91 appends only a header fragment with an unclosed parenthesis: `f"Recent Vitals (recorded {recorded_str}"`.
- The `user_info` block built at lines 56-60 is assigned to `retrieved_context` and then **discarded** when line 93 reassigns `retrieved_context = "\n".join(parts)` (name/age never reach the prompt).

**Lesson**: nodes are functions of `Optional`-heavy state; write each node assuming every optional field is `None` and test that path. This is also the node with zero LLM calls — the easiest one in the whole graph to unit-test, and the one with the most bugs.

### 3.4 The `vital_signs` type annotation contradicts its usage
**Status: ✅ Fixed** — `state.py` now declares `vital_signs: Optional[VitalSign]` (singular), matching `assistant_service.py`'s assignment/`model_dump()` usage.

`state.py:43` declares `vital_signs: Optional[list[VitalSign]]` (a list), but `assistant_service.py:123` assigns a **single** `VitalSign`, and `context_builder.py:83` reads it as a single object. The service then feeds `vital_signs.model_dump()` (a dict) into a field typed as a list (`assistant_service.py:160`), which Pydantic validation on graph input should reject. Whichever path actually executes at runtime, at least one of these three sites is wrong.

**Fix**: the semantics are "latest vitals," so make it `Optional[VitalSign]` (singular) and align everything.

**Lesson**: with Pydantic state, the annotations *are* the contract between nodes. A wrong annotation is worse than none, because everyone downstream trusts it.

### 3.5 Duplicate (and phantom) assistant messages in graph state
**Status: ✅ Fixed** — `chatbot.py` no longer appends to `messages`/`chat_history`, it only returns `draft_response`. `streaming.py` remains the sole node that appends the final `AIMessage`.

Both `chatbot` (`chatbot.py:68`) and `streaming` (`streaming.py:52`) append an `AIMessage` to `messages`. With the `add_messages` reducer, both stick — so the final answer lands in state **twice**, and in a revision loop every *rejected draft* also lands in `messages`, meaning the chatbot sees its own rejected drafts as prior conversation turns while revising.

You're currently protected by an accident: no checkpointer is used, so state is rebuilt from the DB every turn and the polluted `messages` list dies with the request. The moment you enable the Postgres checkpointer you built support for, this becomes real conversation corruption.

**Fix**: only the streaming node (the "commit" point) should append to `messages`; the chatbot should write `draft_response` only.

**Lesson**: reducers accumulate. Every node must be written knowing what *merges* into state, not just what it returns. This is the single most common LangGraph bug in the wild.

### 3.6 The critic never sees the user's question
**Status: ✅ Fixed** — the critic now extracts the latest `HumanMessage` from `state.messages` and embeds it alongside the draft as quoted data in the human message, instead of framing the draft as a fake `AIMessage`.

`critic.py:69-73` sends the critic only the draft and an instruction. Its own checklist asks "COMPLETENESS — does the response address the user's question?" — impossible to judge without the question. Emergency-escalation checking has the same problem: it can't tell whether emergency framing was *warranted* without the actual message.

**Fix**: include the user's message (and ideally the last few turns) in the critic's input. Also embed the draft inside the human message as quoted data rather than sending it as an `AIMessage` — role-play framing where the critic "receives" someone else's AI message is confusing for models.

**Lesson**: an evaluator is only as good as its evidence. When you add a judge, explicitly enumerate what it needs to see to make each judgment on its checklist.

### 3.7 Checkpointing is half-adopted
**Status: ✅ Resolved** — checkpointer plumbing deleted; DB remains the source of truth (manual last-10-messages load). `thread_id` config, `compile_graph` checkpointer support, and the `langgraph-checkpoint-postgres` dependency removed.

- `compile_graph()` supports a checkpointer, but production compiles without one (`graph.py:112`)
- `thread_id` is passed in config on every invocation (`assistant_service.py:165`) — it does nothing without a checkpointer
- `langgraph-checkpoint-postgres` is pinned in `requirements.txt` but never imported
- The CLI passes a *new* `thread_id` per turn (`cli_chat.py:58`), which would break resume semantics if a checkpointer existed
- Meanwhile, actual persistence is a manual "load last 10 messages from the DB" (`assistant_service.py:68-71`)

So there are two competing persistence models, each ~50% implemented. The manual-DB approach **works** and is a legitimate choice — but then `thread_id`, the checkpointer plumbing, and the dependency are dead weight that misleads readers (your own project docs describe the checkpointer as if it were in use).

**Fix**: pick one. For this app I'd keep DB-as-source-of-truth (your messages table already drives the UI) and delete the checkpointer support, `thread_id` config, and the unused dependency. If you want to *learn* checkpointing, do it deliberately: compile with `PostgresSaver`, make `thread_id` the conversation id, stop re-loading history manually — and fix §3.5 first, or the checkpointer will faithfully persist your duplicated drafts.

### 3.8 Dead and broken auxiliary code
**Status: 🔶 Partially resolved** — `state.chat_history`, its reducer, and the `ChatMessage` model (`models/chat.py`) are deleted; nothing read them. The `get_rxcui_by_string` sketch was replaced by the real (async, fail-open) implementation in `assistant/retrieval.py` as part of §4.7. Still remaining: `safety.py`, `tools/update_instructions.py`, and a newly-identified straggler from the §3.7 checkpointer cleanup.

- `nodes/safety.py` — an empty file containing one comment
- `tools/update_instructions.py` — never imported anywhere; would crash if called (`response.instructions` doesn't exist on an `AIMessage`, declared return type `Command` doesn't match, `args_schema` says `dict` while the parameter says `List[str]`)
- ~~`get_rxcui_by_string` (`context_builder.py:12`) — called only from a commented-out line (`context_builder.py:48`)~~ replaced by `retrieval.py` (§4.7, 2026-07-14)
- `backend/tests/test_assistant_with_checkpoint.py` — orphaned by the §3.7 checkpointer removal: it builds state with a `chat_history` key that no longer exists on `State` (deleted in that same cleanup pass) and passes a `thread_id` config that's been inert since the checkpointer plumbing was removed, so it no longer tests what its name says. It's also not `pytest`-discoverable (`pytest` isn't installed, §4.8) and would make real Gemini calls if run — delete it, or fold an assertion-bearing version into the §4.8 test rebuild.

**Lesson**: exploration code is healthy; *shipping* it isn't. Delete scaffolding once the direction is chosen — in AI projects especially, dead prompts/tools/state fields actively mislead the next reader (including future you) about what the system does.

### 3.9 Documentation drift
**Status: ✅ Fixed** — `assistant/README.md` was rewritten to match the code: the graph is documented as living in `graph.py`, the conditional critic-skip edge is now both documented and actually implemented (via `route_critic` in `graph.py`, §3.1), and the state table is current. The residual `chat.py` reference in the file tree was corrected, the stale `README 2.md` duplicate was deleted, and the corresponding known-drift entry was removed from `.claude/rules/ops.md`.

`assistant/README.md` says the graph lives in `chat.py` (it's `graph.py`), and documents the critic-skip for general messages that doesn't actually happen (§3.1). Docs that describe intent rather than behavior are worse than no docs when debugging.

**Tip**: LangGraph can generate the diagram from the real graph — `graph.get_graph().draw_mermaid()` — so the picture can never lie.

### 3.10 Smaller issues, briefly
**Status: ✅ Fixed** — module loggers (`logging.getLogger(__name__)`) replace every `print()`/`traceback.print_exc()`, with `logging.basicConfig(level=INFO)` in `main.py`/`cli_chat.py` so uvicorn's handler-less root logger still surfaces them; a graph failure in `stream_chat` now pushes an `{"type": "error"}` item into the streaming queue so the SSE consumer fails fast instead of waiting out the 60 s `wait_for` timeout; the new `assistant/llm.py:get_llm(temperature=...)` factory removes the duplicated `load_dotenv()`/`init_chat_model(...)` boilerplate across the nodes; the unused `topic_lower` line in `context_builder` is deleted; and `None` (not the `"New Chat"` magic sentinel) now means "not yet titled" end-to-end, with a display fallback in the frontend.

- `print()` debugging in every node instead of `logging` — you can't control verbosity or ship this
- No error handling in nodes: a Gemini rate-limit anywhere kills the run, and if it dies before the streaming node, the queue never receives `"end"` — the SSE consumer sits the full 60 s timeout (`assistant_service.py:199`) before noticing. Push an error event into the queue from a `try/finally`, or `asyncio.wait` on both the queue and the graph task.
- `load_dotenv()` + `init_chat_model(...)` boilerplate duplicated across six files — one `get_llm(temperature=...)` factory would remove it all
- `context_builder` computes `topic_lower` (`context_builder.py:50`) and never uses it — the triage topic *should* drive what context gets retrieved; that's the whole point of running triage first
- `conversation_title = "New Chat"` as a magic sentinel string — `None` says "not yet titled" without inventing an in-band value

---

## 4. Design-Level Improvements (ranked by learning value)

### 4.1 Resolve the streaming ↔ critic tension deliberately
**Status: ✅ Done** — option 1 (gate by severity) is implemented. `assistant_service.stream_chat` reads `critic_approved` off the `triage` node's output the moment it finishes: `general`/`off_topic` turns forward the chatbot's real tokens live via `astream_events`; `clinical`/`emergency` turns stay buffered until the critic-approved draft is committed by the `streaming` node, then go out as one chunk. Nothing reaches the wire that the critic could still veto.

This was the most interesting architectural problem in the project. You cannot both (a) stream tokens live to the user and (b) have a critic veto the response after generation — once tokens are on the wire, there's nothing to veto. Real systems pick one of:

1. **Gate by severity** *(implemented)*: `general`/`off_topic` messages stream directly from the chatbot LLM (real tokens, real latency win); `clinical`/`emergency` messages go through the critic and are delivered after approval. Emergencies are short responses anyway; the buffering cost is low exactly where the safety value is high.
2. **Stream the draft, verify after**: show the response immediately, run the critic in parallel, and visibly correct/retract if it fails. Good UX, complex UI — not pursued here.
3. **Buffer everything**: simplest, safest, slowest — the design before this fix.

### 4.2 Get transport out of the graph
**Status: ✅ Done** — the global `_streaming_queues` dict is gone. `streaming.py` is now a pure commit node: it only appends the approved `draft_response` to `messages` and returns, with no knowledge of SSE, queues, or who's listening. `assistant_service.stream_chat` owns delivery entirely by watching `astream_events` from the caller side (§4.1), so the graph is a function of state → state and survives multiple `uvicorn` workers without shared in-process state.

The old design: a global `_streaming_queues` dict (`streaming.py:14`) made a graph node aware of the delivery mechanism — it broke under `uvicorn --workers 2+` (each process had its own dict), raced if one conversation got two concurrent messages (both runs shared a queue), and leaked queues when a consumer died before `cleanup`.

### 4.3 Route models by task
**Status: ✅ Done** — `get_llm(tier="fast")` routes `triage` and `summarizer` to `GEMINI_MODEL_FAST` (default `gemini-3.1-flash-lite`); chatbot/critic/recommendations stay on the standard tier. Validated first via the §4.5 triage eval (97% accuracy, 7/7 emergency recall, 0 over-escalations, 2026-07-14). Bonus discovered en route: free-tier quotas are per model (flash: 5 req/min, 20 req/day observed), so the split also roughly doubles usable capacity.
Every node uses the same Gemini 2.5 Flash. Triage and title generation are cheap classification/labeling tasks — a smaller/faster tier (e.g., a flash-lite class model) does them fine. Your worst case today is **7 serial LLM calls** for one message (triage → chatbot → critic → chatbot → critic → chatbot → critic); minimum is 3. Cheap-model routing plus §4.1 turns the common path into "1 fast classify + 1 streamed generation." Model routing is a core production skill and easy to add since you already have per-node factories.

### 4.4 Make failure safe, not just handled
**Status: ✅ Done** (2026-07-14) — both classifiers now have an explicit per-node failure policy. **Triage**: the LLM call is wrapped; any error (including structured-output parse failures) returns `TriageResult(severity="clinical", topic="unclassified (triage error)")` — escalate, never `general`, so the critic stays in the loop and the chatbot prompts professional evaluation. **Critic**: a module-level `EMERGENCY_FALLBACK_RESPONSE` (leads with the 911/ER instruction) ships instead of the draft whenever an `emergency` turn would otherwise exit unsafely: critic LLM error, rejection that hits the `revision_count >= 2` cap, cap-entry with an unapproved draft, or no draft at the cap. On critic error at lower severities the draft ships unreviewed (it was generated with the severity-aware prompt; looping against a broken critic would burn calls and land in the same place). Verified with 13 mocked-LLM cases covering every branch — no API calls.
For most apps error handling means "don't crash." In a triage system it means **fail toward safety**: if the triage LLM call errors or returns garbage, default the severity to `clinical` (escalate), never `general`. If the critic errors on an `emergency` message, don't auto-approve. Right now `revision_count >= 2` auto-approves even emergency drafts the critic rejected twice — consider a fallback template response for that case ("I'm having trouble right now — if this is an emergency, call 911") rather than shipping a twice-rejected draft. Designing the *failure policy* per node is what makes an AI system trustworthy.

### 4.5 Build an eval before touching another prompt
**Status: ✅ Done** — both evals exist in `backend/evals/`. **Triage**: 52 labeled cases (grown from 30 on 2026-07-14) incl. profile-escalation pairs and adversarial traps; runner reports accuracy, emergency recall, over-escalation, confusion table; gates on 100% recall. Fully baselined on `gemini-3.1-flash-lite` (2026-07-14, run in two chunks): 51/52 accuracy (98%), 12/12 emergency recall, 0 over-escalations. Re-baselined same day after the §4.7 schema extension (topic_category + mentioned_medications): 52/52 accuracy (100%), 12/12 emergency recall, 0 over-escalations, plus first report-only numbers — topic-category accuracy 52/52, mention extraction 4/5 (the miss: a profile med included in mentions; benign, `context_builder` merges and dedupes profile meds anyway). **Critic**: 24 labeled (message, draft) pairs — 12 unsafe drafts with planted flaws (missing 911 lead, contraindications vs. profile, dangerous dosing, misinformation, completeness failures), 12 clean drafts incl. false-positive traps; `run_critic_eval.py` runs the real critic node with context built by the real `context_builder`, gates on 100% rejection recall and ≥80% clean-approval (false rejections = wasted revision loops). Iteration pass on `gemini-3.1-flash-lite`: 24/24 — 12/12 unsafe drafts rejected (each critique names the planted flaw), 12/12 clean drafts approved incl. both false-positive traps (2026-07-14). Still pending: the baseline on the production model — the critic runs on the standard tier (flash: 20 req/day), so that run needs two daily chunks (`--limit 18` / `--start 19`).
You have two LLM classifiers (triage, critic) and no way to know if they work. This is the single highest-leverage next step:

- Write ~50 labeled messages (`"crushing chest pain"` → `emergency`, `"what's a good breakfast"` → `general`, ambiguous ones too — with and without relevant conditions in the profile, since profile-aware escalation is your headline feature)
- A pytest that runs them through the triage node and asserts accuracy ≥ some threshold; track emergency-recall separately (missing an emergency is the failure that matters)
- Same idea for the critic: drafts with planted contraindications it must catch, clean drafts it must approve (false-positive rate = wasted revision loops = latency)

Once this exists, prompt changes become measurable engineering instead of vibes. **Eval-driven development is the defining skill of AI engineering** — having a committed eval suite in a resume project is genuinely differentiating.

### 4.6 Add tracing
**Status: ✅ Done** (2026-07-14) — LangSmith wired up via `LANGSMITH_TRACING`/`LANGSMITH_API_KEY`/`LANGSMITH_PROJECT`/`LANGSMITH_ENDPOINT` in `backend/.env` (documented in the README env template). No code changes needed: every LLM call already goes through `get_llm()` → `init_chat_model()`, which `langchain-core` instruments automatically once those env vars are set (`langsmith` ships as its transitive dependency — nothing new to add to `requirements.txt`). Verified with a live `cli_chat.py` run against the `medimind-dev` project: the trace shows the full per-node state (triage → context_builder → chatbot → critic) with latency and token counts, confirming the tool would have caught §3.1 immediately had it existed then.

One env var's worth of setup for LangSmith (or self-hosted Langfuse) gives you per-node latency, token counts, full prompt/response inspection, and revision-loop visibility. You cannot debug or optimize a multi-LLM pipeline from `print()` statements. This would have caught §3.1 immediately — you'd have seen critic calls on every general message.

### 4.7 Make `context_builder` do what its name promises
**Status: 🔶 Medication slice done** (2026-07-14) — triage now emits a routable `topic_category` (Literal enum; free-text `topic` kept for prompt richness) plus `mentioned_medications` extracted from the message, and `context_builder` routes on it: `medication` questions trigger RxNorm lookups (`assistant/retrieval.py`, async httpx) that resolve rxcuis for the user's meds + mentioned drugs and fetch pairwise interaction flags into `retrieved_context` — seen by both chatbot and critic. Fail-open with a "don't claim interactions were checked" guard note; triage *errors* (`topic_category: unclassified`) also trigger the lookup over the user's med list, since the unclassified question might be about meds. Both eval datasets are labeled for the new fields (report-only metrics; severity gates unchanged). Interaction source (swapped 2026-07-14): NLM discontinued the RxNav interaction endpoint (2024) with no official replacement, so `retrieval.py` now resolves each med to ingredient names via RxNorm (still live — normalizes "Advil" → "ibuprofen") and scans each drug's openFDA label `drug_interactions` section for mentions of the other drugs. Matching is name-level (a label saying only "NSAIDs" won't flag ibuprofen); the context section states that limitation rather than implying a complete check. Verified live: Coumadin+ibuprofen and warfarin+fluconazole flag bidirectionally; unresolvable names and all-OTC label misses fall back to the guard note. Still open: condition/symptom retrieval routes, and the severity-eval re-baseline after the schema change.

Today it formats data already in state. The design *wants* to be retrieval: use `triage_result.topic` to fetch relevant material — your sketched RxNorm integration for medication questions, condition info for chronic-disease topics. That turns the project from "prompt with profile pasted in" into a real RAG-adjacent architecture, and gives the triage topic (currently unused downstream) a job.

### 4.8 Real tests
`tests/test_assistant.py` streams a response and prints it — no assertions, and it costs an API call. Structure instead as: **unit tests** for pure logic with no LLM (context formatting §3.3, routing function, state reducers — these would have caught most bugs in this review), **mocked-LLM tests** for node behavior (critic rejection increments `revision_count`, triage output routes correctly), and the **eval suite** (§4.5) as a separate, deliberately-run job since it costs money.

---

## 5. How Good Is This for a First Project?

**Honest calibration: strong.** Concretely:

| Dimension | Typical first LangGraph project | Yours |
|---|---|---|
| Graph structure | Single node, linear at best | Parallel branches, cycle with exit condition, conditional routing |
| Output handling | Raw strings | Structured outputs with typed schemas |
| Safety design | None | Triage + severity-aware prompting + critic loop |
| Serving | `invoke()` in a route handler | Service layer, SSE, background task + queue |
| Dev tooling | Notebook | CLI harness, README with diagram |
| Weak spots (original) | Everything | Dead code, no evals, simulated streaming, unguarded optionals |
| Weak spots (current) | — | A few dead files (§3.8), critic eval baseline pending + broader test suite still open (§4.5, §4.8) |

What it demonstrates to a reader of your resume: you can decompose an AI product into specialized LLM roles, wire non-trivial control flow, and think about safety in a regulated-ish domain. Real token streaming shipped (§3.2/§4.1) and a triage eval with numbers exists (§4.5: 100% accuracy, 12/12 emergency recall on the 52-case set, `gemini-3.1-flash-lite`, post-§4.7 re-baseline). Fail-toward-safety is closed too (§4.4: triage errors escalate to `clinical`, unapproved emergency drafts are replaced by a 911-first fallback) — that one actually matters for a *safety* story, not just a resume line. LangSmith tracing is wired up and verified (§4.6). What's left to go from "promising" to "impressive": baseline numbers for the critic eval built in §4.5.

---

## 6. Mistakes to Not Repeat (portable lessons)

The generalized versions of everything above — these apply to any AI system you build next:

1. **Control flow lives in the graph, not in flags.** If a state field is supposed to change behavior, an edge must read it. Trace every flag from writer to reader; a flag nobody reads fails silently (§3.1).
2. **Structured output kills streaming.** Function-calling-based structure means no incremental text. Decide per-call: do I need structure or latency? Never wrap a single string field in a schema (§3.2).
3. **Decide guardrail placement before building the pipeline.** "Stream live" and "veto after generation" are mutually exclusive; picking late means rework (§4.1).
4. **Nodes must respect the reducer.** Anything a node returns for an accumulating field is *appended forever*. Ask "what does state look like after 3 loop iterations?" for every node in a cycle (§3.5).
5. **Adopt framework features whole or not at all.** A checkpointer dependency + `thread_id` config with no checkpointer is worse than nothing: it documents a lie (§3.7).
6. **No in-process global state in a served app.** Module-level dicts/queues break at 2 workers. If two copies of your process can't run side by side, the design is wrong (§4.2).
7. **Every LLM call must justify its latency, and every classifier needs a measurement.** Adding a judge/critic/router is easy; knowing its accuracy and cost is the actual work (§4.3, §4.5).
8. **Fail toward safety in high-stakes classifiers.** Error → escalate, never → "fine" (§4.4).
9. **Evals before prompt tweaks; tracing before debugging.** Without them you're doing folklore, not engineering (§4.5, §4.6).
10. **Optional state means every node handles `None`.** The node with no LLM calls is the cheapest to test — test it (§3.3).
11. **Delete exploration code before it fossilizes.** Dead tools, empty node files, and unread state fields mislead everyone who reads the repo after you — including you (§3.8).
12. **Docs drift; generate what you can.** Derive diagrams from the compiled graph, keep prompt docs next to prompts (§3.9).
13. **One more for the future — data privacy is architecture.** You're sending health data to a third-party LLM API. Fine for a portfolio project, but know the vocabulary: data minimization (send only fields the task needs — your triage prompt does this well already), PII redaction layers, and that real healthcare products require BAAs/HIPAA-compliant endpoints. Being able to *say this unprompted* in an interview matters.

---

## 7. Suggested Order of Work

Original plan, for reference — everything is done except item 4 (dead code):

1. ~~Fix the critic skip with a conditional edge after `chatbot` (§3.1)~~ — done
2. ~~Fix `context_builder` (`None` guards, lost vitals/user-info, the type annotation) and unit-test it (§3.3, §3.4)~~ — done (unit tests for it are still covered by the broader §4.8 gap)
3. ~~Real streaming: drop `llmResponseStructure`, stream general/off_topic responses directly via `astream_events`, keep critic-gating for clinical/emergency (§3.2, §4.1)~~ — done
4. **Delete the dead code** — `safety.py`, `tools/update_instructions.py`, and the now-orphaned `test_assistant_with_checkpoint.py` (§3.8; `get_rxcui_by_string` was replaced by `retrieval.py` in §4.7)
5. ~~Model routing for triage/summarizer (§4.3)~~ — done
6. ~~Grow the eval set and add a critic eval (§4.5)~~ — done 2026-07-14 (triage grown to 52 cases, 24-case critic eval built; baseline runs still pending, see below)
7. ~~Add tracing (§4.6)~~ — done 2026-07-14 (LangSmith, verified via `cli_chat.py`)
8. ~~Topic-driven retrieval in `context_builder` (§4.7)~~ — medication slice done 2026-07-14 (topic_category routing + RxNorm/openFDA via `retrieval.py`; interaction source swapped from the discontinued RxNav endpoint to openFDA labels the same day; condition/symptom routes still open)

### What's actually left, in priority order

1. **Delete the dead code (§3.8)** — quick, low-risk cleanup: `safety.py`, `tools/update_instructions.py`, `test_assistant_with_checkpoint.py`.
2. **Run the critic eval baseline on the production model (§4.5)** — no code, just quota-gated runs of `run_critic_eval.py` on flash, chunked across two days (`--limit 18` / `--start 19`). The flash-lite iteration pass is already perfect (24/24, 2026-07-14), so this is confirmation on the model the critic actually uses. (Triage is fully re-baselined post-§4.7: 52/52, 12/12 emergency recall, category accuracy 52/52.)
3. **Real test suite (§4.8)** — add `pytest` to `requirements.txt`, replace the print-and-eyeball scripts in `backend/tests/` with unit + mocked-LLM tests.
4. **Extend retrieval beyond medications (§4.7)** — condition/symptom routes (e.g. MedlinePlus Connect). (The RxNav→openFDA interaction-source swap is done, 2026-07-14.)

---

*Review based on the code as of commit `4e8c75b`. Line numbers reference the current files; they'll drift as you edit.*
