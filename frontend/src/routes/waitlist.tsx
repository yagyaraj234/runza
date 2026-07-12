import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { CircleCheck, Zap } from 'lucide-react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/waitlist')({ component: WaitlistPage })

type Status = 'idle' | 'loading' | 'joined' | 'duplicate' | 'error'

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

function WaitlistPage() {
  const join = useMutation(api.waitlist.join)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [validationError, setValidationError] = useState('')

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!EMAIL_RE.test(normalized)) {
      setValidationError('Enter a valid email address.')
      return
    }
    setValidationError('')
    setStatus('loading')
    try {
      const result = await join({ email: normalized })
      setStatus(result.joined ? 'joined' : 'duplicate')
    } catch {
      setStatus('error')
    }
  }

  const done = status === 'joined' || status === 'duplicate'

  return (
    <main className="px-4 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto grid max-w-6xl items-stretch gap-6 lg:grid-cols-2">
        {/* Left — visual. Drop your image at frontend/public/waitlist-visual.png */}
        <div
          className="fb-bento-card relative flex min-h-[320px] items-center justify-center overflow-hidden p-8"
          style={{
            background: 'linear-gradient(180deg, #5D7DF9 0%, #A9BEFB 70%, #D4DFFD 100%)',
          }}
        >
          <div
            role="img"
            aria-label="Bugfree product preview"
            className="absolute inset-6 z-10 rounded-2xl bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/waitlist-visual.png)' }}
          />
          <p className="absolute bottom-6 left-0 right-0 text-center text-[13px] text-white/80">
            Autonomous testing, from PR to proof.
          </p>
        </div>

        {/* Right — form */}
        <div className="fb-bento-card flex flex-col justify-center bg-[#EEF2FE] p-8 sm:p-12">
          <p className="fb-mono mb-4 text-[11px] tracking-[2px] text-[#8A92C0] uppercase">
            Waitlist
          </p>
          <h1 className="fb-serif m-0 text-[2.1rem] leading-[1.15] text-[#131B4D]">
            Get early access.
            <br />
            <em>Ship tests, not bugs.</em>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#545C8C]">
            Bugfree generates Playwright tests for every PR, runs them with
            video evidence, and links each failure to the diff that broke it.
            Join the waitlist and we&apos;ll email you when your spot opens.
          </p>

          {done ? (
            <div
              className="mt-8 flex items-start gap-3 rounded-2xl bg-white p-5 shadow-[0_12px_28px_rgba(19,27,77,0.1)]"
              role="status"
            >
              <CircleCheck size={20} color="#2F8F5B" className="mt-0.5 shrink-0" />
              <div>
                <p className="m-0 text-sm font-semibold text-[#131B4D]">
                  {status === 'joined'
                    ? "You're on the list!"
                    : "You're already on the list."}
                </p>
                <p className="m-0 mt-1 text-[13px] text-[#545C8C]">
                  We&apos;ll reach out to {email.trim().toLowerCase()} as soon
                  as access opens up.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8" noValidate>
              <label
                htmlFor="waitlist-email"
                className="mb-2 block text-xs font-semibold text-[#3D4577]"
              >
                Work email
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="waitlist-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (validationError) setValidationError('')
                  }}
                  aria-invalid={Boolean(validationError)}
                  aria-describedby={validationError ? 'waitlist-email-error' : undefined}
                  className="fb-input sm:flex-1"
                  disabled={status === 'loading'}
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="fb-cta-glow fb-press inline-flex items-center justify-center gap-2 rounded-[28px] bg-[#2B4BF2] px-7 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-70"
                >
                  {status === 'loading' ? 'Joining…' : 'Join waitlist'}
                  <Zap size={14} fill="#FFFFFF" />
                </button>
              </div>
              {validationError && (
                <p
                  id="waitlist-email-error"
                  className="m-0 mt-2 text-[13px] text-[#C23B4B]"
                >
                  {validationError}
                </p>
              )}
              {status === 'error' && (
                <p className="m-0 mt-2 text-[13px] text-[#C23B4B]" role="alert">
                  Something went wrong. Please try again.
                </p>
              )}
              <p className="fb-mono mt-4 text-[11px] tracking-[2px] text-[#8A92C0] uppercase">
                Free forever. No credit card required.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
