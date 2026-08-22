interface MeridianMarkProps {
  compact?: boolean
  inverse?: boolean
}

interface MeridianGlyphProps {
  size?: number
  className?: string
}

/**
 * A globe meridian crossed by a rising evidence line. The mark expresses the
 * product promise—understand the market, act, and measure what moved—without
 * relying on the generic sparkle icon used by many AI products.
 */
export function MeridianGlyph({ size = 20, className }: MeridianGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="12.25" stroke="currentColor" strokeWidth="1.7" opacity="0.42" />
      <path
        d="M16 3.75c3.7 3.55 5.75 7.74 5.75 12.25S19.7 24.7 16 28.25C12.3 24.7 10.25 20.51 10.25 16S12.3 7.3 16 3.75Z"
        stroke="currentColor"
        strokeWidth="1.45"
        opacity="0.52"
      />
      <path
        d="M5.7 19.1h5.15l3.35-4.25 4.05 3.35 7.8-8.55"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22.15 9.65h3.9v3.9"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function MeridianMark({ compact = false, inverse = false }: MeridianMarkProps) {
  const ink = inverse ? '#fff' : 'var(--ink)'
  const accent = inverse ? 'var(--nav-accent)' : 'var(--accent)'

  return (
    <div className="inline-flex items-center gap-3" aria-label="Meridian AI Growth OS">
      <span
        className={`${compact ? 'h-9 w-9 rounded-[11px]' : 'h-11 w-11 rounded-[13px]'} inline-flex shrink-0 items-center justify-center`}
        style={{
          background: inverse ? 'rgba(255,255,255,.12)' : 'var(--accent-bg)',
          border: inverse ? '1px solid rgba(255,255,255,.18)' : '1px solid var(--accent-border)',
          color: accent,
          boxShadow: inverse
            ? 'inset 0 1px 0 rgba(255,255,255,.12)'
            : 'inset 0 1px 0 rgba(255,255,255,.8), 0 8px 18px -13px rgba(31,51,126,.9)',
        }}
        aria-hidden="true"
      >
        <MeridianGlyph size={compact ? 19 : 23} />
      </span>
      <span>
        <span
          className={`${compact ? 'text-[25px]' : 'text-[29px]'} font-display italic leading-none`}
          style={{ color: ink }}
        >
          Merid<span style={{ color: accent }}>i</span>an
        </span>
        {!compact && (
          <span
            className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.19em]"
            style={{ color: inverse ? 'rgba(255,255,255,.68)' : 'var(--ink-3)' }}
          >
            AI Growth OS
          </span>
        )}
      </span>
    </div>
  )
}
