'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronRight, LineChart, TriangleAlert, X } from 'lucide-react'
import { PM_QUEUE_MAX, getPmChanges, getPmDecompose, getPmEntities, getPmSummary, getPmTrend, productLabel } from '@/lib/performance-marketeer-api'
import type { PmDecomposeResponse, PmEntityRow, PmQuery } from '@/types/performance-marketeer'
import {
  Caveat,
  ConfidenceChip,
  Empty,
  KpiTile,
  LoadError,
  PmSkeleton,
  SectionCard,
  SortTh,
  Source,
  T,
  TableWrap,
  VerdictChip,
  compare,
  fmt,
  lowConfProps,
  useLoad,
  type SortState,
} from './shared'
import { TrendChart } from './TrendChart'
import { AnalyseButton, AnalyseDialog, type AnalyseTarget } from './AnalyseDialog'
import type { PmView } from './PerformanceMarketeer'

export function OverviewTab({ tenantId, q, view, update }: { tenantId: string; q: PmQuery; view: PmView; update: (p: Partial<PmView>) => void }) {
  const qk = JSON.stringify(q)
  const summary = useLoad(`summary${qk}`, () => getPmSummary(tenantId, q))
  const trend = useLoad(`trend${qk}`, () => getPmTrend(tenantId, { ...q, level: 'account' }))

  return (
    <div className="flex flex-col gap-5">
      {summary.error ? (
        <LoadError message={summary.error} onRetry={summary.reload} />
      ) : !summary.data ? (
        <PmSkeleton rows={1} />
      ) : (
        <SectionCard
          title="How Meta spend is paying back"
          description={`${fmt.date(summary.data.query.from)} – ${fmt.date(summary.data.query.to)} vs ${fmt.date(summary.data.previous.from)} – ${fmt.date(summary.data.previous.to)} · ${productLabel(summary.data.query.product)}${summary.loading ? ' · updating…' : ''}`}
          action={<VerdictChip target={summary.data.target} withheld={hasMissing(summary.data)} />}
          className={summary.loading ? 'opacity-60' : undefined}
        >
          <MissingBanner s={summary.data} />
          <Kpis s={summary.data} />
        </SectionCard>
      )}

      <SectionCard title="Daily spend and return" description="Bars are Meta spend; lines are first-party ROAS. The dashed line is the 1.00× target.">
        {trend.error ? (
          <LoadError message={trend.error} onRetry={trend.reload} />
        ) : !trend.data ? (
          <div className="skeleton h-[240px] w-full" />
        ) : (
          <div className={trend.loading ? 'opacity-60' : undefined} aria-busy={trend.loading}>
            {trend.loading && <p className="explain mb-1" aria-live="polite">Updating…</p>}
            <TrendChart trend={trend.data} />
          </div>
        )}
      </SectionCard>

      <EntityExplorer tenantId={tenantId} q={q} view={view} update={update} />
    </div>
  )
}

type Summary = NonNullable<Awaited<ReturnType<typeof getPmSummary>>>

function hasMissing(s: Summary): boolean {
  const m = s.dataFreshness.missingDays
  return !!m && (m.meta.length > 0 || m.orders.length > 0 || m.visitors.length > 0)
}

/** Any day missing from a source makes the ROAS verdict unreliable, so it is withheld. */
function MissingBanner({ s }: { s: Summary }) {
  const m = s.dataFreshness.missingDays
  if (!m || !hasMissing(s)) return null
  const parts = (
    [
      ['Meta', m.meta],
      ['Order', m.orders],
      ['Website', m.visitors],
    ] as const
  )
    .filter(([, days]) => days.length)
    .map(([name, days]) => `${name} data missing for ${days.map(fmt.date).join(', ')}`)
  return (
    <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
      <TriangleAlert size={17} aria-hidden="true" style={{ color: 'var(--warn)', marginTop: 2 }} />
      <div className="min-w-0 text-[13.5px]" style={{ color: 'var(--ink)' }}>
        <p className="font-semibold">{parts.join('; ')} — ROAS verdict withheld.</p>
        <p className="explain mt-0.5">Totals for this range undercount. Pick a range without the gap, or wait for the backfill.</p>
      </div>
    </div>
  )
}

