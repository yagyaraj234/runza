import { useState, type FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, GitPullRequest, Play, ShieldCheck, Video } from 'lucide-react'

export const Route = createFileRoute('/')({ component: HomePage })

const API_URL = ((import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '')

type FormState = 'idle' | 'submitting' | 'success' | 'duplicate' | 'error'

export function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')
    setMessage('')

    try {
      const response = await fetch(`${API_URL}/v1/waitlist`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = (await response.json()) as { joined?: boolean; error?: string }
      if (!response.ok) throw new Error(result.error === 'invalid_email' ? 'Enter a valid email address.' : 'Could not join the waitlist.')

      setState(result.joined ? 'success' : 'duplicate')
      setMessage(result.joined ? "You're on the list. We'll be in touch soon." : "You're already on the waitlist.")
      setEmail('')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Could not join the waitlist.')
    }
  }

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row" aria-label="Join the Freebug waitlist">
        <label htmlFor="waitlist-email" className="sr-only">Work email</label>
        <input
          id="waitlist-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          disabled={state === 'submitting'}
          className="min-h-12 flex-1 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-5 text-[var(--sea-ink)] outline-none transition placeholder:text-[var(--sea-ink-soft)]/60 focus:border-[var(--lagoon-deep)] focus:ring-4 focus:ring-[rgba(79,184,178,0.16)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={state === 'submitting'}
          className="group min-h-12 rounded-full bg-[var(--sea-ink)] px-6 font-semibold text-[var(--foam)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(23,58,64,0.22)] disabled:cursor-wait disabled:opacity-60"
        >
          <span className="flex items-center justify-center gap-2">
            {state === 'submitting' ? 'Joining…' : 'Join the waitlist'}
            {state !== 'submitting' && <ArrowRight size={17} className="transition group-hover:translate-x-1" aria-hidden="true" />}
          </span>
        </button>
      </form>
      <div aria-live="polite" className="mt-3 min-h-6 text-sm">
        {message && (
          <p className={`m-0 flex items-center gap-2 ${state === 'error' ? 'text-red-700 dark:text-red-300' : 'text-[var(--palm)]'}`}>
            {state !== 'error' && <CheckCircle2 size={16} aria-hidden="true" />}
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

function HomePage() {
  return (
    <main className="page-wrap px-4 pb-16 pt-10 sm:pt-16">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
        <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.34),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.2),transparent_66%)]" />
        <div className="relative max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--kicker)]">
            <span className="h-2 w-2 rounded-full bg-[var(--lagoon)] shadow-[0_0_0_4px_rgba(79,184,178,0.16)]" />
            Autonomous testing for every pull request
          </div>
          <h1 className="display-title mb-6 max-w-4xl text-5xl leading-[0.98] font-bold tracking-[-0.04em] text-[var(--sea-ink)] sm:text-7xl lg:text-8xl">
            Find the bugs before your users do.
          </h1>
          <p className="mb-9 max-w-2xl text-lg leading-8 text-[var(--sea-ink-soft)] sm:text-xl">
            Freebug explores your app, generates Playwright tests with your preferred AI model, and returns reproducible bugs with videos, traces, and accessibility evidence.
          </p>
          <WaitlistForm />
          <p className="mt-5 text-xs font-medium uppercase tracking-[0.13em] text-[var(--sea-ink-soft)]/80">Private beta · Bring any OpenAI-compatible model · No credit card</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="How Freebug works">
        {[
          { icon: GitPullRequest, number: '01', title: 'Connect your PR', copy: 'Install the GitHub App. Freebug reads the diff and targets the behavior that changed.' },
          { icon: Play, number: '02', title: 'Let the agent test', copy: 'A constrained AI plan drives Playwright through real user flows and accessibility checks.' },
          { icon: Video, number: '03', title: 'Review the evidence', copy: 'Get confirmed bugs with exact steps, screenshots, traces, videos, and stable report URLs.' },
        ].map(({ icon: Icon, number, title, copy }, index) => (
          <article key={title} className="island-shell feature-card rise-in rounded-2xl p-6" style={{ animationDelay: `${index * 90 + 80}ms` }}>
            <div className="mb-8 flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[rgba(79,184,178,0.14)] text-[var(--lagoon-deep)]"><Icon size={21} aria-hidden="true" /></span>
              <span className="font-mono text-xs text-[var(--sea-ink-soft)]/60">{number}</span>
            </div>
            <h2 className="mb-3 text-xl font-bold text-[var(--sea-ink)]">{title}</h2>
            <p className="m-0 leading-7 text-[var(--sea-ink-soft)]">{copy}</p>
          </article>
        ))}
      </section>

      <section className="island-shell mt-6 flex flex-col gap-6 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[rgba(47,106,74,0.12)] text-[var(--palm)]"><ShieldCheck size={24} aria-hidden="true" /></span>
          <div>
            <h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">Safe by construction</h2>
            <p className="mb-0 mt-1 max-w-2xl text-sm leading-6 text-[var(--sea-ink-soft)]">The model creates a validated action plan—not arbitrary code. Navigation stays same-origin, secrets stay out of prompts, and every finding must be backed by executed evidence.</p>
          </div>
        </div>
        <a href="https://github.com/yagyaraj234/freebug" target="_blank" rel="noreferrer" className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-5 py-2.5 text-sm font-semibold no-underline transition hover:-translate-y-0.5">View on GitHub</a>
      </section>
    </main>
  )
}
