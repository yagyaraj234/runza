import type { BillingPlan } from './catalog.js'
export type NormalizedBillingEvent={kind:'activated'|'renewed'|'cancelled'|'paymentFailed'|'ignored';id:string;email?:string;customerId?:string;subscriptionId?:string;productId?:string;grantKey?:string}
export interface BillingProvider { createCheckout(plan:BillingPlan,email:string):Promise<{id:string;url:string}>; verifyWebhook(raw:string,headers:Record<string,string>):Promise<NormalizedBillingEvent> }
export class BillingProviderError extends Error { constructor(message='billing_provider_error'){super(message);this.name='BillingProviderError'} }
