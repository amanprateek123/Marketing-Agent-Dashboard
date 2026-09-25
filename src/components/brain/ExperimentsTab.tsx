'use client'

/**
 * Experiments — what the Brain is testing, what it learned, and what it tried and dropped.
 *
 * Every word on this tab comes from the bridge already translated (experiments.mapper.ts in the
 * marketing-agent repo): claims are sentences, kinds and statuses are labels, results carry their
 * own figures. Nothing here reads an attribute code, a status enum or an id — the only id is the
 * opaque `ref`, and it lives inside a collapsed <Details>.
 *
 * Three sections, one fetch each, all sharing the product filter:
 *   1. What we're testing now   — planned + running tests, with progress towards "enough data"
 *   2. What we learned          — tests that worked or didn't, with the figures
 *   3. Tried and dropped        — stopped early or ended without a clear answer
 */

import React, { useEffect, useState } from 'react'
import { Beaker, CircleCheck, Clock, FlaskConical, Loader2, Archive } from 'lucide-react'
import { getExperimentSummary, getExperiments } from '@/lib/brain-api'
import type {
  BrainExperiment,
  BrainExperimentSummary,
  BrainExperimentTone,
  BrainExperimentView,
} from '@/types/brain'
import {
  PLAIN_ERROR,
  errorDetail,
  formatDaysLeft,
  formatInr,
  plainStatus,
  toneChip,
} from '@/lib/plain-language'
import { Details } from '@/components/plain/Details'
import { SectionCard } from './shared'

const TONE_CHIP: Record<BrainExperimentTone, string> = {
  progress: 'chip-accent',
  waiting: 'chip-warn',
  good: 'chip-good',
  bad: 'chip-bad',
  idle: 'chip-neutral',
}

const SECTIONS: Array<{
  view: BrainExperimentView
  title: string
  description: string
  emptyTitle: string
  emptyText: string
  Icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean; style?: React.CSSProperties }>
}> = [
  {
    view: 'testing',
    title: "What we're testing now",
    description: 'Ideas the Brain is checking with real ads. Each needs enough spend and views before it can be judged.',
    emptyTitle: 'Nothing is being tested right now',
    emptyText: 'When the Brain plans new ads, the ideas they test will show up here.',
    Icon: FlaskConical,
  },
  {
    view: 'learned',
    title: 'What we learned',
    description: 'Tests that finished with a clear answer — what worked, and what did not.',
    emptyTitle: 'No results yet',
    emptyText: 'Once a test has run long enough to judge, its result will appear here.',
    Icon: CircleCheck,
  },
  {
    view: 'dropped',
    title: 'Tried and dropped',
    description: 'Tests that were stopped early or ended without enough evidence either way.',
    emptyTitle: 'Nothing dropped',
    emptyText: 'Every test so far has either given an answer or is still running.',
    Icon: Archive,
  },
]

/** After this long a loading section says so in words instead of spinning forever. */
const SLOW_MS = 15_000

interface ExperimentsTabProps {
  tenantId: string
}

