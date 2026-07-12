# Freebug

Freebug (Runza) is a PR-aware web-testing system. A TanStack Start dashboard connects GitHub repositories and stores per-repository staging/login settings. A Hono backend receives signed pull-request webhooks, inspects the staging site and PR patches, asks an OpenAI-compatible model for constrained test plans, runs Playwright and Axe, and publishes reports, screenshots, traces, logs, and one video for the primary run.

## Current architecture

| Component | Stack | Default address | Persistence |
| --- | --- | --- | --- |
| `frontend/` | TanStack Start, React 19, Vite, Nitro, Tailwind | `http://localhost:3000` | Convex is optional for the existing integration; browser auth token is local storage |
| `backend/` | Node 22, Hono, TypeScript | `http://localhost:3001` | SQLite for users, runs, webhook deliveries, repository settings, and encrypted test secrets |
| Browser execution | Playwright, Axe, optional Daytona sandbox | n/a | Local artifacts or private GCS |
| Background work | In-process event bus and queue | n/a | Single-node only |
| Billing | Dodo Payments, disabled by default | n/a | In-memory ledger; test mode only |

PR runs use one ephemeral Daytona sandbox when `DAYTONA_API_KEY` is set. Discovery runs and local fallback execution use Playwright on the backend host. Failed cases rerun once without producing another video.

## Requirements

- Node.js 22
- npm for the backend
- Bun for the frontend
- Chromium installed through Playwright
- Optional external services: OpenAI-compatible API, GitHub App, Daytona, Convex, Google Cloud Storage, SMTP, and Dodo Payments

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env
npm ci
npx playwright install chromium
npm run dev
```

The minimum useful local configuration is:

```dotenv
PORT=3001
PUBLIC_BASE_URL=http://localhost:3001
DASHBOARD_BASE_URL=http://localhost:3000
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=replace-with-provider-api-key
OPENAI_MODEL=gpt-4.1-mini
AUTH_SECRET=replace-with-a-long-random-secret
DATA_ENCRYPTION_KEY=replace-with-32-random-bytes-as-base64
RUNS_DB_PATH=./data/runs.db
USERS_DB_PATH=./data/users.db
ARTIFACT_DIR=./data/artifacts
```

Generate secrets without committing them:

```bash
openssl rand -base64 48 # AUTH_SECRET
openssl rand -base64 32 # DATA_ENCRYPTION_KEY
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
bun install
bun --bun run dev
```

Set at least the backend URL:

```dotenv
VITE_API_URL=http://localhost:3001
```

Open `http://localhost:3000`. The backend allows cross-origin requests during the current MVP.

## Backend configuration

Copy `backend/.env.example` to `backend/.env`. Empty optional values disable their integrations.

### Server, auth, and persistence

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | Backend port. |
| `NODE_ENV` | `development` | Set to `production` in production; this disables direct local artifact serving and rejects development secrets. |
| `PUBLIC_BASE_URL` | `http://localhost:3001` | Public backend origin used in API status and artifact URLs. |
| `DASHBOARD_BASE_URL` | `http://localhost:3000` | Frontend origin used in GitHub Checks, comments, and report links. |
| `AUTH_SECRET` | Must be changed in production | Signs login, report-share, and artifact-access tokens. |
| `DATA_ENCRYPTION_KEY` | Exactly 32 random bytes, base64 encoded | Encrypts repository login/test secrets at rest. |
| `USERS_DB_PATH` | `./data/users.db` | SQLite user database when `CONVEX_URL` is empty. |
| `RUNS_DB_PATH` | `./data/runs.db` | SQLite runs, delivery IDs, repository settings, and encrypted secrets. |
| `ARTIFACT_DIR` | `./data/artifacts` | Local artifact directory when `GCS_BUCKET` is empty. |

`REDIS_URL` is parsed for forward compatibility but is not used by the current in-process queue.

