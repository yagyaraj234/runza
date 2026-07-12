import { Link } from '@tanstack/react-router';
import RunzaLogo from './RunzaLogo';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/80 [backdrop-filter:blur(20px)_saturate(180%)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
        <Link
          to="/"
          className="text-[#131B4D] no-underline"
          aria-label="Runza home">
          <RunzaLogo className="h-6 w-auto" />
        </Link>

        <div className="hidden items-center gap-7 text-sm sm:flex">
          <a
            href="/#features"
            className="text-[#3D4577] no-underline transition hover:text-[#131B4D]">
            Product
          </a>
          <a
            href="/#how-it-works"
            className="text-[#3D4577] no-underline transition hover:text-[#131B4D]">
            How it works
          </a>
          <a
            href="/#pricing"
            className="text-[#3D4577] no-underline transition hover:text-[#131B4D]">
            Pricing
          </a>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="text-sm text-[#3D4577] no-underline transition hover:text-[#131B4D]">
            Log in
          </Link>
          <Link
            to="/signup"
            className="fb-press rounded-full bg-[#2B4BF2] px-4 py-2 text-xs font-semibold text-[#FFFFFF] no-underline transition hover:brightness-95">
            Get Access
          </Link>
        </div>
      </nav>
    </header>
  );
}
