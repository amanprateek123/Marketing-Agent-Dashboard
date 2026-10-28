'use client'

import { useState } from 'react'
import { Term } from '@/components/plain/Term'
import { ImageOff } from 'lucide-react'
import { getPmBudget, getPmChanges, getPmFatigue, getPmGeo, getPmReconcile, productLabel } from '@/lib/performance-marketeer-api'
import type { PmBudgetRow, PmFatigueRow, PmGeoRow, PmQuery } from '@/types/performance-marketeer'
import {
  Caveat,
  ConfidenceChip,
  Empty,
  LoadError,
  PmSkeleton,
  SectionCard,
  SortTh,
  Source,
  T,
  TableWrap,
  compare,
  fmt,
  lowConfProps,
  useLoad,
  type SortState,
} from './shared'

function Loaded<D>({ r, children }: { r: { data?: D; error?: string; loading: boolean; reload: () => void }; children: (d: D) => React.ReactNode }) {
  if (r.error) return <LoadError message={r.error} onRetry={r.reload} />
  if (!r.data) return <PmSkeleton rows={2} />
  return (
    <div className={r.loading ? 'opacity-60' : undefined} aria-busy={r.loading}>
      {children(r.data)}
    </div>
  )
}

// ── Creatives / fatigue ────────────────────────────────────────────────────

const FATIGUE: Record<PmFatigueRow['status'], { label: string; chip: string }> = {
  fatigued: { label: 'Fatigued', chip: 'chip-bad' },
  watch: { label: 'Watch', chip: 'chip-warn' },
  healthy: { label: 'Healthy', chip: 'chip-good' },
  not_enough_data: { label: 'Not enough data', chip: 'chip-neutral' },
}