### Model planning

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible API base including `/v1`. |
| `OPENAI_API_KEY` | Required for real planning | Provider credential; server-side only. |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Provider model ID. |
| `PLANNER_AGENTS` | `smoke,functional,accessibility` | Comma-separated specialist roles run concurrently; keep at least one role. |

Model output is Zod-validated into a small action DSL. It cannot supply JavaScript or cross-origin navigation.

### GitHub App and webhooks

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `GITHUB_APP_ID` | Required for GitHub App features | Numeric GitHub App ID. |
| `GITHUB_APP_SLUG` | `runzaai` in the example | App slug used to build the installation URL. |
| `GITHUB_PRIVATE_KEY_PATH` | Required for GitHub App features | Path to the downloaded PEM key; keep it outside version control. |
| `GITHUB_WEBHOOK_SECRET` | Required for webhook processing | Verifies `X-Hub-Signature-256`. |
| `GITHUB_WEBHOOK_PROXY_URL` | Optional | Smee channel used only by `npm run dev:github`. |
| `GITHUB_TARGET_URL` | Required unless supplied elsewhere | Default staging URL when repository settings and `x-freebug-target-url` do not provide one. |
| `GITHUB_INSTALLATION_ID` | Reserved | Parsed by configuration but current user/repository flows store installation IDs per account. |

Configure the GitHub App with:

- Repository permissions: Contents read, Pull requests read, Checks read/write, Issues read/write, and Deployments read.
- Events: Pull request, Deployment, and Deployment status.
- Webhook URL: `https://<api-host>/v1/github/webhook` in production.
- Pull-request actions currently handled: `opened`, `reopened`, and `synchronize`.

For local webhook delivery, create a Smee channel, set `GITHUB_WEBHOOK_PROXY_URL`, then run in separate terminals:

```bash
cd backend
npm run dev
npm run dev:github
```

Smee receives the webhook payload before relaying it locally. Use it only for repositories whose owners approve that transfer.

### User storage and Convex bridge

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `CONVEX_URL` | Empty | Backend Convex deployment URL. Empty selects local SQLite users. |
| `AUTH_BRIDGE_SECRET` | Required with the Convex bridge | Shared secret passed to backend user functions; set the same value in Convex. |

When using Convex:

```bash
cd frontend
bunx --bun convex dev
bunx --bun convex env set AUTH_BRIDGE_SECRET '<same-value-as-backend>'
```

### Daytona execution

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `DAYTONA_API_KEY` | Empty | Enables ephemeral Daytona execution for PR runs. |
| `DAYTONA_API_URL` | Daytona SDK default | Optional API override. |
| `DAYTONA_TARGET` | SDK default | Optional Daytona target/region. |
| `DAYTONA_SNAPSHOT` | Empty | Optional snapshot with Node 22, Playwright 1.61.1, Axe, and Chromium for faster startup. |
| `DAYTONA_TIMEOUT_SECONDS` | `900` | Positive sandbox timeout in seconds. |

Without `DAYTONA_SNAPSHOT`, the executor uses the pinned official Playwright image and installs runtime packages per run. Without `DAYTONA_API_KEY`, execution stays local.

### Artifact storage

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `GCS_BUCKET` | Empty | Enables Google Cloud Storage instead of local artifact storage. |
| `GCS_PREFIX` | `freebug` | Object prefix; objects are stored under `<prefix>/<run-id>/`. |
| `GCS_PUBLIC_BASE_URL` | Empty | Optional CDN/public prefix. Keep empty for private signed access. |
| `GOOGLE_APPLICATION_CREDENTIALS` | ADC default | Optional path to a service-account JSON file. |

For private GCS, grant the backend service account object create/read permissions and keep `GCS_PUBLIC_BASE_URL` empty. The API issues 15-minute signed artifact URLs. Apply the checked-in 14-day lifecycle once:

```bash
cd backend
npm run setup:gcs
```

### Email notifications

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `SMTP_URL` | Empty | Nodemailer-compatible SMTP URL; empty logs completion instead. |
| `SMTP_FROM` | `Freebug <noreply@freebug.local>` | Completion sender. |

