'use client'

import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { getPmReport } from '@/lib/performance-marketeer-api'
import { productLabel } from '@/lib/performance-marketeer-api'
import type { PmAction, PmFinding, PmMetrics, PmReportResponse } from '@/types/performance-marketeer'
import { ConfidenceChip, Delta, LoadError, PmSkeleton, SectionCard, Source, T, VerdictChip, fmt, useLoad } from './shared'

const SEVERITY: Record<PmFinding['severity'], { label: string; chip: string; Icon: typeof Info; color: string }> = {
  critical: { label: 'Act now', chip: 'chip-bad', Icon: CircleAlert, color: 'var(--bad)' },
  warning: { label: 'Watch', chip: 'chip-warn', Icon: TriangleAlert, color: 'var(--warn)' },
  positive: { label: 'Working', chip: 'chip-good', Icon: CircleCheck, color: 'var(--good)' },
  info: { label: 'For context', chip: 'chip-info', Icon: Info, color: 'var(--info)' },
}

const AREA: Record<PmFinding['area'], string> = {
  roas: 'Return', trend: 'Trend', funnel: 'Website funnel', fatigue: 'Creative fatigue', budget: 'Budget', geo: 'Geography', tracking: 'Tracking', change: 'Recent change',
}

/** UC-11 actions in plain words; the chip tone says how much it changes. */
export const ACTION: Record<PmAction, { label: string; chip: string; help: string }> = {
  hold: { label: 'Hold', chip: 'chip-neutral', help: 'Change nothing yet — collect more data.' },
  investigate: { label: 'Investigate', chip: 'chip-info', help: 'Look into the cause before changing anything.' },
  test: { label: 'Test', chip: 'chip-accent', help: 'Run a small, measured experiment.' },
  scale: { label: 'Scale', chip: 'chip-good', help: 'Increase budget in controlled steps.' },
  reduce_budget: { label: 'Reduce budget', chip: 'chip-bad', help: 'Lower the budget.' },
  pause: { label: 'Pause', chip: 'chip-bad', help: 'Stop delivery.' },
  change_targeting: { label: 'Change targeting', chip: 'chip-warn', help: 'Adjust the audience or placements.' },
  refresh_creative: { label: 'Refresh creative', chip: 'chip-warn', help: 'Prepare new ads to replace tired ones.' },
  fix_funnel: { label: 'Fix funnel', chip: 'chip-warn', help: 'The website or checkout is losing buyers.' },
  fix_tracking: { label: 'Fix tracking', chip: 'chip-warn', help: 'The numbers may be wrong — fix measurement first.' },
}

const LEVEL: Record<PmFinding['entity']['level'], string> = { account: 'Account', campaign: 'Campaign', adset: 'Ad set', ad: 'Ad' }

const rel = (c: number | null, p: number | null) => (c == null || p == null || p === 0 ? null : c / p - 1)

interface ReportProps {
  tenantId: string
  date: string
  product: string
  action: string
  onAction: (action: string) => void
}

export function ReportTab({ tenantId, date, product, action, onAction }: ReportProps) {
  const r = useLoad(`report${date}${product}`, () => getPmReport(tenantId, date, product || undefined))
  if (r.error) return <LoadError message={r.error} onRetry={r.reload} />
  if (!r.data) return <PmSkeleton rows={3} />
  return <Report d={r.data} dim={r.loading} product={product} action={action} onAction={onAction} />
}

function Report({ d, dim, product, action, onAction }: { d: PmReportResponse; dim: boolean; product: string; action: string; onAction: (a: string) => void }) {
  const k = d.kpis.last7
  const p = d.kpis.prior7
  return (
    <article className={`flex flex-col gap-5 ${dim ? 'opacity-60' : ''}`} aria-busy={dim}>
      <section className="card-hero px-5 py-5 sm:px-6">
        <p className="micro-label">
          Daily report · {fmt.date(d.date)} · last 7 days {fmt.date(d.window.last7.from)}–{fmt.date(d.window.last7.to)} vs {fmt.date(d.window.prior7.from)}–{fmt.date(d.window.prior7.to)}
        </p>
        <h2 className="mt-2 text-[20px] font-semibold leading-snug text-balance sm:text-[22px]" style={{ color: 'var(--ink)' }}>
          {d.headline}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <VerdictChip target={d.kpis.target} />
          <ConfidenceChip c={d.kpis.target.confidence} />
          <span className="explain">{productLabel(product || undefined)} · generated {fmt.dateTime(d.generatedAt)} · rule-based, no AI</span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Spend" src="meta" v={fmt.inr(k.spend)} c={rel(k.spend, p.spend)} up={false} />
          <Kpi label="Revenue" src="fp" v={fmt.inr(k.firstPartyRevenue)} c={rel(k.firstPartyRevenue, p.firstPartyRevenue)} />
          <Kpi label={<T k="roas">ROAS</T>} src="fp" v={fmt.roas(k.firstPartyRoas)} c={rel(k.firstPartyRoas, p.firstPartyRoas)} />
          <Kpi label={<T k="cpa">CPA</T>} src="fp" v={fmt.inr(k.firstPartyCpa)} c={rel(k.firstPartyCpa, p.firstPartyCpa)} up={false} />
          <Kpi label="Orders" src="fp" v={fmt.int(k.firstPartyOrders)} c={rel(k.firstPartyOrders, p.firstPartyOrders)} />
          <Kpi label={<T k="roas">Meta ROAS</T>} src="meta" v={fmt.roas(k.metaRoas)} c={rel(k.metaRoas, p.metaRoas)} />
        </dl>
      </section>

      <section aria-labelledby="pm-products">
        <h2 id="pm-products" className="section-title mb-3">By product · last 7 days</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {d.byProduct.map((b) => (
            <ProductCard key={b.product} label={b.label} m={b.last7} prior={b.prior7} target={b.target} />
          ))}
        </div>
      </section>

      <Findings findings={d.findings} action={action} onAction={onAction} />
    </article>
  )
}

