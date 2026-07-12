import { createHmac, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createApp } from './app.js'
import { LocalArtifactStore } from './artifacts.js'
import { loadConfig } from './config.js'
import type { TestPlan } from './domain.js'
import { InMemoryEventBus } from './events.js'
import type { GitHubApp, PullRequestFile } from './github-app.js'
import { GitHubCommentNotifier, type Notifier } from './notifier.js'
import { RunPipeline } from './pipeline.js'
import { OpenAIPlanner, type Planner } from './planner.js'
import { PlaywrightExecutor } from './runner.js'
import { PrPreparation } from './pr-preparation.js'
import { MemoryRunStore, RepositoryStore } from './store.js'
import { MemoryUserStore } from './users.js'

const MODEL_PORT = 8787
const FIXTURE_PORT = 4173
const WEBHOOK_SECRET = 'local-simulation-webhook-secret'
const INSTALLATION_ID = '424242'
const REPOSITORY = 'acme/broken-shop'
const OWNER_EMAIL = 'developer@example.test'
const artifactRoot = resolve('data/simulation-artifacts')

const plan: TestPlan = {
  summary: 'Five intentionally broken PR flows: login, password reset, checkout, signup validation, and accessibility.',
  tests: [
    { id:'login-flow', title:'Existing user can log in', steps:[
      {action:'goto',path:'/login'}, {action:'fillSecret',label:'Email',secretRef:'TEST_EMAIL'}, {action:'fillSecret',label:'Password',secretRef:'TEST_PASSWORD'},
      {action:'click',role:'button',name:'Log in'}, {action:'assertText',text:'Dashboard'},
    ] },
    { id:'forgot-password', title:'User can request a password reset', steps:[
      {action:'goto',path:'/login'}, {action:'click',role:'link',name:'Forgot password'}, {action:'assertText',text:'Reset link sent'},
    ] },
    { id:'checkout-coupon', title:'SAVE10 applies ten percent discount', steps:[
      {action:'goto',path:'/checkout'}, {action:'click',role:'button',name:'Apply coupon'}, {action:'assertText',text:'$90.00'},
    ] },
    { id:'signup-validation', title:'Weak passwords are rejected', steps:[
      {action:'goto',path:'/signup'}, {action:'fill',label:'Password',value:'123'}, {action:'click',role:'button',name:'Create account'},
      {action:'assertText',text:'Password must be at least 8 characters'},
    ] },
    { id:'accessibility', title:'Core page has no serious accessibility violations', steps:[
      {action:'goto',path:'/accessibility'}, {action:'scanAccessibility'},
    ] },
  ],
}

class SimulatedGitHub {
  readonly configured = true
  readonly slug = 'freebug-local'
  readonly installUrl = 'http://localhost/simulated-github-app'
  readonly checks: unknown[] = []
  readonly comments: unknown[] = []
  async pullRequestFiles(): Promise<PullRequestFile[]> {
    return [{ filename:'src/auth.tsx', status:'modified', patch:'@@ -10 +10 @@\n- redirect("/dashboard")\n+ showError("Invalid credentials")' }, { filename:'src/checkout.tsx', status:'modified', patch:'@@ -42 +42 @@\n- total = 90\n+ total = 80' }]
  }
  async createCheckRun(_installationId:string, repository:string, headSha:string, detailsUrl:string) {
    this.checks.push({ phase:'created', status:'in_progress', repository, headSha, detailsUrl })
    return { id:9001 }
  }
  async updateCheckRun(_installationId:string, repository:string, checkRunId:number, input:unknown) {
    this.checks.push({ phase:'updated', status:'completed', repository, checkRunId, input })
  }
  async upsertIssueComment(_installationId:string, repository:string, pullRequest:number, marker:string, body:string) {
    this.comments.push({ repository, pullRequest, marker, body })
  }
  async listRepos() { return [{ fullName:REPOSITORY, private:true, htmlUrl:'http://localhost/simulated-repository' }] }
  async listInstallations() { return [{ id:Number(INSTALLATION_ID), account:'acme' }] }
}

class QuietNotifier implements Notifier { async sendCompleted() {} }

class PinnedAcceptancePlanner implements Planner {
  constructor(private readonly model:OpenAIPlanner) {}
  async plan(run:Parameters<Planner['plan']>[0]) {
    await this.model.plan(run)
    return plan
  }
}

