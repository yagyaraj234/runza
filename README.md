# Freebug

## PR automation prototype

Freebug accepts signed GitHub pull-request webhooks, fans each run out to the specialist roles in `PLANNER_AGENTS`, validates and deterministically merges their constrained plans, compiles the plan into a Playwright script, and executes PR runs in an ephemeral Daytona sandbox when `DAYTONA_API_KEY` is configured. Discovery runs continue to use the local Playwright executor.

The generated script records one video and trace per case, captures a full-page screenshot on failure, runs Axe accessibility checks, and writes a validated result manifest. The script and all evidence are stored through the configured artifact adapter. Set `GCS_BUCKET` to use private Google Cloud Storage with Application Default Credentials; leave it empty for local storage.

Setup:

1. Copy `backend/.env.example` to `backend/.env` and fill the OpenAI-compatible provider, GitHub webhook, Daytona, and GCS values.
2. Configure the GitHub webhook endpoint as `https://<api-host>/v1/github/webhook` for pull-request events and use the same `GITHUB_WEBHOOK_SECRET`.
3. Configure `GITHUB_TARGET_URL` to a deployed preview/staging URL. GitHub PR payloads do not contain a preview URL.
4. For fast sandbox startup, create `DAYTONA_SNAPSHOT` with Node 22, Playwright 1.61.1, Axe, and Chromium. Without a snapshot, Freebug uses the pinned official Playwright image and installs the two runtime packages per run.
5. Give the backend service account `storage.objects.create` access to `GCS_BUCKET`. Objects are written under `GCS_PREFIX/<run-id>/`; use `GCS_PUBLIC_BASE_URL` only when a CDN or controlled public endpoint serves that prefix.
6. Run the release gate from `backend`: `npm ci`, `npx playwright install chromium`, `npm run typecheck`, `npm run build`, `npm test`, and `npm run test:e2e`.

The prototype run store, webhook-delivery deduplication set, event bus, and optional billing ledger remain process-local. They are suitable for a single-node prototype but must move to durable transactional storage and a durable queue before multi-instance production deployment.

## Dodo billing setup

1. Create Starter and Scale subscription products in Dodo Payments.
2. Copy their product IDs and test-mode API key into the backend variables shown in `backend/.env.example`. Decide positive included-credit allocations and `RUN_CREDIT_COST`; these values are intentionally not hard-coded product decisions.
3. Register `https://<api-host>/v1/billing/webhooks/dodo` and store its signing key in `DODO_WEBHOOK_KEY`. Subscribe to subscription activation/renewal/cancellation and payment success/failure events.
4. Keep every Dodo key server-side. Run checkout and webhook replay tests in `test_mode`; duplicate period/event IDs do not grant twice.
5. Set `BILLING_ENABLED=true`, then verify plan catalog, checkout, signed webhook, account balance, reservation, completion settlement, failure release, and insufficient-credit `402` behavior before considering live mode.

Billing identity is a normalized customer email and the ledger is process-local memory. It loses state on restart and cannot safely coordinate multiple instances. Do **not** enable live mode until an authenticated workspace owns each customer and subscriptions, grants, reservations, and webhook event IDs use durable transactional storage. Failed runs currently release their fixed reservation. Refunds, chargebacks, proration, annual plans, top-ups, and a customer portal are out of scope.
