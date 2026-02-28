# Threat Model - The Painful Dollar

## Scope

This document covers the first production boundary for:
- authentication/session integrity,
- 10-minute accountability window enforcement,
- late-fee event creation and ledger correctness,
- social growth surfaces (referrals/squads/share cards).

## Assets

- User identity and session tokens.
- Accountability window state (`open`, `completed`, `expired`).
- Charge records and dispute metadata.
- Social graph and referral attribution.

## Trust Boundaries

- Client app is untrusted.
- API server is trusted policy engine.
- Database is trusted persistence with least-privilege credentials.
- External providers (notification/payment) are semi-trusted and must be verified by signed webhooks.

## Primary Threats

1. Fee evasion by client tampering.
- Mitigation: server-authoritative window state; signed, short-lived window token validation; append-only ledger.

2. Replay attacks on completion/charge endpoints.
- Mitigation: idempotency keys, nonce storage, endpoint-level rate limiting, strict token expiry checks.

3. Account takeover.
- Mitigation: robust auth provider, MFA for sensitive operations, anomalous device detection.

4. Referral/squad abuse.
- Mitigation: anti-fraud scoring, invitation throttles, duplicate-device heuristics.

5. Sensitive data exposure.
- Mitigation: encryption in transit and at rest, CSP/security headers, scoped access tokens, audit logs.

6. Minor safety/policy risk.
- Mitigation: age-aware controls, privacy defaults, abuse reporting, moderation response path.

## Security Requirements

- All policy decisions must be made server-side.
- Every financial decision must have deterministic reason codes.
- All charge writes must be idempotent and auditable.
- Logging must include request ID, user ID (if authenticated), and decision trace metadata.

## Validation & Testing Plan

- Unit tests: charge decision rules and window state transitions.
- Integration tests: auth + signed window lifecycle + ledger writes.
- Abuse tests: replay, rate-limit, forged token attempts.
- Operational drills: dispute resolution and rollback procedures.
