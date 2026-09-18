import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  Inbox,
  Sparkles,
} from 'lucide-react'
import type { DashboardInsight, PortfolioRollup, TenantActivity } from '@/types'

interface GrowthLoopProps {
  activity: TenantActivity
  insights: DashboardInsight[]
  portfolio: PortfolioRollup
  tenantId: string
}

/**
 * Shows the product as a closed loop instead of a collection of features.
 * Every number is already present in the overview response; this component
 * only gives those operational facts a clear sequence.
 */
export function GrowthLoop({ activity, insights, portfolio, tenantId }: GrowthLoopProps) {
  const base = `/dashboard/${tenantId}`
  const openProposals = activity.queue.pendingActions + activity.queue.pendingDecisions
  const steps = [
    {
      label: 'Understand',
      value: insights.length,
      unit: insights.length === 1 ? 'learning signal' : 'learning signals',
      detail: 'Find patterns in campaign evidence',
      href: `${base}/learnings`,
      icon: Sparkles,
    },
    {
      label: 'Create',
      value: activity.creatives.ready,
      unit: 'creatives ready',
      detail: 'Turn strategy into usable ads',
      href: `${base}/creatives`,
      icon: ImageIcon,
    },
    {
      label: 'Review',
      value: activity.queue.pendingApprovalCampaigns,
      unit:
        activity.queue.pendingApprovalCampaigns === 1
          ? 'campaign waiting'
          : 'campaigns waiting',
      detail: 'Keep a human at the launch gate',
      href: `${base}/approvals`,
      icon: Inbox,
    },
    {
      label: 'Measure',
      value: portfolio.campaignCount,
      unit: portfolio.campaignCount === 1 ? 'campaign tracked' : 'campaigns tracked',
      detail: 'Judge each campaign by its goal',
      href: `${base}/campaigns`,
      icon: Activity,
    },
    {
      label: 'Improve',
      value: openProposals,
      unit: openProposals === 1 ? 'proposal open' : 'proposals open',
      detail: 'Convert diagnosis into the next action',
      href: `${base}/proposed-actions`,
      icon: CheckCircle2,
    },
  ]

  return (
    <section aria-labelledby="growth-loop-title" className="card overflow-hidden">
      <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: 'var(--hairline)' }}>
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="beacon" aria-hidden="true" />
            <p className="micro-label">AI growth loop</p>
          </div>
          <h2 id="growth-loop-title" className="section-title">
            Every result feeds the next decision
          </h2>
        </div>
        <p className="explain">Observed operating state; no incrementality claim</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon
          return (
            <Link
              key={step.label}
              href={step.href}
              className="group relative min-w-0 px-5 py-5 transition-colors hover:bg-[var(--surface-warm)]"
              style={{
                borderTop: index > 0 ? '1px solid var(--hairline-light)' : undefined,
              }}
              aria-label={`${step.label}: ${step.value} ${step.unit}`}
            >
              <div className="mb-5 flex items-center justify-between">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: 'var(--accent-bg)', color: 'var(--accent-strong)' }}
                >
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--ink-4)' }}>
                  {String(index + 1).padStart(2, '0')}
                  <ArrowRight
                    size={13}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </div>
              <p className="micro-label mb-1">{step.label}</p>
              <p className="display-num text-2xl" style={{ color: 'var(--ink)' }}>
                {step.value.toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
                {step.unit}
              </p>
              <p className="explain mt-2">{step.detail}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
