'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import * as Tabs from '@radix-ui/react-tabs'
import { PM_MOCK, PM_PRODUCTS, PM_TABS, parsePmView, type PmTab, type PmView } from '@/lib/performance-marketeer-api'
import { PM_DATA_START, PM_MAX_SPAN_DAYS, addDays, validDay } from '@/lib/performance-marketeer-dates'
import type { PmQuery } from '@/types/performance-marketeer'
import { OverviewTab } from './OverviewTab'
import { ReportTab } from './ReportTab'
import { FunnelTab } from './FunnelTab'
import { BudgetGeoTab, CreativesTab, DataChecksTab } from './AnalysisTabs'
import { AgentTab } from './AgentTab'
import { LessonsTab } from './LessonsTab'
import { fmt } from './shared'

export type { PmView }

const PRESETS = [7, 14, 30]
const PANEL = 'rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]'

export function PerformanceMarketeer({ tenantId, initial, yesterday }: { tenantId: string; initial: PmView; yesterday: string }) {
  const [view, setView] = useState<PmView>(initial)
  const presetOf = (v: PmView) => PRESETS.find((n) => v.to === yesterday && v.from === addDays(yesterday, -(n - 1))) ?? null
  const [custom, setCustom] = useState(presetOf(initial) == null)

  // When the URL changes from outside (sidebar link, back/forward), adopt it.
  // Our own replaceState writes parse back to the current view, so they are no-ops.
  const searchParams = useSearchParams()
  const urlKey = searchParams.toString()
  const [seenUrl, setSeenUrl] = useState(urlKey)
  if (urlKey !== seenUrl) {
    setSeenUrl(urlKey)
    const fromUrl = parsePmView((k) => searchParams.get(k), yesterday)
    if (JSON.stringify(fromUrl) !== JSON.stringify(view)) {
      setView(fromUrl)
      setCustom(presetOf(fromUrl) == null)
    }
  }

  function update(patch: Partial<PmView>) {
    const next = { ...view, ...patch }
    setView(next)
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) if (v && !(k === 'tab' && v === 'overview')) qs.set(k, v)
    window.history.replaceState(null, '', `?${qs}`)
  }

  const q: PmQuery = { from: view.from, to: view.to, ...(view.product ? { product: view.product } : {}) }
  const preset = custom ? null : presetOf(view)

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title text-balance">Performance Marketeer</h1>
            {PM_MOCK && (
              <span className="chip chip-warn" title="NEXT_PUBLIC_PM_MOCK=true — numbers are generated fixtures, not real data">
                Sample data
              </span>
            )}
          </div>
          <p className="page-subtitle text-pretty">
            Meta spend joined with our own website visits and confirmed orders — what is paying back, why it moved, and where to look next. Every number says whether it is Meta-reported or first-party.
          </p>
        </div>
      </header>

      {view.tab !== 'agent' && view.tab !== 'lessons' && (
        <form className="card flex flex-wrap items-end gap-3 px-4 py-3.5 sm:px-5" onSubmit={(e) => e.preventDefault()} aria-label="Filters">
          <fieldset className="flex min-w-0 flex-col gap-1">
            <legend className="mb-1 text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>Date range (IST)</legend>
            <div className="flex flex-wrap gap-1.5" role="group">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={preset === n}
                  className={`btn !min-h-[38px] !px-3 !py-2 ${preset === n ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => {
                    setCustom(false)
                    update({ from: addDays(yesterday, -(n - 1)), to: yesterday })
                  }}
                >
                  Last {n} Days
                </button>
              ))}
              <button type="button" aria-pressed={preset == null} className={`btn !min-h-[38px] !px-3 !py-2 ${preset == null ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCustom(true)}>
                Custom
              </button>
            </div>
          </fieldset>
          {preset == null && (
            <div className="flex flex-wrap gap-2">
              <DateInput
                label="From"
                name="from"
                value={view.from}
                min={maxDay(PM_DATA_START, addDays(view.to, -(PM_MAX_SPAN_DAYS - 1)))}
                max={view.to}
                onCommit={(v) => update({ from: v })}
              />
              <DateInput
                label="To"
                name="to"
                value={view.to}
                min={view.from}
                max={minDay(yesterday, addDays(view.from, PM_MAX_SPAN_DAYS - 1))}
                onCommit={(v) => update({ to: v })}
              />
            </div>
          )}
          <label className="flex min-w-[180px] flex-col gap-1 text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            Product
            <select className="input !min-h-[38px] !py-1.5" name="product" value={view.product} onChange={(e) => update({ product: e.target.value, campaign: '', adset: '', sel: '', ad: '' })}>
              <option value="">All products</option>
              {PM_PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
        </form>
      )}

      <Tabs.Root value={view.tab} onValueChange={(t) => update({ tab: t as PmTab })} className="flex min-w-0 flex-col gap-5">
        <Tabs.List aria-label="Analysis views" className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" style={{ borderBottom: '1px solid var(--hairline)' }}>
          {PM_TABS.map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="-mb-px shrink-0 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-3.5 py-2.5 text-[14px] font-semibold text-[var(--ink-3)] transition-colors hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] data-[state=active]:border-[var(--accent)] data-[state=active]:text-[var(--accent-strong)]"
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="overview" className={PANEL}>
          <OverviewTab tenantId={tenantId} q={q} view={view} update={update} />
        </Tabs.Content>
        <Tabs.Content value="report" className={PANEL}>
          <p className="explain mb-3">The report covers the 7 days ending on the range’s end date ({fmt.date(view.to)}) for the selected product.</p>
          <ReportTab tenantId={tenantId} date={view.to} product={view.product} action={view.action} onAction={(action) => update({ action })} />
        </Tabs.Content>
        <Tabs.Content value="funnel" className={PANEL}>
          <FunnelTab tenantId={tenantId} q={q} view={view} update={update} />
        </Tabs.Content>
        <Tabs.Content value="creatives" className={PANEL}>
          <CreativesTab tenantId={tenantId} q={q} />
        </Tabs.Content>
        <Tabs.Content value="budget" className={PANEL}>
          <BudgetGeoTab tenantId={tenantId} q={q} />
        </Tabs.Content>
        <Tabs.Content value="checks" className={PANEL}>
          <DataChecksTab tenantId={tenantId} q={q} />
        </Tabs.Content>
        <Tabs.Content value="agent" className={PANEL}>
          <AgentTab tenantId={tenantId} view={view} update={update} />
        </Tabs.Content>
        <Tabs.Content value="lessons" className={PANEL}>
          <LessonsTab tenantId={tenantId} view={view} update={update} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

const maxDay = (a: string, b: string) => (a > b ? a : b)
const minDay = (a: string, b: string) => (a < b ? a : b)

/**
 * Native date input that only commits on blur or Enter, and only a complete,
 * in-bounds date — typing a year digit by digit never fires a 0002-… range.
 * An invalid entry snaps back and says why.
 */
function DateInput({ label, name, value, min, max, onCommit }: { label: string; name: string; value: string; min: string; max: string; onCommit: (v: string) => void }) {
  const [error, setError] = useState('')
  const commit = (el: HTMLInputElement) => {
    const v = el.value
    if (v === value) return setError('')
    if (validDay(v, max) && v >= min) {
      setError('')
      onCommit(v)
    } else {
      el.value = value
      setError(`Pick a date from ${fmt.date(min)} to ${fmt.date(max)}.`)
    }
  }
  return (
    <label className="flex flex-col gap-1 text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
      {label}
      <input
        key={value}
        type="date"
        className="input !min-h-[38px] !py-1.5"
        name={name}
        autoComplete="off"
        defaultValue={value}
        min={min}
        max={max}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${name}-err` : undefined}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(e.currentTarget)
          }
        }}
      />
      {error && (
        <span id={`${name}-err`} role="alert" className="text-[12px] font-normal" style={{ color: 'var(--bad)' }}>
          {error}
        </span>
      )}
    </label>
  )
}
