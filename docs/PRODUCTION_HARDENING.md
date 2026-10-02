# Production hardening operations

This revision is not a production deployment. Complete dependency installation, lint, clean installs and audits before releasing it. `package.json` contains pending patched overrides and ESLint; the lockfile is not yet regenerated for those additions because npm network approval is pending.

## Deployment order

1. Back up PostgreSQL and prove restoration in a disposable environment. Enable the hosting platform's backup/PITR policy, connection limits, encryption and retention. Existing PostgreSQL and Redis remain the application's storage architecture; no DynamoDB/AWS resources were introduced.
2. Review migration `src/migrations/012_production_hardening.sql` against the actual schema. Run `npm run migrate:hardening` in staging first, then explicitly in the intended production environment before deploying this revision. This command uses the configured database, so verify the destination. It is not an automatic startup migration.
3. Configure distinct strong JWT secrets, database and Redis connection strings, Google audiences, explicit HTTPS `FRONTEND_URLS`, HTTPS `WEB_APP_URL` and `BASE_URL`. Use TLS to PostgreSQL and Redis as supported by the actual host. Secrets belong in the host's secret store, never source control. Rotate previously exposed provider secrets through the provider console.
4. Apply `npm run migrate:cashfree` after the existing migrations, then configure `CASHFREE_ENV=production`, `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`. Sandbox keys are rejected under `NODE_ENV=production`. Register `/api/webhooks/cashfree`, preserving raw request bodies at the reverse proxy. Test provider callbacks in staging before live use. The product still uses prepaid plan purchases; no recurring billing model has been added.
5. Place browser and API on suitable HTTPS domains. Browser refresh uses an HttpOnly secure SameSite=None cookie and explicit origin/platform checks. Cross-site cookie blocking must be tested in supported browsers; prefer a same-site API domain when deploying. Native refresh keeps its existing JSON token contract.
6. Mount persistent private upload storage. The local filesystem is not durable on an ephemeral deployment. Prevent direct CDN/proxy exposure of `/uploads`; access is through signed short-lived paths. Do not place private uploads under a public static host. Flat tenant directories are required; unexpected nested directories fail cleanup safely and need operator review.
7. Check `/health` and `/live` for inexpensive liveness; use `/ready` for dependency readiness. Readiness is coalesced and cached for five seconds, with an in-memory limiter and generic failures.

## Checkout reconciliation

`billing_intents` stores a stable merchant order ID and creation-attempt flag before calling Cashfree. Retries fetch that same order ID. Creation uses a deterministic UUID idempotency key. A timeout with no visible provider result stays UNCERTAIN and cannot create another order. See [Cashfree Create Order](https://www.cashfree.com/docs/api-reference/payments/v2025/orders/create-order).

For an UNCERTAIN intent, inspect its stable receipt using the provider's authoritative records. Confirm order ownership, amount, INR currency and plan. Retry normally after the original appears. If no order can be found, require explicit operator reconciliation before resetting the attempted state; never blindly create another order. No automatic refund or manual provider action was executed here.

Payment activation and its durable payment ID marker commit in one PostgreSQL transaction. Webhook leases allow retries after crashes, and attempt generations prevent stale workers from finishing a newer attempt. Customer payment inserts, balances and activity also commit atomically. Existing plan amounts, durations and tailoring calculations are preserved.

## Account deletion

Initiation requires DELETE plus recent matching identity proof. A separate signed, hashed, seven-day capability resumes the job. Ordinary business access is blocked once deletion starts. Each request cleans one phase and at most 100 domain rows or files/session entries, returning 202 until final identity cleanup. Temporary infrastructure errors return 503, preserving the capability. A replaced/expired capability requires re-authentication. Staff deletion anonymizes pointers while preserving another owner's business records. Legacy recurring references, if present, are cancelled before removing their ownership.

Deletion after capability expiry, provider cancellation failure, unexpected directory structure, extreme account size and backup expiry require an operator procedure. Staging must exercise the full real schema and a disposable authenticated user. No production user or real file was deleted during validation. The database integration fixture refuses non-local databases and database names outside `stitchbook_test*` and mocks file deletion.

## Operational limits and observability

Set retention/cleanup for durable webhook and checkout records according to accounting and incident needs; the migration does not create a cleanup scheduler. Configure request/latency/error/checkout alarms in the existing host. JSON logs redact bearer tokens, cookies and nested secrets; do not enable SQL or full HTTP payload tracing containing customer data. Configure log retention and sampling at the host. Set maximum upload storage and reconcile provider outcomes manually when needed.

Existing list APIs and dashboard aggregation have not been benchmarked against production-scale data. Session listing refuses more than 100 entries instead of silently truncating. CI includes isolated PostgreSQL/Redis tests and strict audit/lint gates, but is unverified remotely and cannot pass until the pending lockfile work is completed.