function Kpis({ s }: { s: Summary }) {
  const c = s.current
  const ch = s.change
  const newShare = c.firstPartyOrders > 0 ? c.newCustomerOrders / c.firstPartyOrders : null
  const priorShare = s.prior.firstPartyOrders > 0 ? s.prior.newCustomerOrders / s.prior.firstPartyOrders : null
  const withheld = hasMissing(s)
  const lowData = s.target.confidence === 'low' || withheld
  const cov = s.attributionCoverage
  const fresh = s.dataFreshness
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <KpiTile label="Spend" source="meta" value={fmt.inr(c.spend)} change={ch.spend} upIsGood={false} foot={`${fmt.int(c.linkClicks)} link clicks`} />
        <KpiTile label="Revenue" source="fp" value={fmt.inr(c.firstPartyRevenue)} change={ch.firstPartyRevenue} foot="Net, ex-GST, minus refunds" />
        <KpiTile
          label={<T k="roas">ROAS</T>}
          source="fp"
          value={fmt.roas(c.firstPartyRoas)}
          change={ch.firstPartyRoas}
          muted={lowData}
          foot={
            <span className="flex flex-wrap items-center gap-1.5">
              Target {fmt.roas(s.target.targetRoas)} <VerdictChip target={s.target} withheld={withheld} />
            </span>
          }
        />
        <KpiTile label={<T k="cpa">CPA</T>} source="fp" value={fmt.inr(c.firstPartyCpa)} change={ch.firstPartyCpa} upIsGood={false} muted={lowData} foot={`AOV ${fmt.inr(c.averageOrderValue)}`} />
        <KpiTile label="Orders tied to Meta ads" source="fp" value={fmt.int(c.firstPartyOrders)} change={ch.firstPartyOrders} foot={`of ${fmt.int(s.allOrders.orders)} confirmed orders in total (${fmt.int(s.allOrders.adminOrders)} staff-entered)`} />
        <KpiTile
          label={<T k="newCustomer">New-customer share</T>}
          source="fp"
          value={fmt.pct(newShare, 0)}
          change={newShare != null && priorShare ? newShare / priorShare - 1 : null}
          foot={`${fmt.int(c.newCustomerOrders)} first-ever orders`}
        />
        <KpiTile label={<T k="roas">Meta ROAS</T>} source="meta" value={fmt.roas(c.metaRoas)} change={ch.metaRoas} foot={`${fmt.int(c.metaPurchases)} Meta purchases · uses Meta’s value, not revenue`} />
        <KpiTile label="Visitors from Meta ads" source="site" value={fmt.int(c.siteVisitors)} change={ch.siteVisitors} foot={`${fmt.pct(c.visitToOrderRate)} visit → order`} />
      </div>
      <p className="explain" aria-live="polite">
        {withheld ? 'Verdict withheld while data is missing' : s.target.note}. <strong>Attribution coverage:</strong> {fmt.pct(cov.linkedToMetaAd, 0)} of confirmed web orders were tied to a Meta ad click and {fmt.pct(cov.linkedToVisit, 0)} to any site visit
        (first-party, device-matched, 7-day click — a lower bound, so true ROAS is likely higher). <strong>Data through:</strong> Meta {fmt.date(fresh.metaThrough)}, orders {fmt.date(fresh.ordersThrough)}, website{' '}
        {fmt.date(fresh.visitorsThrough)}.
      </p>
    </div>
  )
}

// ── Entities: campaigns → ad sets → ads ────────────────────────────────────

type SortKey = 'name' | 'spend' | 'roas' | 'cpa' | 'orders' | 'ctr' | 'cpm' | 'frequency' | 'visitors' | 'verdict'
const VERDICT_RANK = { above_target: 3, near_target: 2, below_target: 1, not_enough_data: 0 }

