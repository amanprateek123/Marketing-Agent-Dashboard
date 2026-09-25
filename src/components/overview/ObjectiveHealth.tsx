import Link from 'next/link'
import { ArrowRight, CircleDollarSign, Target } from 'lucide-react'
import { formatPercent } from '@/lib/utils'
import { formatInr } from '@/lib/plain-language'
import type { DashboardCampaignRow, FacetRollup } from '@/types'

interface ObjectiveHealthProps {
  campaigns: DashboardCampaignRow[]
  objectives: FacetRollup[]
  tenantId: string
}

/**
 * Campaign health without the common dashboard mistake of judging awareness,
 * traffic and engagement campaigns on purchase ROAS. The backend has already
 * evaluated each campaign against its own primary KPI; we only count those
 * server verdicts here.
 */
export function ObjectiveHealth({ campaigns, objectives, tenantId }: ObjectiveHealthProps) {
  if (!objectives.length) {
    return (
      <section aria-labelledby="objective-health-title" className="card px-6 py-10 text-center">
        <Target size={24} className="mx-auto mb-3" style={{ color: 'var(--ink-4)' }} aria-hidden="true" />
        <h2 id="objective-health-title" className="section-title">
          Campaign health will appear here
        </h2>
        <p className="explain mx-auto mt-2 max-w-md">
          Once campaigns start spending, we will check each one against its own goal — sales, awareness, website visits and so on.
        </p>
        <Link href={`/dashboard/${tenantId}/campaign-copilot`} className="btn btn-accent mt-5">
          Build the first campaign <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby="objective-health-title" className="card overflow-hidden">
      <div
        className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-end sm:justify-between"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <div className="min-w-0">
          <p className="micro-label mb-1.5">How your campaigns are doing</p>
          <h2 id="objective-health-title" className="section-title">
            Each campaign checked against its own goal
          </h2>
        </div>
        <Link
          href={`/dashboard/${tenantId}/campaigns`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: 'var(--accent-strong)' }}
        >
          Open campaigns <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {objectives.map((objective, index) => {
          const rows = campaigns.filter(
            (campaign) => campaign.spend > 0 && campaign.objectiveLabel === objective.label,
          )
          const isRevenueObjective = rows.some((campaign) => campaign.isRevenueObjective)
          // Sales verdicts are intentionally neutral here until every row has a
          // compatible return basis. The command-center headline owns the
          // provenance-aware raw-return calculation.
          const good = isRevenueObjective ? 0 : rows.filter((campaign) => campaign.primaryKpi.status === 'good').length
          const watch = isRevenueObjective ? 0 : rows.filter((campaign) => campaign.primaryKpi.status === 'watch').length
          const bad = isRevenueObjective ? 0 : rows.filter((campaign) => campaign.primaryKpi.status === 'bad').length
          const neutral = Math.max(0, objective.campaignCount - good - watch - bad)
          const metricLabels = [...new Set(rows.map((campaign) => campaign.primaryKpi.label))]
          const measured = Math.max(objective.campaignCount, 1)
          const headline = isRevenueObjective
            ? `${objective.campaignCount} sales campaign${objective.campaignCount === 1 ? '' : 's'}`
            : bad > 0
              ? `${bad} need attention`
              : good > 0
                ? `${good} on target`
                : 'Too early to tell'

          return (
            <article
              key={objective.key}
              className="min-w-0 px-5 py-5"
              style={{
                borderTop: index > 0 ? '1px solid var(--hairline-light)' : undefined,
              }}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--ink)' }} title={objective.label}>
                    {objective.label}
                  </p>
                  <p className="explain mt-0.5">
                    {objective.campaignCount} campaign{objective.campaignCount === 1 ? '' : 's'} ·{' '}
                    {formatInr(objective.spend)} spent
                  </p>
                </div>
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: 'var(--accent-bg)',
                    color: 'var(--accent-strong)',
                  }}
                >
                  {isRevenueObjective ? (
                    <CircleDollarSign size={17} aria-hidden="true" />
                  ) : (
                    <Target size={17} aria-hidden="true" />
                  )}
                </span>
              </div>

              <p
                className="display-num break-words text-2xl"
                style={{
                  color:
                    bad > 0
                      ? 'var(--bad)'
                      : good > 0
                        ? 'var(--good)'
                        : 'var(--ink)',
                }}
              >
                {headline}
              </p>
              <p className="explain mt-1 min-h-10">
                {isRevenueObjective
                  ? `${formatInr(objective.spend)} spent · see Campaigns for sales by campaign`
                  : metricLabels.length
                    ? `Judged on ${metricLabels.slice(0, 2).join(' and ')}`
                    : 'Waiting for the first results for this goal'}
              </p>

              <div
                className="mt-4 flex h-2 overflow-hidden rounded-full"
                style={{ background: 'var(--muted)' }}
                role="img"
                aria-label={`${good} on target, ${watch} to watch, ${bad} need attention, ${neutral} too early to tell`}
              >
                {good > 0 && <span style={{ width: formatPercent(good / measured, 2), background: 'var(--good)' }} />}
                {watch > 0 && <span style={{ width: formatPercent(watch / measured, 2), background: 'var(--warn)' }} />}
                {bad > 0 && <span style={{ width: formatPercent(bad / measured, 2), background: 'var(--bad)' }} />}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--ink-3)' }}>
                <Legend color="var(--good)" label={`${good} on target`} />
                <Legend color="var(--warn)" label={`${watch} to watch`} />
                <Legend color="var(--bad)" label={`${bad} need attention`} />
                {neutral > 0 && <Legend color="var(--ink-4)" label={`${neutral} too early`} />}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  )
}
