import { createFileRoute, Link } from '@tanstack/react-router'
import AuthCard from '../components/auth/AuthCard'

export const Route = createFileRoute('/signup')({ component: SignupPage })

function SignupPage() {
  return (
    <AuthCard
      title="Create your account."
      subtitle="Free forever. No credit card required."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#2B4BF2] no-underline">
            Log in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-[#3D4577]">
            Full name
          </label>
          <input
            id="name"
            type="text"
            required
            placeholder="Ada Lovelace"
            className="fb-input"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-[#3D4577]">
            Work email
          </label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@company.com"
            className="fb-input"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-[#3D4577]">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            placeholder="••••••••"
            className="fb-input"
          />
        </div>
        <button
          type="submit"
          className="fb-cta-glow mt-2 w-full rounded-full bg-[#2B4BF2] py-3 text-sm font-semibold text-[#FFFFFF] transition hover:brightness-95"
        >
          Request access
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-black/10" />
        <span className="fb-mono text-[11px] uppercase text-[#8A92C0]">or</span>
        <span className="h-px flex-1 bg-black/10" />
      </div>

      <button
        type="button"
        className="w-full rounded-full border border-black/10 bg-white py-3 text-sm font-medium text-[#131B4D] transition hover:bg-black/5"
      >
        Continue with Google
      </button>
    </AuthCard>
  )
}
