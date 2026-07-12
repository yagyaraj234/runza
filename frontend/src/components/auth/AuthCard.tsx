import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import RunzaLogo from '../RunzaLogo'

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="fb-landing relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="fb-grid-texture pointer-events-none absolute inset-0 top-0 h-[640px]" />
      <div
        className="fb-glow-orb pointer-events-none absolute left-1/2 top-6 h-[140px] w-[140px] -translate-x-1/2"
        aria-hidden="true"
      />

      <Link
        to="/"
        aria-label="Back home"
        className="fb-press absolute left-4 top-6 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[#3D4577] no-underline transition hover:bg-black/5 sm:left-8"
      >
        <ArrowLeft size={18} />
      </Link>

      <div className="relative w-full max-w-sm rounded-[24px] border border-white/60 bg-white/75 p-8 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_20px_60px_rgba(60,45,20,0.14)] [backdrop-filter:blur(20px)_saturate(180%)]">
        <Link
          to="/"
          aria-label="Runza home"
          className="mb-6 inline-flex text-[#131B4D] no-underline"
        >
          <RunzaLogo className="h-8 w-auto" />
        </Link>

        <h1 className="fb-serif mb-2 text-2xl font-medium text-[#131B4D]">
          {title}
        </h1>
        <p className="mb-7 text-sm text-[#545C8C]">{subtitle}</p>

        {children}

        <p className="mt-6 text-center text-sm text-[#545C8C]">{footer}</p>
      </div>
    </div>
  )
}
