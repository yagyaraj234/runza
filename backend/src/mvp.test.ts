import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createArtifactSignature, createShareToken, verifyArtifactSignature, verifyShareToken } from './auth.js'
import { compilePlaywrightScript } from './playwright-compiler.js'
import { summarize } from './pr-preparation.js'
import { RepositoryStore } from './store.js'
import { GitHubCommentNotifier } from './notifier.js'
import type { Run } from './domain.js'

const dirs:string[]=[]
afterEach(async()=>{await Promise.all(dirs.splice(0).map(path=>rm(path,{recursive:true,force:true})))})

describe('PR testing MVP security and context',()=>{
  it('encrypts repository secrets and never returns values with settings',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'runza-store-'));dirs.push(dir);const path=join(dir,'runs.db')
    const store=new RepositoryStore(path,Buffer.alloc(32,7).toString('base64'))
    store.save({repository:'acme/app',installationId:'1',ownerEmail:'owner@example.com',previewUrl:'https://preview.test',enabled:true,reportVisibility:'private',loginSteps:[]})
    store.setSecret('acme/app','TEST_PASSWORD','canary-secret')
    expect(store.secretNames('acme/app')).toEqual(['TEST_PASSWORD'])
    expect(store.secrets('acme/app')).toEqual({TEST_PASSWORD:'canary-secret'})
    expect((await readFile(path)).includes(Buffer.from('canary-secret'))).toBe(false)
  })
  it('creates verifiable per-run share tokens',()=>{const token=createShareToken('run-1','nonce','secret');expect(verifyShareToken(token,'run-1','nonce','secret')).toBe(true);expect(verifyShareToken(token,'run-2','nonce','secret')).toBe(false)})
  it('expires artifact proxy signatures',()=>{const expires=Date.now()+10_000,signature=createArtifactSignature('run-1','artifact-1',expires,'secret');expect(verifyArtifactSignature('run-1','artifact-1',expires,signature,'secret')).toBe(true);expect(verifyArtifactSignature('run-1','artifact-2',expires,signature,'secret')).toBe(false)})
  it('filters noisy diff files and caps generated context',()=>{expect(summarize([{filename:'src/app.ts',status:'modified',patch:'+fix'},{filename:'package-lock.json',status:'modified',patch:'+noise'}])).toContain('src/app.ts');expect(summarize([{filename:'package-lock.json',status:'modified',patch:'+noise'}])).toBe('')})
  it('compiles secret references without secret values and records proof',()=>{const script=compilePlaywrightScript({summary:'login',tests:[{id:'login',title:'Login',steps:[{action:'fillSecret',label:'Password',secretRef:'TEST_PASSWORD'}]}]},'https://preview.test');expect(script).toContain('process.env[step.secretRef]');expect(script).toContain('recordVideo');expect(script).toContain("classification =");expect(script).not.toContain('canary-secret')})
  it('updates one marked PR comment and its check',async()=>{const calls:string[]=[];const github={upsertIssueComment:async()=>{calls.push('comment')},updateCheckRun:async()=>{calls.push('check')}} as any;const notifier=new GitHubCommentNotifier({sendCompleted:async()=>{calls.push('inner')}},github,'https://app.test','secret');await notifier.sendCompleted({id:'r',mode:'pr',status:'completed',targetUrl:'https://preview.test',repository:'acme/app',pullRequest:1,installationId:'2',headSha:'abc',checkRunId:3,email:'owner@example.com',model:{baseUrl:'https://api.test',model:'m'},results:[],createdAt:'',updatedAt:''} as Run);expect(calls).toEqual(['inner','comment','check'])})
})
