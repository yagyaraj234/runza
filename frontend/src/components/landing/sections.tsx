import {
  Zap,
  CircleCheck,
  PlayCircle,
  CircleX,
  FileCode2,
  RefreshCw,
  Clapperboard,
  GitPullRequest,
  Wand2,
  Video,
  Link2,
  Play,
  Accessibility,
  BadgeCheck,
} from 'lucide-react'

const FLOW_CHIPS = [
  { label: 'Checkout', bg: '#DBE4FE', color: '#2B4BF2', tilt: '-3deg' },
  { label: 'Signup', bg: '#F9DCDE', color: '#C23B4B', tilt: '2deg' },
  { label: 'Search', bg: '#FBE7C9', color: '#C9701F', tilt: '-2deg' },
  { label: 'Settings', bg: '#DCF3E4', color: '#2F8F5B', tilt: '3deg' },
  { label: 'Billing', bg: '#DEE5FD', color: '#2B4BF2', tilt: '-2deg' },
  { label: 'Onboarding', bg: '#FBDCE7', color: '#C23B7C', tilt: '2deg' },
]

const COMPANIES = [
  'NORTHBEAM',
  'VECTOR',
  'ORBITAL',
  'GRIDLOCK',
  'PARALLEL',
  'COREBASE',
]

const STEPS = [
  {
    number: '01',
    title: 'Open a PR',
    description: 'Runza watches your repo and picks up every diff the moment it lands.',
    icon: GitPullRequest,
    accent: '#2B4BF2',
    bg: '#DEE5FD',
  },
  {
    number: '02',
    title: 'Generate tests',
    description: 'Playwright specs get written for the exact lines that changed, no boilerplate.',
    icon: Wand2,
    accent: '#C9701F',
    bg: '#FBE7C9',
  },
  {
    number: '03',
    title: 'Run & record',
    description: 'Every spec runs in CI with full video capture, uploaded behind a CDN.',
    icon: Video,
    accent: '#2B4BF2',
    bg: '#DBE4FE',
  },
  {
    number: '04',
    title: 'Ship or fix',
    description: 'Pass, and merge. Fail, and get one link straight to the broken frame.',
    icon: Link2,
    accent: '#C23B4B',
    bg: '#F9DCDE',
  },
]

const REVIEWS = [
  {
    quote:
      'Runza caught a checkout regression our own suite missed. The video link made the fix a five-minute job.',
    name: 'Ava R.',
    role: 'Staff Engineer',
    bg: '#DEE5FD',
  },
  {
    quote:
      "We stopped assigning someone to write PR tests. It just happens now, before review even starts.",
    name: 'Marcus T.',
    role: 'Eng Lead',
    bg: '#FBE7C9',
  },
  {
    quote:
      "Flaky tests used to eat a day a week. Runza's auto-stabilizer cut that to almost zero.",
    name: 'Priya K.',
    role: 'QA Lead',
    bg: '#DBE4FE',
  },
]

const TESTIMONIAL_CHIPS = [
  { name: 'Ava R.', role: 'Staff Engineer', chipBg: '#DEE5FD', initials: 'AR' },
  { name: 'Marcus T.', role: 'Eng Lead', chipBg: '#FBDCE7', initials: 'MT' },
  { name: 'Priya K.', role: 'QA Lead', chipBg: '#FBE7C9', initials: 'PK' },
  { name: 'Sam D.', role: 'Founder', chipBg: '#DBE4FE', initials: 'SD' },
]

const TEST_GEN_FEATURES = [
  {
    iconBg: '#DBE4FE',
    iconColor: '#2B4BF2',
    icon: FileCode2,
    text: 'Turn a diff into a full Playwright test file',
  },
  {
    iconBg: '#FBE7C9',
    iconColor: '#C9701F',
    icon: RefreshCw,
    text: 'Turn a flaky test into a stable one automatically',
  },
  {
    iconBg: '#DEE5FD',
    iconColor: '#2B4BF2',
    icon: Clapperboard,
    text: 'Turn a failed run into a shareable video link',
  },
]

