'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatInr } from '@/lib/plain-language'
import { Term } from '@/components/plain/Term'
import type { PmConfidence, PmTargetCheck, PmVerdict } from '@/types/performance-marketeer'

export { SectionCard, BrainSkeleton as PmSkeleton } from '@/components/brain/shared'

// ── Formatting: every null ratio is "—" ────────────────────────────────────

const intFmt = new Intl.NumberFormat('en-IN')

export const fmt = {
  inr: (n: number | null | undefined) => formatInr(n == null ? null : Math.round(n)),
  inrCompact: (n: number | null | undefined) => formatInr(n, { compact: true }),
  int: (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : intFmt.format(Math.round(n))),
  roas: (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(2)}×`),
  pct: (n: number | null | undefined, dp = 1) => (n == null || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(dp)}%`),
  dec: (n: number | null | undefined, dp = 2) => (n == null || !Number.isFinite(n) ? '—' : n.toFixed(dp)),
  date: (ymd: string | null | undefined) =>
    ymd && !Number.isNaN(Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`)) ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${ymd.slice(0, 10)}T00:00:00Z`)) : '—',
  dateTime: (iso: string | null | undefined) => {
    const d = iso ? new Date(iso) : null
    return d && !Number.isNaN(d.getTime())
      ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(d)
      : '—'
  },
}

// ── Glossary (07-definitions.md) ───────────────────────────────────────────

export const PM_GLOSSARY = {
  roas: 'Return on ad spend = revenue ÷ Meta spend. First-party ROAS uses our net revenue (ex-GST, minus refunds) from orders tied to the ad; Meta-reported ROAS uses the value Meta was told (a flat ₹1,300 for Nadi Report Premium).',
  cpa: 'Cost per acquisition = Meta spend ÷ orders. First-party CPA uses confirmed, paid orders tied to the ad.',
  cpm: 'Cost per 1,000 impressions = spend ÷ impressions × 1,000 (Meta-reported).',
  ctr: 'Link click-through rate = link clicks ÷ impressions (Meta-reported).',
  frequency: 'Average times one person saw the ad (Meta-reported, impression-weighted). Rising frequency with flat reach means the same people are seeing it again.',
  firstParty:
    'First-party = our own confirmed, paid orders tied to the last Meta ad click on the same device within 7 days. device_id rotates daily, so this is a lower bound.',
  meta: 'Meta-reported = what Meta’s Ads Manager attributes (7-day click + 1-day view). It overlaps with, but is not the same as, our orders.',
  newCustomer: 'New customer = the person’s first-ever confirmed order with 91Astrology (any product).',
  clickToOrder: 'Click → order rate = first-party orders ÷ Meta link clicks — how well the site converts the traffic.',
} as const

export function T({ k, children }: { k: keyof typeof PM_GLOSSARY; children: string }) {
  return <Term help={PM_GLOSSARY[k]}>{children}</Term>
}

/** Source label carried next to every number (07-definitions.md: label source). */
export function Source({ s, className }: { s: 'meta' | 'fp' | 'site' | 'mixed'; className?: string }) {
  const label = s === 'meta' ? 'Meta-reported' : s === 'fp' ? 'First-party' : s === 'mixed' ? 'First-party ÷ Meta' : 'Website'
  const help =
    s === 'meta'
      ? PM_GLOSSARY.meta
      : s === 'fp'
        ? PM_GLOSSARY.firstParty
        : s === 'mixed'
          ? 'A first-party number (our orders or revenue) divided by a Meta-reported one (purchases or spend).'
          : 'Website analytics (OpenPanel) — visitors who arrived from these Meta ads.'
  return (
    <span
      className={cn('inline-flex items-center rounded px-1.5 text-[10.5px] font-semibold uppercase tracking-wide', className)}
      style={
        s === 'meta'
          ? { background: 'var(--info-bg)', color: 'var(--info)' }
          : s === 'fp' || s === 'mixed'
            ? { background: 'var(--brand-secondary-bg)', color: 'var(--brand-secondary)' }
            : { background: 'var(--muted)', color: 'var(--ink-2)' }
      }
      title={help}
    >
      {label}
    </span>
  )
}

