import type { ArtifactStore } from './artifacts.js'
import type { EventBus } from './events.js'
import type { Notifier } from './notifier.js'
import type { Planner } from './planner.js'
import type { Executor } from './runner.js'
import type { RunStore } from './store.js'

export class RunPipeline {
  private unsubscribe?: () => void
  constructor(private readonly deps: { store: RunStore; events: EventBus; planner: Planner; executor: Executor; artifacts: ArtifactStore; notifier: Notifier; publicBaseUrl: string }) {}
  start() {
    this.unsubscribe = this.deps.events.subscribe(async (event) => {
      if (event.type !== 'run.requested') return
      try {
        let run = await this.required(event.runId)
        run = await this.deps.store.update(run.id, { status: 'planning' })
        const plan = await this.deps.planner.plan(run)
        run = await this.deps.store.update(run.id, { status: 'running', plan })
        const execution = await this.deps.executor.execute(run)
        run = await this.deps.store.update(run.id, { status: 'reporting', ...execution })
        const report = await this.deps.artifacts.saveJson(run.id, 'report', 'report.json', { runId: run.id, plan, ...execution })
        run = await this.deps.store.update(run.id, { status: 'completed', artifacts: [...execution.artifacts, report], reportUrl: report.url })
        await this.deps.notifier.sendCompleted(run)
      } catch (cause) {
        await this.deps.store.update(event.runId, { status: 'failed', error: cause instanceof Error ? cause.message : String(cause) }).catch(() => undefined)
      }
    })
    return this.unsubscribe
  }
  stop() { this.unsubscribe?.() }
  private async required(id: string) { const run = await this.deps.store.get(id); if (!run) throw new Error(`Run ${id} not found`); return run }
}
