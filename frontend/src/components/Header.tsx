import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav className="page-wrap flex items-center gap-4 py-3 sm:py-4" aria-label="Primary navigation">
        <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-extrabold tracking-tight text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)] shadow-[0_0_0_4px_rgba(79,184,178,0.14)]" />
          Freebug
        </Link>
        <div className="hidden items-center gap-5 text-sm font-semibold sm:flex">
          <Link to="/" className="nav-link" activeProps={{ className: 'nav-link is-active' }}>Home</Link>
          <Link to="/about" className="nav-link" activeProps={{ className: 'nav-link is-active' }}>About</Link>
          <a href="https://github.com/yagyaraj234/freebug" className="nav-link" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a href="#waitlist-email" className="hidden rounded-full bg-[var(--sea-ink)] px-4 py-2 text-xs font-bold text-[var(--foam)] no-underline transition hover:-translate-y-0.5 sm:block">Join waitlist</a>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