// ── Verdict / confidence / delta ───────────────────────────────────────────

const VERDICT: Record<PmVerdict, { label: string; chip: string }> = {
  above_target: { label: 'Above target', chip: 'chip-good' },
  near_target: { label: 'Near target', chip: 'chip-warn' },
  below_target: { label: 'Below target', chip: 'chip-bad' },
  not_enough_data: { label: 'Not enough data', chip: 'chip-neutral' },
}

export function VerdictChip({ target, className, withheld }: { target: PmTargetCheck; className?: string; withheld?: boolean }) {
  if (withheld)
    return (
      <span className={cn('chip chip-neutral', className)} style={{ opacity: 0.75 }} title="Some days are missing data, so no verdict is given for this range.">
        Verdict withheld
      </span>
    )
  const v = VERDICT[target.verdict]
  return (
    <span className={cn('chip', v.chip, className)} title={`${target.note} · ${target.confidence} confidence`}>
      {v.label}
    </span>
  )
}

const CONF_HELP: Record<PmConfidence, string> = {
  low: 'Low confidence — small sample (e.g. fewer than 10 orders), so this can swing a lot day to day. Treat as a hint, not a result.',
  medium: 'Medium confidence — a moderate sample (e.g. 10–29 orders).',
  high: 'High confidence — a large sample (e.g. 30+ orders).',
}

export function ConfidenceChip({ c }: { c: PmConfidence }) {
  return (
    <span className={cn('chip', c === 'high' ? 'chip-good' : c === 'medium' ? 'chip-info' : 'chip-neutral')} title={CONF_HELP[c]}>
      {c === 'low' ? 'Low confidence · small sample' : c === 'medium' ? 'Medium confidence' : 'High confidence'}
    </span>
  )
}

/** Greys out a low-confidence row/value and explains why on hover. */
export function lowConfProps(c: PmConfidence | undefined): { className?: string; title?: string; style?: React.CSSProperties } {
  return c === 'low' ? { style: { opacity: 0.62 }, title: CONF_HELP.low } : {}
}

export function Delta({ change, upIsGood = true }: { change: number | null | undefined; upIsGood?: boolean }) {
  if (change == null || !Number.isFinite(change)) return <span className="text-[12px]" style={{ color: 'var(--ink-4)' }}>— vs prior</span>
  const flat = Math.abs(change) < 0.005
  const good = flat ? null : change > 0 === upIsGood
  const Icon = change > 0 ? ArrowUp : ArrowDown
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums" style={{ color: good == null ? 'var(--ink-3)' : good ? 'var(--good)' : 'var(--bad)' }}>
      {!flat && <Icon size={12} aria-hidden="true" />}
      <span className="sr-only">{flat ? 'flat' : change > 0 ? 'up' : 'down'}</span>
      {flat ? '0%' : `${Math.abs(change * 100).toFixed(1)}%`}
      <span className="font-normal" style={{ color: 'var(--ink-3)' }}>&nbsp;vs prior</span>
    </span>
  )
}

export function KpiTile({
  label,
  value,
  source,
  change,
  upIsGood,
  foot,
  muted,
}: {
  label: React.ReactNode
  value: string
  source: 'meta' | 'fp' | 'site'
  change?: number | null
  upIsGood?: boolean
  foot?: React.ReactNode
  muted?: boolean
}) {
  return (
    <div className="card-inset flex min-w-0 flex-col gap-1 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p className="micro-label">{label}</p>
        <Source s={source} />
      </div>
      <p className="display-num text-[20px] tabular-nums sm:text-[24px]" style={{ color: muted ? 'var(--ink-3)' : 'var(--ink)' }}>
        {value}
      </p>
      {change !== undefined && <Delta change={change} upIsGood={upIsGood} />}
      {foot && <div className="explain leading-snug">{foot}</div>}
    </div>
  )
}

// ── Data loading ───────────────────────────────────────────────────────────

