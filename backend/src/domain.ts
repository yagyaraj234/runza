export type RunMode = 'pr' | 'discovery'
export type RunStatus = 'queued' | 'scanning' | 'planning' | 'running' | 'confirming' | 'uploading' | 'reporting' | 'completed' | 'failed' | 'superseded'

export type TestStep =
  | { action: 'goto'; path: string }
  | { action: 'click'; role: 'button' | 'link'; name: string }
  | { action: 'fill'; label: string; value: string }
  | { action: 'fillSecret'; label: string; secretRef: string }
  | { action: 'assertText'; text: string }
  | { action: 'scanAccessibility' }

export interface TestCase { id: string; title: string; steps: TestStep[] }
export interface TestPlan { summary: string; tests: TestCase[] }
export interface Artifact {
  id: string
  kind: 'video' | 'screenshot' | 'trace' | 'report' | 'script' | 'log' | 'manifest'
  url?: string
  objectKey?: string
  testId?: string
  attempt?: number
  mimeType?: string
  size?: number
  sha256?: string
}
export interface Finding {
  id: string
  testId: string
  title: string
  severity: 'low' | 'medium' | 'high'
  category?: 'functional' | 'accessibility' | 'console' | 'network'
  classification?: 'confirmed' | 'flaky' | 'inconclusive'
  details: string
  expected?: string
  actual?: string
  reproduction?: string[]
  consoleErrors?: string[]
  networkErrors?: string[]
  repairPrompt?: string
  artifactIds: string[]
}
export interface TestResult {
  testId: string
  status: 'passed' | 'failed'
  classification?: 'confirmed' | 'flaky' | 'inconclusive'
  durationMs: number
  error?: string
  artifactIds?: string[]
}
export interface RunEvent { status: RunStatus; at: string; message?: string }
export interface PlanningContext {
  diff?: string
  site?: { pages: Array<{ url: string; title: string; headings: string[]; links: string[]; labels: string[] }> }
  secretNames?: string[]
}

export interface Run {
  id: string
  mode: RunMode
  status: RunStatus
  targetUrl: string
  repository?: string
  pullRequest?: number
  installationId?: string
  headSha?: string
  baseSha?: string
  deliveryId?: string
  checkRunId?: number
  shareNonce?: string
  targetFingerprint?: string
  planningContext?: PlanningContext
  events?: RunEvent[]
  email?: string
  billingReservationId?: string
  billingAccountKey?: string
  model: { baseUrl: string; model: string }
  plan?: TestPlan
  results?: TestResult[]
  findings?: Finding[]
  artifacts?: Artifact[]
  reportUrl?: string
  createdAt: string
  updatedAt: string
  error?: string
}

export interface RunRequested { type: 'run.requested'; runId: string }