### Dodo billing

Billing stays off unless every required value is present.

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `BILLING_ENABLED` | `false` | Enables checkout and credit reservation. |
| `DODO_ENVIRONMENT` | `test_mode` | `test_mode` or `live_mode`. |
| `DODO_API_KEY` | Required when enabled | Server API key. |
| `DODO_WEBHOOK_KEY` | Required when enabled | Webhook signing key. |
| `DODO_STARTER_PRODUCT_ID` | Required when enabled | Starter subscription product. |
| `DODO_SCALE_PRODUCT_ID` | Required when enabled | Scale subscription product. |
| `DODO_STARTER_CREDITS` | Required positive integer | Starter credits per grant. |
| `DODO_SCALE_CREDITS` | Required positive integer | Scale credits per grant. |
| `RUN_CREDIT_COST` | Required positive integer | Credits reserved per run. |
| `DODO_RETURN_URL` | Required URL when enabled | Checkout return URL, normally the frontend origin. |

Register `https://<api-host>/v1/billing/webhooks/dodo` for subscription activation, renewal, cancellation, and payment success/failure events. Keep `test_mode`: the current billing ledger is process-local and loses grants, reservations, and webhook deduplication on restart. Live multi-instance billing requires durable transactional storage and authenticated workspace ownership.

## Frontend configuration

Copy `frontend/.env.example` to `frontend/.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Yes outside local defaults | Browser-visible backend origin. |
| `VITE_CONVEX_URL` | Optional | Browser-visible Convex URL; no provider is mounted when empty. |
| `CONVEX_DEPLOYMENT` | Only for Convex CLI | Deployment selected by Convex tooling. |
| `DATABASE_URL` | Only for Drizzle commands | PostgreSQL URL read by `drizzle.config.ts`; current application routes do not use the Drizzle database module. |

Build and preview the Nitro application:

```bash
cd frontend
bun --bun run build
bun --bun run preview
```

The frontend is TanStack Start with Nitro server output, not a static-only Vite export. Use an SSR-capable deployment target and set `VITE_API_URL` at build time.

## Repository setup in the dashboard

After signing up and installing the GitHub App:

1. Select an installed repository.
2. Save its fixed preview/staging URL.
3. Choose private or public report visibility.
4. Optionally add a same-origin login path and write-only login recipe.
5. Store referenced secrets by name; values are encrypted and are never returned by the API.
6. Verify the staging configuration before relying on webhook runs.

PR context combines GitHub file patches with a same-origin Playwright site scan. Completion updates one GitHub Check and upserts one marked PR comment.

## Deterministic local PR simulation

The simulation uses a local broken staging site and a correctly signed GitHub PR delivery. It targets `http://localhost:8787/v1` with `gpt-5.4-mini`; when that service is absent, it starts a deterministic compatible fallback. No real OpenAI key is needed.

```bash
cd backend
npx playwright install chromium
npm run simulate:pr
```

Five pinned regressions cover login, forgot password, checkout coupon math, signup password validation, and serious accessibility violations. Output includes pipeline stages, classifications, simulated GitHub Check/comment calls, secret-canary status, and the absolute artifact directory.

## Verification

Backend release gate:

```bash
cd backend
npm ci
npx playwright install chromium
npm run typecheck
npm run build
npm test
npm run test:e2e
```

Frontend checks:

```bash
cd frontend
bun install
bun --bun run test
bun --bun run build
```

## Production boundaries

- SQLite run/user state survives restarts but is single-node storage.
- Event delivery, execution queue, and optional billing ledger remain process-local.
- Local artifacts are served only outside `NODE_ENV=production`; configure private GCS for production.
- Multi-instance production needs a durable transactional database and queue.
- Billing must remain in test mode until its ledger and webhook IDs are durable.
- Never commit `.env`, `.env.local`, GitHub App PEM keys, cloud credentials, or provider keys; current gitignore rules exclude them.
