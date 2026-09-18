import Link from 'next/link'
import {
  AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, Info,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { DashboardAlert, AlertSeverity } from '@/types'

const SEVERITY_STYLE: Record<AlertSeverity, {
  icon: typeof AlertOctagon
  color: string
  bg: string
  border: string
  label: string
}> = {
  critical: {
    icon: AlertOctagon,
    color: 'var(--bad)',
    bg: 'var(--bad-bg)',
    border: 'var(--bad-border)',
    label: 'Urgent evidence',
  },
  warning: {
    icon: AlertTriangle,
    color: 'var(--warn)',
    bg: 'var(--warn-bg)',
    border: 'var(--warn-border)',
    label: 'Worth a look',
  },
  info: {
    icon: Info,
    color: 'var(--info)',
    bg: 'var(--info-bg)',
    border: 'var(--info-border)',
    label: 'For your awareness',
  },
}

/**
 * The attention feed.
 *
 * Replaces an empty state that said "All caught up 🎉" whenever the approval
 * queue was empty. The queue being empty and the available campaign evidence
 * being healthy are different questions, so this state only summarizes the
 * alerts the backend can support with the current data.
 */
export function AlertFeed({ alerts }: { alerts: DashboardAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <CheckCircle2
          size={22}
          style={{ color: 'var(--good)' }}
          className="mx-auto mb-3"
        />
        <p style={{ color: 'var(--ink)' }} className="font-medium">
          Nothing needs attention.
        </p>
        <p className="explain mt-2">
          No urgent evidence or configuration alerts in the current data.
        </p>
      </div>
    )
  }

  return (
    <div>
      {alerts.map((a, i) => {
        const s = SEVERITY_STYLE[a.severity]
        const Icon = s.icon
        const body = (
          <div
            className="flex items-start gap-3.5 px-5 py-4"
            style={{ borderTop: i === 0 ? undefined : '1px solid var(--hairline-light)' }}
          >
            <span
              className="shrink-0 inline-flex items-center justify-center rounded-lg mt-0.5"
              style={{ width: 30, height: 30, background: s.bg, border: `1px solid ${s.border}` }}
            >
              <Icon size={15} style={{ color: s.color }} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="font-semibold" style={{ color: 'var(--ink)' }}>
                  {a.title}
                </p>
                {a.amount != null && a.amount > 0 && (
                  <span className="mono" style={{ fontSize: 12, color: s.color }}>
                    {formatCurrency(Math.round(a.amount))}
                  </span>
                )}
              </div>
              <p className="explain mt-1">{a.detail}</p>
              {a.suggestedAction && (
                <p
                  className="mt-1.5 font-medium"
                  style={{ fontSize: 12.5, color: s.color }}
                >
                  → {a.suggestedAction}
                </p>
              )}
            </div>
            {a.href && (
              <ArrowRight
                size={15}
                style={{ color: 'var(--ink-4)' }}
                className="shrink-0 mt-1"
              />
            )}
          </div>
        )
        return a.href ? (
          <Link key={`${a.kind}-${i}`} href={a.href} className="block card-hover">
            {body}
          </Link>
        ) : (
          <div key={`${a.kind}-${i}`}>{body}</div>
        )
      })}
    </div>
  )
}