/**
 * Loads `fn` whenever `key` changes; `reload()` refetches. Loading is derived
 * (the stored key differs from the requested one), so no setState runs inside
 * the effect body. Stale data stays visible while the next key loads.
 */
export function useLoad<T>(key: string, fn: () => Promise<T>) {
  const [nonce, setNonce] = useState(0)
  const full = `${key}#${nonce}`
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' })
  useEffect(() => {
    let alive = true
    fn().then(
      (data) => alive && setState({ key: full, data }),
      (err: unknown) => alive && setState((s) => ({ key: full, data: s.data, error: err instanceof Error ? err.message : String(err) })),
    )
    return () => {
      alive = false
    }
    // `fn` closes over the values encoded in `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full])
  const loading = state.key !== full
  return { data: state.data, error: loading ? undefined : state.error, loading, reload: () => setNonce((n) => n + 1) }
}

/** apiFetch throws "<status> <body>"; pull Nest's `message` out of a JSON body so the server's own words show. */
export function serverMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const m = /^(\d{3}) ([\s\S]*)$/.exec(raw)
  if (!m) return raw.slice(0, 200)
  try {
    const body = JSON.parse(m[2]) as { message?: string | string[] }
    if (body.message) return (Array.isArray(body.message) ? body.message.join('; ') : body.message).slice(0, 200)
  } catch {}
  return raw.slice(0, 200)
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center" style={{ background: 'var(--bad-bg)', borderColor: 'var(--bad-border)' }}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold" style={{ color: 'var(--ink)' }}>We couldn’t load this analysis</p>
        <p className="explain mt-1 break-words">Check the backend is running, then try again. ({message.slice(0, 160)})</p>
      </div>
      <button type="button" className="btn btn-ghost" onClick={onRetry}>
        Try Again
      </button>
    </div>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Inbox size={22} aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
      <p className="text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>{title}</p>
      {hint && <p className="explain max-w-sm">{hint}</p>}
    </div>
  )
}

/** Table that scrolls sideways inside its card — never the page. */
export function TableWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative max-w-full overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-[var(--accent)]" role="region" aria-label={label} tabIndex={0}>
      <table className="data-table min-w-max">{children}</table>
    </div>
  )
}

export interface SortState<K extends string> {
  key: K
  dir: 'asc' | 'desc'
}

export function SortTh<K extends string>({
  k,
  sort,
  onSort,
  children,
  num = true,
}: {
  k: K
  sort: SortState<K>
  onSort: (s: SortState<K>) => void
  children: React.ReactNode
  num?: boolean
}) {
  const active = sort.key === k
  return (
    <th className={num ? 'num' : undefined} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        onClick={() => onSort({ key: k, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}
      >
        {children}
        {active ? (sort.dir === 'desc' ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />) : <ArrowUpDown size={12} aria-hidden="true" style={{ opacity: 0.4 }} />}
      </button>
    </th>
  )
}

/** Null-last comparator for sortable tables. */
export function compare(a: number | string | null | undefined, b: number | string | null | undefined, dir: 'asc' | 'desc'): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  const r = typeof a === 'string' ? a.localeCompare(String(b)) : a - (b as number)
  return dir === 'asc' ? r : -r
}

/**
 * Container width via ResizeObserver, so SVG charts draw at real pixel size.
 * A callback ref, so it attaches whenever the element mounts (also after an
 * empty state was shown first).
 */
export function useWidth<E extends HTMLElement>(fallback = 720) {
  const [width, setWidth] = useState(fallback)
  const ref = useCallback((el: E | null) => {
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export function Caveat({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg px-3 py-2 text-[13px] leading-snug" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--ink-2)' }}>
      <strong style={{ color: 'var(--warn)' }}>Caveat: </strong>
      {children}
    </p>
  )
}

/** Horizontal bar used for drop-offs and shares. */
export function Bar({ value, max, color = 'var(--viz-funnel-2)', label }: { value: number; max: number; color?: string; label?: string }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--muted)' }} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
    </div>
  )
}
