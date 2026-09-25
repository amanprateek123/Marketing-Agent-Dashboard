import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Eye,
  FileImage,
  Layers3,
  LockKeyhole,
  Megaphone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react'
import type {
  IntelligenceReviewActionSnapshot,
  IntelligenceReviewBaseline,
  IntelligenceReviewEvidenceBundle,
  IntelligenceReviewEvidenceValue,
  IntelligenceReviewHierarchyLevel,
  IntelligenceReviewHierarchyNode,
  IntelligenceReviewResult,
  IntelligenceReviewValidationCheck,
  IntelligenceReviewVerdict,
} from '@/types/intelligence-review'
import { FounderVerdict } from './FounderVerdict'
import { Details } from '@/components/plain/Details'
import { formatInr, formatWhen, humanise, plainStatus, shortRef, toneChip } from '@/lib/plain-language'

export interface MeridianReviewPanelProps {
  review?: IntelligenceReviewResult
  evidence?: IntelligenceReviewEvidenceBundle
  loading?: boolean
  /** Live daily budget, so a percentage change can also be shown in rupees. */
  currentDailyBudget?: number | null
}

type EffectiveVerdict = IntelligenceReviewVerdict | 'unavailable'

const VERDICT_PRESENTATION: Record<
  EffectiveVerdict,
  { label: string; color: string; background: string; border: string }
> = {
  support: {
    label: 'The numbers back this change',
    color: 'var(--good)',
    background: 'var(--good-bg)',
    border: 'var(--good-border)',
  },
  hold: {
    label: 'Held back to be safe',
    color: 'var(--warn)',
    background: 'var(--warn-bg)',
    border: 'var(--warn-border)',
  },
  reject: {
    label: 'The numbers argue against this change',
    color: 'var(--bad)',
    background: 'var(--bad-bg)',
    border: 'var(--bad-border)',
  },
  unavailable: {
    label: 'No second check yet',
    color: 'var(--ink-3)',
    background: 'var(--surface-warm)',
    border: 'var(--hairline)',
  },
}

const HIERARCHY_ORDER: Record<IntelligenceReviewHierarchyLevel, number> = {
  campaign: 1,
  adset: 2,
  ad: 3,
  creative: 4,
}

function plainLabel(value: string): string {
  return humanise(value) || 'Unavailable'
}

function levelLabel(level: string): string {
  if (level === 'adset') return 'Ad group'
  return plainLabel(level)
}

function formatTimestamp(value: string | undefined): string {
  const when = formatWhen(value)
  return when === '—' ? 'Time unavailable' : when
}

function formatDelta(value: number): string {
  const magnitude = Math.round(Math.abs(value) * 10) / 10
  if (value === 0) return '0%'
  return `${value > 0 ? '+' : '−'}${magnitude}%`
}

