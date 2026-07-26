import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import type { DashboardInsight } from '@/types'

const STRENGTH_STYLE: Record<
  DashboardInsight['strength'],
  { chip: string; label: string; opacity: number }
> = {
  strong: { chip: 'chip chip-good', label: 'Well supported', opacity: 1 },
  moderate: { chip: 'chip chip-warn', label: 'Some support', opacity: 0.95 },
  weak: { chip: 'chip chip-neutral', label: 'Early signal', opacity: 0.8 },
}

/**
 * Learnings, one card each, weighted by how much they're actually backed by.
 *
 * The previous version rendered a single ~200-word paragraph containing three
 * separate findings — a budget misconfiguration, a landing-page conversion
 * problem, and a learning-phase volume problem — each with a different owner
 * and a different fix, at 60% confidence from two campaigns, styled exactly
 * like an established fact. Splitting them and grading the support lets a
 * reader tell which ones to act on.
 */
export function InsightList({
  insights,
  tenantId,
}: {
  insights: DashboardInsight[]
  tenantId: string
}) {
  return (
    <div className="card overflow-hidden flex flex-col">
      <div
        className="px-5 py-4 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <Sparkles size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="section-title">What we&rsquo;re learning</h2>
      </div>

      {insights.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p style={{ color: 'var(--ink-3)' }}>Not enough data yet.</p>
          <p className="explain mt-2">
            Once a few campaigns finish, patterns show up here.
          </p>
        </div>
      ) : (
        <div className="flex-1">
          {insights.slice(0, 4).map((ins, i) => {
            const s = STRENGTH_STYLE[ins.strength]
            return (
              <div
                key={ins.id}
                className="px-5 py-4"
                style={{
                  borderTop: i === 0 ? undefined : '1px solid var(--hairline-light)',
                  opacity: s.opacity,
                }}
              >
                {/* Clamped: these findings run 200+ words each, and four of
                    them unclamped stretch this column to several times the
                    height of the alert feed beside it. The full text lives on
                    the learnings page. */}
                <p
                  title={ins.finding}
                  style={{
                    color: 'var(--ink)',
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    display: '-webkit-box',
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {ins.finding}
                </p>
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <span className={s.chip} style={{ fontSize: 11 }}>
                    {s.label}
                  </span>
                  <span className="explain">
                    {(ins.confidence * 100).toFixed(0)}% sure · {ins.dataPoints}{' '}
                    campaign{ins.dataPoints === 1 ? '' : 's'}
                  </span>
                  {ins.category && (
                    <span className="explain" style={{ marginLeft: 'auto' }}>
                      {ins.category.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href={`/dashboard/${tenantId}/learnings`}
        className="px-5 py-3 text-sm font-medium"
        style={{
          borderTop: '1px solid var(--hairline-light)',
          color: 'var(--accent-strong)',
        }}
      >
        See all patterns →
      </Link>
    </div>
  )
}
