export type SubscriptionStatus='active'|'cancelled'|'past_due'
export interface CreditBalance { granted:number; consumed:number; reserved:number; available:number }
export interface BillingAccount { accountKey:string; email:string; customerId?:string; subscriptionId?:string; plan?:'starter'|'scale'; status?:SubscriptionStatus; balance:CreditBalance }
export const normalizeAccountKey=(email:string)=>email.trim().toLowerCase()
