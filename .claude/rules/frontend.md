# Frontend Rules — MediMind

## Core principle

The frontend is a presentation layer. Business and safety logic live in the backend; the frontend renders, routes, and calls services.

---

## Running

```bash
cd frontend
npm start          # CRA dev server on http://localhost:3000
npm run build      # production build (also the de-facto typecheck)
```

* Build tool is **Create React App** (`react-scripts` 5) — NOT Vite, NOT Next.js
* Env vars must use the `REACT_APP_` prefix to be visible in code; the `NEXT_PUBLIC_*` vars in local `.env` are vestigial and unused — don't reference them
* React 19 + TypeScript (`strict: true`) + React Router 7 + axios + chart.js + react-markdown

---

## Structure rules

* `pages/` → route-level screens (PascalCase `.tsx`)
* `components/` → reusable UI (PascalCase)
* `services/` → API wrappers (camelCase, e.g. `authService.ts`)
* `context/` → React Context providers (`AuthContext` is the only state store)
* `styles/` → page-level CSS; prefer this folder for new page styles (placement is currently inconsistent — don't add a third convention)
* `data/` → static data; `assets/` → media
* All routes are declared in `App.tsx`; protected screens wrap in `ProtectedRoute` (+ `SetupProtectedRoute` for setup gating)

---

## API rules

* Backend base URL is currently hardcoded as `http://localhost:8000` separately in each service file — when adding calls, extend the existing service for that domain; do NOT hardcode another copy in a component
* Auth: JWT from `localStorage` (`token`), attached manually as `Authorization: Bearer <token>` per request — there are no axios interceptors; follow the pattern of the service file you're in
* Chat streaming uses raw `fetch` on `POST /chat/stream` in `Chat.tsx` (SSE — axios can't stream tokens); keep SSE on `fetch`
* Service style is mixed (class singletons in `authService`/`chatService`, plain functions in `dashboardService`) — match the file you're editing; don't convert styles as a side effect

---

## State & UI rules

* No state management library — React Context + hooks only; adding Redux/Zustand/TanStack Query requires asking first
* TypeScript strict mode: no `any`; types for API responses should mirror the backend Pydantic schemas
* Plain CSS files only — no Tailwind, no CSS-in-JS
* AI responses render through `react-markdown` — the backend emits markdown; don't strip or re-parse it

---

## Anti-patterns

* No fetch/axios calls inline in components for standard requests — go through `services/`
* No routing defined outside `App.tsx`
* No storing anything but the JWT in `localStorage`
* No new global CSS resets or frameworks
* Known dead code: the duplicate `/` route in `App.tsx` (second one never matches) — don't replicate the pattern
