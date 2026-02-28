# @painful-dollar/server

Production backend skeleton for The Painful Dollar.

## Environment

Create `.env` with:

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
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## API Surface (v1)

- `POST /v1/auth/dev-login`
- `POST /v1/coach/respond`
- `POST /v1/checkins/window/start`
- `POST /v1/checkins/window/complete`
- `POST /v1/checkins/window/expire`
- `GET /v1/ledger`

Accountability/payment skeleton (iOS briefing aligned):
- `GET /v1/accountability/settings`
- `PUT /v1/accountability/settings`
- `POST /v1/accountability/goals/report`
- `POST /v1/accountability/payment/setup-session`
- `POST /v1/accountability/payment/confirm`
- `DELETE /v1/accountability/payment-method`
- `POST /v1/accountability/charges/run-due`
- `GET /v1/accountability/charge-history`

## Security Notes

- Window completion relies on signed short-lived window tokens.
- Ledger writes should be persisted in PostgreSQL and settled asynchronously.
- Replace in-memory repositories with database adapters before non-test use.
- Off-session charge routes currently simulate Stripe responses; wire real Stripe SetupIntent + PaymentIntent for production.
