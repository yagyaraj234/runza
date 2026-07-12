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
import { ConsoleNotifier, SmtpNotifier } from './notifier.js';
import { RunPipeline } from './pipeline.js';
import { OpenAIPlanner } from './planner.js';
import { CompositePlanner } from './composite-planner.js';
import { DaytonaExecutor, PrSandboxExecutor, type DaytonaClientLike } from './daytona-executor.js';
import { PlaywrightExecutor } from './runner.js';
import { MemoryRunStore } from './store.js';
import { ConvexUserStore, MemoryUserStore } from './users.js';
import { GitHubApp } from './github-app.js';
const config = loadConfig(),
  store = new MemoryRunStore(),
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
const notifier = config.SMTP_URL
  ? new SmtpNotifier(config.SMTP_URL, config.SMTP_FROM)
  : new ConsoleNotifier();
const roles = config.PLANNER_AGENTS.split(',').map(role => role.trim()).filter(Boolean);
const planner = new CompositePlanner(roles.map(role => new OpenAIPlanner(config.OPENAI_API_KEY, role)));
const localExecutor = new PlaywrightExecutor(artifacts);
const executor = config.DAYTONA_API_KEY
  ? new PrSandboxExecutor(localExecutor, new DaytonaExecutor(new Daytona({ apiKey: config.DAYTONA_API_KEY, apiUrl: config.DAYTONA_API_URL, target: config.DAYTONA_TARGET }) as unknown as DaytonaClientLike, artifacts, { snapshot: config.DAYTONA_SNAPSHOT, timeoutSeconds: config.DAYTONA_TIMEOUT_SECONDS }))
  : localExecutor;
new RunPipeline({
  store,
  events,
  planner,
  executor,
  artifacts,
  notifier,
  publicBaseUrl: config.PUBLIC_BASE_URL,
  billing: billingStore,
}).start();
const users = config.CONVEX_URL
  ? new ConvexUserStore(config.CONVEX_URL, config.AUTH_BRIDGE_SECRET)
  : new MemoryUserStore();
const githubApp = new GitHubApp(
  config.GITHUB_APP_ID,
  config.GITHUB_PRIVATE_KEY_PATH,
  config.GITHUB_APP_SLUG
);
const app = createApp({ config, store, events, users, githubApp, billing });
serve({ fetch: app.fetch, port: config.PORT }, info =>
  console.log(`Freebug backend: http://localhost:${info.port}`)
);
