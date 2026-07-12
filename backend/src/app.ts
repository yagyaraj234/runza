import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { z } from 'zod';
import type { Config } from './config.js';
import type { EventBus } from './events.js';
import { verifyGitHubSignature, type PullRequestWebhook } from './github.js';
import type { Run } from './domain.js';
import type { RepositoryStore, RunStore } from './store.js';
import type { ArtifactStore } from './artifacts.js';
import type { UserStore, User } from './users.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  verifyShareToken,
  createArtifactSignature,
  verifyArtifactSignature,
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
  installationId: z.string().optional(),
  headSha: z.string().optional(),
  baseSha: z.string().optional(),
  deliveryId: z.string().optional(),
  checkRunId: z.number().int().positive().optional(),
  shareNonce: z.string().optional(),
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
const SettingsSchema = z.object({
  previewUrl:z.string().url(), enabled:z.boolean().default(true), reportVisibility:z.enum(['private','public']).default('private'),
  loginPath:z.string().regex(/^\//).optional(), loginSteps:z.array(z.discriminatedUnion('action',[
    z.object({action:z.literal('fillSecret'),label:z.string().min(1),secretRef:z.string().regex(/^[A-Z][A-Z0-9_]*$/)}),
    z.object({action:z.literal('click'),role:z.enum(['button','link']),name:z.string().min(1)}),
    z.object({action:z.literal('assertText'),text:z.string().min(1)}),
  ])).max(20).default([]),
});
const SecretSchema=z.object({value:z.string().min(1).max(10_000)});
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
  repositories?: RepositoryStore;
  artifacts?: ArtifactStore;
  verifyRepository?: (repository:string)=>Promise<void>;
  billing?: BillingDeps;
}) {
  const app = new Hono();
  app.use('*', cors());
  app.get('/health', c => c.json({ status: 'ok' }));
  if(deps.config.NODE_ENV!=='production') app.use(
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
  const createRun = async (input: z.infer<typeof CreateRunSchema>, publish = true) => {
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
      installationId: input.installationId,
      headSha: input.headSha,
      baseSha: input.baseSha,
      deliveryId: input.deliveryId,
      checkRunId: input.checkRunId,
      shareNonce: input.shareNonce,
      email: accountKey,
      billingAccountKey: accountKey,
      billingReservationId: deps.billing ? id : undefined,
      model: input.model ?? {
        baseUrl: deps.config.OPENAI_BASE_URL,
        model: deps.config.OPENAI_MODEL,
      },
      createdAt: now,
      updatedAt: now,
      events: [{status:'queued',at:now}],
    };
    try {
      await deps.store.create(run);
      if(publish) await deps.events.publish({ type: 'run.requested', runId: id });
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
    if(!deps.githubApp?.configured)return c.json({error:'github_app_unconfigured'},503)
    const installations=await deps.githubApp.listInstallations().catch(()=>[])
    if(!installations.some(item=>String(item.id)===parsed.data.installationId))return c.json({error:'invalid_installation'},403)
    try{await deps.users.setInstallation(user.email, parsed.data.installationId)}catch{return c.json({error:'installation_already_linked'},409)}
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
  const repositoryForUser = async (user:User, owner:string, repo:string) => {
    const repository=`${owner}/${repo}`
    if(!user.githubInstallationId||!deps.githubApp?.configured)return undefined
    const available=await deps.githubApp.listRepos(user.githubInstallationId)
    return available.some(item=>item.fullName===repository)?repository:undefined
  }
  app.get('/v1/repos/:owner/:repo/settings',async c=>{
    const user=await requireUser(c);if(!user)return c.json({error:'unauthorized'},401)
    const repository=await repositoryForUser(user,c.req.param('owner'),c.req.param('repo'));if(!repository)return c.json({error:'forbidden'},403)
    const settings=deps.repositories?.get(repository)
    return c.json({settings:settings?{...settings,secretNames:deps.repositories?.secretNames(repository)??[]}:null})
  })
  app.put('/v1/repos/:owner/:repo/settings',async c=>{
    const user=await requireUser(c);if(!user)return c.json({error:'unauthorized'},401)
    const repository=await repositoryForUser(user,c.req.param('owner'),c.req.param('repo'));if(!repository||!user.githubInstallationId)return c.json({error:'forbidden'},403)
    const parsed=SettingsSchema.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({error:'invalid_request',details:parsed.error.flatten()},400)
    const settings=deps.repositories?.save({repository,installationId:user.githubInstallationId,ownerEmail:user.email,...parsed.data})
    return settings?c.json({settings:{...settings,secretNames:deps.repositories?.secretNames(repository)??[]}}):c.json({error:'repository_store_unavailable'},503)
  })
  app.put('/v1/repos/:owner/:repo/secrets/:name',async c=>{
    const user=await requireUser(c);if(!user)return c.json({error:'unauthorized'},401)
    const repository=await repositoryForUser(user,c.req.param('owner'),c.req.param('repo'));if(!repository)return c.json({error:'forbidden'},403)
    const name=c.req.param('name');if(!/^[A-Z][A-Z0-9_]*$/.test(name))return c.json({error:'invalid_secret_name'},400)
    const parsed=SecretSchema.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({error:'invalid_request'},400)
    deps.repositories?.setSecret(repository,name,parsed.data.value);return c.json({name,configured:true})
  })
  app.delete('/v1/repos/:owner/:repo/secrets/:name',async c=>{
    const user=await requireUser(c);if(!user)return c.json({error:'unauthorized'},401)
    const repository=await repositoryForUser(user,c.req.param('owner'),c.req.param('repo'));if(!repository)return c.json({error:'forbidden'},403)
    deps.repositories?.deleteSecret(repository,c.req.param('name'));return c.json({deleted:true})
  })
  app.post('/v1/repos/:owner/:repo/settings/verify',async c=>{
    const user=await requireUser(c);if(!user)return c.json({error:'unauthorized'},401)
    const repository=await repositoryForUser(user,c.req.param('owner'),c.req.param('repo'));if(!repository)return c.json({error:'forbidden'},403)
    try{await deps.verifyRepository?.(repository);return c.json({verified:true})}catch(error){return c.json({verified:false,error:error instanceof Error?error.message:String(error)},422)}
  })
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
    const user=await requireUser(c);if(!user)return c.json({error:'unauthorized'},401)
    const run = await deps.store.get(c.req.param('id'));
    return run&&run.email===user.email ? c.json({ run }) : c.json({ error: 'not_found' }, 404);
  });
  app.get('/v1/runs/:id/report', async c => {
    const user=await requireUser(c);if(!user)return c.json({error:'unauthorized'},401)
    const run = await deps.store.get(c.req.param('id'));
    return run
      && run.email===user.email
      ? c.json({
          run,
          plan: run.plan,
          results: run.results ?? [],
          findings: run.findings ?? [],
          artifacts: run.artifacts ?? [],
        })
      : c.json({ error: 'not_found' }, 404);
  });
  app.get('/v1/share/runs/:token',async c=>{
    const token=c.req.param('token'),runId=token.split('.')[0],run=runId?await deps.store.get(runId):undefined
    if(!run||!verifyShareToken(token,run.id,run.shareNonce,deps.config.AUTH_SECRET))return c.json({error:'not_found'},404)
    const safeRun={...run,email:undefined,billingAccountKey:undefined,billingReservationId:undefined,planningContext:undefined,model:undefined}
    return c.json({run:safeRun,plan:run.plan,results:run.results??[],findings:run.findings??[],artifacts:run.artifacts??[]})
  })
  app.post('/v1/artifacts/:id/url',async c=>{
    const body=await c.req.json().catch(()=>({})) as {runId?:string;shareToken?:string}
    if(!body.runId)return c.json({error:'invalid_request'},400)
    const run=await deps.store.get(body.runId);if(!run)return c.json({error:'not_found'},404)
    const user=await requireUser(c),shared=body.shareToken?verifyShareToken(body.shareToken,run.id,run.shareNonce,deps.config.AUTH_SECRET):false
    if(run.email!==user?.email&&!shared)return c.json({error:'forbidden'},403)
    const artifact=run.artifacts?.find(item=>item.id===c.req.param('id'));if(!artifact)return c.json({error:'not_found'},404)
    try{return c.json(await deps.artifacts?.accessUrl?.(artifact,900))}catch{
      const expires=Date.now()+900_000,signature=createArtifactSignature(run.id,artifact.id,expires,deps.config.AUTH_SECRET)
      return c.json({url:`${deps.config.PUBLIC_BASE_URL.replace(/\/$/,'')}/v1/artifacts/${artifact.id}/content?runId=${encodeURIComponent(run.id)}&expires=${expires}&signature=${signature}`,expiresAt:new Date(expires).toISOString()})
    }
  })
  app.get('/v1/artifacts/:id/content',async c=>{
    const runId=c.req.query('runId'),expires=Number(c.req.query('expires')),signature=c.req.query('signature')??''
    if(!runId||!verifyArtifactSignature(runId,c.req.param('id'),expires,signature,deps.config.AUTH_SECRET))return c.json({error:'forbidden'},403)
    const run=await deps.store.get(runId),artifact=run?.artifacts?.find(item=>item.id===c.req.param('id'));if(!artifact)return c.json({error:'not_found'},404)
    try{const body=await deps.artifacts?.read?.(artifact);if(!body)throw new Error('unavailable');return new Response(Uint8Array.from(body).buffer,{headers:{'content-type':artifact.mimeType??'application/octet-stream','content-length':String(body.length),'cache-control':'private, max-age=900'}})}catch{return c.json({error:'artifact_unavailable'},503)}
  })
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
    const deliveryId=c.req.header('x-github-delivery')
    const settings=deps.repositories?.get(payload.repository.full_name)
    if(settings&&!settings.enabled)return c.json({accepted:false,reason:'repository_disabled'})
    const targetUrl =
      c.req.header('x-freebug-target-url') ?? settings?.previewUrl ?? deps.config.GITHUB_TARGET_URL;
    if (!targetUrl) return c.json({ error: 'missing_target_url' }, 422);
    const owner = payload.installation
      ? await deps.users.getByInstallation(String(payload.installation.id))
      : undefined;
    if (deps.billing && !owner)
      return c.json({ error: 'billing_account_required' }, 402);
    if(deliveryId&&!await deps.store.claimDelivery(deliveryId))return c.json({accepted:false,reason:'duplicate_delivery'})
    if(owner){for(const previous of await deps.store.listByEmail(owner.email))if(previous.repository===payload.repository.full_name&&previous.pullRequest===payload.pull_request.number&&!['completed','failed','superseded'].includes(previous.status)&&previous.headSha!==payload.pull_request.head.sha)await deps.store.update(previous.id,{status:'superseded',events:[...(previous.events??[]),{status:'superseded',at:new Date().toISOString(),message:'Newer pull request commit received'}]})}
    let run = await createRun({
      mode: 'pr',
      targetUrl,
      repository: payload.repository.full_name,
      pullRequest: payload.pull_request.number,
      installationId: payload.installation ? String(payload.installation.id) : undefined,
      headSha:payload.pull_request.head.sha,
      baseSha:payload.pull_request.base.sha,
      deliveryId,
      shareNonce:settings?.reportVisibility==='public'?randomBytes(24).toString('base64url'):undefined,
      email: owner?.email,
    },false);
    if(deps.githubApp?.configured&&run.installationId&&run.repository&&run.headSha){
      const detailsUrl=`${deps.config.DASHBOARD_BASE_URL.replace(/\/$/,'')}/dashboard/runs/${run.id}`
      const check=await deps.githubApp.createCheckRun(run.installationId,run.repository,run.headSha,detailsUrl).catch(()=>undefined)
      if(check)run=await deps.store.update(run.id,{checkRunId:check.id})
    }
    await deps.events.publish({type:'run.requested',runId:run.id})
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
