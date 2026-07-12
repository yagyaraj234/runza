import type { Run } from './domain.js'
import type { GitHubApp, PullRequestFile } from './github-app.js'
import { SiteInspector } from './site-inspector.js'
import type { RepositoryStore } from './store.js'

const ignored = /(^|\/)(node_modules|dist|build|vendor)\/|(^|\/)(package-lock\.json|bun\.lock|pnpm-lock\.yaml|yarn\.lock)$|\.(png|jpe?g|gif|webp|zip|pdf|woff2?)$/i

export class PrPreparation {
  constructor(private readonly github: GitHubApp, private readonly repositories: RepositoryStore, private readonly inspector = new SiteInspector()) {}
  async prepare(run: Run): Promise<Partial<Run>> {
    if (run.mode !== 'pr' || !run.repository || !run.pullRequest || !run.installationId) return {}
    const settings = this.repositories.get(run.repository)
    if (!settings?.enabled) throw new Error('Repository testing is not configured')
    const files = await this.github.pullRequestFiles(run.installationId, run.repository, run.pullRequest)
    const diff = summarize(files)
    const secrets=this.repositories.secrets(run.repository)
    const inspection = await this.inspector.inspect(settings, secrets)
    const pages=JSON.parse(Object.values(secrets).reduce((value,secret)=>secret?value.replaceAll(secret,'[REDACTED]'):value,JSON.stringify(inspection.pages))) as typeof inspection.pages
    return { targetUrl:settings.previewUrl, targetFingerprint:inspection.fingerprint, planningContext:{diff,site:{pages},secretNames:this.repositories.secretNames(run.repository)} }
  }
}

export function summarize(files: PullRequestFile[]) {
  let size=0; const chunks:string[]=[]
  for(const file of files.slice(0,50)){
    if(ignored.test(file.filename)||!file.patch)continue
    const patch=file.patch.replace(/((?:api[_-]?key|secret|password|token)\s*[:=]\s*)[^\s,;]+/gi,'$1[REDACTED]').replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/g,'[REDACTED PRIVATE KEY]')
    const chunk=`FILE ${file.filename} (${file.status})\n${patch}`
    if(size+chunk.length>100_000)break
    chunks.push(chunk); size+=chunk.length
  }
  return chunks.join('\n\n')
}
