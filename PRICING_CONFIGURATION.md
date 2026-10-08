# Change subscription prices from GitHub

The backend is the source for both the website's displayed prices and Cashfree subscription checkout. Defaults remain Basic ₹299, Team ₹399 and Pro ₹599 per month. This does not change staff limits, features or existing entitlement dates.

## One-time setup (after merging and deploying the backend, then web PR)

In **Siddiq3/StitchBook-Backend → Settings → Secrets and variables → Actions → Variables**, add repository variables:

| Name | Initial value |
| --- | --- |
| `BASIC_PLAN_PRICE` | `299` |
| `TEAM_PLAN_PRICE` | `399` |
| `PRO_PLAN_PRICE` | `599` |
| `RENDER_SERVICE_ID` | The backend's service ID, starting with `srv-` |

In **Actions → Secrets**, add `RENDER_API_KEY` with a Render API key authorized for that service. Never put this key in a `VITE_` variable, source code or website settings. These account settings are not created by the PR.

## Each price change

1. Edit the three repository price variables as needed. Enter rupees only, without ₹ or commas; two decimal places are supported. Allowed values: 1 through 100000.
2. Open **Actions → Publish subscription prices → Run workflow**, selecting `main`.
3. The workflow validates all three values, saves one atomic `SUBSCRIPTION_PRICES_JSON` environment variable on Render, then requests a deployment. It leaves every unrelated environment variable intact.
4. Wait for the Render deployment to become live. A green publishing workflow means the deployment was requested, not that the deployment has completed.
5. Verify `GET /api/subscription/plans` on the backend and reload the website. Catalog responses and browser reuse each have a 60-second cache lifetime. No Vercel rebuild is needed for subsequent price changes.

Editing a GitHub variable alone does not publish anything. Re-run the workflow to retry a failed deployment or publish another change. To roll back, restore the old variables and run it again.

If using Render directly instead, set `SUBSCRIPTION_PRICES_JSON` to `{"basic":299,"team":399,"pro":599}` and deploy. The GitHub workflow overwrites this single value on its next run. Missing configuration uses defaults; malformed configuration fails startup instead of silently charging unexpected prices.

## Checkout behavior

New upgrade sessions store the current quoted amount. Sessions already in progress keep their quote until expiry. Durable billing intents remain authoritative for already-created payment orders and delayed webhooks, including orders created before this change. Website checkout displays the session amount; it does not invent a frontend price.

Deploy the backend first. The new website needs `/api/subscription/plans` and the amount/currency fields on the upgrade-session response. If prices cannot be loaded, price cards show an unavailable state with a retry action and disable plan selection. No stale hardcoded price is advertised. Native app price labels are outside this web/backend change.

## Render API references

- https://api-docs.render.com/reference/update-env-var
- https://api-docs.render.com/reference/create-deploy
