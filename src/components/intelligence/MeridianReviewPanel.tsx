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
    label: 'Evidence supports review',
    color: 'var(--good)',
    background: 'var(--good-bg)',
    border: 'var(--good-border)',
  },
  hold: {
    label: 'Safety hold',
    color: 'var(--warn)',
    background: 'var(--warn-bg)',
    border: 'var(--warn-border)',
  },
  reject: {
    label: 'Evidence rejects action',
    color: 'var(--bad)',
    background: 'var(--bad-bg)',
    border: 'var(--bad-border)',
  },
  unavailable: {
    label: 'Review unavailable',
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
  const words = value.replaceAll('_', ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Unavailable'
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return `${new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date)} UTC`
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
    return `₹${Math.round(value).toLocaleString('en-IN')}`
  }
  if (normalizedUnit === 'percent' || normalizedUnit === '%') {
    return `${Math.round(value * 10) / 10}%`
  }
  if (normalizedUnit === 'ratio' || normalizedUnit === 'x') {
    return `${value.toFixed(2)}x`
  }
  return `${value.toLocaleString('en-IN')}${unit ? ` ${unit}` : ''}`
}

function formatParameter(value: unknown): string {
  if (value === null || value === undefined) return 'Unavailable'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString('en-IN')
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(formatParameter).join(', ')
  return 'Structured configuration preserved'
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
          Evidence path
        </p>
        {coverage && (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]" style={{ color: 'var(--ink-3)' }}>
            <span>{coverage.adSetsIncluded}/{coverage.adSetsTotal} ad sets</span>
            <span aria-hidden="true">·</span>
            <span>{coverage.adsIncluded}/{coverage.adsTotal} ads</span>
            {coverage.truncated && <span className="chip chip-warn" style={{ fontSize: '9px', padding: '0 6px' }}>Focused sample</span>}
          </div>
        )}
      </div>
      <ol className="flex flex-wrap items-center gap-2" aria-label="Campaign diagnosis hierarchy">
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
                  {node.level === 'adset' ? 'Ad set' : plainLabel(node.level)}
                </div>
                <div className="mt-0.5 flex max-w-[240px] items-baseline gap-2">
                  <span className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }} title={node.name}>
                    {node.name}
                  </span>
                  {target && <span className="chip chip-accent" style={{ fontSize: '9px', padding: '0 6px' }}>Target</span>}
                  {unresolved && <span className="chip chip-warn" style={{ fontSize: '9px', padding: '0 6px' }}>Unresolved</span>}
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
            <span key={`${node.level}:${node.id}`} className={`chip ${node.resolution === 'unresolved' ? 'chip-warn' : 'chip-neutral'}`} title={node.name}>
              {node.level === 'adset' ? 'Ad set' : plainLabel(node.level)} · {node.name}
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
        Evidence hierarchy unavailable
      </span>
    )
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Evidence path summary">
      {path.map((node, index) => (
        <div key={`${node.level}:${node.id}`} className="contents">
          {index > 0 && <ArrowRight size={11} style={{ color: 'var(--ink-4)' }} aria-hidden="true" />}
          <span
            className={`chip ${node.role === 'action_target' ? 'chip-accent' : node.resolution === 'unresolved' ? 'chip-warn' : 'chip-neutral'}`}
            style={{ fontSize: '9.5px', padding: '1px 7px' }}
            title={`${plainLabel(node.level)}: ${node.name}`}
          >
            {node.level === 'adset' ? 'Ad set' : plainLabel(node.level)} · {node.name}
          </span>
        </div>
      ))}
    </div>
  )
}