export function ExperimentsTab({ tenantId }: ExperimentsTabProps) {
  const [summary, setSummary] = useState<BrainExperimentSummary | null>(null)
  const [product, setProduct] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const next = await getExperimentSummary(tenantId)
        if (!cancelled) setSummary(next)
      } catch {
        // The summary only feeds the filter and the counts; the sections still load on their own.
        if (!cancelled) setSummary(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId])

  const products = summary?.products ?? []

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionCard
        title="Experiments"
        description="The Brain treats every new ad as a small test of an idea. This is what it is testing, and what it has learned so far."
        action={
          products.length > 1 ? (
            <label className="flex min-w-0 items-center gap-2 text-sm" style={{ color: 'var(--ink-3)' }}>
              <span className="shrink-0">Product</span>
              <select
                className="input min-w-0 max-w-[14rem]"
                value={product}
                onChange={(event) => setProduct(event.target.value)}
              >
                <option value="">All products</option>
                {products.map((p) => (
                  <option key={p.productKey} value={p.productKey}>
                    {p.product}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      >
        {summary ? (
          <div className="flex flex-wrap gap-2">
            <span className="chip chip-accent">{countLabel(summary.views.testing, summary.partial)} being tested</span>
            <span className="chip chip-good">{countLabel(summary.views.learned, summary.partial)} learned</span>
            <span className="chip chip-neutral">{countLabel(summary.views.dropped, summary.partial)} dropped</span>
          </div>
        ) : (
          <p className="explain">Counts are not available right now.</p>
        )}
      </SectionCard>

      {SECTIONS.map((section) => (
        <ExperimentSection key={section.view} tenantId={tenantId} product={product} {...section} />
      ))}
    </div>
  )
}

function countLabel(n: number, partial: boolean): string {
  return partial ? `${n}+` : String(n)
}

/* ── One section ─────────────────────────────────────────────────────────────── */

function ExperimentSection({
  tenantId,
  product,
  view,
  title,
  description,
  emptyTitle,
  emptyText,
  Icon,
}: {
  tenantId: string
  product: string
} & (typeof SECTIONS)[number]) {
  const [rows, setRows] = useState<BrainExperiment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [slow, setSlow] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (!cancelled) setSlow(true)
    }, SLOW_MS)
    void (async () => {
      try {
        const next = await getExperiments(tenantId, view, product || null)
        if (cancelled) return
        setRows(next)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(errorDetail(err) || 'Unknown error')
      } finally {
        window.clearTimeout(timer)
        if (!cancelled) setSlow(false)
      }
    })()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [tenantId, view, product, reload])

  const retry = () => {
    setRows(null)
    setError(null)
    setReload((n) => n + 1)
  }

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <Icon size={16} aria-hidden style={{ color: 'var(--ink-3)' }} />
          {title}
          {rows && rows.length > 0 && <span className="chip chip-neutral tabular-nums">{rows.length}</span>}
        </span>
      }
      description={description}
    >
      {error ? (
        <div className="flex flex-col gap-3" role="alert">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
              {PLAIN_ERROR}
            </p>
            <button type="button" className="btn btn-ghost" onClick={retry}>
              Try again
            </button>
          </div>
          <Details items={[{ label: 'Error', value: error }]} />
        </div>
      ) : rows === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {slow ? (
            <p className="explain">This is taking longer than usual. It may still load — or try again in a minute.</p>
          ) : (
            <p className="explain inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Loading…
            </p>
          )}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center">
          <Beaker size={22} aria-hidden="true" style={{ color: 'var(--ink-4)' }} className="mx-auto" />
          <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
            {emptyTitle}
          </p>
          <p className="explain mx-auto mt-1 max-w-[46ch]">{emptyText}</p>
        </div>
      ) : (
        <ul className="flex min-w-0 flex-col gap-3">
          {rows.map((exp) => (
            <li key={exp.ref} className="min-w-0">
              <ExperimentCard exp={exp} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

/* ── One experiment ──────────────────────────────────────────────────────────── */

function ExperimentCard({ exp }: { exp: BrainExperiment }) {
  const kindTone = exp.kind === 'other' ? 'neutral' : plainStatus('experimentKind', exp.kind).tone
  return (
    <article
      className="flex min-w-0 flex-col gap-3 rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className={`chip ${TONE_CHIP[exp.tone]}`} title={exp.statusMeaning || undefined}>
          {exp.statusLabel}
        </span>
        <span className={`chip ${toneChip(kindTone)}`}>{exp.kindLabel}</span>
        {exp.product && <span className="chip chip-neutral max-w-full truncate" title={exp.product}>{exp.product}</span>}
        <span className="chip chip-neutral">{exp.levelLabel}</span>
      </div>

      <p className="break-words text-[14px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
        {exp.claim}
      </p>

      {exp.progress && <ProgressBlock progress={exp.progress} />}

      {exp.result && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 break-words text-sm" style={{ color: 'var(--ink-2)' }}>
            {exp.result.sentence}
          </p>
          {exp.result.confidenceLabel && <span className="chip chip-info">{exp.result.confidenceLabel}</span>}
        </div>
      )}

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        {exp.since && (
          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-3)' }}>
            <Clock size={12} aria-hidden="true" />
            {exp.progress ? 'Started' : 'Decided'} {exp.since}
          </span>
        )}
      </div>
      <Details reference={exp.ref} />
    </article>
  )
}

function ProgressBlock({ progress }: { progress: NonNullable<BrainExperiment['progress']> }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Bar
          label="Spent"
          value={progress.spentInr}
          target={progress.neededInr}
          text={
            progress.neededInr !== null
              ? `${formatInr(progress.spentInr)} of ${formatInr(progress.neededInr)} needed`
              : formatInr(progress.spentInr)
          }
        />
        <Bar
          label="Views"
          value={progress.impressions}
          target={progress.neededImpressions}
          text={
            progress.neededImpressions !== null
              ? `${progress.impressions.toLocaleString('en-IN')} of ${progress.neededImpressions.toLocaleString('en-IN')} needed`
              : progress.impressions.toLocaleString('en-IN')
          }
        />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--ink-3)' }}>
        {progress.daysLeft !== null && <span className="chip chip-neutral">{formatDaysLeft(progress.daysLeft)}</span>}
        {progress.note && <span className="min-w-0 break-words">{progress.note}</span>}
      </div>
    </div>
  )
}

function Bar({
  label,
  value,
  target,
  text,
}: {
  label: string
  value: number
  target: number | null
  text: string
}) {
  const pct = target && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : null
  const met = pct !== null && pct >= 100
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline justify-between gap-2 text-xs">
        <span className="font-medium" style={{ color: 'var(--ink-2)' }}>
          {label}
        </span>
        <span className="min-w-0 truncate tabular-nums" style={{ color: 'var(--ink-3)' }} title={text}>
          {text}
        </span>
      </div>
      {pct !== null && (
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--muted)' }}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: met ? 'var(--good)' : 'var(--accent)' }}
          />
        </div>
      )}
    </div>
  )
}
