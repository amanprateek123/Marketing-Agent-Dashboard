import { HelpCircle } from 'lucide-react'

type Health = 'good' | 'watch' | 'bad' | 'unknown'

interface Props {
  /** Big, human label — e.g. "Money spent today" */
  label: string
  /** The number itself — e.g. "₹4,320" */
  value: string
  /** Small line under the value explaining context — e.g. "across 4 ads" */
  sub?: string
  /** Optional tooltip on hover: what does this really mean? */
  help?: string
  /** Traffic-light health — colours the value + adds a dot */
  health?: Health
}

const HEALTH_COLOR: Record<Health, string> = {
  good: 'var(--good)',
  watch: 'var(--warn)',
  bad: 'var(--bad)',
  unknown: 'var(--ink)',
}

const HEALTH_DOT: Record<Health, string | null> = {
  good: 'var(--good)',
  watch: 'var(--warn)',
  bad: 'var(--bad)',
  unknown: null,
}

/**
 * The tile a non-tech person sees. Big number, plain sentence label,
 * optional "?" for jargon explanations.
 */
export function PlainMetric({ label, value, sub, help, health = 'unknown' }: Props) {
  const dot = HEALTH_DOT[health]
  return (
    <div
      className="card px-5 py-5"
      style={{ minHeight: 112 }}
    >
      <div className="flex items-center gap-2 mb-2">
        {dot && (
          <span
            className="inline-block rounded-full"
            style={{ width: 8, height: 8, background: dot }}
          />
        )}
        <p className="micro-label" style={{ color: 'var(--ink-3)' }}>
          {label}
        </p>
        {help && (
          <span title={help} className="inline-flex" style={{ color: 'var(--ink-4)' }}>
            <HelpCircle size={13} />
          </span>
        )}
      </div>
      <p
        className="display-num"
        style={{ fontSize: 32, color: HEALTH_COLOR[health] }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-2" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}
