export type RunMode = 'pr' | 'discovery'
export type RunStatus = 'queued' | 'planning' | 'running' | 'reporting' | 'completed' | 'failed'

export type TestStep =
  | { action: 'goto'; path: string }
  | { action: 'click'; role: 'button' | 'link'; name: string }
  | { action: 'fill'; label: string; value: string }
  | { action: 'assertText'; text: string }
  | { action: 'scanAccessibility' }

export interface TestCase { id: string; title: string; steps: TestStep[] }
export interface TestPlan { summary: string; tests: TestCase[] }
export interface Artifact { id: string; kind: 'video' | 'screenshot' | 'trace' | 'report'; url: string }
export interface Finding { id: string; testId: string; title: string; severity: 'low' | 'medium' | 'high'; details: string; artifactIds: string[] }
export interface TestResult { testId: string; status: 'passed' | 'failed'; durationMs: number; error?: string }

export interface Run {
  id: string
  mode: RunMode
  status: RunStatus
  targetUrl: string
  repository?: string
  pullRequest?: number
  email?: string
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
