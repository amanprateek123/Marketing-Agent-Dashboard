'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Lock,
  TrendingDown,
  X,
  XCircle,
} from 'lucide-react'
import type {
  IntelligenceReviewEvidenceBundle,
  IntelligenceReviewHierarchyNode,
  IntelligenceReviewResult,
} from '@/types/intelligence-review'

/**
 * The founder-facing half of the review. Everything here answers "what is
 * happening and what should I do", in the words a non-technical operator
 * already uses. Refs, step numbers, internal codes and the full fact list stay
 * behind the evidence drawer — they are the proof, not the message.
 */

// ── plain-language dictionaries ───────────────────────────────────────────────

const ACTION_PHRASE: Record<string, string> = {
  pause_ad: 'Turn off this ad',
  pause_adset: 'Turn off this ad group',
  scale_adset: 'Give this ad group more budget',
  replace_creative: 'Swap in a different creative',
  add_creative: 'Add another creative to test',
  add_adset: 'Launch a new ad group',
  shift_budget_between_adsets: 'Move budget between ad groups',
  reduce_total_budget: 'Lower the total daily budget',
  narrow_placement: 'Show the ads in fewer places',
  dayparting: 'Only run the ads at certain hours',
}

function actionPhrase(type: string): string {
  return ACTION_PHRASE[type] ?? type.replace(/_/g, ' ')
}

function numericParam(
  parameters: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const raw = parameters?.[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  }
  return null
}

/**
 * "Lower the total daily budget" does not tell an operator how much. The size
 * of the change lives in the action parameters, so state it in the sentence
 * rather than leaving it as a `reductionPercent: 20` key further down the page.
 */
function actionSentence(action: {
  type: string
  parameters: Record<string, unknown>
}): string {
  const base = actionPhrase(action.type)
  const pct = numericParam(
    action.parameters,
    'reductionPercent',
    'scalePercent',
    'shiftPercent',
    'increasePercent',
  )
  if (pct === null) return base
  const rounded = Math.round(pct * 10) / 10
  if (action.type === 'reduce_total_budget') return `Lower the daily budget by ${rounded}%`
  if (action.type === 'scale_adset') return `Raise this ad group's budget by ${rounded}%`
  if (action.type === 'shift_budget_between_adsets') return `Move ${rounded}% of the budget to a stronger ad group`
  return `${base} — by ${rounded}%`
}

const VERDICT_COPY = {
  support: {
    label: 'This looks right',
    detail: 'The evidence backs this up.',
    tone: 'good' as const,
  },
  hold: {
    label: 'Wait before doing this',
    detail: 'The evidence is not strong enough to act on yet.',
    tone: 'warn' as const,
  },
  reject: {
    label: "Don't do this",
    detail: 'The evidence argues against it.',
    tone: 'bad' as const,
  },
}

function toneColor(tone: 'good' | 'warn' | 'bad') {
  if (tone === 'good') return { fg: 'var(--good)', bg: 'var(--good-bg)', border: 'var(--good-border)' }
  if (tone === 'bad') return { fg: 'var(--bad)', bg: 'var(--bad-bg)', border: 'var(--bad-border)' }
  return { fg: 'var(--warn)', bg: 'var(--warn-bg)', border: 'var(--warn-border)' }
}

// ── formatting ───────────────────────────────────────────────────────────────