function sortValue(r: PmEntityRow, k: SortKey): number | string | null {
  const m = r.metrics
  switch (k) {
    case 'name': return r.name
    case 'spend': return m.spend
    case 'roas': return m.firstPartyRoas
    case 'cpa': return m.firstPartyCpa
    case 'orders': return m.firstPartyOrders
    case 'ctr': return m.ctr
    case 'cpm': return m.cpm
    case 'frequency': return m.frequency
    case 'visitors': return m.siteVisitors
    case 'verdict': return VERDICT_RANK[r.target.verdict]
  }
}

function EntityExplorer({ tenantId, q, view, update }: { tenantId: string; q: PmQuery; view: PmView; update: (p: Partial<PmView>) => void }) {
  const level: PmEntityRow['level'] = view.adset ? 'ad' : view.campaign ? 'adset' : 'campaign'
  const qk = JSON.stringify(q)
  const campaigns = useLoad(`ent-c${qk}`, () => getPmEntities(tenantId, { ...q, level: 'campaign' }))
  const adsets = useLoad(`ent-s${qk}${view.campaign}`, () =>
    view.campaign ? getPmEntities(tenantId, { ...q, level: 'adset', parentId: view.campaign }) : Promise.resolve(null),
  )
  const ads = useLoad(`ent-a${qk}${view.adset}`, () => (view.adset ? getPmEntities(tenantId, { ...q, level: 'ad', parentId: view.adset }) : Promise.resolve(null)))
  const current = level === 'campaign' ? campaigns : level === 'adset' ? adsets : ads
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'spend', dir: 'desc' })
  // Campaigns ticked for "Analyse selected"; ids that leave the table (filter change) just drop out.
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [analyse, setAnalyse] = useState<AnalyseTarget[] | null>(null)

  const rows = useMemo(() => [...(current.data?.rows ?? [])].sort((a, b) => compare(sortValue(a, sort.key), sortValue(b, sort.key), sort.dir)), [current.data, sort])
  const campaignName = campaigns.data?.rows.find((r) => r.id === view.campaign)?.name ?? 'Campaign'
  const adsetName = adsets.data?.rows.find((r) => r.id === view.adset)?.name ?? 'Ad set'
  const dot = view.sel.indexOf('.')
  const selLevel = dot > 0 ? view.sel.slice(0, dot) : null
  const selId = dot > 0 ? view.sel.slice(dot + 1) : null
  const selRow = [...(campaigns.data?.rows ?? []), ...(adsets.data?.rows ?? []), ...(ads.data?.rows ?? [])].find((r) => r.level === selLevel && r.id === selId) ?? null
  const levelWord = level === 'campaign' ? 'campaigns' : level === 'adset' ? 'ad sets' : 'ads'
  const pickable = level === 'campaign'
  const pickedRows = pickable ? rows.filter((r) => picked.has(r.id)) : []
  const allPicked = rows.length > 0 && rows.slice(0, PM_QUEUE_MAX).every((r) => picked.has(r.id))
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set([...p].filter((x) => rows.some((r) => r.id === x)))
      if (n.has(id)) n.delete(id)
      else if (n.size < PM_QUEUE_MAX) n.add(id)
      return n
    })
  const target = (r: PmEntityRow): AnalyseTarget => ({ id: r.id, name: r.name })

  // After a drill (or breadcrumb jump), move focus to the breadcrumb so keyboard
  // and screen-reader users land on the new level instead of a removed button.
  const crumbRef = useRef<HTMLElement>(null)
  const drilled = useRef(false)
  const go = (patch: Partial<PmView>) => {
    drilled.current = true
    update(patch)
  }
  useEffect(() => {
    if (!drilled.current) return
    drilled.current = false
    crumbRef.current?.focus()
  }, [view.campaign, view.adset])

  return (
    <SectionCard
      padded={false}
      title="Campaigns, ad sets and ads"
      description="Select a name to drill down. Use the chart button for a row’s trend and “why did CPA change”. Greyed first-party figures rest on fewer than 10 orders."
    >
      <nav ref={crumbRef} tabIndex={-1} aria-label={`Breadcrumb: showing ${levelWord}`} className="flex flex-wrap items-center gap-1 rounded px-5 pt-4 text-[13px] focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
        <Crumb onClick={view.campaign ? () => go({ campaign: '', adset: '', sel: '' }) : undefined}>All campaigns</Crumb>
        {view.campaign && (
          <>
            <ChevronRight size={14} aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
            <Crumb onClick={view.adset ? () => go({ adset: '', sel: '' }) : undefined}>{campaignName}</Crumb>
          </>
        )}
        {view.adset && (
          <>
            <ChevronRight size={14} aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
            <Crumb>{adsetName}</Crumb>
          </>
        )}
      </nav>
      <div className="p-5 pt-3">
        {current.error ? (
          <LoadError message={current.error} onRetry={current.reload} />
        ) : !current.data ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <span className="sr-only">Loading…</span>
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-10 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <Empty title={`No ${levelWord} with delivery in this range`} hint="Try a longer date range or a different product." />
        ) : (
          <div className={current.loading ? 'opacity-60' : undefined} aria-busy={current.loading}>
            {pickable && (
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2" role="toolbar" aria-label="AI analysis">
                <button type="button" className="btn btn-primary !min-h-[38px] !py-2" disabled={!pickedRows.length} onClick={() => setAnalyse(pickedRows.map(target))}>
                  Analyse Selected ({pickedRows.length})
                </button>
                {pickedRows.length > 0 && (
                  <button type="button" className="btn btn-ghost !min-h-[38px] !py-2" onClick={() => setPicked(new Set())}>
                    Clear Selection
                  </button>
                )}
                <span className="explain" aria-live="polite">
                  {pickedRows.length >= PM_QUEUE_MAX ? `Limit reached — up to ${PM_QUEUE_MAX} campaigns per batch.` : `Tick up to ${PM_QUEUE_MAX} campaigns, or use Analyse on one row.`}
                </span>
              </div>
            )}
            <TableWrap label={`${levelWord} performance table`}>
              <thead>
                <tr>
                  {pickable && (
                    <th className="w-10">
                      <label className="-m-2 flex cursor-pointer p-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          style={{ accentColor: 'var(--accent)' }}
                          aria-label={rows.length > PM_QUEUE_MAX ? `Select the first ${PM_QUEUE_MAX} campaigns` : 'Select all campaigns'}
                          checked={allPicked}
                          onChange={() => setPicked(allPicked ? new Set() : new Set(rows.slice(0, PM_QUEUE_MAX).map((r) => r.id)))}
                        />
                      </label>
                    </th>
                  )}
                  <SortTh k="name" sort={sort} onSort={setSort} num={false}>Name</SortTh>
                  <SortTh k="spend" sort={sort} onSort={setSort}>Spend <Source s="meta" /></SortTh>
                  <SortTh k="roas" sort={sort} onSort={setSort}><T k="roas">ROAS</T> <Source s="fp" /></SortTh>
                  <SortTh k="cpa" sort={sort} onSort={setSort}><T k="cpa">CPA</T> <Source s="fp" /></SortTh>
                  <SortTh k="orders" sort={sort} onSort={setSort}>Orders <Source s="fp" /></SortTh>
                  <SortTh k="ctr" sort={sort} onSort={setSort}><T k="ctr">CTR</T> <Source s="meta" /></SortTh>
                  <SortTh k="cpm" sort={sort} onSort={setSort}><T k="cpm">CPM</T> <Source s="meta" /></SortTh>
                  <SortTh k="frequency" sort={sort} onSort={setSort}><T k="frequency">Avg daily freq.</T> <Source s="meta" /></SortTh>
                  <SortTh k="visitors" sort={sort} onSort={setSort}>Visitors <Source s="site" /></SortTh>
                  <SortTh k="verdict" sort={sort} onSort={setSort} num={false}>Verdict</SortTh>
                  <th><span className="sr-only">{pickable ? 'Actions' : 'Details'}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const m = r.metrics
                  const low = lowConfProps(r.target.confidence)
                  const drill = r.level === 'campaign' ? () => go({ campaign: r.id, adset: '', sel: '' }) : r.level === 'adset' ? () => go({ adset: r.id, sel: '' }) : () => update({ sel: `ad.${r.id}` })
                  return (
                    <tr key={r.id}>
                      {pickable && (
                        <td className="w-10">
                          <label className="-m-2 flex cursor-pointer p-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              style={{ accentColor: 'var(--accent)' }}
                              aria-label={`Select ${r.name} for AI analysis`}
                              checked={picked.has(r.id)}
                              disabled={!picked.has(r.id) && pickedRows.length >= PM_QUEUE_MAX}
                              onChange={() => toggle(r.id)}
                            />
                          </label>
                        </td>
                      )}
                      <td className="max-w-[300px]">
                        <button type="button" onClick={drill} className="text-left font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-[var(--accent)] break-words" style={{ color: 'var(--accent-strong)' }}>
                          {r.name}
                        </button>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <StatusChip status={r.effectiveStatus} />
                          {r.budgetLevel && r.level !== 'ad' && (
                            <span className="chip chip-neutral" title={r.budgetLevel === 'campaign' ? 'Campaign budget optimisation — budget is set on the campaign' : 'Ad set budgets — each ad set has its own budget'}>
                              {r.budgetLevel === 'campaign' ? 'CBO' : 'ABO'}
                              {r.dailyBudget != null && ` · ${fmt.inrCompact(r.dailyBudget)}/day`}
                            </span>
                          )}
                          {r.target.confidence === 'low' && (
                            <span className="chip chip-neutral">
                              <TriangleAlert size={11} aria-hidden="true" /> Low data · under 10 orders
                            </span>
                          )}
                          {!q.product && <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{productLabel(r.product)}</span>}
                        </div>
                      </td>
                      <td className="num">{fmt.inr(m.spend)}</td>
                      <td className="num font-semibold" {...low}>{fmt.roas(m.firstPartyRoas)}</td>
                      <td className="num" {...low}>{fmt.inr(m.firstPartyCpa)}</td>
                      <td className="num" {...low}>{fmt.int(m.firstPartyOrders)}</td>
                      <td className="num">{fmt.pct(m.ctr, 2)}</td>
                      <td className="num">{fmt.inr(m.cpm)}</td>
                      <td className="num">{fmt.dec(m.frequency)}</td>
                      <td className="num">{fmt.int(m.siteVisitors)}</td>
                      <td><VerdictChip target={r.target} /></td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="btn btn-ghost !min-h-[34px] !px-2.5 !py-1.5"
                            aria-label={`Trend and CPA breakdown for ${r.name}`}
                            title="Trend and CPA breakdown"
                            onClick={() => update({ sel: `${r.level}.${r.id}` })}
                          >
                            <LineChart size={15} aria-hidden="true" />
                          </button>
                          {pickable && <AnalyseButton compact name={r.name} onClick={() => setAnalyse([target(r)])} />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </TableWrap>
          </div>
        )}
      </div>
      <EntityPanel tenantId={tenantId} q={q} row={selRow} onClose={() => update({ sel: '' })} onAnalyse={(r) => setAnalyse([target(r)])} />
      <AnalyseDialog
        key={analyse?.map((c) => c.id).join() ?? ''}
        tenantId={tenantId}
        campaigns={analyse}
        onClose={() => setAnalyse(null)}
        onOpenAgent={() => {
          setAnalyse(null)
          setPicked(new Set())
          update({ tab: 'agent', day: '', run: '', sel: '' })
        }}
      />
    </SectionCard>
  )
}