function formatConfidence(value: number): string {
  if (!Number.isFinite(value)) return 'Unavailable'
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function formatEvidenceValue(
  value: IntelligenceReviewEvidenceValue,
  unit?: string,
): string {
  if (value === null) return 'Unavailable'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return value

  const normalizedUnit = unit?.trim().toLowerCase()
  if (normalizedUnit === 'inr' || normalizedUnit === '₹') {
    return formatInr(value)
  }
  if (normalizedUnit === 'percent' || normalizedUnit === '%') {
    return `${Math.round(value * 10) / 10}%`
  }
  if (normalizedUnit === 'ratio' || normalizedUnit === 'x') {
    return `${value.toFixed(2)}x`
  }
  return `${value.toLocaleString('en-IN')}${unit ? ` ${humanise(unit).toLowerCase()}` : ''}`
}

function formatParameter(value: unknown): string {
  if (value === null || value === undefined) return 'Unavailable'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString('en-IN')
  if (typeof value === 'string') return humanise(value)
  if (Array.isArray(value)) return value.map(formatParameter).join(', ')
  return 'More settings'
}

function effectiveVerdict(
  review?: IntelligenceReviewResult,
): EffectiveVerdict {
  if (!review) return 'unavailable'
  if (review.source === 'fallback' || !review.validation.valid) {
    return 'hold'
  }
  return review.verdict
}

function VerdictIcon({ verdict }: { verdict: EffectiveVerdict }) {
  if (verdict === 'support') return <ShieldCheck size={19} aria-hidden="true" />
  if (verdict === 'reject') return <XCircle size={19} aria-hidden="true" />
  if (verdict === 'hold') return <ShieldAlert size={19} aria-hidden="true" />
  return <Activity size={19} aria-hidden="true" />
}

function HierarchyIcon({ level }: { level: IntelligenceReviewHierarchyLevel }) {
  if (level === 'campaign') return <Megaphone size={14} aria-hidden="true" />
  if (level === 'adset') return <Layers3 size={14} aria-hidden="true" />
  if (level === 'creative') return <FileImage size={14} aria-hidden="true" />
  return <Target size={14} aria-hidden="true" />
}

function reviewHierarchy(evidence?: IntelligenceReviewEvidenceBundle): {
  path: IntelligenceReviewHierarchyNode[]
  comparisons: IntelligenceReviewHierarchyNode[]
} {
  if (!evidence) return { path: [], comparisons: [] }

  const nodes = evidence.hierarchy.nodes
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const pathIds = new Set<string>()

  for (const context of nodes.filter((node) => node.role === 'context')) {
    pathIds.add(context.id)
  }

  for (const target of nodes.filter((node) => node.role === 'action_target')) {
    let current: IntelligenceReviewHierarchyNode | undefined = target
    while (current && !pathIds.has(current.id)) {
      pathIds.add(current.id)
      current = current.parentId ? nodesById.get(current.parentId) : undefined
    }
  }

  // Historical evidence can have context without an exact action-target node.
  // It remains visible, but no target relationship is invented.
  const byLevel = (a: IntelligenceReviewHierarchyNode, b: IntelligenceReviewHierarchyNode) =>
    HIERARCHY_ORDER[a.level] - HIERARCHY_ORDER[b.level]

  return {
    path: nodes.filter((node) => pathIds.has(node.id)).sort(byLevel),
    comparisons: nodes.filter((node) => !pathIds.has(node.id)).sort(byLevel),
  }
}

function HierarchyStrip({ evidence }: { evidence?: IntelligenceReviewEvidenceBundle }) {
  const { path, comparisons } = reviewHierarchy(evidence)
  if (path.length === 0 && comparisons.length === 0) return null
  const coverage = evidence?.hierarchy.coverage

  return (
    <div
      className="px-5 py-3.5"
      style={{
        background: 'var(--surface-warm)',
        borderTop: '1px solid var(--hairline-light)',
        borderBottom: '1px solid var(--hairline-light)',
      }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>
          What was looked at
        </p>
        {coverage && (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]" style={{ color: 'var(--ink-3)' }}>
            <span>{coverage.adSetsIncluded} of {coverage.adSetsTotal} ad groups</span>
            <span aria-hidden="true">·</span>
            <span>{coverage.adsIncluded} of {coverage.adsTotal} ads</span>
            {coverage.truncated && <span className="chip chip-warn" style={{ fontSize: '9px', padding: '0 6px' }}>Only the most relevant</span>}
          </div>
        )}
      </div>
      <ol className="flex flex-wrap items-center gap-2" aria-label="Campaign, ad group and ad looked at">
        {path.map((node, index) => {
          const metric = node.metrics.find((item) => item.status === 'available' && item.value !== null) ?? node.metrics[0]
          const unresolved = node.resolution === 'unresolved'
          const target = node.role === 'action_target'
          return (
            <li key={`${node.level}:${node.id}`} className="contents">
              {index > 0 && (
                <ArrowRight size={13} style={{ color: 'var(--ink-4)' }} aria-hidden="true" />
              )}
              <div
                className="min-w-0 rounded-lg px-3 py-2"
                style={{
                  background: target ? 'var(--accent-bg)' : 'var(--surface)',
                  border: `1px solid ${unresolved ? 'var(--warn-border)' : target ? 'var(--accent-border)' : 'var(--hairline)'}`,
                }}
              >
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>
                  <HierarchyIcon level={node.level} />
                  {levelLabel(node.level)}
                </div>
                <div className="mt-0.5 flex min-w-0 max-w-[240px] flex-wrap items-baseline gap-2">
                  <span className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }} title={node.name}>
                    {node.name}
                  </span>
                  {target && <span className="chip chip-accent" style={{ fontSize: '9px', padding: '0 6px' }}>Would change</span>}
                  {unresolved && <span className="chip chip-warn" style={{ fontSize: '9px', padding: '0 6px' }} title="We could not match this to your ad account.">Not found</span>}
                  {metric && (
                    <span className="shrink-0 text-[10.5px] tabular-nums" style={{ color: 'var(--ink-3)' }}>
                      {metric.label ? `${metric.label} ` : ''}
                      {formatEvidenceValue(metric.value, metric.unit)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {comparisons.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold" style={{ color: 'var(--ink-3)' }}>Compared with</span>
          {comparisons.slice(0, 6).map((node) => (
            <span key={`${node.level}:${node.id}`} className={`chip max-w-full truncate ${node.resolution === 'unresolved' ? 'chip-warn' : 'chip-neutral'}`} title={node.name}>
              {levelLabel(node.level)} · {node.name}
            </span>
          ))}
          {comparisons.length > 6 && <span className="chip chip-neutral">+{comparisons.length - 6} more</span>}
        </div>
      )}
    </div>
  )
}

function CompactEvidencePath({ evidence }: { evidence?: IntelligenceReviewEvidenceBundle }) {
  const { path } = reviewHierarchy(evidence)
  if (path.length === 0) {
    return (
      <span className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
        We couldn&apos;t tell which campaign, ad group or ad this is about
      </span>
    )
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="What was looked at">
      {path.map((node, index) => (
        <div key={`${node.level}:${node.id}`} className="contents">
          {index > 0 && <ArrowRight size={11} style={{ color: 'var(--ink-4)' }} aria-hidden="true" />}
          <span
            className={`chip max-w-full truncate ${node.role === 'action_target' ? 'chip-accent' : node.resolution === 'unresolved' ? 'chip-warn' : 'chip-neutral'}`}
            style={{ fontSize: '9.5px', padding: '1px 7px' }}
            title={`${levelLabel(node.level)}: ${node.name}`}
          >
            {levelLabel(node.level)} · {node.name}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Internal evidence references, kept behind a collapsed Details block (never shown as content). */
function EvidenceRefs({ refs, title = 'Reference' }: { refs: string[]; title?: string }) {
  if (refs.length === 0) return null
  if (refs.length === 1) return <Details title={title} reference={refs[0]} className="mt-2" />
  return (
    <Details
      title={`${title}s`}
      className="mt-2"
      items={refs.map((ref, index) => ({
        label: `${index + 1}`,
        value: <span title={ref}>{shortRef(ref)}</span>,
      }))}
    />
  )
}

function ObservedSection({
  review,
  evidence,
}: {
  review?: IntelligenceReviewResult
  evidence?: IntelligenceReviewEvidenceBundle
}) {
  const factsByRef = new Map(evidence?.packet.facts.map((fact) => [fact.ref, fact]))
  const observed = review?.observedFacts ?? []

  return (
    <article
      className="card-inset h-full p-4"
      style={{ background: 'var(--info-bg)', borderColor: 'var(--info-border)' }}
      aria-label="What the numbers show"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye size={16} style={{ color: 'var(--info)' }} aria-hidden="true" />
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            What the numbers show
          </h3>
        </div>
        <span className="chip chip-info" style={{ fontSize: '10px', padding: '1px 7px' }}>
          {observed.length} recorded
        </span>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
        Facts read straight from your ad account.
      </p>

      {observed.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {observed.map((fact) => {
            const sourceFact = factsByRef.get(fact.evidenceRef)
            return (
              <li key={fact.evidenceRef} className="rounded-lg bg-white/75 px-3 py-2.5" style={{ border: '1px solid var(--info-border)' }}>
                <p className="break-words text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                  {fact.statement}
                </p>
                {sourceFact && (
                  <p className="mt-1.5 text-[10px] font-semibold" style={{ color: 'var(--info)' }}>
                    From {plainLabel(sourceFact.source).toLowerCase()}
                  </p>
                )}
                <EvidenceRefs refs={[fact.evidenceRef]} />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-white/75 px-3 py-3 text-[12px]" style={{ color: 'var(--ink-3)', border: '1px solid var(--info-border)' }}>
          No facts from your ad account came with this check.
        </p>
      )}
    </article>
  )
}

function DerivedSection({ evidence }: { evidence?: IntelligenceReviewEvidenceBundle }) {
  const derived = evidence?.packet.facts.filter((fact) => fact.kind === 'derived') ?? []

  return (
    <article
      className="card-inset h-full p-4"
      style={{ background: 'var(--surface-warm)', borderColor: 'var(--hairline)' }}
      aria-label="Worked out from the numbers"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity size={16} style={{ color: 'var(--brand-secondary)' }} aria-hidden="true" />
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            Worked out from the numbers
          </h3>
        </div>
        <span className="chip chip-neutral" style={{ fontSize: '10px', padding: '1px 7px' }}>
          {derived.length} calculated
        </span>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
        Simple sums done on the facts, kept apart from them.
      </p>

      {derived.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {derived.map((fact) => (
            <li key={fact.ref} className="rounded-lg bg-white/75 px-3 py-2.5" style={{ border: '1px solid var(--hairline-light)' }}>
              <p className="break-words text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                {fact.statement}
              </p>
              <p className="mt-1.5 text-[10px] font-semibold" style={{ color: 'var(--brand-secondary)' }}>
                From {plainLabel(fact.source).toLowerCase()}
              </p>
              <EvidenceRefs refs={[fact.ref]} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-white/75 px-3 py-3 text-[12px]" style={{ color: 'var(--ink-3)', border: '1px solid var(--hairline-light)' }}>
          Nothing was worked out for this check.
        </p>
      )}
    </article>
  )
}

function InterpretationSection({ review }: { review?: IntelligenceReviewResult }) {
  const fallback = review?.source === 'fallback' || review?.validation.valid === false
  const hypotheses = fallback ? [] : (review?.hypotheses ?? [])

  return (
    <article
      className="card-inset h-full p-4"
      style={{
        background: fallback ? 'var(--warn-bg)' : 'var(--accent-soft)',
        borderColor: fallback ? 'var(--warn-border)' : 'var(--accent-border)',
      }}
      aria-label={fallback ? 'No AI explanation' : "The AI's explanation"}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {fallback ? (
            <ShieldAlert size={16} style={{ color: 'var(--warn)' }} aria-hidden="true" />
          ) : (
            <Sparkles size={16} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          )}
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            {fallback ? 'No AI explanation' : "The AI's explanation"}
          </h3>
        </div>
        <span className={`chip ${fallback ? 'chip-warn' : 'chip-accent'}`} style={{ fontSize: '10px', padding: '1px 7px' }}>
          A best guess, not proof
        </span>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
        {fallback
          ? 'The AI check did not run properly, so no AI explanation is shown.'
          : 'Possible reasons, based only on the facts listed here.'}
      </p>

      {fallback ? (
        <div className="mt-3 rounded-lg bg-white/75 px-3 py-3" style={{ border: '1px solid var(--warn-border)' }}>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--warn)' }}>
            Held back to be safe
          </p>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            The suggested change is kept as it was, but the AI has not checked or explained it.
          </p>
        </div>
      ) : hypotheses.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {hypotheses.map((hypothesis, index) => (
            <li key={`${hypothesis.statement}:${index}`} className="rounded-lg bg-white/75 px-3 py-2.5" style={{ border: '1px solid var(--accent-border)' }}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                  {hypothesis.statement}
                </p>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: 'var(--accent-strong)' }} title="How sure the AI is">
                  {formatConfidence(hypothesis.confidence)} sure
                </span>
              </div>
              {(hypothesis.evidenceRefs.length > 0 || hypothesis.counterevidenceRefs.length > 0) && (
                <p className="mt-1.5 text-[10px]" style={{ color: 'var(--ink-3)' }}>
                  Backed by {hypothesis.evidenceRefs.length} {hypothesis.evidenceRefs.length === 1 ? 'fact' : 'facts'}
                  {hypothesis.counterevidenceRefs.length > 0 &&
                    ` · ${hypothesis.counterevidenceRefs.length} ${hypothesis.counterevidenceRefs.length === 1 ? 'fact points' : 'facts point'} the other way`}
                </p>
              )}
              <EvidenceRefs refs={[...hypothesis.evidenceRefs, ...hypothesis.counterevidenceRefs]} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-white/75 px-3 py-3 text-[12px]" style={{ color: 'var(--ink-3)', border: '1px solid var(--accent-border)' }}>
          The AI did not suggest any reasons.
        </p>
      )}
    </article>
  )
}

function UnknownsSection({
  review,
  evidence,
}: {
  review?: IntelligenceReviewResult
  evidence?: IntelligenceReviewEvidenceBundle
}) {
  const deterministic = evidence?.unknowns ?? []
  const reviewerUnknowns = review?.unknowns ?? []
  const count = deterministic.length + reviewerUnknowns.length

  return (
    <article
      className="card-inset h-full p-4"
      style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}
      aria-label="What we don't know yet"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} style={{ color: 'var(--warn)' }} aria-hidden="true" />
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            What we don&apos;t know yet
          </h3>
        </div>
        <span className="chip chip-warn" style={{ fontSize: '10px', padding: '1px 7px' }}>
          {count} {count === 1 ? 'gap' : 'gaps'}
        </span>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
        Missing information is listed here so nothing is claimed without it.
      </p>

      {count > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {deterministic.map((item) => (
            <li key={item.code} className="rounded-lg bg-white/75 px-3 py-2.5" style={{ border: '1px solid var(--warn-border)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="min-w-0 break-words text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>{item.statement}</p>
                <span className="chip chip-warn" style={{ fontSize: '9px', padding: '0 6px' }}>
                  {plainLabel(item.effect)}
                </span>
              </div>
              <EvidenceRefs refs={[item.code]} />
            </li>
          ))}
          {reviewerUnknowns.map((item, index) => (
            <li key={`${item.question}:${index}`} className="rounded-lg bg-white/75 px-3 py-2.5" style={{ border: '1px solid var(--warn-border)' }}>
              <p className="break-words text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>{item.question}</p>
              <p className="mt-1 break-words text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{item.whyItMatters}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-white/75 px-3 py-3 text-[12px]" style={{ color: 'var(--ink-3)', border: '1px solid var(--warn-border)' }}>
          Nothing is missing.
        </p>
      )}
    </article>
  )
}

function RecommendationMetrics({ action }: { action: IntelligenceReviewActionSnapshot }) {
  const profit = action.expectedProfitDeltaINR7d
  const basis = action.expectedImpact.basis ?? 'modeled'
  const impactLabel =
    basis === 'not_estimated'
      ? `What we will watch · ${plainLabel(action.expectedImpact.metric).toLowerCase()}`
      : basis === 'observed_gap'
        ? `Gap to similar ads · ${plainLabel(action.expectedImpact.metric).toLowerCase()}`
        : `Expected change in ${plainLabel(action.expectedImpact.metric).toLowerCase()}`
  const impactValue =
    basis === 'not_estimated'
      ? typeof action.expectedImpact.currentValue === 'number'
        ? formatEvidenceValue(action.expectedImpact.currentValue)
        : 'Measure next'
      : formatDelta(
          basis === 'observed_gap'
            ? (action.expectedImpact.observedGapPct ?? action.expectedImpact.deltaPct)
            : action.expectedImpact.deltaPct,
        )
  const impactDetail =
    basis === 'not_estimated'
      ? 'We do not guess how much it will improve'
      : basis === 'observed_gap'
        ? 'Measured, not a forecast'
        : 'An estimate, not measured'
  const economicImpactModeled = basis === 'modeled'
  return (
    <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-3">
      <div className="rounded-lg bg-white/80 px-3 py-2.5" style={{ border: '1px solid var(--hairline-light)' }}>
        <p className="break-words text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>{impactLabel}</p>
        <p className="mt-0.5 text-[17px] font-bold tabular-nums" style={{ color: basis === 'observed_gap' ? 'var(--info)' : 'var(--viz-estimate)' }}>{impactValue}</p>
        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{impactDetail}</p>
      </div>
      <div className="rounded-lg bg-white/80 px-3 py-2.5" style={{ border: '1px solid var(--hairline-light)' }}>
        <p className="text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>{basis === 'modeled' ? 'How sure the estimate is' : 'How solid the facts are'}</p>
        <p className="mt-0.5 text-[17px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{formatConfidence(action.expectedImpact.confidence)}</p>
        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{basis === 'modeled' ? 'Confidence in the estimate' : 'Enough facts to act on'}</p>
      </div>
      <div className="rounded-lg bg-white/80 px-3 py-2.5" style={{ border: '1px solid var(--hairline-light)' }}>
        <p className="text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>{economicImpactModeled ? 'Expected profit over 7 days' : 'Money impact'}</p>
        <p className="mt-0.5 text-[17px] font-bold tabular-nums" style={{ color: 'var(--viz-estimate)' }}>
          {economicImpactModeled
            ? `${profit < 0 ? '−' : profit > 0 ? '+' : ''}${formatInr(Math.abs(profit))}`
            : 'Not estimated'}
        </p>
        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{economicImpactModeled ? 'An estimate, not measured' : 'We make no money claim for this goal'}</p>
      </div>
    </div>
  )
}

function RecommendationSection({
  review,
  safetyHold,
}: {
  review?: IntelligenceReviewResult
  safetyHold: boolean
}) {
  const recommendation = review?.recommendation
  if (!recommendation) {
    return (
      <article className="card-inset p-4" aria-label="The suggested change">
        <div className="flex items-center gap-2">
          <LockKeyhole size={16} style={{ color: 'var(--ink-3)' }} aria-hidden="true" />
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            The suggested change
          </h3>
        </div>
        <p className="mt-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          No change was suggested for this check.
        </p>
      </article>
    )
  }

  const action = recommendation.action
  const parameters = Object.entries(action.parameters)

  return (
    <article
      className="card-inset p-4 sm:p-5"
      style={{
        background: safetyHold ? 'var(--warn-bg)' : 'var(--accent-soft)',
        borderColor: safetyHold ? 'var(--warn-border)' : 'var(--accent-border)',
      }}
      aria-label="The suggested change"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LockKeyhole size={16} style={{ color: safetyHold ? 'var(--warn)' : 'var(--accent)' }} aria-hidden="true" />
            <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
              The suggested change
            </h3>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
            The AI can agree, ask to wait, or advise against it — it cannot change it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`chip ${toneChip(plainStatus('risk', action.risk).tone)}`} title={plainStatus('risk', action.risk).meaning || undefined}>
            {plainStatus('risk', action.risk).label}
          </span>
          {action.requiresHumanApproval && <span className="chip chip-neutral">Needs your approval</span>}
          {action.gatedBy.length > 0 && <span className="chip chip-warn">{action.gatedBy.length} {action.gatedBy.length === 1 ? 'check' : 'checks'} holding it</span>}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[17px] font-bold" style={{ color: 'var(--ink)' }}>{plainStatus('actionType', action.type).label}</p>
        <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          Applies to one {levelLabel(action.targetType).toLowerCase()}
        </p>
        <p className="mt-2 max-w-4xl break-words text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {recommendation.interpretation}
        </p>
        <Details title="Details" reference={action.targetId} />
      </div>

      <RecommendationMetrics action={action} />

      {parameters.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-2">
          {parameters.map(([key, value]) => (
            <div key={key} className="min-w-0 break-words rounded-lg bg-white/80 px-2.5 py-1.5 text-[11px]" style={{ border: '1px solid var(--hairline-light)' }}>
              <dt className="inline font-semibold" style={{ color: 'var(--ink-3)' }}>{plainLabel(key)}: </dt>
              <dd className="inline" style={{ color: 'var(--ink)' }}>{formatParameter(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {action.gatedBy.length > 0 && (
        <div className="mt-3 rounded-lg bg-white/80 px-3 py-2.5" style={{ border: '1px solid var(--warn-border)' }}>
          <p className="text-[11px] font-semibold" style={{ color: 'var(--warn)' }}>Not done yet — waiting on these checks</p>
          <p className="mt-1 text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
            {action.gatedBy.map(plainLabel).join(' · ')}
          </p>
        </div>
      )}
    </article>
  )
}

function BaselineSummary({ baseline }: { baseline?: IntelligenceReviewBaseline }) {
  if (!baseline || baseline.value === null) {
    return (
      <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
        <p className="text-[10.5px] font-semibold" style={{ color: 'var(--warn)' }}>No starting point recorded</p>
        <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-2)' }}>We can&apos;t say for sure whether the change helped until the &ldquo;before&rdquo; numbers are saved.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[10.5px] font-semibold" style={{ color: 'var(--info)' }}>Starting point (before the change)</p>
          <p className="mt-0.5 text-[15px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {plainLabel(baseline.metric)} · {formatEvidenceValue(baseline.value, baseline.unit)}
          </p>
        </div>
        <span className="text-[10px]" style={{ color: 'var(--ink-3)' }}>
          {formatTimestamp(baseline.capturedAt)}
        </span>
      </div>
      {baseline.evidenceRef && <EvidenceRefs refs={[baseline.evidenceRef]} />}
    </div>
  )
}

function ValidationColumn({
  horizon,
  checks,
}: {
  horizon: '24h' | '72h'
  checks: IntelligenceReviewValidationCheck[]
}) {
  return (
    <div className="card-inset p-3.5">
      <div className="flex items-center gap-2">
        <Clock3 size={15} style={{ color: 'var(--accent)' }} aria-hidden="true" />
        <h4 className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>{horizon === '24h' ? 'After 1 day' : 'After 3 days'}</h4>
      </div>
      {checks.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {checks.map((item, index) => (
            <li key={`${item.metric}:${index}`} className="flex items-start gap-2">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--info)' }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>{plainLabel(item.metric)}</p>
                <p className="mt-0.5 break-words text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{item.check}</p>
                <EvidenceRefs refs={item.evidenceRefs} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>Nothing planned to check.</p>
      )}
    </div>
  )
}

function ValidationSection({
  review,
  evidence,
}: {
  review?: IntelligenceReviewResult
  evidence?: IntelligenceReviewEvidenceBundle
}) {
  return (
    <article className="card-inset p-4 sm:p-5" aria-label="How we will check it worked">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={16} style={{ color: 'var(--brand-secondary)' }} aria-hidden="true" />
            <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
              How we will check it worked
            </h3>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
            The numbers before the change, then a check after 1 day and after 3 days.
          </p>
        </div>
        <span className="chip chip-neutral">Follow-up plan</span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <BaselineSummary baseline={evidence?.baseline} />
        <ValidationColumn horizon="24h" checks={review?.validationPlan.after24h ?? []} />
        <ValidationColumn horizon="72h" checks={review?.validationPlan.after72h ?? []} />
      </div>

      <p className="mt-3 text-[10.5px]" style={{ color: 'var(--ink-4)' }}>
        This is the plan for checking, not proof that it worked. We&apos;ll know how accurate the estimate was once the results come in.
      </p>
    </article>
  )
}

function ReviewLoading() {
  return (
    <section className="card overflow-hidden" aria-busy="true" aria-label="Loading the check on this suggestion">
      <div className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="skeleton h-3 w-36" />
            <div className="skeleton mt-3 h-6 w-72 max-w-full" />
          </div>
          <div className="skeleton h-7 w-28 rounded-full" />
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="card-inset p-4">
              <div className="skeleton h-4 w-28" />
              <div className="skeleton mt-4 h-14 w-full" />
              <div className="skeleton mt-2 h-14 w-full" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Checking this suggestion…</span>
    </section>
  )
}

function ReviewPending({ evidence }: { evidence?: IntelligenceReviewEvidenceBundle }) {
  return (
    <section
      className="rounded-lg px-3 py-2.5"
      role="status"
      aria-label="AI check not done yet"
      style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold" style={{ color: 'var(--ink)' }}>The AI hasn&apos;t checked this yet</p>
            <p className="mt-0.5 text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
              You can still see the suggested change. A second opinion from the AI will appear here once it is ready.
            </p>
          </div>
        </div>
        {evidence && (
          <span className="chip chip-info" style={{ fontSize: '9.5px', padding: '1px 7px' }}>
            <Database size={10} aria-hidden="true" /> {evidence.packet.facts.length} facts gathered
          </span>
        )}
      </div>
    </section>
  )
}

export function MeridianReviewPanel({
  review,
  evidence,
  loading = false,
  currentDailyBudget,
}: MeridianReviewPanelProps) {
  if (loading) return <ReviewLoading />
  if (!review) return <ReviewPending evidence={evidence} />

  const verdict = effectiveVerdict(review)
  const presentation = VERDICT_PRESENTATION[verdict]
  const modelFallback = review?.source === 'fallback'
  const fallback = modelFallback
  const invalid = review?.validation.valid === false
  const safetyHold = verdict === 'hold'
  const derivedCount = evidence?.packet.facts.filter((fact) => fact.kind === 'derived').length ?? 0
  const unknownCount = (evidence?.unknowns.length ?? 0) + review.unknowns.length

  return (
    <FounderVerdict review={review} evidence={evidence} currentDailyBudget={currentDailyBudget}>
      {/* Everything below is the audit trail. It lives inside the evidence
          drawer so the card above can stay in plain language. */}
      <div aria-label="The full check" style={{ background: 'var(--surface)' }}>
      <header
        className="px-4 py-4 sm:px-5"
        style={{
          background: fallback
            ? 'linear-gradient(118deg, var(--surface) 0%, var(--warn-bg) 100%)'
            : 'linear-gradient(118deg, var(--surface) 0%, var(--accent-soft) 100%)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-4xl">
            <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--accent-strong)' }}>
              <Bot size={14} aria-hidden="true" />
              The full check
            </div>
            <h2 className="mt-1.5 break-words text-[16px] font-bold leading-snug sm:text-[17px]" style={{ color: 'var(--ink)' }}>
              {review?.headline ?? 'No check is available yet'}
            </h2>
          </div>

          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
            {modelFallback ? (
              <span className="chip chip-warn"><ShieldAlert size={11} aria-hidden="true" /> AI unavailable · held back</span>
            ) : review ? (
              <span className="chip chip-accent"><Sparkles size={11} aria-hidden="true" /> Checked by AI</span>
            ) : (
              <span className="chip chip-neutral">Not checked</span>
            )}
            {review && !fallback && !invalid && (
              <span className="chip chip-good"><ShieldCheck size={11} aria-hidden="true" /> Passed our checks</span>
            )}
            {invalid && (
              <span className="chip chip-warn"><ShieldAlert size={11} aria-hidden="true" /> Failed our checks</span>
            )}
          </div>
        </div>

        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
          role="status"
          style={{
            color: presentation.color,
            background: presentation.background,
            border: `1px solid ${presentation.border}`,
          }}
        >
          <div className="flex min-w-0 items-center gap-2 font-semibold">
            <VerdictIcon verdict={verdict} />
            <span className="text-[12.5px]">{presentation.label}</span>
          </div>
          {review && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
              <span>Goal: {plainStatus('objective', review.goal.objective).label}</span>
              <span aria-hidden="true">·</span>
              <span>Main measure: {plainLabel(review.goal.primaryKPI).toLowerCase()}</span>
              {review.goal.optimizationGoal && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Meta aims for: {plainLabel(review.goal.optimizationGoal).toLowerCase()}
                  </span>
                </>
              )}
              {review.goal.optimizationMetric && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Judged on: {plainLabel(review.goal.optimizationMetric).toLowerCase()}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>
            <Database size={12} aria-hidden="true" /> What was looked at
          </span>
          <CompactEvidencePath evidence={evidence} />
        </div>
      </header>

      <details className="group" open>
        <summary
          className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 sm:px-5"
          style={{ color: 'var(--ink-2)', background: 'var(--surface-warm)', borderTop: '1px solid var(--hairline-light)', listStyle: 'none' }}
        >
          <span className="flex items-center gap-2 text-[12px] font-semibold">
            <ChevronRight size={14} className="transition-transform group-open:rotate-90" aria-hidden="true" />
            See the facts and the follow-up plan
          </span>
          <span className="flex flex-wrap justify-end gap-1.5">
            <span className="chip chip-info" style={{ fontSize: '9.5px', padding: '1px 7px' }}>{review.observedFacts.length} facts</span>
            <span className="chip chip-neutral" style={{ fontSize: '9.5px', padding: '1px 7px' }}>{derivedCount} worked out</span>
            {unknownCount > 0 && <span className="chip chip-warn" style={{ fontSize: '9.5px', padding: '1px 7px' }}>{unknownCount} not known</span>}
          </span>
        </summary>

        <HierarchyStrip evidence={evidence} />

        <div className="space-y-4 p-4 sm:p-5">
          <p className="max-w-4xl break-words text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {review.summary}
          </p>

          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            <ObservedSection review={review} evidence={evidence} />
            <DerivedSection evidence={evidence} />
            <InterpretationSection review={review} />
            <UnknownsSection review={review} evidence={evidence} />
          </div>

          <RecommendationSection review={review} safetyHold={safetyHold} />
          <ValidationSection review={review} evidence={evidence} />
        </div>

        <footer
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[10.5px] sm:px-5"
          style={{ color: 'var(--ink-3)', background: 'var(--surface-warm)', borderTop: '1px solid var(--hairline-light)' }}
        >
          <span className="min-w-0">The facts, the sums and the suggested change come from your data — the AI cannot edit them.</span>
          <span className="flex flex-wrap items-center gap-2">
            <span>Checked {formatTimestamp(review.generatedAt)}</span>
            {invalid && <span>{review.validation.issues.length} {review.validation.issues.length === 1 ? 'problem' : 'problems'} found in the AI&apos;s answer</span>}
          </span>
        </footer>
        {(review.model || review.inputHash) && (
          <div className="px-4 pb-3 sm:px-5" style={{ background: 'var(--surface-warm)' }}>
            <Details
              title="Technical details"
              reference={review.inputHash ?? null}
              items={review.model ? [{ label: 'AI model', value: review.model }] : []}
            />
          </div>
        )}
      </details>
      </div>
    </FounderVerdict>
  )
}
