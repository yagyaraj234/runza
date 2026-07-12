# Freebug backend

Freebug is a Hono/TypeScript control plane for autonomous web testing. A manual request or signed GitHub pull-request webhook publishes a run, an OpenAI-compatible model creates a constrained test plan, Playwright executes it, Axe scans accessibility, and the backend publishes videos, traces, screenshots, findings, and a JSON report. Completion can be delivered through SMTP.

## Local setup

Requirements: Node.js 22 and Chromium dependencies supported by Playwright.

```bash
cp .env.example .env
npm install
npx playwright install chromium
npm run typecheck
npm test
npm run dev
```

The API listens on `http://localhost:3001` by default.

To exercise the complete PR path without a GitHub repository, run:

```bash
npm run simulate:pr
```

This sends a correctly signed `pull_request` delivery into the real webhook handler, inspects a local broken staging site, verifies the OpenAI-compatible contract at `OPENAI_BASE_URL=http://localhost:8787/v1` using `OPENAI_MODEL=gpt-5.4-mini`, runs five pinned Playwright regressions, records one video for the whole primary run, reruns failures without extra videos, writes local proof artifacts, and records the GitHub Check/sticky-comment calls. No OpenAI API key is required for this local simulation.

## Configuration

- `OPENAI_BASE_URL`: any OpenAI-compatible `/v1` URL.
- `OPENAI_API_KEY`: provider credential.
- `OPENAI_MODEL`: model identifier accepted by that endpoint.
- `GITHUB_APP_ID`: numeric RunzaAI GitHub App identifier.
- `GITHUB_APP_SLUG`: GitHub App slug (`runzaai`).
- `GITHUB_INSTALLATION_ID`: installation identifier for the connected account/repository.
- `GITHUB_PRIVATE_KEY_PATH`: path to the downloaded GitHub App private key. Keep it outside version control.
- `GITHUB_WEBHOOK_SECRET`: GitHub App webhook secret.
- `GITHUB_WEBHOOK_PROXY_URL`: Smee HTTPS channel used to relay GitHub webhooks during local development.
- `GITHUB_TARGET_URL`: default preview/staging URL for PR runs. CI can override this with the `x-freebug-target-url` webhook header.
- `CONVEX_URL`: Convex deployment URL used to persist waitlist signups.
- `ARTIFACT_DIR`: local artifact directory. Use an object-storage adapter for multi-node production.
- `PLANNER_AGENTS`: comma-separated planning roles run concurrently for every run.
- `DAYTONA_API_KEY`: required for PR runs; each PR run gets one ephemeral sandbox.
- `DAYTONA_API_URL`, `DAYTONA_TARGET`, `DAYTONA_SNAPSHOT`: optional Daytona overrides.
- `GCS_BUCKET`, `GCS_PREFIX`, `GCS_PUBLIC_BASE_URL`: optional GCS artifact storage. Authentication uses Google Application Default Credentials.
- `DASHBOARD_BASE_URL`: frontend origin used by GitHub Checks and PR comments.
- `RUNS_DB_PATH`: SQLite database for durable runs, deliveries, repository settings, and encrypted test secrets.
- `DATA_ENCRYPTION_KEY`: exactly 32 random bytes encoded as base64.
- `SMTP_URL`: Nodemailer-compatible SMTP URL. If omitted, completion is logged.
- `SMTP_FROM`: sender used for completion email.

## API

Create a discovery run:

```bash
curl -X POST http://localhost:3001/v1/runs \
  -H 'content-type: application/json' \
  -d '{
    "mode":"discovery",
    "targetUrl":"https://example.com",
    "email":"owner@example.com",
    "model":{"baseUrl":"https://provider.example/v1","model":"your-model"}
  }'
```

Read status and report:

```bash
curl http://localhost:3001/v1/runs/RUN_ID
curl http://localhost:3001/v1/runs/RUN_ID/report
```

Endpoints:

- `GET /health`
- `POST /v1/waitlist` with `{ "email": "person@example.com" }`
- `POST /v1/runs`
- `GET /v1/runs/:id`
- `GET /v1/runs/:id/report`
- `GET /v1/artifacts/:runId/:file`
- `POST /v1/github/webhook`
- `GET|PUT /v1/repos/:owner/:repo/settings`
- `PUT|DELETE /v1/repos/:owner/:repo/secrets/:name`
- `POST /v1/repos/:owner/:repo/settings/verify`
- `GET /v1/share/runs/:token`
- `POST /v1/artifacts/:id/url`

## GitHub integration

The RunzaAI GitHub App uses repository permissions for Contents (read), Pull requests (read), Checks (read/write), Issues (read/write, for the sticky PR comment), and Deployments (read). It subscribes to Pull request, Deployment, and Deployment status events; GitHub sends installation lifecycle events automatically. The current MVP handles Pull request actions `opened`, `reopened`, and `synchronize`; other subscriptions support the Phase 3 workflow described in `feature.md`.

For local development, set the App webhook URL to `GITHUB_WEBHOOK_PROXY_URL`, then run both processes:

```bash
npm run dev
npm run dev:github
```

The relay forwards signed deliveries to `http://127.0.0.1:${PORT}/v1/github/webhook`. Smee is a third-party relay and receives the GitHub webhook payloads sent to its channel; only activate it for repositories whose owners approve that transfer. Production must replace Smee with a stable HTTPS `PUBLIC_BASE_URL` and configure the App webhook as `${PUBLIC_BASE_URL}/v1/github/webhook`.

A deployment system must provide a reachable preview URL using `GITHUB_TARGET_URL` or `x-freebug-target-url`; a PR payload does not contain the deployed application URL.

## Safety model

Model output is parsed into a Zod-validated action DSL. The model cannot emit or execute JavaScript. Navigation is same-origin because `goto` accepts paths beginning with `/`. Playwright uses accessible role/name and label locators. Browser execution occurs headlessly and captures a trace and video for every test.

## Verification

```bash
npm run typecheck
npm run build
npm test
```

The end-to-end test starts a real fixture web server, runs Chromium, executes an AI-style plan, performs an Axe scan, records video and trace artifacts, creates the report, updates run state, and invokes the notification adapter.

PR webhooks fan out to the configured planning agents, merge their validated DSL plans, generate a reproducible `generated.spec.mjs`, then create exactly one ephemeral Daytona sandbox for that PR run. The sandbox runs every merged test case and is deleted after evidence is downloaded. Configure `GCS_BUCKET` to upload scripts, videos, traces, screenshots, and reports to Google Cloud Storage.

## Production boundaries

The checked-in MVP is fully executable on one node. For horizontal production deployment, replace `MemoryRunStore`, `InMemoryEventBus`, and `LocalArtifactStore` through their existing interfaces with PostgreSQL, Redis/NATS, and S3 adapters. GitHub installation-token check updates and VM/container isolation are also deployment-layer work; they are not represented as completed here.
