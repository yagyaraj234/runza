import DodoPayments from 'dodopayments'
import type { BillingPlan } from './catalog.js'
import { BillingProviderError, type BillingProvider, type NormalizedBillingEvent } from './provider.js'
export type DodoClient = { checkoutSessions: { create(body: unknown): Promise<{session_id:string;checkout_url?:string|null}> }; webhooks: { unwrap(raw:string,input:{headers:Record<string,string>;key?:string}): unknown } }
type Options={apiKey:string;webhookKey:string;environment:'test_mode'|'live_mode';returnUrl:string}
export class DodoBillingProvider implements BillingProvider {
  private readonly client:DodoClient; private readonly returnUrl:string; private readonly webhookKey?:string
  constructor(options:Options); constructor(client:DodoClient,returnUrl:string,webhookKey?:string)
  constructor(first:Options|DodoClient, returnUrl?:string, webhookKey?:string) { if ('checkoutSessions' in first) { this.client=first; this.returnUrl=returnUrl!; this.webhookKey=webhookKey } else { this.client=new DodoPayments({bearerToken:first.apiKey,webhookKey:first.webhookKey,environment:first.environment}) as unknown as DodoClient; this.returnUrl=first.returnUrl; this.webhookKey=first.webhookKey } }
  async createCheckout(plan:BillingPlan,email:string) { try { const response=await this.client.checkoutSessions.create({product_cart:[{product_id:plan.productId,quantity:1}],customer:{email:email.trim().toLowerCase()},return_url:this.returnUrl}); if (!response.checkout_url) throw new Error('missing checkout URL'); return {id:response.session_id,url:response.checkout_url} } catch { throw new BillingProviderError() } }
  async verifyWebhook(raw:string,headers:Record<string,string>):Promise<NormalizedBillingEvent> { let value:any; try { value=this.client.webhooks.unwrap(raw,{headers,key:this.webhookKey}) } catch { throw new BillingProviderError('invalid_signature') }
    const data=value.data??{}, customer=data.customer??{}; const id=String(headers['webhook-id']??value.id??`${value.type}:${value.timestamp}`); const base={id,email:customer.email??data.email,customerId:customer.customer_id??data.customer_id,subscriptionId:data.subscription_id??data.id,productId:data.product_id,grantKey:String(data.payment_id??data.invoice_id??`${data.subscription_id??data.id}:${value.timestamp}`)}
    if(value.type==='subscription.active') return {kind:'activated',...base}; if(value.type==='subscription.renewed') return {kind:'renewed',...base}; if(value.type==='subscription.cancelled') return {kind:'cancelled',...base}; if(value.type==='payment.failed') return {kind:'paymentFailed',...base}; return {kind:'ignored',id}
  }
}
