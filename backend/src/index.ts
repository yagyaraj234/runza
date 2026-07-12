import 'dotenv/config';
import { serve } from '@hono/node-server';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { GcsArtifactStore, LocalArtifactStore } from './artifacts.js';
import { Daytona } from '@daytona/sdk';
import { createCatalog } from './billing/catalog.js';
import { DodoBillingProvider } from './billing/dodo.js';
import { MemoryBillingStore } from './billing/store.js';
import { loadConfig } from './config.js';
import { InMemoryEventBus } from './events.js';
import { ConsoleNotifier, GitHubCommentNotifier, SmtpNotifier } from './notifier.js';
import { RunPipeline } from './pipeline.js';
import { OpenAIPlanner } from './planner.js';
import { CompositePlanner } from './composite-planner.js';
import { DaytonaExecutor, PrSandboxExecutor, type DaytonaClientLike } from './daytona-executor.js';
import { PlaywrightExecutor } from './runner.js';
import { RepositoryStore, SqliteRunStore } from './store.js';
import { ConvexUserStore, SqliteUserStore } from './users.js';
import { GitHubApp } from './github-app.js';
import { PrPreparation } from './pr-preparation.js';
import { SiteInspector } from './site-inspector.js';
const config = loadConfig(),
  store = new SqliteRunStore(resolve(config.RUNS_DB_PATH)),
  repositories = new RepositoryStore(resolve(config.RUNS_DB_PATH), config.DATA_ENCRYPTION_KEY),
  events = new InMemoryEventBus(),
  artifacts = config.GCS_BUCKET
    ? new GcsArtifactStore(config.GCS_BUCKET, config.GCS_PREFIX, config.GCS_PUBLIC_BASE_URL)
    : new LocalArtifactStore(resolve(config.ARTIFACT_DIR), config.PUBLIC_BASE_URL),
  billingStore = config.BILLING_ENABLED ? new MemoryBillingStore() : undefined;
const billing = config.BILLING_ENABLED
  ? {
      store: billingStore!,
      provider: new DodoBillingProvider({
        apiKey: config.DODO_API_KEY,
        webhookKey: config.DODO_WEBHOOK_KEY,
        environment: config.DODO_ENVIRONMENT,
        returnUrl: config.DODO_RETURN_URL!,
      }),
      catalog: createCatalog({
        starterProductId: config.DODO_STARTER_PRODUCT_ID,
        scaleProductId: config.DODO_SCALE_PRODUCT_ID,
        starterCredits: config.DODO_STARTER_CREDITS!,
        scaleCredits: config.DODO_SCALE_CREDITS!,
      }),
    }
  : undefined;
const githubApp = new GitHubApp(
  config.GITHUB_APP_ID,
  config.GITHUB_PRIVATE_KEY_PATH,
  config.GITHUB_APP_SLUG
);
const baseNotifier = config.SMTP_URL
  ? new SmtpNotifier(config.SMTP_URL, config.SMTP_FROM)
  : new ConsoleNotifier();
const notifier = githubApp.configured
  ? new GitHubCommentNotifier(baseNotifier, githubApp, config.DASHBOARD_BASE_URL, config.AUTH_SECRET)
  : baseNotifier;
const roles = config.PLANNER_AGENTS.split(',').map(role => role.trim()).filter(Boolean);
const planner = new CompositePlanner(roles.map(role => new OpenAIPlanner(config.OPENAI_API_KEY, role)));
const localExecutor = new PlaywrightExecutor(artifacts, run => run.repository ? repositories.secrets(run.repository) : {});
const executor = config.DAYTONA_API_KEY
  ? new PrSandboxExecutor(localExecutor, new DaytonaExecutor(new Daytona({ apiKey: config.DAYTONA_API_KEY, apiUrl: config.DAYTONA_API_URL, target: config.DAYTONA_TARGET }) as unknown as DaytonaClientLike, artifacts, { snapshot: config.DAYTONA_SNAPSHOT, timeoutSeconds: config.DAYTONA_TIMEOUT_SECONDS }, repository=>({settings:repositories.get(repository),secrets:repositories.secrets(repository)})))
  : localExecutor;
new RunPipeline({
  store,
  events,
  planner,
  executor,
  artifacts,
  notifier,
  publicBaseUrl: config.DASHBOARD_BASE_URL,
  billing: billingStore,
  prepare: run=>new PrPreparation(githubApp,repositories).prepare(run),
}).start();
const users = config.CONVEX_URL
  ? new ConvexUserStore(config.CONVEX_URL, config.AUTH_BRIDGE_SECRET)
  : new SqliteUserStore(resolve(config.USERS_DB_PATH));
const inspector=new SiteInspector()
const app = createApp({ config, store, events, users, githubApp, billing, repositories, artifacts, verifyRepository:async repository=>{const settings=repositories.get(repository);if(!settings)throw new Error('Repository settings not found');await inspector.inspect(settings,repositories.secrets(repository))} });
serve({ fetch: app.fetch, port: config.PORT }, info =>
  console.log(`Freebug backend: http://localhost:${info.port}`)
);
