type RunzaLogoProps = {
  className?: string
}

export default function RunzaLogo({ className }: RunzaLogoProps) {
  return (
    <svg
      viewBox="0 0 400 120"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(7 11) scale(.98)">
        <g
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M25 82V18h27c17 0 27 9 27 23S69 64 52 64H25"
            strokeWidth="10"
          />
          <path d="M52 64 79 86" strokeWidth="10" />
        </g>
        <path d="m49 32 16 10-16 10Z" fill="#8FA8F6" />
      </g>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M127 83V43m0 14c0-9 7-14 17-14h8" />
        <path d="M174 43v25c0 10 7 15 16 15s16-5 16-15V43" />
        <path d="M229 83V43m0 14c0-9 7-15 17-15s17 6 17 16v25" />
        <path d="M285 43h32l-32 40h34" />
        <path d="M358 47c-4-4-10-6-17-6-13 0-20 9-20 21s7 21 20 21c10 0 17-8 17-20m0-21v41" />
      </g>
    </svg>
  )
}
