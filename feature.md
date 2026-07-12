# Freebug Product Features

## Product vision

Freebug is an autonomous web-application testing platform. A team connects a GitHub repository or submits a deployed application URL, selects any OpenAI-compatible model, and Freebug discovers user flows, generates safe Playwright tests, runs functional and accessibility checks, records evidence, and delivers actionable bug reports.

## Product principles

- Model-provider neutral: users can supply any OpenAI-compatible base URL, API key, and model name.
- Safe by construction: models produce a constrained test-plan DSL, never arbitrary executable code.
- Evidence first: every finding links to reproducible steps, screenshots, traces, logs, and video.
- Accessible by default: use Playwright accessible locators, ARIA state, and Axe checks.
- CI native: installation should require only a GitHub App and repository configuration.
- Replaceable infrastructure: storage, queue, model, browser, and notification providers use adapters.
- Clear confidence: distinguish confirmed failures, flaky tests, and infrastructure errors.

---

# User journeys

## 1. GitHub pull-request testing

1. A repository owner installs the Freebug GitHub App.
2. The owner configures a preview URL or CI command in the repository.
3. A contributor opens or updates a pull request.
4. Freebug verifies the webhook and retrieves the PR metadata and diff.
5. Freebug identifies changed behavior and existing test coverage.
6. The selected model produces a focused, schema-valid test plan.
7. An isolated Playwright worker runs the tests against the preview deployment.
8. Freebug retries failed tests once in a fresh browser context.
9. Freebug publishes a GitHub Check with pass, confirmed, flaky, and inconclusive counts.
10. The PR links to the full report, videos, traces, screenshots, and suggested tests.

## 2. Full-application discovery

1. A user submits an application URL.
2. The user optionally supplies an encrypted Playwright storage state or login secret references.
3. Freebug explores the application using same-origin, bounded, accessibility-driven navigation.
4. Freebug records pages, states, forms, actions, console errors, and failed requests.
5. The model converts observed states into user flows and constrained test cases.
6. Freebug creates a Mermaid user-flow diagram.
7. Playwright executes the generated suite with functional and accessibility checks.
8. Freebug publishes confirmed bugs and evidence-backed report URLs.
9. The user receives an email when the run completes.

## 3. Waitlist signup

1. A visitor submits an email address.
2. The API validates and normalizes the address.
3. Freebug stores the address in Convex.
4. Duplicate submissions return the existing signup without creating duplicate records.

---

# Frontend features

## Public website

- Product landing page explaining PR testing and full-app discovery.
- Waitlist form connected to `POST /v1/waitlist`.
- Pricing catalog for $149 Starter and $499 Scale plans with Dodo hosted checkout.
- Inline validation, loading, success, duplicate, and error states.
- Responsive layout and accessible keyboard/focus behavior.
- Product demo showing a sample run, bug, video, and user-flow diagram.
- Documentation links, privacy statement, and contact information.

## Authentication and onboarding

- Email or OAuth sign-in.
- Organization and workspace creation.
- GitHub App installation flow.
- Repository selection and installation-status confirmation.
- Guided setup checklist:
  - Connect GitHub.
  - Choose a repository.
  - Configure preview deployment.
  - Configure an OpenAI-compatible model.
  - Configure notifications.
  - Run the first test.
- Secure model-key entry; secret values are never displayed after saving.

## Dashboard

- Workspace summary with recent runs and health metrics.
- Run counts grouped by queued, running, passed, failed, flaky, and inconclusive.
- Repository cards with latest commit, latest run, and installation status.
- Filters by repository, branch, author, trigger, status, and date.
- Search by run ID, pull request, test name, URL, or bug title.

## Run creation

- Manual discovery-run form.
- Target URL and environment selection.
- OpenAI-compatible provider URL, model, and stored credential selection.
- Authentication selection using storage state or login flow.
- Allowed and denied action configuration.
- Crawl-depth, state-count, and timeout budgets.
- Notification recipients.
- Destructive-action warning and explicit staging confirmation.

## Live run view

- Real-time stage timeline:
  - Queued.
  - Planning.
  - Exploring.
  - Generating.
  - Running.
  - Retrying.
  - Reporting.
  - Completed or failed.
- Live test progress and worker logs.
- Cancel-run control.
- Model, prompt version, commit SHA, worker image, and configuration metadata.

## Report view

- Executive summary and quality score.
- Passed, confirmed, flaky, inconclusive, and accessibility totals.
- Test-case list with steps and expected outcomes.
- Bug cards containing:
  - Severity and confidence.
  - Affected URL.
  - Reproduction steps.
  - Expected and actual behavior.
  - Console and network context.
  - Accessibility rule and help URL.
- Embedded or linked videos.
- Trace, screenshot, ARIA snapshot, and report downloads.
- Mermaid user-flow diagram.
- Artifact retention and expiration status.
- Re-run all or selected failed tests.
- Export as JSON, Markdown, or JUnit.

## Repository settings

- GitHub installation and repository permissions.
- Preview URL source or deployment-status integration.
- Branch and path filters.
- Trigger rules for opened, reopened, synchronize, label, or comment events.
- Test budgets and browser selection.
- Existing test-directory configuration.
- Pull-request check and comment preferences.
- Suggested-test delivery as artifact, patch, or opt-in bot commit.

