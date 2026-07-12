import type { RunRequested } from './domain.js'
export type PipelineEvent = RunRequested
export type EventHandler = (event: PipelineEvent) => Promise<void>
export interface EventBus { publish(event: PipelineEvent): Promise<void>; subscribe(handler: EventHandler): () => void }
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Set<EventHandler>()
  async publish(event: PipelineEvent) {
    for (const handler of this.handlers) queueMicrotask(() => void handler(event).catch((error) => console.error('event handler failed', error)))
  }
  subscribe(handler: EventHandler) { this.handlers.add(handler); return () => this.handlers.delete(handler) }
}