const VIDEO_FEATURES = [
  {
    iconBg: '#F9DCDE',
    iconColor: '#C23B4B',
    icon: CircleX,
    text: 'Every failure captured on video, frame by frame',
  },
  {
    iconBg: '#DBE4FE',
    iconColor: '#2B4BF2',
    icon: PlayCircle,
    text: 'Playable straight from the PR, no download required',
  },
  {
    iconBg: '#FBE7C9',
    iconColor: '#C9701F',
    icon: Link2,
    text: 'One shareable link per run, behind a CDN',
  },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-16 text-center sm:pt-12">
      <div
        className="fb-glow-orb pointer-events-none absolute left-1/2 top-10 h-[120px] w-[120px] -translate-x-1/2"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-3xl pt-24">
        <h1 className="fb-serif text-[2.75rem] leading-[1.12] font-medium tracking-[-0.01em] text-[#131B4D] sm:text-[4rem]">
          Ship tests
          <br />
          <em className="italic">not bugs.</em>
        </h1>

        <p className="mx-auto mt-6 max-w-md text-base tracking-wide text-[#545C8C]">
          Ready to stop writing Playwright tests by hand?
        </p>

        <a
          href="/waitlist"
          className="fb-cta-glow fb-press mt-8 inline-flex items-center gap-2 rounded-[28px] bg-[#2B4BF2] px-8 py-3.5 text-sm font-semibold text-[#FFFFFF] no-underline transition hover:-translate-y-0.5 hover:brightness-95"
        >
          Request Access
          <Zap size={15} fill="#FFFFFF" />
        </a>

        <p className="fb-mono mt-4 text-[11px] tracking-[2px] text-[#8A92C0] uppercase">
          Free forever. No credit card required.
        </p>
      </div>
    </section>
  )
}

