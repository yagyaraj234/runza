import nodemailer from 'nodemailer'
import type { Run } from './domain.js'
import type { GitHubApp } from './github-app.js'
import { createShareToken } from './auth.js'
export interface Notifier { sendCompleted(run: Run): Promise<void> }
export class ConsoleNotifier implements Notifier {
  async sendCompleted(run: Run) { console.log(JSON.stringify({ message: 'run completed', runId: run.id, email: run.email, reportUrl: run.reportUrl })) }
}
export class SmtpNotifier implements Notifier {
  private readonly transport
  constructor(url: string, private readonly from: string) { this.transport = nodemailer.createTransport(url) }
  async sendCompleted(run: Run) {
    if (!run.email) return
    const failed = run.results?.filter((result) => result.status === 'failed').length ?? 0
    await this.transport.sendMail({ from: this.from, to: run.email, subject: `Freebug run ${run.status}: ${failed} failed`, text: `Run: ${run.id}\nStatus: ${run.status}\nFailed tests: ${failed}\nReport: ${run.reportUrl ?? 'not available'}` })
  }
}

const conclusion = (run: Run) => {
  if (run.status === 'failed') return 'action_required' as const
  const classifications = run.findings?.map(finding => finding.classification) ?? []
  if (classifications.includes('confirmed')) return 'failure' as const
  if (classifications.some(value => value === 'flaky' || value === 'inconclusive')) return 'neutral' as const
  return 'success' as const
}

const buildPrComment = (run: Run, reportUrl: string) => {
  const failed = run.results?.filter(result => result.status === 'failed').length ?? 0
  const total = run.results?.length ?? 0
  const lines = [
    '## Freebug test report',
    '',
    `**Status:** ${run.status} — ${failed}/${total} tests failed`,
    `**Conclusion:** ${conclusion(run)}`,
    `**Full report:** ${reportUrl}`,
  ].filter(Boolean)
  return lines.join('\n')
}

export class GitHubCommentNotifier implements Notifier {
  constructor(private readonly inner: Notifier, private readonly githubApp: GitHubApp, private readonly publicBaseUrl: string, private readonly authSecret: string) {}
  async sendCompleted(run: Run) {
    await this.inner.sendCompleted(run)
    if (run.mode !== 'pr' || !run.repository || !run.pullRequest || !run.installationId) return
    const reportUrl = run.shareNonce
      ? `${this.publicBaseUrl.replace(/\/$/,'')}/reports/${createShareToken(run.id, run.shareNonce, this.authSecret)}`
      : `${this.publicBaseUrl.replace(/\/$/,'')}/dashboard/runs/${run.id}`
    const result = conclusion(run), failed = run.results?.filter(item=>item.status==='failed').length ?? 0
    await Promise.all([
      this.githubApp.upsertIssueComment(run.installationId, run.repository, run.pullRequest, '<!-- runza-pr-report -->', buildPrComment(run, reportUrl)),
      run.checkRunId ? this.githubApp.updateCheckRun(run.installationId, run.repository, run.checkRunId, { conclusion: result, detailsUrl: reportUrl, title: result === 'success' ? 'Runza tests passed' : result === 'failure' ? `${failed} confirmed test failure${failed===1?'':'s'}` : result === 'neutral' ? 'Runza found flaky or inconclusive results' : 'Runza could not complete testing', summary: run.error ?? `${failed}/${run.results?.length ?? 0} tests failed. Open the detailed report for proof and repair prompts.` }) : Promise.resolve(),
    ]).catch(error => console.error('github_notification_failed', { runId: run.id, error: error instanceof Error ? error.message : String(error) }))
  }
}
