import type { ArtifactStore } from './artifacts.js'
import type { BillingStore } from './billing/store.js'
import type { Run, RunStatus, Finding } from './domain.js'
import type { EventBus } from './events.js'
import type { Notifier } from './notifier.js'
import type { Planner } from './planner.js'
import type { Executor } from './runner.js'
import type { RunStore } from './store.js'

export class RunPipeline {
  private unsubscribe?:()=>void
  constructor(private readonly deps:{store:RunStore;events:EventBus;planner:Planner;executor:Executor;artifacts:ArtifactStore;notifier:Notifier;publicBaseUrl:string;billing?:BillingStore;prepare?:(run:Run)=>Promise<Partial<Run>>}){}
  start(){
    this.unsubscribe=this.deps.events.subscribe(async event=>{
      if(event.type!=='run.requested')return
      try{
        let run=await this.stage(event.runId,'scanning')
        if(this.deps.prepare) run=await this.deps.store.update(run.id,await this.deps.prepare(run))
        run=await this.stage(run.id,'planning')
        const plan=await this.deps.planner.plan(run)
        run=await this.deps.store.update(run.id,{status:'running',plan,events:this.event(run,'running')})
        const execution=await this.deps.executor.execute(run)
        if((await this.required(run.id)).status==='superseded')return
        run=await this.deps.store.update(run.id,{status:'confirming',...execution,findings:execution.findings.map(finding=>({...finding,repairPrompt:repairPrompt(run,finding,`${this.deps.publicBaseUrl.replace(/\/$/,'')}/dashboard/runs/${run.id}`)})),events:this.event(run,'confirming')})
        run=await this.stage(run.id,'uploading')
        const manifest=await this.deps.artifacts.saveJson(run.id,'manifest','manifest.json',{runId:run.id,artifacts:run.artifacts,results:run.results,findings:run.findings})
        const report=await this.deps.artifacts.saveJson(run.id,'report','report.json',{runId:run.id,run,plan,results:run.results,findings:run.findings,artifacts:[...(run.artifacts??[]),manifest]})
        run=await this.deps.store.update(run.id,{status:'completed',artifacts:[...(run.artifacts??[]),manifest,report],reportUrl:`${this.deps.publicBaseUrl.replace(/\/$/,'')}/dashboard/runs/${run.id}`,events:this.event(run,'completed')})
        if(run.billingReservationId)await this.deps.billing?.settleReservation(run.billingReservationId).catch(error=>console.error('billing_reconciliation_failed',{runId:run.id,error:error instanceof Error?error.message:String(error)}))
        await this.deps.notifier.sendCompleted(run)
      }catch(cause){
        const current=await this.deps.store.get(event.runId)
        if(current?.status==='superseded')return
        const message=cause instanceof Error?cause.message:String(cause)
        const run=current?await this.deps.store.update(event.runId,{status:'failed',error:message,events:this.event(current,'failed',message)}).catch(()=>undefined):undefined
        if(run?.billingReservationId)await this.deps.billing?.releaseReservation(run.billingReservationId).catch(()=>undefined)
        if(run)await this.deps.notifier.sendCompleted(run).catch(()=>undefined)
      }
    })
    return this.unsubscribe
  }
  stop(){this.unsubscribe?.()}
  private async stage(id:string,status:RunStatus){const run=await this.required(id);if(run.status==='superseded')throw new Error('Run superseded');return this.deps.store.update(id,{status,events:this.event(run,status)})}
  private event(run:Run,status:RunStatus,message?:string){return [...(run.events??[]),{status,at:new Date().toISOString(),message}]}
  private async required(id:string){const run=await this.deps.store.get(id);if(!run)throw new Error(`Run ${id} not found`);return run}
}

function repairPrompt(run:Run,finding:Finding,reportUrl:string){
  return `Fix this ${finding.classification ?? 'reported'} browser-test failure in ${run.repository ?? 'the application'}${run.pullRequest?` PR #${run.pullRequest}`:''}${run.headSha?` at ${run.headSha}`:''}.

Test: ${finding.title}
Target: ${run.targetUrl}
Expected: ${finding.expected ?? 'The generated user flow should complete.'}
Actual: ${finding.actual ?? finding.details}
Reproduction:
${(finding.reproduction??[]).map((step,index)=>`${index+1}. ${step}`).join('\n')}

Relevant PR diff context:
${run.planningContext?.diff?.slice(0,3000) ?? 'No diff context was captured.'}

Evidence: ${finding.classification ?? 'reported'} ${finding.category ?? 'functional'} failure with ${finding.artifactIds.length} linked proof artifacts.

Inspect the code and reproduce the issue. Fix the shared root cause with the smallest safe change, add or update one regression test, and run the relevant checks. Do not edit generated scripts or evidence artifacts. Report: ${reportUrl}`
}