## Provider and secret settings

- OpenAI-compatible base URL.
- Model name.
- Encrypted API key.
- Connection test and structured-output capability check.
- SMTP or transactional-email settings.
- S3-compatible artifact-storage settings for self-hosted installations.
- Secret rotation and deletion.

## Administration

- Workspace members and roles.
- Audit log.
- Usage, concurrency, storage, and retention metrics.
- Worker health and queue depth.
- Data-export and deletion controls.

---

# Backend features

## API and contracts

- Hono/TypeScript API.
- Versioned `/v1` routes.
- Zod request and response validation.
- Consistent error schema and request IDs.
- Health, readiness, and dependency-health endpoints.
- OpenAPI specification and generated API client.
- Rate limiting, CORS policy, secure headers, and structured logs.

## Waitlist

- `POST /v1/waitlist`.
- Trim and lowercase email addresses.
- Reject malformed or oversized addresses.
- Persist signups in the Convex `waitlist` table.
- Enforce idempotency through the `by_email` index and mutation transaction.
- Return `201` for a new signup and `200` for an existing signup.

## Run lifecycle

- `POST /v1/runs` for manual runs.
- `GET /v1/runs/:id` for status.
- `GET /v1/runs/:id/report` for results.
- Cancel, retry, and selective re-run endpoints.
- State machine:
  - `queued`
  - `planning`
  - `exploring`
  - `generating`
  - `running`
  - `retrying`
  - `reporting`
  - `completed` or `failed`
- Idempotency keys and duplicate-delivery protection.
- Typed failure reasons for configuration, authentication, model, browser, target, and infrastructure failures.

## OpenAI-compatible planning

- Configurable base URL, API key, and model.
- Connection and capability validation.
- Structured JSON output validated against the test-plan schema.
- Prompt templates for PR-diff mode and discovery mode.
- Prompt and response size limits.
- Timeouts and bounded retries for rate limits and transient server errors.
- Secret redaction.
- Prompt-injection resistance: repository and page content are always untrusted data.
- Planner output audit metadata and deterministic plan hashes.

## Safe test-plan DSL

- Same-origin `goto` paths.
- Accessible role/name click actions.
- Label-based form filling with secret references.
- Text, URL, visibility, and accessibility assertions.
- No model-authored JavaScript, imports, shell commands, or filesystem operations.
- Exhaustive deterministic compiler into Playwright actions.
- Per-test and per-plan step limits.

## Application explorer

- Same-origin breadth-first exploration.
- Configurable maximum depth, states, actions, and duration.
- Stable state fingerprints using normalized URL and accessibility/DOM state.
- Accessible headings, roles, names, labels, links, and forms.
- Console error and failed-network-request capture.
- ARIA snapshots for important states.
- Destructive-action denylist for delete, purchase, transfer, send, and logout.
- Explicit allowlist for approved mutations.
- Authentication through encrypted Playwright storage state or secret-referenced login steps.
- File-download and external-navigation prevention.

## Pull-request analysis

- Signed GitHub webhook verification using the raw request body.
- Delivery-ID deduplication.
- Pull-request events: opened, reopened, and synchronize.
- GitHub App installation-token authentication.
- Diff pagination and normalization.
- Exclude binaries, generated files, lockfiles, vendored content, and secrets.
- Existing-test inventory and changed-behavior risk analysis.
- Preview deployment discovery through GitHub Deployments or configured CI output.
- Focused test plans linked to changed files.
- GitHub Check Run creation and updates.
- Optional concise PR comment with report link.

## Browser execution

- Headless Chromium for the MVP.
- Firefox and WebKit as later configurable targets.
- One isolated browser context per test attempt.
- Playwright video recording.
- Trace recording with screenshots and DOM snapshots.
- Failure screenshots.
- Console, page-error, request-failure, and response-status collection.
- Axe accessibility scans with WCAG rule IDs and help URLs.
- Fresh-context retry for failures.
- Hard timeouts, cancellation, CPU/memory/PID limits, and non-root workers.
- No host Docker socket or unrestricted filesystem access.

## Failure classification

- Confirmed: the failure reproduces with a matching normalized signature.
- Flaky: the first attempt fails and a clean retry passes.
- Inconclusive: environment, authentication, target, or infrastructure prevents a trustworthy result.
- Deduplicate bugs by assertion, URL, console/network signature, and accessibility rule.
- Preserve every attempt and its evidence.

## User-flow and report generation

- Validated flow nodes and edges grounded in observed states.
- Mermaid diagram output.
- Bug records with stable IDs and URLs.
- Reproduction steps derived from executed actions only.
- Expected and actual behavior.
- Severity and confidence.
- Test results and attempt history.
- JSON, Markdown, JUnit, and machine-readable report formats.

## Artifact storage

- Videos, traces, screenshots, ARIA snapshots, generated tests, and reports.
- Local filesystem adapter for single-node development.
- S3-compatible adapter for production.
- Stable metadata records and short-lived signed download URLs.
- Content type, size, checksum, and creation time.
- Different retention policies for passing and failed runs.
- Automatic expiration and user-requested deletion.

