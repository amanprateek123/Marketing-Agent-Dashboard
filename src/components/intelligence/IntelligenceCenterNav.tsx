import Link from 'next/link'
import { BookOpenCheck, ChartNoAxesCombined, Sparkles } from 'lucide-react'

type IntelligenceView = 'recommendations' | 'patterns' | 'quality'

interface IntelligenceCenterNavProps {
  tenantId: string
  active: IntelligenceView
}

const VIEWS = [
  {
    key: 'recommendations' as const,
    label: 'Recommendations',
    description: 'Review what Meridian wants to change',
    path: 'proposed-actions',
    Icon: Sparkles,
  },
  {
    key: 'patterns' as const,
    label: 'Winning patterns',
    description: 'Reuse evidence from past performance',
    path: 'learnings',
    Icon: BookOpenCheck,
  },
  {
    key: 'quality' as const,
    label: 'Decision quality',
    description: 'Check actions, outcomes and safeguards',
    path: 'intelligence',
    Icon: ChartNoAxesCombined,
  },
]

export function IntelligenceCenterNav({ tenantId, active }: IntelligenceCenterNavProps) {
  return (
    <nav aria-label="Intelligence center" className="mb-8">
      <div
        className="grid grid-cols-1 gap-2 rounded-2xl p-2 sm:grid-cols-3"
        style={{
          background: 'var(--surface-warm)',
          border: '1px solid var(--hairline)',
        }}
      >
        {VIEWS.map(({ key, label, description, path, Icon }, index) => {
          const isActive = active === key
          return (
            <Link
              key={key}
              href={`/dashboard/${tenantId}/${path}`}
              aria-current={isActive ? 'page' : undefined}
              className="group flex min-h-16 items-center gap-3 rounded-xl px-3.5 py-3 transition-[background-color,border-color,box-shadow,transform] duration-200 motion-reduce:transition-none"
              style={
                isActive
                  ? {
                      background: 'var(--surface)',
                      border: '1px solid var(--accent-border)',
                      boxShadow: 'var(--shadow-soft)',
                    }
                  : { border: '1px solid transparent' }
              }
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: isActive ? 'var(--accent-bg)' : 'var(--muted)',
                  color: isActive ? 'var(--accent-strong)' : 'var(--ink-3)',
                }}
              >
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isActive ? 'var(--ink)' : 'var(--ink-2)' }}
                  >
                    {label}
                  </span>
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--ink-4)' }}>
                    0{index + 1}
                  </span>
                </span>
                <span className="mt-0.5 hidden text-[11px] leading-snug lg:block" style={{ color: 'var(--ink-3)' }}>
                  {description}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
