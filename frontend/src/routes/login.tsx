import { createFileRoute, Link } from '@tanstack/react-router'
import AuthCard from '../components/auth/AuthCard'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  return (
    <AuthCard
      title="Welcome back."
      subtitle="Log in to see what shipped while you were away."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-semibold text-[#2B4BF2] no-underline">
            Sign up
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-[#3D4577]">
            Email
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
          Log in
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