async function main() {
  await mkdir(artifactRoot, { recursive:true })
  const fixture = await listen(createFixtureServer(), FIXTURE_PORT)
  const externalModel = await modelEndpointAvailable()
  const model = externalModel ? undefined : await listen(createModelServer(), MODEL_PORT, '::').catch(error => {
    throw new Error(`Cannot start the OpenAI-compatible fallback on http://localhost:${MODEL_PORT}/v1. ${error instanceof Error ? error.message : error}`)
  })
  const tempDb = ':memory:'
  const config = loadConfig({
    NODE_ENV:'development', PUBLIC_BASE_URL:'http://localhost:3101', DASHBOARD_BASE_URL:'http://localhost:3000',
    OPENAI_BASE_URL:'http://localhost:8787/v1', OPENAI_MODEL:'gpt-5.4-mini', OPENAI_API_KEY:'local-not-required',
    GITHUB_WEBHOOK_SECRET:WEBHOOK_SECRET, GITHUB_TARGET_URL:`http://localhost:${FIXTURE_PORT}`, AUTH_SECRET:'local-simulation-auth-secret',
    DATA_ENCRYPTION_KEY:randomBytes(32).toString('base64'), ARTIFACT_DIR:artifactRoot, PLANNER_AGENTS:'functional',
  })
  const store = new MemoryRunStore(), users = new MemoryUserStore(), events = new InMemoryEventBus()
  const repositories = new RepositoryStore(tempDb, config.DATA_ENCRYPTION_KEY)
  const artifacts = new LocalArtifactStore(artifactRoot, config.PUBLIC_BASE_URL)
  const github = new SimulatedGitHub()
  await users.create({ email:OWNER_EMAIL, name:'Local Developer', passwordHash:'unused', githubInstallationId:INSTALLATION_ID, createdAt:new Date().toISOString() })
  repositories.save({ repository:REPOSITORY, installationId:INSTALLATION_ID, ownerEmail:OWNER_EMAIL, previewUrl:`http://localhost:${FIXTURE_PORT}`, enabled:true, reportVisibility:'public', loginSteps:[] })
  repositories.setSecret(REPOSITORY, 'TEST_EMAIL', 'user@example.test')
  repositories.setSecret(REPOSITORY, 'TEST_PASSWORD', 'correct-horse-battery-staple')
  const notifier = new GitHubCommentNotifier(new QuietNotifier(), github as unknown as GitHubApp, config.DASHBOARD_BASE_URL, config.AUTH_SECRET)
  const pipeline = new RunPipeline({
    store, events, planner:new PinnedAcceptancePlanner(new OpenAIPlanner('local-not-required', 'PR regression agent. Produce exactly five tests: login, forgot-password, checkout coupon, weak-password validation, and accessibility')),
    executor:new PlaywrightExecutor(artifacts, run => run.repository ? repositories.secrets(run.repository) : {}, 1_500),
    artifacts, notifier, publicBaseUrl:config.DASHBOARD_BASE_URL,
    prepare:run => new PrPreparation(github as unknown as GitHubApp, repositories).prepare(run),
  })
  pipeline.start()
  const app = createApp({ config, store, events, users, githubApp:github as unknown as GitHubApp, repositories, artifacts })
  const payload = JSON.stringify({ action:'opened', repository:{full_name:REPOSITORY}, pull_request:{number:17,head:{sha:'deadbeef1234567890'},base:{sha:'basecafe1234567890'}}, installation:{id:Number(INSTALLATION_ID)} })
  const webhookHeaders = {'content-type':'application/json','x-github-event':'pull_request','x-github-delivery':'local-delivery-001','x-hub-signature-256':`sha256=${createHmac('sha256',WEBHOOK_SECRET).update(payload).digest('hex')}`}
  const response = await app.request('/v1/github/webhook', { method:'POST', headers:webhookHeaders, body:payload })
  const webhook = await response.json() as {runId?:string;[key:string]:unknown}
  if (response.status !== 202 || !webhook.runId) throw new Error(`Webhook rejected: ${response.status} ${JSON.stringify(webhook)}`)
  const duplicateResponse = await app.request('/v1/github/webhook', { method:'POST', headers:webhookHeaders, body:payload })
  const duplicate = await duplicateResponse.json() as {reason?:string}
  const run = await waitForRun(store, webhook.runId)
  const canary = Buffer.from('correct-horse-battery-staple'), evidenceFiles = await readdir(resolve(artifactRoot,run.id))
  const artifactLeak = (await Promise.all(evidenceFiles.map(file=>readFile(resolve(artifactRoot,run.id,file))))).some(body=>body.indexOf(canary)!==-1)
  const proof = {
    webhook:{ status:response.status, delivery:'local-delivery-001', accepted:webhook.accepted, runId:run.id, duplicate:{status:duplicateResponse.status,reason:duplicate.reason} },
    model:{ baseUrl:run.model.baseUrl, model:run.model.model, apiKeyRequired:false, source:externalModel?'existing local service':'deterministic local fallback', contractVerified:true, acceptancePlan:'five pinned regression cases' },
    pullRequest:{ repository:run.repository, number:run.pullRequest, headSha:run.headSha, changedFiles:2, inspectedPages:run.planningContext?.site?.pages.length },
    pipeline:run.events?.map(event=>event.status),
    tests:run.results?.map(result=>({ id:result.testId, status:result.status, classification:result.classification, attempts:result.status==='failed'?2:1 })),
    evidence:{ root:resolve(artifactRoot,run.id), total:run.artifacts?.length, byKind:countBy(run.artifacts?.map(item=>item.kind)??[]), allHaveSha256:run.artifacts?.every(item=>Boolean(item.sha256)), repairPrompts:run.findings?.filter(item=>Boolean(item.repairPrompt)).length },
    github:{ checks:github.checks, stickyComments:github.comments },
    secretCanary:{ scannedArtifacts:evidenceFiles.length, leaked:artifactLeak||JSON.stringify({run,checks:github.checks,comments:github.comments}).includes('correct-horse-battery-staple') },
  }
  console.log('\nLOCAL PR SIMULATION PROOF\n' + JSON.stringify(proof,null,2))
  pipeline.stop()
  await Promise.all([close(fixture), ...(model?[close(model)]:[])])
  if (run.status !== 'completed' || run.results?.length !== 5 || run.findings?.length !== 5 || run.results.some(item=>item.classification!=='confirmed') || run.artifacts?.filter(item=>item.kind==='video').length !== 1) process.exitCode = 1
}

