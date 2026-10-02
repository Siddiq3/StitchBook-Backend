# Cashfree Payment Gateway setup

StitchBook uses Cashfree for prepaid plan purchases and customer order payments. Mobile subscription screens read entitlements; purchases take place on the website.

## Configure and migrate

1. Install backend dependencies using `npm ci`.
2. Apply the existing database migrations through 013, then run `npm run migrate:cashfree`. Do not rerun older payment schema migrations after 014. Historical references are preserved in provider-neutral columns. No migration is run automatically at startup.
3. Set `CASHFREE_ENV=sandbox`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_API_VERSION=2025-01-01` and `WEB_APP_URL` in the backend environment. Secrets never belong in the website or app environment.
4. Whitelist the website domain in Cashfree. Register `https://YOUR_API_HOST/api/webhooks/cashfree` for payment success events. The signature uses the Cashfree secret key and the exact raw request body plus `x-webhook-timestamp`.
5. Test in sandbox before switching to matched live credentials and `CASHFREE_ENV=production`. Production requires HTTPS for the website return URL.

## Checkout flow

Authenticated owners create an upgrade session with `POST /api/subscription/create-upgrade-session` (`plan`: basic/team/pro). The website uses its session URL, then `POST /api/subscription/upgrade-session/:sessionId/checkout` (`customerPhone` if the account has no phone). Cashfree requires a valid customer mobile number. Prices and ownership always come from the server.

The response includes `orderId`, `paymentSessionId`, `mode`, and the amount in **rupees**. Cashfree JS v3 opens modal checkout. The website confirms through `POST /api/subscription/upgrade-session/:sessionId/verify` with `cashfree_order_id`; neither modal completion nor a URL parameter grants access. The backend checks a PAID order and matching SUCCESS transaction, then activates the persisted plan exactly once.

Customer payments use `POST /api/payment/cashfree/create-order` with `orderId`, optional `amount`, and `customer` (name/email/phone). Open the returned checkout URL on the configured website. Public verification uses `POST /api/payment/cashfree/verify-payment` with `checkoutToken` and `cashfree_order_id`. Signed webhooks also record customer payments, including after the Redis token expires.

Upgrade intent ownership and customer checkout ownership are durable in PostgreSQL. Retries reconcile the same provider order; ambiguous creation attempts stay pending rather than charging a second order. Payment ledger IDs are namespaced with `cashfree:` to preserve historical payment references.

## Cutover

Finish or reconcile outstanding old-provider orders before cutover; existing old checkout links expire and cannot be completed through the new endpoints. Any historical recurring mandates must be cancelled in their original provider dashboard before retiring that account, because this implementation uses prepaid Cashfree orders only. Leave applied historical SQL migrations unchanged. Remove obsolete provider credentials from deployed environments after reconciliation.

## Verification

Run backend `npm test` and `npm run lint`, website `npm test` and `npm run build`, and mobile `npm test`. Database/Redis integration checks require isolated `TEST_DATABASE_URL` / `TEST_REDIS_URL`. Test sandbox success, failure, cancellation, redirects, duplicate callbacks, webhook retries and account ownership before enabling live payments.

References: [Cashfree web checkout](https://www.cashfree.com/docs/payments/online/web/redirect), [Create Order](https://www.cashfree.com/docs/api-reference/payments/v2025/orders/create-order), [Webhook verification](https://www.cashfree.com/devstudio/preview/pg/tools/webhookVerification).
