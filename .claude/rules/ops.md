# Ops & Workflow Rules — MediMind

## Purpose

How Claude should behave during development, debugging, verification, and git operations in this repo.

---

## Running the full stack

Two terminals:

```bash
# 1 — backend (port 8000)
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 2 — frontend (port 3000)
cd frontend && npm start
```

One-time DB setup:

```bash
createdb medimind
cd backend && for f in migrations/*.sql; do psql $DATABASE_URL -f "$f"; done
```

AI-layer-only iteration (no web stack, no DB): `cd backend && python cli_chat.py`

---

## Git workflow

* NEVER commit on `main` — before committing, check the current branch:
  * On `main` → create a new branch first (`git checkout -b <type>/<short-description>`)
  * On a branch whose name doesn't match the current task → create a new branch for this task instead of mixing work
* Conventional commits: `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci)
* Group changes logically; never `git add .` across unrelated changes
* Commit/push only when asked; propose a commit plan first for multi-part changes

---

## Cross-file change checklists

* **Schema change** → new numbered migration + `app/models/` + `app/schemas/` + `assistant/models/` mirror + frontend service types
* **New endpoint** → route + schema + frontend service function + root README endpoint list
* **Graph change** → node + `state.py` + `assistant/README.md` (diagram and node table) + check against `AI_ARCHITECTURE_REVIEW.md`
* **New env var** → code + README env template

---

## Verification

* Backend: server boots clean, `http://localhost:8000/docs` loads, exercise the changed endpoint
* Frontend: `npm run build` passes (this is the typecheck — there's no separate lint setup beyond CRA defaults)
* AI changes: exercise via `python cli_chat.py` before wiring through the API
* LLM-calling tests cost real money — never run them unprompted

---

## Documentation discipline

* Update docs in the same change that invalidates them — doc drift is this repo's documented weakness
* Known existing drift (fix when touching the area, don't silently work around it):
  * README documents `POST /chat/messages`; the real endpoint is `POST /chat/stream`

---

## Safety flags — ask before

* Applying migrations or changing schema
* Auth/JWT changes
* Changing triage severities, critic strictness, or emergency-response behavior
* Adding any new dependency, service, or architectural pattern

---

## Change discipline

* Minimal surface area; no "while I'm here" refactors
* This is a learning project: when fixing something non-obvious, explain the why briefly (commit body or comment where a constraint isn't visible in code)
* Delete exploration code instead of leaving it — dead nodes/tools/state fields have misled work here before
