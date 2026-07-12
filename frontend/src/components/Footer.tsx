import { Link } from '@tanstack/react-router'
import { Github, Linkedin } from 'lucide-react'
import RunzaLogo from './RunzaLogo'

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Reviews', href: '/#reviews' },
    ],
  },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-black/5 bg-white px-4 pb-10 pt-14 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link
            to="/"
            aria-label="Runza home"
            className="inline-flex text-[#131B4D] no-underline"
          >
            <RunzaLogo className="h-8 w-auto" />
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#545C8C]">
            Playwright tests, generated from your diff, run in CI, and linked
            straight to what broke.
          </p>
          <div className="mt-4 flex gap-2">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="fb-press flex h-9 w-9 items-center justify-center rounded-lg text-[#3D4577] transition hover:bg-black/5"
            >
              <span className="sr-only">GitHub</span>
              <Github size={18} />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              className="fb-press flex h-9 w-9 items-center justify-center rounded-lg text-[#3D4577] transition hover:bg-black/5"
            >
              <span className="sr-only">LinkedIn</span>
              <Linkedin size={18} />
            </a>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <p className="fb-mono mb-3 text-[11px] tracking-[1.5px] text-[#8A92C0] uppercase">
              {col.heading}
            </p>
            <ul className="m-0 list-none space-y-2 p-0">
              {col.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-[#3D4577] no-underline transition hover:text-[#131B4D]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-black/5 pt-6 text-center text-xs text-[#8A92C0] sm:text-left">
        &copy; {year} Runza. All rights reserved.
      </div>
    </footer>
  )
}