export function BentoGrid() {
  return (
    <section id="features" className="relative px-4 pb-24 pt-4 sm:px-8 sm:pb-32">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Row 1 — big PR card + classification card */}
          <div
            className="fb-bento-card overflow-hidden p-8 pb-0 text-center lg:col-span-2"
            style={{
              background: 'linear-gradient(180deg, #5D7DF9 0%, #A9BEFB 70%, #D4DFFD 100%)',
            }}
          >
            <h3 className="fb-serif m-0 text-2xl text-white">
              Tests from every pull request
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-[13px] text-white/80">
              Open a PR and Runza writes the Playwright suite for the exact
              lines that changed.
            </p>
            <div className="mx-auto mt-8 w-full max-w-md rounded-t-2xl bg-white p-5 text-left shadow-[0_-12px_40px_rgba(19,27,77,0.18)]">
              <div className="flex items-center gap-2">
                <GitPullRequest size={15} color="#2B4BF2" />
                <span className="fb-mono text-[11px] text-[#8A92C0]">
                  fix/checkout-total #482
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  ['checkout flow', true],
                  ['coupon applies once', true],
                  ['total updates on qty change', false],
                ].map(([name, pass]) => (
                  <div
                    key={name as string}
                    className="flex items-center justify-between rounded-lg bg-[#EEF2FE] px-3 py-2"
                  >
                    <span className="fb-mono text-[12px] text-[#3D4577]">
                      {name}
                    </span>
                    {pass ? (
                      <CircleCheck size={14} color="#2F8F5B" />
                    ) : (
                      <CircleX size={14} color="#C23B4B" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="fb-bento-card flex flex-col justify-between bg-[#DBE4FE] p-8">
            <div className="flex flex-col items-start gap-3 py-4">
              <span className="rotate-[-2deg] rounded-full bg-[#2B4BF2] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(43,75,242,0.35)]">
                ✓ Confirmed
              </span>
              <span className="ml-8 rotate-[1deg] rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#131B4D] shadow-[0_8px_20px_rgba(19,27,77,0.12)]">
                ~ Flaky
              </span>
              <span className="ml-2 rotate-[-1deg] rounded-full bg-[#F4576E] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(244,87,110,0.35)]">
                ? Inconclusive
              </span>
            </div>
            <div>
              <h3 className="fb-serif m-0 text-lg text-[#131B4D]">
                Every failure classified
              </h3>
              <p className="m-0 mt-1 text-[13px] text-[#545C8C]">
                Retries in a fresh browser separate real bugs from flakes.
              </p>
            </div>
          </div>

          {/* Row 2 — three equal cards */}
          <div className="fb-bento-card flex flex-col justify-between bg-[#EEF2FE] p-8">
            <div className="overflow-hidden rounded-xl bg-[#0F1B2E] shadow-[0_12px_28px_rgba(19,27,77,0.2)]">
              <div className="flex aspect-video items-center justify-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95">
                  <Play size={17} color="#2B4BF2" fill="#2B4BF2" />
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="fb-mono text-[10px] text-white/60">0:07</span>
                <div className="h-1 flex-1 rounded-full bg-white/15">
                  <div className="h-1 w-1/4 rounded-full bg-[#2B4BF2]" />
                </div>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="fb-serif m-0 text-lg text-[#131B4D]">
                Video for every run
              </h3>
              <p className="m-0 mt-1 text-[13px] text-[#545C8C]">
                Traces, screenshots, and replayable video behind one link.
              </p>
            </div>
          </div>

          <div className="fb-bento-card flex flex-col justify-between bg-[#EEF2FE] p-8">
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="rotate-[-3deg] rounded-xl bg-white p-4 shadow-[0_12px_28px_rgba(19,27,77,0.12)]">
                <Accessibility size={20} color="#2B4BF2" />
                <p className="fb-mono m-0 mt-2 text-[11px] text-[#8A92C0]">
                  WCAG AA
                </p>
                <p className="m-0 text-xl font-bold text-[#2F8F5B]">96%</p>
              </div>
              <div className="rotate-[2deg] rounded-xl bg-white p-4 shadow-[0_12px_28px_rgba(19,27,77,0.12)]">
                <CircleX size={20} color="#C23B4B" />
                <p className="fb-mono m-0 mt-2 text-[11px] text-[#8A92C0]">
                  Axe issues
                </p>
                <p className="m-0 text-xl font-bold text-[#131B4D]">3</p>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="fb-serif m-0 text-lg text-[#131B4D]">
                Accessibility on autopilot
              </h3>
              <p className="m-0 mt-1 text-[13px] text-[#545C8C]">
                Axe scans with WCAG rule IDs on every generated test.
              </p>
            </div>
          </div>

          <div className="fb-bento-card flex flex-col justify-between bg-[#EEF2FE] p-8">
            <div className="flex items-center justify-center py-4">
              <div className="relative">
                <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-[#2B4BF2] to-[#8FA8F6] shadow-[0_16px_36px_rgba(43,75,242,0.4)]">
                  <Zap size={30} color="#FFFFFF" fill="#FFFFFF" />
                </span>
                <BadgeCheck
                  size={26}
                  color="#2B4BF2"
                  className="absolute -bottom-2 -right-2 rounded-full bg-white"
                />
              </div>
            </div>
            <div className="mt-6">
              <h3 className="fb-serif m-0 text-lg text-[#131B4D]">
                Bring any model
              </h3>
              <p className="m-0 mt-1 text-[13px] text-[#545C8C]">
                Any OpenAI-compatible base URL, key, and model name works.
              </p>
            </div>
          </div>

          {/* Row 3 — full-width discovery card */}
          <div
            className="fb-bento-card relative overflow-hidden px-8 py-14 text-center lg:col-span-3"
            style={{
              background: 'linear-gradient(180deg, #DEE5FD 0%, #C7D6FD 100%)',
            }}
          >
            <div className="pointer-events-none absolute inset-0 flex flex-wrap items-center justify-between px-6 opacity-90 sm:px-12">
              {FLOW_CHIPS.map((chip) => (
                <span
                  key={chip.label}
                  className="rounded-full px-4 py-2 text-xs font-semibold shadow-[0_6px_16px_rgba(19,27,77,0.1)]"
                  style={{
                    background: chip.bg,
                    color: chip.color,
                    transform: `rotate(${chip.tilt})`,
                  }}
                >
                  {chip.label}
                </span>
              ))}
            </div>
            <div className="relative mx-auto max-w-lg rounded-2xl bg-white/85 px-8 py-6 shadow-[0_16px_40px_rgba(19,27,77,0.12)] backdrop-blur-sm">
              <h3 className="fb-serif m-0 text-2xl text-[#131B4D]">
                Autonomous discovery
                <br />
                <em>covering every flow</em>
              </h3>
              <p className="m-0 mt-2 text-[13px] text-[#545C8C]">
                Point Runza at a URL and it maps pages, forms, and states
                into a full user-flow diagram.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function CompaniesStrip() {
  return (
    <section className="px-4 pb-24">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="fb-serif mb-10 text-[1.75rem] font-medium italic text-[#131B4D]">
          Trusted by teams shipping fast
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {COMPANIES.map((name) => (
            <span
              key={name}
              className="fb-mono text-sm tracking-wider text-black/30"
            >
              {name}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {TESTIMONIAL_CHIPS.map((person) => (
            <div
              key={person.name}
              className="flex items-center gap-3 rounded-lg px-3 py-2"
              style={{ background: person.chipBg }}
            >
              <div className="fb-mono flex h-8 w-8 items-center justify-center rounded-md bg-white/60 text-[11px] font-medium text-[#131B4D]">
                {person.initials}
              </div>
              <div className="text-left">
                <p className="m-0 text-xs font-semibold text-[#131B4D]">
                  {person.name}
                </p>
                <p className="m-0 text-[11px] text-[#545C8C]">{person.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-xl text-center">
          <p className="fb-mono mb-4 text-[11px] tracking-[2px] text-[#8A92C0] uppercase">
            How it works
          </p>
          <h2 className="fb-serif text-[2.1rem] leading-[1.2] tracking-[-0.01em] font-medium text-[#131B4D]">
            From open PR to shipped fix.
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.number}
                className="rounded-2xl bg-[#EEF2FE] p-5"
              >
                <div className="mb-6 flex items-center justify-between">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: step.bg }}
                  >
                    <Icon size={17} color={step.accent} />
                  </span>
                  <span className="fb-mono text-xs text-[#8A92C0]">
                    {step.number}
                  </span>
                </div>
                <h3 className="fb-serif mb-2 text-base font-medium text-[#131B4D]">
                  {step.title}
                </h3>
                <p className="m-0 text-sm leading-snug text-[#545C8C]">
                  {step.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function Reviews() {
  return (
    <section id="reviews" className="px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-xl text-center">
          <p className="fb-mono mb-4 text-[11px] tracking-[2px] text-[#8A92C0] uppercase">
            Reviews
          </p>
          <h2 className="fb-serif text-[2.1rem] leading-[1.2] tracking-[-0.01em] font-medium text-[#131B4D]">
            Teams that ship without the babysitting.
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {REVIEWS.map((review) => (
            <div
              key={review.name}
              className="rounded-2xl p-6 shadow-[0_8px_24px_rgba(60,45,20,0.07)]"
              style={{ background: review.bg }}
            >
              <p className="fb-serif m-0 mb-6 text-[1.05rem] leading-snug text-[#131B4D]">
                &ldquo;{review.quote}&rdquo;
              </p>
              <p className="m-0 text-sm font-semibold text-[#131B4D]">
                {review.name}
              </p>
              <p className="m-0 text-xs text-[#545C8C]">{review.role}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}

export function TestGenerationSection() {
  return (
    <section className="px-4 py-4">
      <div className="mx-auto grid max-w-6xl items-center gap-12 rounded-[28px] bg-[#EEF2FE] px-8 py-14 sm:grid-cols-2 sm:px-14">
        <div>
          <p className="fb-mono mb-4 text-[11px] tracking-[2px] text-[#8A92C0] uppercase">
            Test generation
          </p>
          <h2 className="fb-serif mb-8 text-[2.1rem] leading-[1.2] tracking-[-0.01em] font-medium text-[#131B4D]">
            Tests that actually cover your PR.
          </h2>
          <ul className="m-0 list-none space-y-3 p-0">
            {TEST_GEN_FEATURES.map((item) => {
              const Icon = item.icon
              return (
                <li
                  key={item.text}
                  className="flex items-center gap-3 rounded-xl bg-white px-4 py-3"
                >
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: item.iconBg }}
                  >
                    <Icon size={16} color={item.iconColor} />
                  </span>
                  <span className="text-sm text-[#3D4577]">{item.text}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <TerminalIllustration />
      </div>
    </section>
  )
}

export function VideoEvidenceSection() {
  return (
    <section className="px-4 py-4">
      <div className="mx-auto grid max-w-6xl items-center gap-12 rounded-[28px] bg-[#EEF2FE] px-8 py-14 sm:grid-cols-2 sm:px-14">
        <div className="order-2 sm:order-1">
          <VideoIllustration />
        </div>
        <div className="order-1 sm:order-2">
          <p className="fb-mono mb-4 text-[11px] tracking-[2px] text-[#8A92C0] uppercase">
            Video evidence
          </p>
          <h2 className="fb-serif mb-8 text-[2.1rem] leading-[1.2] tracking-[-0.01em] font-medium text-[#131B4D]">
            Every run, replayable.
          </h2>
          <ul className="m-0 list-none space-y-3 p-0">
            {VIDEO_FEATURES.map((item) => {
              const Icon = item.icon
              return (
                <li
                  key={item.text}
                  className="flex items-center gap-3 rounded-xl bg-white px-4 py-3"
                >
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: item.iconBg }}
                  >
                    <Icon size={16} color={item.iconColor} />
                  </span>
                  <span className="text-sm text-[#3D4577]">{item.text}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-6xl rounded-[28px] bg-[#EEF2FE] px-8 py-14 text-center">
        <h2 className="fb-serif mb-4 text-[2rem] leading-[1.2] font-medium text-[#131B4D]">
          Stop writing Playwright tests by hand.
        </h2>
        <p className="mx-auto mb-8 max-w-md text-sm text-[#545C8C]">
          Free forever. No credit card required.
        </p>
        <a
          href="/waitlist"
          className="fb-cta-glow fb-press inline-flex items-center gap-2 rounded-[28px] bg-[#2B4BF2] px-8 py-3.5 text-sm font-semibold text-[#FFFFFF] no-underline transition hover:-translate-y-0.5 hover:brightness-95"
        >
          Request Access
          <Zap size={15} fill="#FFFFFF" />
        </a>
      </div>
    </section>
  )
}

function TerminalIllustration() {
  return (
    <div
      className="overflow-hidden rounded-2xl p-4 shadow-[0_12px_32px_rgba(60,45,20,0.08)]"
      style={{
        background: 'linear-gradient(160deg, #FBE7C9 0%, #8FA8F6 100%)',
      }}
    >
      <div className="overflow-hidden rounded-xl bg-[#FFFFFF] shadow-inner">
        <div className="flex items-center gap-1.5 border-b border-black/5 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF6B6B]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#F6C453]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#4CAF7D]" />
          <span className="fb-mono ml-2 text-[11px] text-black/35">
            pr-482.spec.ts
          </span>
        </div>
        <div className="fb-mono space-y-2 px-5 py-6 text-[13px] leading-relaxed">
          <p className="m-0 text-black/30">// generated from diff #482</p>
          <p className="m-0">
            <span className="text-[#2B4BF2]">test</span>
            <span className="text-[#131B4D]/70">(</span>
            <span className="text-[#2F8F5B]">'checkout flow'</span>
            <span className="text-[#131B4D]/70">
              , async ({`{ page }`}) =&gt; {`{`}
            </span>
          </p>
          <p className="m-0 pl-4 text-[#131B4D]/70">
            await page.goto(<span className="text-[#2F8F5B]">'/checkout'</span>)
          </p>
          <p className="m-0 pl-4 text-[#131B4D]/70">
            await page.click(<span className="text-[#2F8F5B]">'#pay'</span>)
          </p>
          <p className="m-0 pl-4 text-[#2B4BF2]">
            await expect(page).toHaveURL(/success/)
          </p>
          <p className="m-0 text-[#131B4D]/70">{`}`})</p>
          <p className="m-0 pt-2 text-black/30">
            <span className="fb-blink text-[#2B4BF2]">▍</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function VideoIllustration() {
  return (
    <div
      className="overflow-hidden rounded-2xl p-4 shadow-[0_12px_32px_rgba(60,45,20,0.08)]"
      style={{
        background: 'linear-gradient(160deg, #DBE4FE 0%, #A9C7F3 100%)',
      }}
    >
      <div className="overflow-hidden rounded-xl bg-[#0F1B2E]">
        <div className="flex aspect-video items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg">
            <Play size={22} color="#2B4BF2" fill="#2B4BF2" />
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="fb-mono text-[11px] text-white/60">0:07 / 0:24</span>
          <div className="h-1 flex-1 rounded-full bg-white/15">
            <div className="h-1 w-1/4 rounded-full bg-[#2B4BF2]" />
          </div>
        </div>
      </div>
    </div>
  )
}