function Crumb({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  if (!onClick)
    return (
      <span aria-current="page" className="font-semibold break-words" style={{ color: 'var(--ink)' }}>
        {children}
      </span>
    )
  return (
    <button type="button" onClick={onClick} className="rounded font-medium hover:underline focus-visible:outline-2 focus-visible:outline-[var(--accent)] break-words" style={{ color: 'var(--accent-strong)' }}>
      {children}
    </button>
  )
}

function StatusChip({ status }: { status: string }) {
  const s = status.toUpperCase()
  const on = s === 'ACTIVE'
  return <span className={on ? 'chip chip-good' : 'chip chip-neutral'}>{on ? 'Active' : s.includes('PAUSED') ? 'Paused' : s.toLowerCase().replace(/_/g, ' ')}</span>
}

// ── Side panel: trend + CPA decomposition + recent changes ─────────────────

function EntityPanel({ tenantId, q, row, onClose, onAnalyse }: { tenantId: string; q: PmQuery; row: PmEntityRow | null; onClose: () => void; onAnalyse: (r: PmEntityRow) => void }) {
  return (
    <Dialog.Root open={!!row} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay data-portal className="fixed inset-0 z-[60] animate-fade-in" style={{ background: 'rgba(15,23,42,0.35)' }} />
        <Dialog.Content
          data-portal
          className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-[560px] flex-col overflow-y-auto overscroll-contain animate-panel-slide-in"
          style={{ background: 'var(--paper)', boxShadow: 'var(--shadow-overlay)' }}
        >
          {row && <PanelBody tenantId={tenantId} q={q} row={row} onAnalyse={onAnalyse} />}
          <Dialog.Close asChild>
            <button type="button" className="btn btn-ghost absolute right-4 top-4 !min-h-[36px] !px-2" aria-label="Close panel">
              <X size={18} aria-hidden="true" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PanelBody({ tenantId, q, row, onAnalyse }: { tenantId: string; q: PmQuery; row: PmEntityRow; onAnalyse: (r: PmEntityRow) => void }) {
  const key = `${JSON.stringify(q)}${row.level}${row.id}`
  const eq = { ...q, level: row.level, id: row.id }
  const trend = useLoad(`ptrend${key}`, () => getPmTrend(tenantId, eq))
  const dec = useLoad(`pdec${key}`, () => getPmDecompose(tenantId, eq))
  const changes = useLoad(`pchg${key}`, () => getPmChanges(tenantId, { from: q.from, to: q.to, objectId: row.id }))
  const m = row.metrics
  const levelWord = row.level === 'adset' ? 'Ad set' : row.level === 'ad' ? 'Ad' : 'Campaign'

  return (
    <div className="flex flex-col gap-4 p-5 pt-6">
      <div className="pr-12">
        <p className="micro-label">{levelWord} · {productLabel(row.product)}</p>
        <Dialog.Title className="section-title mt-1 break-words text-pretty">{row.name}</Dialog.Title>
        <Dialog.Description className="explain mt-1">
          {fmt.date(q.from)} – {fmt.date(q.to)} · {row.activeDays} days with spend · {row.target.note}
        </Dialog.Description>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <VerdictChip target={row.target} />
          <ConfidenceChip c={row.target.confidence} />
        </div>
        {row.level === 'campaign' && (
          <div className="mt-3">
            <AnalyseButton onClick={() => onAnalyse(row)} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <KpiTile label="Spend" source="meta" value={fmt.inr(m.spend)} />
        <KpiTile label={<T k="roas">ROAS</T>} source="fp" value={fmt.roas(m.firstPartyRoas)} muted={row.target.confidence === 'low'} />
        <KpiTile label={<T k="cpa">CPA</T>} source="fp" value={fmt.inr(m.firstPartyCpa)} muted={row.target.confidence === 'low'} />
        <KpiTile label="Orders" source="fp" value={fmt.int(m.firstPartyOrders)} foot={`Meta reported ${fmt.int(m.metaPurchases)}`} />
      </div>

      <SectionCard title="Daily trend">
        {trend.error ? <LoadError message={trend.error} onRetry={trend.reload} /> : !trend.data ? <div className="skeleton h-[200px] w-full" /> : <TrendChart trend={trend.data} height={200} />}
      </SectionCard>

      <SectionCard title="Why did CPA change?" description="CPA = CPM ÷ (1,000 × CTR × click→order rate), compared with the same-length period before.">
        {dec.error ? <LoadError message={dec.error} onRetry={dec.reload} /> : !dec.data ? <div className="skeleton h-[160px] w-full" /> : <Decompose d={dec.data} />}
      </SectionCard>

      <SectionCard title="Recent changes in Meta" description="Edits to this item in the range. A change in the last 3–4 days makes the trend hard to read.">
        {changes.error ? (
          <LoadError message={changes.error} onRetry={changes.reload} />
        ) : !changes.data ? (
          <div className="skeleton h-12 w-full" />
        ) : changes.data.rows.length === 0 ? (
          <p className="explain">No edits recorded for this {levelWord.toLowerCase()} in the range.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {changes.data.rows.map((c, i) => (
              <li key={i} className="text-[13px]">
                <strong>{c.translatedEventType}</strong>
                {c.extraData && <span className="block max-h-24 overflow-auto whitespace-pre-wrap break-words">{c.extraData}</span>}
                <span className="block text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  {fmt.dateTime(c.eventTime)} · {c.actorName} · {c.objectName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

const FACTOR: Record<PmDecomposeResponse['factors'][number]['name'], { label: React.ReactNode; f: (v: number | null) => string }> = {
  cpm: { label: <T k="cpm">CPM</T>, f: (v) => fmt.inr(v) },
  ctr: { label: <T k="ctr">Link CTR</T>, f: (v) => fmt.pct(v, 2) },
  clickToOrderRate: { label: <T k="clickToOrder">Click → order</T>, f: (v) => fmt.pct(v, 2) },
}

function Decompose({ d }: { d: PmDecomposeResponse }) {
  const ch = d.cpa.change
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
        {d.read}
      </p>
      <p className="explain tabular-nums">
        First-party CPA {fmt.inr(d.cpa.prior)} → {fmt.inr(d.cpa.current)}
        {ch != null && ` (${ch > 0 ? '+' : ''}${(ch * 100).toFixed(0)}%)`} · {fmt.date(d.previous.from)}–{fmt.date(d.previous.to)} vs {fmt.date(d.query.from)}–{fmt.date(d.query.to)}
      </p>
      <ul className="flex flex-col gap-2.5">
        {d.factors.map((f) => {
          const meta = FACTOR[f.name]
          const share = f.contribution
          const pushesUp = share != null && ch != null && share * ch > 0
          return (
            <li key={f.name} className="card-inset px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                <span className="font-semibold">{meta.label}</span>
                <span className="tabular-nums" style={{ color: 'var(--ink-2)' }}>
                  {meta.f(f.prior)} → {meta.f(f.current)}
                  {f.change != null && ` (${f.change > 0 ? '+' : ''}${(f.change * 100).toFixed(1)}%)`}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--muted)' }} aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.abs(share ?? 0) * 100)}%`, background: pushesUp ? 'var(--bad)' : 'var(--good)' }} />
                </div>
                <span className="w-[150px] shrink-0 text-right text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  {share == null || ch == null ? '—' : `${Math.abs(share * 100).toFixed(0)}% of change · ${share > 0 ? (ch > 0 ? 'raised CPA' : 'lowered CPA') : 'offset it'}`}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceChip c={d.confidence} />
        <span className="explain">CPM and CTR are Meta-reported; click → order uses first-party orders.</span>
      </div>
      {d.confidence === 'low' && <Caveat>Few orders in one of the periods — the split can flip with a handful of orders. Hold before acting.</Caveat>}
    </div>
  )
}
