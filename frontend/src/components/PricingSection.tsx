import { CircleCheck } from 'lucide-react';
import { plans } from '../lib/billing';

export function PricingSection() {
  return (
    <section id="pricing" className="px-4 py-20 sm:py-24" aria-labelledby="pricing-title">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-xl text-center">
          <p className="fb-mono mb-4 text-[11px] tracking-[2px] text-[#8A92C0] uppercase">
            Pricing
          </p>
          <h2
            id="pricing-title"
            className="fb-serif text-[2.1rem] leading-[1.2] tracking-[-0.01em] font-medium text-[#131B4D]">
            Plans for every team.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#545C8C]">
            Pick the monthly capacity your team needs. Every plan includes the complete testing workflow.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {plans.map(p => (
            <article
              key={p.slug}
              className={`relative overflow-hidden rounded-2xl border p-8 ${p.slug === 'scale' ? 'border-[#B8C4FF] bg-[#E8EDFF]' : 'border-[#E3E8F8] bg-[#F4F6FC]'}`}>
              <div className="absolute inset-x-0 top-0 h-1 bg-[#2B4BF2]" />
              <div className="flex items-center justify-between gap-4">
                <h3 className="fb-serif text-xl font-medium text-[#131B4D]">{p.name}</h3>
                <span className="fb-mono rounded-full bg-white px-3 py-1 text-[10px] tracking-[1px] text-[#545C8C] uppercase">
                  {p.slug === 'scale' ? 'Growing teams' : 'Small teams'}
                </span>
              </div>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#131B4D]">{`$${p.price / 100}`}</span>
                <span className="text-sm text-[#8A92C0]">/month</span>
              </p>
              <p className="fb-mono mt-1 text-[11px] tracking-[1px] text-[#8A92C0] uppercase">
                {p.includedCredits.toLocaleString()} credits included
              </p>

              <p className="fb-mono mt-8 text-[10px] tracking-[1.5px] text-[#545C8C] uppercase">
                What you get
              </p>
              <ul className="m-0 mt-3 list-none divide-y divide-[#E3E8F8] rounded-xl bg-white px-5 py-1">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-3 py-4">
                    <CircleCheck size={16} color="#2F8F5B" className="flex-shrink-0" />
                    <span className="text-sm text-[#3D4577]">{f}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
