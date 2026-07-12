import { useEffect, useState, type FormEvent } from 'react';
import { CircleCheck, Zap } from 'lucide-react';
import { createCheckout, fetchPlans, type PublicPlan } from '../lib/billing';
import { me } from '../lib/auth';

export function PricingSection() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [email, setEmail] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState('Loading plans…');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchPlans()
      .then(p => {
        setPlans(p);
        setMessage(p.length ? '' : 'Billing is unavailable.');
      })
      .catch(() => setMessage('Could not load plans. Please try again later.'));
    me().then(user => {
      if (user) {
        setEmail(user.email);
        setSignedIn(true);
      }
    });
  }, []);

  async function buy(e: FormEvent, slug: PublicPlan['slug']) {
    e.preventDefault();
    setBusy(true);
    setMessage('Opening secure checkout…');
    try {
      const s = await createCheckout(slug, email);
      window.location.assign(s.url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Checkout failed.');
      setBusy(false);
    }
  }

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
          <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm text-[#545C8C]">
            {message}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {plans.map(p => (
            <article key={p.slug} className="rounded-2xl bg-[#EEF2FE] p-8">
              <h3 className="fb-serif text-xl font-medium text-[#131B4D]">{p.name}</h3>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#131B4D]">{`$${p.price / 100}`}</span>
                <span className="text-sm text-[#8A92C0]">/month</span>
              </p>
              <p className="fb-mono mt-1 text-[11px] tracking-[1px] text-[#8A92C0] uppercase">
                {p.includedCredits.toLocaleString()} credits included
              </p>

              <ul className="m-0 mt-6 list-none space-y-3 p-0">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3">
                    <CircleCheck size={16} color="#2F8F5B" className="flex-shrink-0" />
                    <span className="text-sm text-[#3D4577]">{f}</span>
                  </li>
                ))}
              </ul>

              <form onSubmit={e => buy(e, p.slug)} className="mt-6">
                {signedIn ? (
                  <p className="fb-mono text-[11px] tracking-[1px] text-[#8A92C0] uppercase">
                    Buying as {email}
                  </p>
                ) : (
                  <>
                    <label htmlFor={`email-${p.slug}`} className="fb-mono block text-[11px] tracking-[1px] text-[#8A92C0] uppercase">
                      Work email
                    </label>
                    <input
                      id={`email-${p.slug}`}
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="fb-input mt-2"
                    />
                  </>
                )}
                <button
                  disabled={busy}
                  className="fb-cta-glow fb-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[28px] bg-[#2B4BF2] px-8 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-95 disabled:opacity-60">
                  Choose {p.name}
                  <Zap size={15} fill="#FFFFFF" />
                </button>
              </form>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