function EvidenceRef({ value }: { value: string }) {
  return (
    <span
      className="inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 font-mono text-[9.5px]"
      style={{ color: 'var(--ink-3)', background: 'var(--muted)' }}
      title={value}
    >
      {value}
    </span>
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
      aria-label="Observed evidence"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye size={16} style={{ color: 'var(--info)' }} aria-hidden="true" />
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            Observed
          </h3>
        </div>
        <span className="chip chip-info" style={{ fontSize: '10px', padding: '1px 7px' }}>
          {observed.length} recorded
        </span>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
        Allow-listed facts copied from recorded evidence.
      </p>

      {observed.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {observed.map((fact) => {
            const sourceFact = factsByRef.get(fact.evidenceRef)
            return (
              <li key={fact.evidenceRef} className="rounded-lg bg-white/75 px-3 py-2.5" style={{ border: '1px solid var(--info-border)' }}>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                  {fact.statement}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <EvidenceRef value={fact.evidenceRef} />
                  {sourceFact && (
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--info)' }}>
                      Step {sourceFact.step} · {plainLabel(sourceFact.source)}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-white/75 px-3 py-3 text-[12px]" style={{ color: 'var(--ink-3)', border: '1px solid var(--info-border)' }}>
          No verified observed facts were supplied with this review.
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
      aria-label="Rule-derived evidence"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity size={16} style={{ color: 'var(--brand-secondary)' }} aria-hidden="true" />
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            Rule-derived
          </h3>
        </div>
        <span className="chip chip-neutral" style={{ fontSize: '10px', padding: '1px 7px' }}>
          {derived.length} calculated
        </span>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
        Deterministic calculations kept separate from recorded facts.
      </p>

      {derived.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {derived.map((fact) => (
            <li key={fact.ref} className="rounded-lg bg-white/75 px-3 py-2.5" style={{ border: '1px solid var(--hairline-light)' }}>
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                {fact.statement}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <EvidenceRef value={fact.ref} />
                <span className="text-[10px] font-semibold" style={{ color: 'var(--brand-secondary)' }}>
                  Step {fact.step} · {plainLabel(fact.source)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-white/75 px-3 py-3 text-[12px]" style={{ color: 'var(--ink-3)', border: '1px solid var(--hairline-light)' }}>
          No deterministic derived facts were supplied with this review.
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
      aria-label={fallback ? 'Interpretation withheld' : 'OpenAI interpretation'}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {fallback ? (
            <ShieldAlert size={16} style={{ color: 'var(--warn)' }} aria-hidden="true" />
          ) : (
            <Sparkles size={16} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          )}
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            {fallback ? 'Interpretation withheld' : 'OpenAI interpretation'}
          </h3>
        </div>
        <span className={`chip ${fallback ? 'chip-warn' : 'chip-accent'}`} style={{ fontSize: '10px', padding: '1px 7px' }}>
          Not causal proof
        </span>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
        {fallback
          ? 'No model-authored explanation is accepted in fallback mode.'
          : 'Bounded hypotheses grounded only in the referenced evidence.'}
      </p>

      {fallback ? (
        <div className="mt-3 rounded-lg bg-white/75 px-3 py-3" style={{ border: '1px solid var(--warn-border)' }}>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--warn)' }}>
            Deterministic safety hold
          </p>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            The recommendation is preserved unchanged, but OpenAI has not endorsed or interpreted it.
          </p>
        </div>
      ) : hypotheses.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {hypotheses.map((hypothesis, index) => (
            <li key={`${hypothesis.statement}:${index}`} className="rounded-lg bg-white/75 px-3 py-2.5" style={{ border: '1px solid var(--accent-border)' }}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                  {hypothesis.statement}
                </p>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: 'var(--accent-strong)' }}>
                  {formatConfidence(hypothesis.confidence)}
                </span>
              </div>
              {(hypothesis.evidenceRefs.length > 0 || hypothesis.counterevidenceRefs.length > 0) && (
                <div className="mt-2 space-y-1.5">
                  {hypothesis.evidenceRefs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>Supports</span>
                      {hypothesis.evidenceRefs.map((ref) => <EvidenceRef key={ref} value={ref} />)}
                    </div>
                  )}
                  {hypothesis.counterevidenceRefs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9.5px] font-semibold" style={{ color: 'var(--warn)' }}>Challenges</span>
                      {hypothesis.counterevidenceRefs.map((ref) => <EvidenceRef key={ref} value={ref} />)}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-white/75 px-3 py-3 text-[12px]" style={{ color: 'var(--ink-3)', border: '1px solid var(--accent-border)' }}>
          No interpretation hypotheses were returned.
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
      aria-label="Unknown and withheld evidence"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} style={{ color: 'var(--warn)' }} aria-hidden="true" />
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            Unknown / withheld
          </h3>
        </div>
        <span className="chip chip-warn" style={{ fontSize: '10px', padding: '1px 7px' }}>
          {count} open
        </span>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
        Missing evidence stays visible and cannot become a claim.
      </p>

      {count > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {deterministic.map((item) => (
            <li key={item.code} className="rounded-lg bg-white/75 px-3 py-2.5" style={{ border: '1px solid var(--warn-border)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>{item.statement}</p>
                <span className="chip chip-warn" style={{ fontSize: '9px', padding: '0 6px' }}>
                  {plainLabel(item.effect)}
                </span>
              </div>
              <p className="mt-1.5 font-mono text-[9.5px]" style={{ color: 'var(--warn)' }}>{item.code}</p>
            </li>
          ))}
          {reviewerUnknowns.map((item, index) => (
            <li key={`${item.question}:${index}`} className="rounded-lg bg-white/75 px-3 py-2.5" style={{ border: '1px solid var(--warn-border)' }}>
              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>{item.question}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{item.whyItMatters}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-white/75 px-3 py-3 text-[12px]" style={{ color: 'var(--ink-3)', border: '1px solid var(--warn-border)' }}>
          No unknowns were listed in this payload.
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
      ? `Validation metric · ${plainLabel(action.expectedImpact.metric).toLowerCase()}`
      : basis === 'observed_gap'
        ? `Observed peer gap · ${plainLabel(action.expectedImpact.metric).toLowerCase()}`
        : `Modeled ${plainLabel(action.expectedImpact.metric).toLowerCase()}`
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
      ? 'Uplift intentionally not estimated'
      : basis === 'observed_gap'
        ? 'Measured evidence, not a forecast'
        : 'Estimate, not observed'
  const economicImpactModeled = basis === 'modeled'
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      <div className="rounded-lg bg-white/80 px-3 py-2.5" style={{ border: '1px solid var(--hairline-light)' }}>
        <p className="text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>{impactLabel}</p>
        <p className="mt-0.5 text-[17px] font-bold tabular-nums" style={{ color: basis === 'observed_gap' ? 'var(--info)' : 'var(--viz-estimate)' }}>{impactValue}</p>
        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{impactDetail}</p>
      </div>
      <div className="rounded-lg bg-white/80 px-3 py-2.5" style={{ border: '1px solid var(--hairline-light)' }}>
        <p className="text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>{basis === 'modeled' ? 'Model confidence' : 'Evidence confidence'}</p>
        <p className="mt-0.5 text-[17px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{formatConfidence(action.expectedImpact.confidence)}</p>
        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{basis === 'modeled' ? 'Prediction confidence' : 'Rule evidence readiness'}</p>
      </div>
      <div className="rounded-lg bg-white/80 px-3 py-2.5" style={{ border: '1px solid var(--hairline-light)' }}>
        <p className="text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>{economicImpactModeled ? 'Modeled 7-day contribution' : 'Economic impact'}</p>
        <p className="mt-0.5 text-[17px] font-bold tabular-nums" style={{ color: 'var(--viz-estimate)' }}>
          {economicImpactModeled
            ? `${profit < 0 ? '−' : profit > 0 ? '+' : ''}₹${Math.abs(Math.round(profit)).toLocaleString('en-IN')}`
            : 'Withheld'}
        </p>
        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{economicImpactModeled ? 'Estimate, not observed' : 'No financial claim for this goal'}</p>
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
      <article className="card-inset p-4" aria-label="Immutable recommendation">
        <div className="flex items-center gap-2">
          <LockKeyhole size={16} style={{ color: 'var(--ink-3)' }} aria-hidden="true" />
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            Immutable recommendation
          </h3>
        </div>
        <p className="mt-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          No deterministic recommendation was supplied for review.
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
      aria-label="Immutable recommendation"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LockKeyhole size={16} style={{ color: safetyHold ? 'var(--warn)' : 'var(--accent)' }} aria-hidden="true" />
            <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
              Immutable recommendation
            </h3>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
            OpenAI may support, hold, or reject this action. It cannot rewrite it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`chip ${action.risk === 'high' ? 'chip-bad' : action.risk === 'medium' ? 'chip-warn' : 'chip-neutral'}`}>
            {plainLabel(action.risk)} risk
          </span>
          {action.requiresHumanApproval && <span className="chip chip-neutral">Human approval</span>}
          {action.gatedBy.length > 0 && <span className="chip chip-warn">{action.gatedBy.length} gate{action.gatedBy.length === 1 ? '' : 's'}</span>}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[17px] font-bold" style={{ color: 'var(--ink)' }}>{plainLabel(action.type)}</p>
        <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          {action.targetType === 'adset' ? 'Ad set' : plainLabel(action.targetType)} target ·{' '}
          <span className="font-mono">{action.targetId}</span>
        </p>
        <p className="mt-2 max-w-4xl text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {recommendation.interpretation}
        </p>
      </div>

      <RecommendationMetrics action={action} />

      {parameters.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-2">
          {parameters.map(([key, value]) => (
            <div key={key} className="rounded-lg bg-white/80 px-2.5 py-1.5 text-[11px]" style={{ border: '1px solid var(--hairline-light)' }}>
              <dt className="inline font-semibold" style={{ color: 'var(--ink-3)' }}>{plainLabel(key)}: </dt>
              <dd className="inline" style={{ color: 'var(--ink)' }}>{formatParameter(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {action.gatedBy.length > 0 && (
        <div className="mt-3 rounded-lg bg-white/80 px-3 py-2.5" style={{ border: '1px solid var(--warn-border)' }}>
          <p className="text-[11px] font-semibold" style={{ color: 'var(--warn)' }}>Execution remains withheld</p>
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
        <p className="text-[10.5px] font-semibold" style={{ color: 'var(--warn)' }}>Baseline unavailable</p>
        <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-2)' }}>Outcome validation cannot be conclusive until a baseline is recorded.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[10.5px] font-semibold" style={{ color: 'var(--info)' }}>Recorded baseline</p>
          <p className="mt-0.5 text-[15px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {plainLabel(baseline.metric)} · {formatEvidenceValue(baseline.value, baseline.unit)}
          </p>
        </div>
        <span className="text-[10px]" style={{ color: 'var(--ink-3)' }}>
          {formatTimestamp(baseline.capturedAt)}
        </span>
      </div>
      {baseline.evidenceRef && (
        <div className="mt-2 flex flex-wrap gap-1">
          <EvidenceRef value={baseline.evidenceRef} />
        </div>
      )}
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
        <h4 className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>After {horizon}</h4>
      </div>
      {checks.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {checks.map((item, index) => (
            <li key={`${item.metric}:${index}`} className="flex items-start gap-2">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--info)' }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>{plainLabel(item.metric)}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{item.check}</p>
                {item.evidenceRefs.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.evidenceRefs.map((ref) => <EvidenceRef key={ref} value={ref} />)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>No validation check recorded.</p>
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
    <article className="card-inset p-4 sm:p-5" aria-label="24 and 72 hour validation plan">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={16} style={{ color: 'var(--brand-secondary)' }} aria-hidden="true" />
            <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
              Measure after action
            </h3>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
            Baseline, then objective-aware checks at 24 and 72 hours.
          </p>
        </div>
        <span className="chip chip-neutral">Validation plan</span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <BaselineSummary baseline={evidence?.baseline} />
        <ValidationColumn horizon="24h" checks={review?.validationPlan.after24h ?? []} />
        <ValidationColumn horizon="72h" checks={review?.validationPlan.after72h ?? []} />
      </div>

      <p className="mt-3 text-[10.5px]" style={{ color: 'var(--ink-4)' }}>
        This is a measurement contract, not proof of impact. Prediction accuracy remains unavailable until outcomes are recorded against the same action.
      </p>
    </article>
  )
}

function ReviewLoading() {
  return (
    <section className="card overflow-hidden" aria-busy="true" aria-label="Loading Meridian evidence review">
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
      <span className="sr-only">Building the bounded evidence review…</span>
    </section>
  )
}

function ReviewPending({ evidence }: { evidence?: IntelligenceReviewEvidenceBundle }) {
  return (
    <section
      className="rounded-lg px-3 py-2.5"
      role="status"
      aria-label="Bounded OpenAI review pending"
      style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <div>
            <p className="text-[11.5px] font-semibold" style={{ color: 'var(--ink)' }}>Bounded OpenAI review pending</p>
            <p className="mt-0.5 text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
              The deterministic action remains available as the source recommendation; no model verdict is claimed yet.
            </p>
          </div>
        </div>
        {evidence && (
          <span className="chip chip-info" style={{ fontSize: '9.5px', padding: '1px 7px' }}>
            <Database size={10} aria-hidden="true" /> {evidence.packet.facts.length} bounded facts ready
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
      <div aria-label="Meridian evidence review" style={{ background: 'var(--surface)' }}>
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
              Meridian evidence review
            </div>
            <h2 className="mt-1.5 text-[16px] font-bold leading-snug sm:text-[17px]" style={{ color: 'var(--ink)' }}>
              {review?.headline ?? 'No bounded review is available yet'}
            </h2>
          </div>

          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
            {modelFallback ? (
              <span className="chip chip-warn"><ShieldAlert size={11} aria-hidden="true" /> Fallback · safety hold</span>
            ) : review ? (
              <span className="chip chip-accent"><Sparkles size={11} aria-hidden="true" /> OpenAI</span>
            ) : (
              <span className="chip chip-neutral">Source unavailable</span>
            )}
            {review?.model && <span className="chip chip-neutral"><Bot size={11} aria-hidden="true" /> {review.model}</span>}
            {review && !fallback && !invalid && (
              <span className="chip chip-good"><ShieldCheck size={11} aria-hidden="true" /> Validated</span>
            )}
            {invalid && (
              <span className="chip chip-warn"><ShieldAlert size={11} aria-hidden="true" /> Validation held</span>
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
          <div className="flex items-center gap-2 font-semibold">
            <VerdictIcon verdict={verdict} />
            <span className="text-[12.5px]">{presentation.label}</span>
          </div>
          {review && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
              <span>{plainLabel(review.goal.objective)} objective</span>
              <span aria-hidden="true">·</span>
              <span>{plainLabel(review.goal.primaryKPI)} primary KPI</span>
              {review.goal.optimizationGoal && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {plainLabel(review.goal.optimizationGoal)} Meta optimization
                  </span>
                </>
              )}
              {review.goal.optimizationMetric && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {plainLabel(review.goal.optimizationMetric)} evidence metric
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>
            <Database size={12} aria-hidden="true" /> Evidence path
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
            Inspect evidence and validation
          </span>
          <span className="flex flex-wrap justify-end gap-1.5">
            <span className="chip chip-info" style={{ fontSize: '9.5px', padding: '1px 7px' }}>{review.observedFacts.length} observed</span>
            <span className="chip chip-neutral" style={{ fontSize: '9.5px', padding: '1px 7px' }}>{derivedCount} derived</span>
            {unknownCount > 0 && <span className="chip chip-warn" style={{ fontSize: '9.5px', padding: '1px 7px' }}>{unknownCount} unknown</span>}
          </span>
        </summary>

        <HierarchyStrip evidence={evidence} />

        <div className="space-y-4 p-4 sm:p-5">
          <p className="max-w-4xl text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
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
          <span>Recorded facts, deterministic calculations, and immutable action fields stay outside model authorship.</span>
          <span className="flex flex-wrap items-center gap-2">
            <span>{formatTimestamp(review.generatedAt)}</span>
            {invalid && <span>{review.validation.issues.length} validation issue{review.validation.issues.length === 1 ? '' : 's'} withheld</span>}
            {review?.inputHash && (
              <span className="font-mono" title={review.inputHash}>Input {review.inputHash.slice(0, 10)}</span>
            )}
          </span>
        </footer>
      </details>
      </div>
    </FounderVerdict>
  )
}
