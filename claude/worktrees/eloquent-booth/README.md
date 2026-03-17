# The Painful Dollar

Chat-first accountability app with server-enforced 10-minute response windows and fee ledger logic.

## Structure

- `apps/web`: React + TypeScript web app (Vite)
- `apps/server`: Express + TypeScript backend skeleton (auth, signed windows, ledger)
- `packages/core`: Shared business logic (validation, scoring, prompts)

## Run (after Node.js 20+ is installed)

```bash
npm install
npm run dev:web
npm run dev:server
```

## Gen-AI coach setup (natural chat replies)

Create `/Users/pascal/Desktop/experimentation/apps/server/.env` with:

```bash
NODE_ENV=development
PORT=8787
AUTH_TOKEN_SECRET=replace-with-32-char-min-secret
WINDOW_TOKEN_SECRET=replace-with-32-char-min-secret
CORS_ORIGIN=http://localhost:5173
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
COACH_API_TIMEOUT_MS=4500
GRACE_MISSES_PER_MONTH=2
MONTHLY_CHARGE_CAP_CENTS=1500
```

Then run web + server together so chat can use `/v1/coach/respond`.

## Current Scope

- Morning check-in flow
- Priority quality validation
- Accountability score and streak tracking
- Signed check-in window backend skeleton
- Ledger and late-fee decision engine
- CI quality gates and threat-modeling docs