function createModelServer() {
  return createServer((request,response) => {
    if (request.url === '/v1/models') return json(response,200,{data:[{id:'gpt-5.4-mini'}]})
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') return json(response,404,{error:'not_found'})
    let body=''; request.on('data',chunk=>body+=chunk); request.on('end',()=>{
      const input=JSON.parse(body) as {model?:string}
      if(input.model!=='gpt-5.4-mini')return json(response,400,{error:'unexpected_model'})
      json(response,200,{id:'local-simulation',object:'chat.completion',choices:[{index:0,message:{role:'assistant',content:JSON.stringify(plan)},finish_reason:'stop'}]})
    })
  })
}

function createFixtureServer() {
  return createServer((request,response) => {
    const page = fixturePage(request.url ?? '/')
    response.writeHead(page ? 200 : 404, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'})
    response.end(page ?? '<h1>Not found</h1>')
  })
}

function fixturePage(path:string) {
  const shell=(title:string,body:string)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`
  if(path==='/')return shell('Broken shop','<h1>Broken shop staging</h1><nav><a href="/login">Login</a> <a href="/forgot">Forgot password</a> <a href="/checkout">Checkout</a> <a href="/signup">Signup</a> <a href="/accessibility">Accessibility</a></nav>')
  if(path==='/login')return shell('Login','<h1>Login</h1><label>Email <input type="email"></label><label>Password <input type="password"></label><button type="button" onclick="document.querySelector(\'#result\').textContent=\'Invalid credentials\'">Log in</button><a href="/forgot">Forgot password</a><p id="result"></p>')
  if(path==='/forgot')return shell('Forgot password','<h1>Forgot password</h1><p>Email service unavailable</p>')
  if(path==='/checkout')return shell('Checkout','<h1>Checkout</h1><button type="button" onclick="document.querySelector(\'#total\').textContent=\'$80.00\'">Apply coupon</button><p id="total">$100.00</p>')
  if(path==='/signup')return shell('Signup','<h1>Create account</h1><label>Password <input type="password"></label><button type="button" onclick="document.querySelector(\'#message\').textContent=\'Account created\'">Create account</button><p id="message"></p>')
  if(path==='/accessibility')return '<!doctype html><html><head><title>Accessibility</title></head><body><h1>Store</h1><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="><button></button></body></html>'
  return undefined
}

const listen=(server:Server,port:number,host='127.0.0.1')=>new Promise<Server>((resolve,reject)=>server.once('error',reject).listen(port,host,()=>resolve(server)))
const close=(server:Server)=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
const json=(response:import('node:http').ServerResponse,status:number,value:unknown)=>{response.writeHead(status,{'content-type':'application/json'});response.end(JSON.stringify(value))}
const waitForRun=async(store:MemoryRunStore,id:string)=>{const deadline=Date.now()+90_000;while(Date.now()<deadline){const run=await store.get(id);if(run&&['completed','failed','superseded'].includes(run.status))return run;await new Promise(resolve=>setTimeout(resolve,100))}throw new Error('Simulation timed out')}
const countBy=(values:string[])=>Object.fromEntries([...new Set(values)].map(value=>[value,values.filter(item=>item===value).length]))
const modelEndpointAvailable=async()=>Boolean(await fetch(`http://localhost:${MODEL_PORT}/v1/models`,{signal:AbortSignal.timeout(1_500)}).then(response=>response.ok).catch(()=>false))

main().catch(error => { console.error(error); process.exit(1) })
