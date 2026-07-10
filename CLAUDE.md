# CLAUDE.md — MediMind

This file defines how Claude Code should behave in this repository. It does not describe the system architecture — that lives in `backend/assistant/README.md`, `AI_ARCHITECTURE_REVIEW.md`, and the root `README.md`.

---

## Core principle

MediMind is a self-built portfolio project: an AI health assistant (FastAPI + LangGraph + Gemini backend, React 19 + TypeScript frontend, PostgreSQL). It exists to practice and demonstrate AI architecture skills.

Claude must prioritize:

1. Correctness over completeness
2. Existing patterns over new abstractions
3. Safety behavior (medical domain) over convenience
4. Teaching value — explain the *why* behind non-obvious choices, the owner is learning

Never guess architecture. Verify against the code and the documents below.

---

## Source of truth hierarchy

When in doubt, follow this order:

1. `backend/migrations/*.sql` → database schema truth
2. The codebase implementation
3. `AI_ARCHITECTURE_REVIEW.md` → known bugs, design issues, and planned improvements for the AI layer
4. `backend/assistant/README.md` → AI graph *intent* (has known drift from the code — trust `graph.py` over the diagram when they disagree)
5. Root `README.md` → setup and commands (has known drift: documents `POST /chat/messages` but the real endpoint is `POST /chat/stream`; documents `CORS_ORIGINS` env var that no code reads)
6. This file (behavior rules only)

---

## Repo mental model

* `backend/app/` = FastAPI: thin routes → services → SQLAlchemy → PostgreSQL
* `backend/assistant/` = LangGraph AI layer; invoked ONLY through `AssistantService`
* `frontend/` = Create React App (NOT Vite/Next.js): pages + services, React Context for state
* Auth = JWT (python-jose) issued by backend, stored in `localStorage`, attached manually per request
* Streaming = SSE from `POST /chat/stream`, consumed with raw `fetch` on the frontend

---

## Global rules for Claude

### Always

* Filter every user-facing DB query by `user_id` — user isolation is non-negotiable
* Keep Python 3.9-compatible syntax (`Optional[X]`, not `X | None`; no `match`)
* Follow the existing pattern in the file you're editing before introducing a new one
* Route all LLM calls through the LangGraph nodes / `AssistantService` layer
* Check `AI_ARCHITECTURE_REVIEW.md` §3 before modifying anything in `backend/assistant/` — the known bugs and their fixes are documented there

### Never

* Bypass the service layer to call Gemini from a route
* Commit `.env` files or secrets (live keys exist in local `.env` files)
* Modify or reorder existing files in `backend/migrations/` — append new numbered ones
* Reintroduce a bug documented as fixed in `AI_ARCHITECTURE_REVIEW.md`
* Run tests that hit the real Gemini API without being asked — they cost money

---

## Critical invariants

These must NEVER be broken:

* Every conversation/message/health-data query is scoped to the authenticated user
* All non-auth endpoints require a valid JWT (`get_current_user` dependency)
* Emergency-severity triage responses lead with 911/ER guidance before anything else
* The chatbot ⇄ critic revision loop has a hard exit (`revision_count` cap) — every cycle in the graph must have one
* Triage failure falls toward safety: on error, escalate severity, never default to `general`

---

## File navigation guidance

If unsure where logic lives:

* `backend/app/routes/` → HTTP layer only (auth, chat, dashboard)
* `backend/app/services/` → business logic; `assistant_service.py` is the graph gateway
* `backend/app/models/` → SQLAlchemy ORM (one file per table)
* `backend/app/schemas/` → Pydantic request/response models
* `backend/assistant/graph.py` → graph wiring; `nodes/` → node logic; `state.py` → shared state
* `frontend/src/pages/` → route screens; `services/` → API wrappers; `context/` → auth state
* `.claude/rules/` → domain-specific mechanics (backend, ai-assistant, frontend, ops)

---

## Debugging approach

When fixing issues:

1. Identify the layer (frontend / API / service / graph node / DB)
2. For AI issues, trace state through the graph: fanout → triage → context_builder → chatbot → critic → streaming
3. Check `AI_ARCHITECTURE_REVIEW.md` — the bug may already be documented with a fix
4. Reproduce before fixing (`python cli_chat.py` exercises the full graph without the web stack)

---

## Safety rule

Ask before changing:

* database schema (new migration)
* auth/JWT behavior
* triage severity definitions, critic strictness, or anything that gates medical safety behavior
* adding any new dependency, state library, or architectural pattern

This is a health assistant. When a change trades safety strictness for UX or latency, surface the trade-off — don't decide it silently.
