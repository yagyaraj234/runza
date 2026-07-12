import nodemailer from 'nodemailer'
import type { Run } from './domain.js'
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
