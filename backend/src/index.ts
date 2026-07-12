import 'dotenv/config'
import { serve } from '@hono/node-server'
import { resolve } from 'node:path'
import { createApp } from './app.js'
import { LocalArtifactStore } from './artifacts.js'
import { loadConfig } from './config.js'
import { InMemoryEventBus } from './events.js'
import { ConsoleNotifier, SmtpNotifier } from './notifier.js'
import { RunPipeline } from './pipeline.js'
import { OpenAIPlanner } from './planner.js'
import { PlaywrightExecutor } from './runner.js'
import { MemoryRunStore } from './store.js'
import { ConvexWaitlistStore, MemoryWaitlistStore } from './waitlist.js'

const config = loadConfig(), store = new MemoryRunStore(), events = new InMemoryEventBus()
const artifacts = new LocalArtifactStore(resolve(config.ARTIFACT_DIR), config.PUBLIC_BASE_URL)
const notifier = config.SMTP_URL ? new SmtpNotifier(config.SMTP_URL, config.SMTP_FROM) : new ConsoleNotifier()
new RunPipeline({ store, events, planner: new OpenAIPlanner(config.OPENAI_API_KEY), executor: new PlaywrightExecutor(artifacts), artifacts, notifier, publicBaseUrl: config.PUBLIC_BASE_URL }).start()
const waitlist = config.CONVEX_URL ? new ConvexWaitlistStore(config.CONVEX_URL) : new MemoryWaitlistStore()
const app = createApp({ config, store, events, waitlist })
serve({ fetch: app.fetch, port: config.PORT }, (info) => console.log(`Freebug backend: http://localhost:${info.port}`))