export function CreativesTab({ tenantId, q }: { tenantId: string; q: PmQuery }) {
  const r = useLoad(`fatigue${JSON.stringify(q)}`, () => getPmFatigue(tenantId, q))
  return (
    <SectionCard
      padded={false}
      title="Creative fatigue"
      description="Launch week vs the last 7 days of the range. “Fatigued” needs frequency rising and CTR falling or CPA rising — one bad week alone is not enough."
    >
      <div className="p-5">
        <Loaded r={r}>
          {(d) =>
            d.rows.length === 0 ? (
              <Empty title="No ads delivered in this range" />
            ) : (
              <TableWrap label="Creative fatigue table">
                <thead>
                  <tr>
                    <th>Creative</th>
                    <th>Status</th>
                    <th className="num">Days live</th>
                    <th className="num">Spend <Source s="meta" /></th>
                    <th className="num"><T k="frequency">Avg daily freq.</T> <Source s="meta" /></th>
                    <th className="num"><T k="ctr">CTR</T> <Source s="meta" /></th>
                    <th className="num"><T k="cpa">CPA</T> <Source s="fp" /></th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((a) => (
                    <tr key={a.adId}>
                      <td className="min-w-[280px] max-w-[360px]">
                        <div className="flex gap-3">
                          <Thumb url={a.creative?.thumbnailUrl} title={a.creative?.title} />
                          <div className="min-w-0">
                            <p className="break-words font-semibold" style={{ color: 'var(--ink)' }}>{a.adName}</p>
                            {a.creative?.title && <p className="break-words text-[13px] font-medium" style={{ color: 'var(--ink-2)' }}>{a.creative.title}</p>}
                            {a.creative?.body && <p className="line-clamp-2 text-[12.5px]" style={{ color: 'var(--ink-3)' }} title={a.creative.body}>{a.creative.body}</p>}
                            <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-4)' }}>{a.campaignName} · {productLabel(a.product)}</p>
                          </div>
                        </div>
                      </td>
                      <td><span className={`chip ${FATIGUE[a.status].chip}`}>{FATIGUE[a.status].label}</span></td>
                      <td className="num">{a.daysLive}</td>
                      <td className="num">{fmt.inr(a.spend)}</td>
                      <td className="num">{fmt.dec(a.frequencyFirst7)} → {fmt.dec(a.frequencyLast7)}</td>
                      <td className="num">{fmt.pct(a.ctrFirst7, 2)} → {fmt.pct(a.ctrLast7, 2)}</td>
                      <td className="num" {...(a.status === 'not_enough_data' ? lowConfProps('low') : {})}>{fmt.inr(a.cpaFirst7)} → {fmt.inr(a.cpaLast7)}</td>
                      <td className="min-w-[240px] max-w-[320px]">
                        <ul className="list-disc pl-4 text-[13px]" style={{ color: 'var(--ink-2)' }}>
                          {a.reasons.map((x, i) => <li key={i} className="break-words">{x}</li>)}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )
          }
        </Loaded>
      </div>
    </SectionCard>
  )
}

// ── Budget & geo ───────────────────────────────────────────────────────────

const SIGNAL: Record<PmBudgetRow['signal'], { label: string; chip: string }> = {
  room_to_scale: { label: 'Room to scale', chip: 'chip-good' },
  saturating: { label: 'Saturating', chip: 'chip-warn' },
  hold: { label: 'Hold', chip: 'chip-info' },
  reduce: { label: 'Reduce', chip: 'chip-bad' },
  not_enough_data: { label: 'Not enough data', chip: 'chip-neutral' },
}

const signedPct = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`)

type GeoKey = 'state' | 'spend' | 'siteVisitors' | 'firstPartyOrders' | 'roasEstimate' | 'visitToOrderRate'

export function BudgetGeoTab({ tenantId, q }: { tenantId: string; q: PmQuery }) {
  const qk = JSON.stringify(q)
  const budget = useLoad(`budget${qk}`, () => getPmBudget(tenantId, q))
  const geo = useLoad(`geo${qk}`, () => getPmGeo(tenantId, q))
  const [sort, setSort] = useState<SortState<GeoKey>>({ key: 'spend', dir: 'desc' })

  return (
    <div className="flex flex-col gap-5">
      <SectionCard padded={false} title="Budget signals" description="Where budget is set (campaign = CBO, ad set = ABO), and whether extra spend has been paying back. Suggestions only — nothing changes in Meta without approval.">
        <div className="flex flex-col gap-3 p-5">
          <Loaded r={budget}>
            {(d) => (
              <div className="flex flex-col gap-3">
                {d.rows.length === 0 ? (
                  <Empty title="No budgets with spend in this range" />
                ) : (
                  <TableWrap label="Budget signals table">
                    <thead>
                      <tr>
                        <th>Budget owner</th>
                        <th>Signal</th>
                        <th className="num">Daily budget</th>
                        <th className="num">Spend <Source s="meta" /></th>
                        <th className="num"><T k="roas">ROAS</T> <Source s="fp" /></th>
                        <th className="num">
                          <Term help="Slope of daily first-party revenue on daily Meta spend in this range — descriptive, not causal.">Marginal ROAS</Term> <Source s="mixed" />
                        </th>
                        <th className="num"><T k="frequency">Avg daily freq. trend</T> <Source s="meta" /></th>
                        <th className="num">Reach trend <Source s="meta" /></th>
                        <th>Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.rows.map((b) => (
                        <tr key={b.id}>
                          <td className="min-w-[220px] max-w-[300px]">
                            <p className="break-words font-semibold">{b.name}</p>
                            <p className="mt-0.5 flex flex-wrap gap-1">
                              <span className="chip chip-neutral">{b.budgetLevel === 'campaign' ? 'CBO' : b.budgetLevel === 'adset' ? 'ABO' : 'Budget unknown'}</span>
                              {b.learningStage && b.learningStage !== 'SUCCESS' && (
                                <span className="chip chip-warn">{b.learningStage === 'LEARNING' ? 'Learning' : b.learningStage === 'FAIL' ? 'Learning limited' : b.learningStage}</span>
                              )}
                            </p>
                          </td>
                          <td><span className={`chip ${SIGNAL[b.signal].chip}`}>{SIGNAL[b.signal].label}</span></td>
                          <td className="num">{b.dailyBudget == null ? '—' : fmt.inr(b.dailyBudget)}</td>
                          <td className="num">{fmt.inr(b.spend)}</td>
                          <td className="num font-semibold" {...(b.signal === 'not_enough_data' ? lowConfProps('low') : {})}>{fmt.roas(b.firstPartyRoas)}</td>
                          <td className="num" {...(b.signal === 'not_enough_data' ? lowConfProps('low') : {})}>{fmt.roas(b.marginalRoas)}</td>
                          <td className="num">{signedPct(b.frequencyTrend)}</td>
                          <td className="num">{signedPct(b.reachTrend)}</td>
                          <td className="min-w-[260px] max-w-[340px]">
                            <ul className="list-disc pl-4 text-[13px]" style={{ color: 'var(--ink-2)' }}>
                              {b.reasons.map((x, i) => <li key={i} className="break-words">{x}</li>)}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                )}
                <Caveat>{d.caveat}</Caveat>
              </div>
            )}
          </Loaded>
        </div>
      </SectionCard>

      <SectionCard padded={false} title="By state" description="Spend from Meta’s region breakdown; visitors and orders from our own data. Greyed first-party figures have too few orders to read.">
        <div className="flex flex-col gap-3 p-5">
          <Loaded r={geo}>
            {(d) => {
              const rows = [...d.rows].sort((a, b) => compare(a[sort.key] as number | string | null, b[sort.key] as number | string | null, sort.dir))
              return (
                <div className="flex flex-col gap-3">
                  {rows.length === 0 ? (
                    <Empty title="No state-level data in this range" />
                  ) : (
                    <TableWrap label="Performance by state">
                      <thead>
                        <tr>
                          <SortTh k="state" sort={sort} onSort={setSort} num={false}>State</SortTh>
                          <SortTh k="spend" sort={sort} onSort={setSort}>Spend <Source s="meta" /></SortTh>
                          <SortTh k="siteVisitors" sort={sort} onSort={setSort}>Visitors <Source s="site" /></SortTh>
                          <SortTh k="firstPartyOrders" sort={sort} onSort={setSort}>Orders <Source s="fp" /></SortTh>
                          <SortTh k="roasEstimate" sort={sort} onSort={setSort}>
                            <Term help="First-party revenue ÷ Meta spend for the state. An estimate: the two geographies don’t always match.">ROAS est.</Term> <Source s="mixed" />
                          </SortTh>
                          <SortTh k="visitToOrderRate" sort={sort} onSort={setSort}>Visit → order <Source s="fp" /></SortTh>
                          <th>Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((g: PmGeoRow) => (
                          <tr key={g.state}>
                            <td className="font-semibold">{g.state}</td>
                            <td className="num">{fmt.inr(g.spend)}</td>
                            <td className="num">{fmt.int(g.siteVisitors)}</td>
                            <td className="num" {...lowConfProps(g.confidence)}>{fmt.int(g.firstPartyOrders)}</td>
                            <td className="num font-semibold" {...lowConfProps(g.confidence)}>{fmt.roas(g.roasEstimate)}</td>
                            <td className="num" {...lowConfProps(g.confidence)}>{fmt.pct(g.visitToOrderRate, 2)}</td>
                            <td><ConfidenceChip c={g.confidence} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </TableWrap>
                  )}
                  <Caveat>{d.caveat}</Caveat>
                </div>
              )
            }}
          </Loaded>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Data checks ────────────────────────────────────────────────────────────

export function DataChecksTab({ tenantId, q }: { tenantId: string; q: PmQuery }) {
  const qk = JSON.stringify(q)
  const rec = useLoad(`rec${qk}`, () => getPmReconcile(tenantId, q))
  const chg = useLoad(`chg${q.from}${q.to}`, () => getPmChanges(tenantId, { from: q.from, to: q.to }))

  return (
    <div className="flex flex-col gap-5">
      <SectionCard padded={false} title="Meta purchases vs our orders" description="How many of the purchases Meta claims we can confirm as paid orders tied to a Meta click.">
        <div className="flex flex-col gap-4 p-5">
          <Loaded r={rec}>
            {(d) => (
              <div className="flex flex-col gap-4">
                <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
                  <Total label="Meta-reported purchases" src="meta" v={fmt.int(d.totals.metaPurchases)} />
                  <Total label="Orders tied to Meta ads" src="fp" v={fmt.int(d.totals.firstPartyOrders)} foot={`${fmt.pct(d.totals.metaPurchases ? d.totals.firstPartyOrders / d.totals.metaPurchases : null, 0)} of Meta’s count`} />
                  <Total label="All confirmed orders" src="fp" v={fmt.int(d.totals.allConfirmedOrders)} foot="Any source, incl. staff-entered" />
                </dl>
                {d.rows.length === 0 ? (
                  <Empty title="No campaigns with delivery in this range" />
                ) : (
                  <TableWrap label="Reconciliation by campaign">
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th className="num">Purchases <Source s="meta" /></th>
                        <th className="num">Value <Source s="meta" /></th>
                        <th className="num">Orders <Source s="fp" /></th>
                        <th className="num">Revenue <Source s="fp" /></th>
                        <th className="num">Match <Source s="mixed" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.rows.map((r) => {
                        const off = r.matchRatio != null && (r.matchRatio < 0.4 || r.matchRatio > 1)
                        return (
                          <tr key={r.campaignId}>
                            <td className="max-w-[300px]">
                              <p className="break-words font-semibold">{r.campaignName}</p>
                              <p className="text-[11.5px]" style={{ color: 'var(--ink-4)' }}>{productLabel(r.product)}</p>
                            </td>
                            <td className="num">{fmt.int(r.metaPurchases)}</td>
                            <td className="num">{fmt.inr(r.metaPurchaseValue)}</td>
                            <td className="num">{fmt.int(r.firstPartyOrders)}</td>
                            <td className="num">{fmt.inr(r.firstPartyRevenue)}</td>
                            <td className="num">
                              <span className={off ? 'chip chip-warn' : 'font-semibold'} title={off ? 'Unusual match ratio — check tracking for this campaign' : undefined}>{fmt.pct(r.matchRatio, 0)}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </TableWrap>
                )}
                <ul className="explain list-disc pl-5">
                  {d.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
          </Loaded>
        </div>
      </SectionCard>

      <SectionCard padded={false} title="Recent changes in Meta" description="Edits from the Meta activity log. Judge a change only after 3–4 days of data.">
        <div className="p-5">
          <Loaded r={chg}>
            {(d) =>
              d.rows.length === 0 ? (
                <Empty title="No edits recorded in this range" />
              ) : (
                <TableWrap label="Meta change log">
                  <thead>
                    <tr>
                      <th>When (IST)</th>
                      <th>Change</th>
                      <th>Item</th>
                      <th>Details</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((c, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap tabular-nums">{fmt.dateTime(c.eventTime)}</td>
                        <td className="font-semibold">{c.translatedEventType}</td>
                        <td className="max-w-[260px]">
                          <span className="break-words">{c.objectName}</span>
                          <span className="block text-[11.5px]" style={{ color: 'var(--ink-4)' }}>{c.objectType.toLowerCase().replace(/_/g, ' ')}</span>
                        </td>
                        <td className="max-w-[260px]">
                          <div className="max-h-24 overflow-auto whitespace-pre-wrap break-words">{c.extraData || '—'}</div>
                        </td>
                        <td>{c.actorName}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )
            }
          </Loaded>
        </div>
      </SectionCard>
    </div>
  )
}

function Total({ label, src, v, foot }: { label: string; src: 'meta' | 'fp'; v: string; foot?: string }) {
  return (
    <div className="card-inset px-4 py-3">
      <dt className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--ink-3)' }}>
        {label} <Source s={src} />
      </dt>
      <dd className="display-num mt-1 text-[22px] tabular-nums">{v}</dd>
      {foot && <dd className="explain">{foot}</dd>}
    </div>
  )
}

/** Creative thumbnail with a fallback when the CDN URL is missing, expired or blocked. */
function Thumb({ url, title }: { url?: string; title?: string }) {
  const [broken, setBroken] = useState(false)
  if (!url || broken)
    return (
      <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--muted)' }} aria-hidden="true">
        <ImageOff size={18} style={{ color: 'var(--ink-4)' }} />
      </span>
    )
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={title ? `Creative: ${title}` : ''}
      width={56}
      height={56}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="h-14 w-14 shrink-0 rounded-lg object-cover"
      style={{ background: 'var(--muted)' }}
    />
  )
}
