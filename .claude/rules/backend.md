# Backend Rules — MediMind

## Core principle

FastAPI = thin transport layer.
Services = business logic.
SQLAlchemy + PostgreSQL = persistence.
`backend/assistant/` = AI layer (see `ai-assistant.md`).

---

## Running

```bash
cd backend
source venv/bin/activate                # Python 3.12 venv (rebuilt 2026-07; 3.12 is also the syntax baseline)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API at `http://localhost:8000`, interactive docs at `/docs`.
CORS is hardcoded in `app/main.py` to allow only `http://localhost:3000`.

---

## Structure rules

### Routes (`app/routes/`)

* Must only: parse input, check auth, call service/query, return response
* `HTTPException` lives here, not in services
* One router per domain with its own `APIRouter(prefix=..., tags=[...])`, wired in `app/main.py`
* Auth via `HTTPBearer()` + `get_current_user` dependency — import it from `app/routes/auth.py`; do NOT add another local copy (`chat.py` already has a duplicate; don't make it three)

### Services (`app/services/`)

* All business logic and every LLM interaction lives here
* `assistant_service.py` is the ONLY gateway to the LangGraph graph

### Models & schemas

* SQLAlchemy models in `app/models/`, one file per table, inherit `app.database.Base`, explicit `back_populates` relationships
* Pydantic v2 schemas in `app/schemas/`, `from_attributes = True` for ORM responses, `json_schema_extra` examples
* `assistant/models/` are Pydantic mirrors for graph state — keep them in sync when a table changes; never put ORM objects in graph state

---

## Data rules

* EVERY user-facing query filters by `user_id` — no exceptions
* DB sessions only via `Depends(get_db)`; no session creation in routes
* Passwords: passlib/bcrypt only; tokens: python-jose HS256

---

## Migrations

* Raw SQL files in `backend/migrations/`, numbered `NNN_description.sql`, idempotent (`CREATE TABLE IF NOT EXISTS`)
* No Alembic — applied manually: `for f in migrations/*.sql; do psql $DATABASE_URL -f "$f"; done`
* Append-only: never edit or reorder an existing migration; add a new numbered file
* Schema change checklist: new migration + `app/models/` + `app/schemas/` + `assistant/models/` mirror (if the graph uses it)

---

## Environment

Read via `os.getenv` + `python-dotenv` from `backend/.env` (gitignored, no `.env.example` exists — the root README's env section is the template):

* `DATABASE_URL` — PostgreSQL connection string
* `SECRET_KEY`, `ALGORITHM` (HS256), `ACCESS_TOKEN_EXPIRE_MINUTES` (default 30)
* `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash`)

Adding a new env var → also add it to the README env template.
`VITAL_*` vars in local `.env` files are vestigial/unused — don't build on them.

---

## Python constraints

* Target Python 3.12 (the venv's interpreter) — modern syntax (`X | None`, `list[str]`, `match`) is fine in new code; leave existing 3.9-style annotations alone rather than mass-rewriting them (baseline moved from 3.9 on 2026-07-14)
* Async: routes and graph nodes are `async def`; use `ainvoke`/`astream_events` for LLM calls in async context

---

## Testing (current reality)

* `pytest` is NOT installed and not in `requirements.txt` — `pytest` commands fail today
* `tests/` files are mostly scripts run as `python tests/test_x.py`; several make REAL Gemini API calls — never run those unprompted
* If adding real tests: add `pytest` to `requirements.txt` first, write `def test_*` functions with assertions, mock the LLM

---

## Anti-patterns

* No business logic or raw SQL in routes
* No direct Gemini/LangChain calls outside `assistant/` nodes and services
* No new copies of `get_current_user`
* Don't build on scaffolding endpoints: `GET /test-db` is leftover; `GET /health` doesn't actually check the DB