function rupees(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function metricOf(node: IntelligenceReviewHierarchyNode, key: string): number | null {
  const metric = node.metrics?.find((m) => m.key === key)
  if (!metric || metric.status !== 'available' || metric.value === null) return null
  return metric.value
}

function factValueByUnit(
  evidence: IntelligenceReviewEvidenceBundle | undefined,
  unit: string,
): number | string | null {
  const fact = evidence?.packet.facts.find((f) => f.unit === unit)
  if (!fact) return null
  if (typeof fact.value === 'number' || typeof fact.value === 'string') return fact.value
  return null
}

// ── money headline ───────────────────────────────────────────────────────────

function MoneyHeadline({
  campaign,
  breakeven,
}: {
  campaign: IntelligenceReviewHierarchyNode
  breakeven: number | null
}) {
  const spend = metricOf(campaign, 'spend')
  const roas = metricOf(campaign, 'roas')
  if (spend === null || roas === null) return null

  const returned = spend * roas
  const losing = breakeven !== null ? roas < breakeven : roas < 1
  const perRupee = roas.toFixed(2)

  // Bar is scaled against whichever is larger so neither bar overflows.
  const ceiling = Math.max(spend, returned, 1)
  const spendPct = (spend / ceiling) * 100
  const returnPct = (returned / ceiling) * 100

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        {losing ? (
          <TrendingDown size={18} aria-hidden="true" style={{ color: 'var(--bad)' }} />
        ) : (
          <CheckCircle2 size={18} aria-hidden="true" style={{ color: 'var(--good)' }} />
        )}
        <h3 className="text-[17px] font-bold" style={{ color: 'var(--ink)' }}>
          {losing ? 'This campaign is losing money' : 'This campaign is making money'}
        </h3>
      </div>

      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
        You spent <strong style={{ color: 'var(--ink)' }}>{rupees(spend)}</strong> and got{' '}
        <strong style={{ color: 'var(--ink)' }}>{rupees(returned)}</strong> back — that is{' '}
        <strong style={{ color: losing ? 'var(--bad)' : 'var(--good)' }}>₹{perRupee} for every ₹1 spent</strong>.
        {breakeven !== null && (
          <> This product needs <strong style={{ color: 'var(--ink)' }}>₹{breakeven.toFixed(2)}</strong> per ₹1 just to break even.</>
        )}
      </p>

      <div className="mt-3 space-y-1.5" aria-hidden="true">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>Spent</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--muted)' }}>
            <div className="h-full rounded-full" style={{ width: `${spendPct}%`, background: 'var(--ink-3)' }} />
          </div>
          <span className="w-20 shrink-0 text-right text-[11px] font-semibold tabular-nums" style={{ color: 'var(--ink-2)' }}>{rupees(spend)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>Got back</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--muted)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${returnPct}%`, background: losing ? 'var(--bad)' : 'var(--good)' }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-[11px] font-semibold tabular-nums" style={{ color: 'var(--ink-2)' }}>{rupees(returned)}</span>
        </div>
      </div>
    </div>
  )
}

// ── per-ad-set / per-ad breakdown, worst first ───────────────────────────────

function BreakdownRow({
  node,
  breakeven,
  href,
}: {
  node: IntelligenceReviewHierarchyNode
  breakeven: number | null
  href: string | null
}) {
  const spend = metricOf(node, 'spend')
  const roas = metricOf(node, 'roas')
  const profitable = roas !== null && breakeven !== null ? roas >= breakeven : null
  const levelLabel = node.level === 'adset' ? 'Ad group' : 'Ad'

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="chip chip-neutral shrink-0" style={{ fontSize: '9.5px', padding: '1px 6px' }}>{levelLabel}</span>
          <span className="truncate text-[13px] font-semibold" style={{ color: 'var(--ink)' }} title={node.name}>
            {node.name}
          </span>
        </div>
      </div>
      <span className="w-24 shrink-0 text-right text-[12.5px] tabular-nums" style={{ color: 'var(--ink-2)' }}>
        {spend === null ? '—' : rupees(spend)}
      </span>
      <span
        className="w-28 shrink-0 text-right text-[12.5px] font-bold tabular-nums"
        style={{ color: profitable === null ? 'var(--ink-2)' : profitable ? 'var(--good)' : 'var(--bad)' }}
      >
        {roas === null ? '—' : `₹${roas.toFixed(2)}`}
      </span>
      <span className="hidden w-32 shrink-0 text-right text-[11px] font-semibold sm:block" style={{ color: profitable ? 'var(--good)' : 'var(--ink-3)' }}>
        {profitable === null ? '' : profitable ? 'Making money' : roas === 0 ? 'No sales at all' : 'Losing money'}
      </span>
      {href && <ChevronRight size={14} className="shrink-0" aria-hidden="true" style={{ color: 'var(--accent)' }} />}
    </>
  )

  const className = 'flex items-center gap-3 px-3 py-2.5'
  if (!href) {
    return <div className={className} style={{ borderTop: '1px solid var(--hairline-light)' }}>{body}</div>
  }
  return (
    <Link
      href={href}
      className={`${className} transition-colors hover:bg-[var(--accent-bg)]`}
      style={{ borderTop: '1px solid var(--hairline-light)' }}
      title={`Open ${node.name}`}
    >
      {body}
    </Link>
  )
}

function Breakdown({
  evidence,
  breakeven,
}: {
  evidence?: IntelligenceReviewEvidenceBundle
  breakeven: number | null
}) {
  if (!evidence) return null
  const { tenantId, campaignId } = evidence.packet

  const rows = evidence.hierarchy.nodes
    .filter((node) => node.level === 'adset' || node.level === 'ad')
    .filter((node) => metricOf(node, 'roas') !== null || metricOf(node, 'spend') !== null)
    .sort((a, b) => {
      const ra = metricOf(a, 'roas')
      const rb = metricOf(b, 'roas')
      if (ra === null) return 1
      if (rb === null) return -1
      return ra - rb
    })

  if (rows.length === 0) return null

  const best = rows.reduce<IntelligenceReviewHierarchyNode | null>((acc, node) => {
    const r = metricOf(node, 'roas')
    if (r === null) return acc
    const accR = acc ? metricOf(acc, 'roas') : null
    return accR === null || r > accR ? node : acc
  }, null)
  const bestRoas = best ? metricOf(best, 'roas') : null
  const bestIsProfitable = bestRoas !== null && breakeven !== null && bestRoas >= breakeven

  const coverage = evidence.hierarchy.coverage

  return (
    <div className="mt-5">
      <h4 className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
        Where the money is going
      </h4>
      {bestIsProfitable && best && (
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          Not everything here is failing — <strong style={{ color: 'var(--good)' }}>{best.name}</strong> is
          bringing back ₹{bestRoas?.toFixed(2)} per ₹1, which is above break-even. A cut across the whole
          campaign would slow this one down too.
        </p>
      )}

      <div className="mt-2.5 overflow-hidden rounded-lg" style={{ border: '1px solid var(--hairline)' }}>
        <div
          className="flex items-center gap-3 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide"
          style={{ background: 'var(--surface-warm)', color: 'var(--ink-3)' }}
        >
          <span className="min-w-0 flex-1">Name</span>
          <span className="w-24 shrink-0 text-right">Spent</span>
          <span className="w-28 shrink-0 text-right">Back per ₹1</span>
          <span className="hidden w-32 shrink-0 text-right sm:block">Verdict</span>
          <span className="w-3.5 shrink-0" aria-hidden="true" />
        </div>
        {rows.map((node) => (
          <BreakdownRow
            key={`${node.level}-${node.id}`}
            node={node}
            breakeven={breakeven}
            href={
              node.level === 'adset'
                ? `/dashboard/${tenantId}/campaigns/${campaignId}?tab=adsets&focus=${encodeURIComponent(node.id)}`
                : `/dashboard/${tenantId}/campaigns/${campaignId}?tab=adsets&focus=${encodeURIComponent(node.id)}`
            }
          />
        ))}
      </div>

      {coverage.truncated && (
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--ink-3)' }}>
          Showing {coverage.adsIncluded} of {coverage.adsTotal} ads and {coverage.adSetsIncluded} of{' '}
          {coverage.adSetsTotal} ad groups — the ones the check looked at closely.
        </p>
      )}
    </div>
  )
}

// ── the two opinions ─────────────────────────────────────────────────────────

function Opinions({
  review,
  lifecycleStage,
  ageDays,
  currentDailyBudget,
}: {
  review: IntelligenceReviewResult
  lifecycleStage: string | null
  ageDays: number | null
  currentDailyBudget?: number | null
}) {
  const reductionPct =
    review.recommendation.action.type === 'reduce_total_budget'
      ? numericParam(review.recommendation.action.parameters, 'reductionPercent')
      : null
  const verdict = review.source === 'fallback' || !review.validation.valid ? 'hold' : review.verdict
  const copy = VERDICT_COPY[verdict]
  const tone = toneColor(copy.tone)

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg p-3.5" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}>
        <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
          What Meridian suggests
        </p>
        <p className="mt-1.5 text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
          {actionSentence(review.recommendation.action)}
        </p>
        {typeof currentDailyBudget === 'number' && reductionPct !== null && (
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
            {rupees(currentDailyBudget)} → <strong style={{ color: 'var(--ink)' }}>{rupees(currentDailyBudget * (1 - reductionPct / 100))}</strong> a day
          </p>
        )}
      </div>

      <div className="rounded-lg p-3.5" style={{ background: tone.bg, border: `1px solid ${tone.border}` }}>
        <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
          What the second opinion says
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[14px] font-bold" style={{ color: tone.fg }}>
          {verdict === 'support' ? <CheckCircle2 size={15} aria-hidden="true" /> : verdict === 'reject' ? <XCircle size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />}
          {copy.label}
        </p>
        {(lifecycleStage === 'learning' || ageDays !== null) && verdict !== 'support' && (
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {ageDays !== null
              ? `This campaign is only ${Math.round(ageDays)} days old${lifecycleStage === 'learning' ? ' and still learning' : ''}, so the numbers can still move on their own.`
              : copy.detail}
          </p>
        )}
      </div>
    </div>
  )
}

// ── what we still don't know ─────────────────────────────────────────────────

function OpenQuestions({ review }: { review: IntelligenceReviewResult }) {
  const questions = review.unknowns.slice(0, 2)
  if (questions.length === 0) return null
  return (
    <div className="mt-5">
      <h4 className="flex items-center gap-1.5 text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
        <HelpCircle size={15} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
        What we still don&rsquo;t know
      </h4>
      <ul className="mt-2 space-y-2">
        {questions.map((item) => (
          <li
            key={item.question}
            className="rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed"
            style={{ background: 'var(--surface-warm)', color: 'var(--ink-2)', border: '1px solid var(--hairline-light)' }}
          >
            {item.question}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── evidence drawer ──────────────────────────────────────────────────────────

function EvidenceDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null
  // Rendered through a portal on <body>. Inside the card an ancestor creates a
  // containing block, which makes `position: fixed` resolve against that
  // ancestor instead of the viewport — the drawer ends up clipped inside the
  // recommendation card rather than covering the screen.
  if (typeof document === 'undefined') return null

  return createPortal(
    // `data-portal` opts out of the global `body > :not([data-portal])` rule,
    // which otherwise forces position:relative / z-index:1 onto direct body
    // children and collapses this overlay into the page flow.
    <div
      data-portal="true"
      className="fixed inset-0 z-[100] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close evidence"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(15,23,42,0.45)' }}
      />
      <div
        className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden shadow-2xl"
        style={{ background: 'var(--surface)' }}
      >
        <header
          className="flex shrink-0 items-center justify-between gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--hairline)' }}
        >
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>
              The evidence behind this
            </h2>
            <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              Every number below was recorded from your ad account — nothing here was written by the model.
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="btn btn-ghost shrink-0" aria-label="Close">
            <X size={15} aria-hidden="true" /> Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// ── main ─────────────────────────────────────────────────────────────────────

export function FounderVerdict({
  review,
  evidence,
  readOnlyReason,
  currentDailyBudget,
  children,
}: {
  review: IntelligenceReviewResult
  evidence?: IntelligenceReviewEvidenceBundle
  readOnlyReason?: string
  /** Live daily budget, so a percentage change can be shown in rupees. */
  currentDailyBudget?: number | null
  children: React.ReactNode
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const campaignNode = evidence?.hierarchy.nodes.find((node) => node.level === 'campaign')
  const breakevenRaw = factValueByUnit(evidence, 'breakeven_roas')
  const breakeven = typeof breakevenRaw === 'number' ? breakevenRaw : null
  const stageRaw = factValueByUnit(evidence, 'lifecycle_stage')
  const lifecycleStage = typeof stageRaw === 'string' ? stageRaw : null
  const hoursRaw = factValueByUnit(evidence, 'hours')
  const ageDays = typeof hoursRaw === 'number' ? hoursRaw / 24 : null

  return (
    <section
      className="overflow-hidden rounded-xl"
      aria-label="What Meridian found"
      style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
    >
      <div className="px-4 py-4 sm:px-5">
        {readOnlyReason && (
          <div
            className="mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] leading-relaxed"
            style={{ background: 'var(--surface-warm)', color: 'var(--ink-2)', border: '1px solid var(--hairline-light)' }}
          >
            <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
            <span>{readOnlyReason}</span>
          </div>
        )}

        {campaignNode ? (
          <MoneyHeadline campaign={campaignNode} breakeven={breakeven} />
        ) : (
          <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{review.summary}</p>
        )}

        <Breakdown evidence={evidence} breakeven={breakeven} />

        <Opinions
          review={review}
          lifecycleStage={lifecycleStage}
          ageDays={ageDays}
          currentDailyBudget={currentDailyBudget}
        />

        <OpenQuestions review={review} />

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="btn btn-ghost mt-5"
          aria-haspopup="dialog"
        >
          Show the evidence behind this <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>

      <EvidenceDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {children}
      </EvidenceDrawer>
    </section>
  )
}
