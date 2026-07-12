import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { z } from 'zod';
import type { Config } from './config.js';
import type { EventBus } from './events.js';
import { verifyGitHubSignature, type PullRequestWebhook } from './github.js';
import type { Run } from './domain.js';
import type { RunStore } from './store.js';
import type { UserStore, User } from './users.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
} from './auth.js';
import type { GitHubApp } from './github-app.js';
import type { BillingProvider } from './billing/provider.js';
import { BillingProviderError } from './billing/provider.js';
import type { BillingStore } from './billing/store.js';
import type { BillingCatalog, PlanSlug } from './billing/catalog.js';
import { normalizeAccountKey } from './billing/domain.js';
const CreateRunSchema = z.object({
  mode: z.enum(['pr', 'discovery']),
  targetUrl: z.string().url(),
  repository: z.string().optional(),
  pullRequest: z.number().int().positive().optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  model: z
    .object({ baseUrl: z.string().url(), model: z.string().min(1) })
    .optional(),
});
const CheckoutSchema = z
  .object({
    plan: z.enum(['starter', 'scale']),
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();
const AccountSchema = z.string().trim().toLowerCase().email();
const SignupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
});
const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1),
});
const InstallationSchema = z.object({
  installationId: z.string().trim().regex(/^\d+$/),
});
const publicUser = (user: User) => ({
  email: user.email,
  name: user.name,
  githubInstallationId: user.githubInstallationId ?? null,
});
type BillingDeps = {
  provider: BillingProvider;
  store: BillingStore;
  catalog: BillingCatalog;
};
export function createApp(deps: {
  config: Config;
  store: RunStore;
  events: EventBus;
  users: UserStore;
  githubApp?: GitHubApp;
  billing?: BillingDeps;
}) {
  const app = new Hono();
  app.use('*', cors());
  app.get('/health', c => c.json({ status: 'ok' }));
  app.use(
    '/v1/artifacts/*',
    serveStatic({
      root: resolve(deps.config.ARTIFACT_DIR),
      rewriteRequestPath: path => path.replace(/^\/v1\/artifacts/, ''),
    })
  );
  const requireUser = async (c: {
    req: { header(name: string): string | undefined };
  }): Promise<User | undefined> => {
    const header = c.req.header('authorization');
    if (!header?.startsWith('Bearer ')) return undefined;
    const email = await verifyToken(header.slice(7), deps.config.AUTH_SECRET);
    return email ? deps.users.getByEmail(email) : undefined;
  };
  const createRun = async (input: z.infer<typeof CreateRunSchema>) => {
    const now = new Date().toISOString(),
      id = randomUUID(),
      accountKey = input.email ? normalizeAccountKey(input.email) : undefined;
    if (deps.billing && accountKey) {
      const reserved = await deps.billing.store.reserveCredits({
        accountKey,
        amount: deps.config.RUN_CREDIT_COST!,
        reservationId: id,
      });
      if (!reserved) throw new Error('insufficient_credits');
    }
    const run: Run = {
      id,
      mode: input.mode,
      status: 'queued',
      targetUrl: input.targetUrl,
      repository: input.repository,
      pullRequest: input.pullRequest,
      email: accountKey,
      billingAccountKey: accountKey,
      billingReservationId: deps.billing ? id : undefined,
      model: input.model ?? {
        baseUrl: deps.config.OPENAI_BASE_URL,
        model: deps.config.OPENAI_MODEL,
      },
      createdAt: now,
      updatedAt: now,
    };
    try {
      await deps.store.create(run);
      await deps.events.publish({ type: 'run.requested', runId: id });
      return run;
    } catch (error) {
      if (deps.billing && run.billingReservationId)
        await deps.billing.store
          .releaseReservation(run.billingReservationId)
          .catch(() => false);
      throw error;
    }
  };
  app.post('/v1/auth/signup', async c => {
    const parsed = SignupSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return c.json(
        { error: 'invalid_request', details: parsed.error.flatten() },
        400
      );
    const { name, email, password } = parsed.data;
    const result = await deps.users.create({
      email,
      name,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    if (!result.created) return c.json({ error: 'email_taken' }, 409);
    const user = (await deps.users.getByEmail(email))!;
    return c.json(
      {
        token: await signToken(email, deps.config.AUTH_SECRET),
        user: publicUser(user),
      },
      201
    );
  });
  app.post('/v1/auth/login', async c => {
    const parsed = LoginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    const user = await deps.users.getByEmail(parsed.data.email);
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash))
      return c.json({ error: 'invalid_credentials' }, 401);
    return c.json({
      token: await signToken(user.email, deps.config.AUTH_SECRET),
      user: publicUser(user),
    });
  });
  app.get('/v1/auth/me', async c => {
    const user = await requireUser(c);
    return user
      ? c.json({ user: publicUser(user) })
      : c.json({ error: 'unauthorized' }, 401);
  });
  app.get('/v1/github/app', async c => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: 'unauthorized' }, 401);
    if (!deps.githubApp?.configured)
      return c.json({ error: 'github_app_unconfigured' }, 503);
    return c.json({
      installUrl: deps.githubApp.installUrl,
      slug: deps.githubApp.slug,
    });
  });
  app.get('/v1/github/installations', async c => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: 'unauthorized' }, 401);
    if (!deps.githubApp?.configured)
      return c.json({ error: 'github_app_unconfigured' }, 503);
    try {
      return c.json({
        installations: await deps.githubApp.listInstallations(),
      });
    } catch {
      return c.json({ error: 'github_error' }, 502);
    }
  });
  app.post('/v1/github/installation', async c => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: 'unauthorized' }, 401);
    const parsed = InstallationSchema.safeParse(
      await c.req.json().catch(() => null)
    );
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    await deps.users.setInstallation(user.email, parsed.data.installationId);
    return c.json({ installationId: parsed.data.installationId });
  });
  app.get('/v1/github/repos', async c => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: 'unauthorized' }, 401);
    if (!user.githubInstallationId)
      return c.json({ error: 'not_connected' }, 404);
    if (!deps.githubApp?.configured)
      return c.json({ error: 'github_app_unconfigured' }, 503);
    try {
      return c.json({
        repos: await deps.githubApp.listRepos(user.githubInstallationId),
      });
    } catch {
      return c.json({ error: 'github_error' }, 502);
    }
  });
  app.get('/v1/runs', async c => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: 'unauthorized' }, 401);
    return c.json({ runs: await deps.store.listByEmail(user.email) });
  });
  app.get('/v1/billing/plans', c =>
    c.json({ plans: deps.billing?.catalog.public ?? [] })
  );
  app.post('/v1/billing/checkout', async c => {
    if (!deps.billing) return c.json({ error: 'billing_unavailable' }, 503);
    const parsed = CheckoutSchema.safeParse(
      await c.req.json().catch(() => null)
    );
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    try {
      return c.json(
        await deps.billing.provider.createCheckout(
          deps.billing.catalog.get(parsed.data.plan),
          parsed.data.email
        ),
        201
      );
    } catch {
      return c.json({ error: 'billing_provider_error' }, 502);
    }
  });
  app.get('/v1/billing/account', async c => {
    if (!deps.billing) return c.json({ error: 'billing_unavailable' }, 503);
    const parsed = AccountSchema.safeParse(c.req.query('email'));
    if (!parsed.success) return c.json({ error: 'invalid_email' }, 400);
    const account = await deps.billing.store.getAccount(parsed.data);
    return account ? c.json({ account }) : c.json({ error: 'not_found' }, 404);
  });
  app.post('/v1/billing/webhooks/dodo', async c => {
    if (!deps.billing) return c.json({ error: 'billing_unavailable' }, 503);
    const raw = await c.req.text(),
      headers = Object.fromEntries(
        [...c.req.raw.headers.entries()].map(([k, v]) => [k.toLowerCase(), v])
      );
    let event;
    try {
      event = await deps.billing.provider.verifyWebhook(raw, headers);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof BillingProviderError &&
            error.message === 'invalid_signature'
              ? 'invalid_signature'
              : 'invalid_webhook',
        },
        error instanceof BillingProviderError &&
          error.message === 'invalid_signature'
          ? 401
          : 400
      );
    }
    if (event.kind === 'ignored')
      return c.json({ received: true, applied: false });
    if (
      !event.email ||
      !event.customerId ||
      !event.subscriptionId ||
      !event.productId
    )
      return c.json({ error: 'invalid_webhook' }, 400);
    const plan = deps.billing.catalog.plans.find(
      p => p.productId === event.productId
    );
    if (!plan) return c.json({ received: true, applied: false });
    const status =
      event.kind === 'cancelled'
        ? 'cancelled'
        : event.kind === 'paymentFailed'
          ? 'past_due'
          : 'active';
    await deps.billing.store.upsertSubscription({
      email: event.email,
      customerId: event.customerId,
      subscriptionId: event.subscriptionId,
      plan: plan.slug,
      status,
    });
    let applied = true;
    if (event.kind === 'activated' || event.kind === 'renewed')
      applied = await deps.billing.store.grantCredits({
        accountKey: event.email,
        amount: plan.includedCredits,
        idempotencyKey: event.grantKey || event.id,
      });
    return c.json({ received: true, applied });
  });
  app.post('/v1/runs', async c => {
    const parsed = CreateRunSchema.safeParse(
      await c.req.json().catch(() => null)
    );
    if (!parsed.success)
      return c.json(
        { error: 'invalid_request', details: parsed.error.flatten() },
        400
      );
    if (deps.billing && !parsed.data.email)
      return c.json({ error: 'email_required' }, 400);
    try {
      const run = await createRun(parsed.data);
      return c.json(
        { run, statusUrl: `${deps.config.PUBLIC_BASE_URL}/v1/runs/${run.id}` },
        202
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'insufficient_credits')
        return c.json(
          {
            error: 'insufficient_credits',
            plansUrl: `${deps.config.PUBLIC_BASE_URL}/v1/billing/plans`,
          },
          402
        );
      throw error;
    }
  });
  app.get('/v1/runs/:id', async c => {
    const run = await deps.store.get(c.req.param('id'));
    return run ? c.json({ run }) : c.json({ error: 'not_found' }, 404);
  });
  app.get('/v1/runs/:id/report', async c => {
    const run = await deps.store.get(c.req.param('id'));
    return run
      ? c.json({
          run,
          plan: run.plan,
          results: run.results ?? [],
          findings: run.findings ?? [],
          artifacts: run.artifacts ?? [],
        })
      : c.json({ error: 'not_found' }, 404);
  });
  app.post('/v1/github/webhook', async c => {
    const raw = await c.req.text();
    if (
      !verifyGitHubSignature(
        raw,
        c.req.header('x-hub-signature-256'),
        deps.config.GITHUB_WEBHOOK_SECRET
      )
    )
      return c.json({ error: 'invalid_signature' }, 401);
    if (c.req.header('x-github-event') !== 'pull_request')
      return c.json({ accepted: false, reason: 'ignored_event' });
    const payload = JSON.parse(raw) as PullRequestWebhook;
    if (!['opened', 'reopened', 'synchronize'].includes(payload.action))
      return c.json({ accepted: false, reason: 'ignored_action' });
    const targetUrl =
      c.req.header('x-freebug-target-url') ?? deps.config.GITHUB_TARGET_URL;
    if (!targetUrl) return c.json({ error: 'missing_target_url' }, 422);
    const owner = payload.installation
      ? await deps.users.getByInstallation(String(payload.installation.id))
      : undefined;
    if (deps.billing && !owner)
      return c.json({ error: 'billing_account_required' }, 402);
    const run = await createRun({
      mode: 'pr',
      targetUrl,
      repository: payload.repository.full_name,
      pullRequest: payload.pull_request.number,
      email: owner?.email,
    });
    return c.json(
      {
        accepted: true,
        runId: run.id,
        repository: payload.repository.full_name,
        pullRequest: payload.pull_request.number,
        statusUrl: `${deps.config.PUBLIC_BASE_URL}/v1/runs/${run.id}`,
      },
      202
    );
  });
  return app;
}
