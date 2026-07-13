export interface PublicPlan {
  slug: 'starter' | 'scale';
  name: string;
  price: number;
  currency: 'USD';
  interval: 'month';
  includedCredits: number;
  features: string[];
}
export const plans: PublicPlan[] = [
  {
    slug: 'starter',
    name: 'Starter',
    price: 14900,
    currency: 'USD',
    interval: 'month',
    includedCredits: 1000,
    features: [
      'PR-triggered automated test runs',
      'Browser and accessibility checks',
      'Screenshots, traces, and video evidence',
      'Shareable test reports',
    ],
  },
  {
    slug: 'scale',
    name: 'Scale',
    price: 49900,
    currency: 'USD',
    interval: 'month',
    includedCredits: 5000,
    features: [
      'Everything included in Starter',
      '5× included monthly credits',
      'Higher monthly run capacity',
      'Browser, accessibility, and evidence reports',
    ],
  },
];
