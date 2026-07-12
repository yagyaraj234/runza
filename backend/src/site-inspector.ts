import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import type { RepositorySettings } from './store.js'

export interface SiteInspection {
  fingerprint: string
  pages: Array<{ url:string; title:string; headings:string[]; links:string[]; labels:string[] }>
}

export class SiteInspector {
  async inspect(settings: RepositorySettings, secrets: Record<string,string>): Promise<SiteInspection> {
    let response: Response | undefined
    for (let attempt=0; attempt<10; attempt++) {
      response = await fetch(settings.previewUrl, { signal: AbortSignal.timeout(15_000) }).catch(()=>undefined)
      if (response?.ok) break
      if (attempt < 9) await new Promise(resolve=>setTimeout(resolve,30_000))
    }
    if (!response?.ok) throw new Error(`Preview URL unavailable: ${response?.status ?? 'network error'}`)
    const body = await response.text(), fingerprint = createHash('sha256').update(body).digest('hex')
    const browser = await chromium.launch({ headless:true }), context = await browser.newContext({ baseURL:settings.previewUrl })
    try {
      if (settings.loginPath && settings.loginSteps.length) {
        const page = await context.newPage(); await page.goto(new URL(settings.loginPath,settings.previewUrl).toString(),{waitUntil:'domcontentloaded'})
        for (const step of settings.loginSteps) {
          if (step.action==='fillSecret') {
            const value=secrets[step.secretRef]; if(value===undefined) throw new Error(`Missing repository secret ${step.secretRef}`)
            await page.getByLabel(step.label,{exact:true}).fill(value)
          } else if(step.action==='click') await page.getByRole(step.role,{name:step.name,exact:true}).click()
          else await page.getByText(step.text,{exact:false}).waitFor({state:'visible'})
        }
        await page.close()
      }
      const origin = new URL(settings.previewUrl).origin, queue=[{url:new URL('/',settings.previewUrl).toString(),depth:0}], seen=new Set<string>(), pages:SiteInspection['pages']=[]
      while(queue.length && pages.length<20){
        const current=queue.shift()!,url=current.url; if(seen.has(url))continue; seen.add(url)
        const page=await context.newPage(); await page.goto(url,{waitUntil:'domcontentloaded',timeout:30_000})
        const snapshot=await page.evaluate(()=>({title:document.title,headings:[...document.querySelectorAll('h1,h2,h3')].map(x=>x.textContent?.trim()||'').filter(Boolean).slice(0,30),links:[...document.querySelectorAll('a[href]')].map(x=>(x as HTMLAnchorElement).href).slice(0,100),labels:[...document.querySelectorAll('label')].map(x=>x.textContent?.trim()||'').filter(Boolean).slice(0,50)}))
        pages.push({url,title:snapshot.title,headings:snapshot.headings,links:snapshot.links.filter(link=>new URL(link).origin===origin).slice(0,30),labels:snapshot.labels})
        if(current.depth<2)for(const link of snapshot.links){const parsed=new URL(link);parsed.hash='';if(parsed.origin===origin&&!seen.has(parsed.toString())&&seen.size+queue.length<40)queue.push({url:parsed.toString(),depth:current.depth+1})}
        await page.close()
      }
      return {fingerprint,pages}
    } finally { await browser.close() }
  }
}
