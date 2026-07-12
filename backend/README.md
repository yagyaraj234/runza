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

## Configuration

- `OPENAI_BASE_URL`: any OpenAI-compatible `/v1` URL.
- `OPENAI_API_KEY`: provider credential.
- `OPENAI_MODEL`: model identifier accepted by that endpoint.
- `GITHUB_WEBHOOK_SECRET`: GitHub App webhook secret.
- `GITHUB_TARGET_URL`: default preview/staging URL for PR runs. CI can override this with the `x-freebug-target-url` webhook header.
- `ARTIFACT_DIR`: local artifact directory. Use an object-storage adapter for multi-node production.
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
- `POST /v1/runs`
- `GET /v1/runs/:id`
- `GET /v1/runs/:id/report`
- `GET /v1/artifacts/:runId/:file`
- `POST /v1/github/webhook`

## GitHub integration

Create a GitHub App with Pull requests read access, Checks write access for the next production phase, and Pull request webhooks. Configure the webhook URL as `/v1/github/webhook`. Events `opened`, `reopened`, and `synchronize` create PR runs after HMAC verification.

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

## Production boundaries

The checked-in MVP is fully executable on one node. For horizontal production deployment, replace `MemoryRunStore`, `InMemoryEventBus`, and `LocalArtifactStore` through their existing interfaces with PostgreSQL, Redis/NATS, and S3 adapters. GitHub installation-token check updates and VM/container isolation are also deployment-layer work; they are not represented as completed here.
