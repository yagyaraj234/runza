import { Link } from '@tanstack/react-router';
import { Github, Linkedin } from 'lucide-react';
import RunzaLogo from './RunzaLogo';

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Docs', href: '/#docs' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Reviews', href: '/#reviews' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-[var(--line)] px-4 pb-12 pt-9 text-[var(--sea-ink-soft)]">
      <div className="page-wrap flex flex-col items-center justify-between gap-4 text-center text-sm sm:flex-row sm:text-left">
        <p className="m-0">
          &copy; {new Date().getFullYear()} Freebug. Test boldly, ship calmly.
        </p>
        <div className="flex items-center gap-4 font-semibold">
          <a
            href="https://github.com/yagyaraj234/freebug"
            target="_blank"
            rel="noreferrer">
            GitHub
          </a>
          <a href="mailto:hello@freebug.dev">Contact</a>
        </div>
      </div>
    </footer>
  );
}