## Notifications

- SMTP completion emails.
- Summary of confirmed, flaky, inconclusive, and accessibility findings.
- Stable report URL.
- Notification retries and delivery status.
- Optional Slack, Microsoft Teams, and webhook adapters.

## Persistence and pub/sub

- Dodo subscription webhooks, idempotent monthly credit grants, and run credit reservation/settlement.
- Follow-up: persist subscriptions, grants, reservations, and webhook event IDs in a transactional production store.

- In-memory adapters for local development and tests.
- PostgreSQL production store for runs, attempts, bugs, artifacts, installations, and audit events.
- Redis/BullMQ, NATS, or cloud pub/sub adapter for durable work distribution.
- Idempotent consumers and dead-letter handling.
- Worker heartbeats, leases, cancellation, retry budgets, and concurrency limits.
- Transactional outbox for reliable state/event publication.

## Security

- SSRF protection with DNS resolution and private/link-local/metadata-address blocking.
- DNS-rebinding checks.
- Encrypted credentials and browser storage state.
- Short-lived GitHub installation tokens.
- Signed webhook verification.
- Secret redaction in prompts, logs, screenshots, and artifacts.
- Tenant isolation and authorization checks.
- Audit log for configuration and run actions.
- Explicit production-target and destructive-action confirmation.
- Configurable data residency, retention, export, and deletion.

## Observability

- Structured logs with run, test, worker, and request IDs.
- Metrics for queue delay, stage duration, model latency, browser duration, pass rate, flake rate, and storage.
- Distributed tracing across API, queue, model, worker, and artifact services.
- Error tracking and alerting.
- Worker and dependency health dashboards.

---

# GitHub and CI/CD features

- Installable GitHub App.
- Minimal documented permissions.
- Repository-level `freebug.yml` configuration.
- Reusable GitHub Actions workflow.
- Preview URL handoff after deployment.
- PR Check Run with annotations and report link.
- Branch and path filters.
- Manual `workflow_dispatch` execution.
- Optional `/freebug test` PR comment trigger.
- Generated test artifact or suggested patch.
- Automatic issue creation for confirmed bugs as an opt-in feature.

Example repository configuration:

```yaml
version: 1
app:
  previewUrlFrom: deployment
model:
  providerSecret: FREEBUG_MODEL_API_KEY
  baseUrl: https://provider.example/v1
  name: provider-model
exploration:
  maxStates: 50
  maxDepth: 6
  allowActions: []
  denyActions: [delete, purchase, transfer, send]
tests:
  browsers: [chromium]
  accessibility: true
  retryFailures: 1
artifacts:
  video: always
  trace: always
  retentionDays: 30
notifications:
  emails: [engineering@example.com]
```

---

# Delivery phases

## Phase 1 — Executable single-node MVP

- Hono API and environment validation.
- Manual discovery-run creation and status/report routes.
- OpenAI-compatible structured planner.
- Constrained test DSL.
- Real Chromium execution.
- Axe scanning.
- Videos, traces, screenshots, findings, and JSON reports.
- Local artifacts and in-memory orchestration.
- SMTP notification adapter.
- Convex-backed waitlist endpoint.
- Real-browser end-to-end test.

## Phase 2 — Product dashboard

- Landing page and waitlist form.
- Authentication and workspace onboarding.
- Manual run form.
- Live run status.
- Report, bug, video, trace, and flow-diagram views.
- Provider and notification settings.

## Phase 3 — GitHub-native workflow

- GitHub App installation flow.
- Installation-token authentication.
- Diff analysis and preview deployment discovery.
- Durable webhook deduplication.
- Check Runs and PR annotations.
- Repository configuration file.
- Suggested generated-test patches.

## Phase 4 — Discovery engine

- Bounded application explorer.
- State graph and user-flow generation.
- Authentication/storage-state handling.
- Console and network diagnostics.
- Failure retry and flaky/inconclusive classification.

## Phase 5 — Production infrastructure

- PostgreSQL persistence.
- Durable Redis/NATS/cloud pub-sub.
- S3-compatible artifact storage.
- Isolated browser workers or ephemeral VMs.
- Autoscaling, leases, cancellation, dead letters, and concurrency controls.
- Metrics, tracing, alerting, audit logs, and retention jobs.

## Phase 6 — Multi-tenant SaaS hardening

- Organization roles and authorization.
- Tenant and secret isolation.
- Usage limits and billing.
- Data residency and compliance controls.
- Enterprise SSO and advanced audit exports.

---

# Definition of done

A feature is complete only when:

- Its external behavior has tests written before implementation.
- Focused tests and the complete relevant suite pass.
- Type checking and production builds pass.
- Security and failure cases are covered.
- API and environment configuration are documented.
- Logs and errors do not expose secrets.
- End-to-end behavior is exercised against a real browser or realistic integration fixture.
- Evidence and URLs are read back after storage.
- GitHub CI verifies the change.
- Documentation clearly distinguishes implemented, local-only, and production-ready behavior.