function Kpi({ label, src, v, c, up = true }: { label: React.ReactNode; src: 'meta' | 'fp'; v: string; c: number | null; up?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--ink-3)' }}>
        {label} <Source s={src} />
      </dt>
      <dd className="display-num mt-1 text-[22px] tabular-nums">{v}</dd>
      <dd>
        <Delta change={c} upIsGood={up} />
      </dd>
    </div>
  )
}

function ProductCard({ label, m, prior, target }: { label: string; m: PmMetrics; prior: PmMetrics; target: PmReportResponse['kpis']['target'] }) {
  const low = target.confidence === 'low'
  return (
    <div className="card p-4" title={low ? 'Low confidence — fewer than 10 orders.' : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{label}</h3>
        <VerdictChip target={target} />
      </div>
      <p className="display-num mt-2 text-[26px] tabular-nums" style={{ color: low ? 'var(--ink-3)' : 'var(--ink)' }}>
        {fmt.roas(m.firstPartyRoas)} <span className="text-[13px] font-medium" style={{ color: 'var(--ink-3)' }}>first-party ROAS</span>
      </p>
      <p className="mt-1 flex flex-wrap gap-x-3 text-[12px]">
        <span>ROAS <Delta change={rel(m.firstPartyRoas, prior.firstPartyRoas)} /></span>
        <span>Orders <Delta change={rel(m.firstPartyOrders, prior.firstPartyOrders)} /></span>
      </p>
      <p className="explain mt-1 tabular-nums">
        {fmt.inr(m.spend)} spend (Meta) · {fmt.int(m.firstPartyOrders)} orders · CPA {fmt.inr(m.firstPartyCpa)} · Meta reported {fmt.int(m.metaPurchases)} purchases
      </p>
      <p className="explain mt-1">{target.note}</p>
    </div>
  )
}

function Findings({ findings: all, action, onAction }: { findings: PmFinding[]; action: string; onAction: (a: string) => void }) {
  const order: PmFinding['severity'][] = ['critical', 'warning', 'positive', 'info']
  const counts = all.reduce<Partial<Record<PmAction, number>>>((c, f) => ({ ...c, [f.action]: (c[f.action] ?? 0) + 1 }), {})
  const findings = action ? all.filter((f) => f.action === action) : all
  return (
    <SectionCard title={`What we found (${all.length})`} description="Ordered by urgency. Each finding names the item, the numbers, the window, the source and what to do. “Hold” is a valid answer when the data is thin.">
      <div className="mb-5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter findings by action">
        <span className="mr-1 text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>Action:</span>
        <FilterButton pressed={!action} onClick={() => onAction('')}>All ({all.length})</FilterButton>
        {(Object.keys(ACTION) as PmAction[]).filter((a) => counts[a]).map((a) => (
          <FilterButton key={a} pressed={action === a} onClick={() => onAction(action === a ? '' : a)}>
            {ACTION[a].label} ({counts[a]})
          </FilterButton>
        ))}
      </div>
      {findings.length === 0 ? (
        <p className="explain">{all.length ? 'No findings with this action.' : 'Nothing stood out — keep running as is.'}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {order.map((sev) => {
            const list = findings.filter((f) => f.severity === sev)
            if (!list.length) return null
            const s = SEVERITY[sev]
            return (
              <section key={sev} aria-labelledby={`pm-sev-${sev}`}>
                <h3 id={`pm-sev-${sev}`} className="mb-2 flex items-center gap-2 text-[14px] font-semibold" style={{ color: s.color }}>
                  <s.Icon size={16} aria-hidden="true" />
                  {s.label} ({list.length})
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {list.map((f, i) => (
                    <li key={i} className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)', borderLeft: `4px solid ${s.color}`, opacity: f.confidence === 'low' ? 0.75 : 1 }}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`chip ${ACTION[f.action]?.chip ?? 'chip-neutral'} !text-[12.5px] !font-bold`} title={ACTION[f.action]?.help}>
                          <span className="sr-only">Action: </span>
                          {ACTION[f.action]?.label ?? f.action}
                        </span>
                        <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                          {AREA[f.area]} · {LEVEL[f.entity.level]}
                        </span>
                        <span className="min-w-0 break-words text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                          {f.entity.name}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[15px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                        {f.title}
                      </p>
                      <p className="mt-1 break-words text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                        {f.evidence}
                      </p>
                      <div className="mt-2">
                        <ConfidenceChip c={f.confidence} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}

function FilterButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`chip cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)] ${pressed ? 'chip-accent' : 'chip-neutral hover:border-[var(--ink-4)]'}`}
    >
      {children}
    </button>
  )
}
