'use client'

import { use, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react'
import { formatCurrency, plainLabel } from '@/lib/utils'
import {
  getIntelligenceDecisions,
  getIntelligenceDecisionsSummary,
  approveIntelligenceDecision,
  rejectIntelligenceDecision,
  primeIntelligence,
  getIntelligenceCycles,
  getDecisionTrace,
  getCycleTrace,
  getCampaigns,
  DecisionsSummary,
  IntelligenceCycle,
  DecisionTraceStep,
} from '@/lib/api'
import type {
  Campaign,
  IntelligenceDecision,
  IntelligenceDecisionStatus,
} from '@/types'
import { IntelligenceCenterNav } from '@/components/intelligence/IntelligenceCenterNav'
import { MeridianReviewPanel } from '@/components/intelligence/MeridianReviewPanel'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

interface Toast {
  kind: 'success' | 'error'
  text: string
}

function hasGoalAwareContract(
  decision: IntelligenceDecision | undefined,
): decision is IntelligenceDecision & {
  decisionContractVersion: 'goal_aware_v1'
  objective: string
  primaryKPI: string
  expectedImpact: {
    metric: string
    deltaPct: number
    confidence: number
    basis?: 'modeled' | 'observed_gap' | 'not_estimated'
    currentValue?: number
    siblingBaselineValue?: number
    observedGapPct?: number
  }
} {
  return Boolean(
    decision?.decisionContractVersion === 'goal_aware_v1' &&
      decision.objective &&
      decision.primaryKPI &&
      decision.expectedImpact?.metric &&
      Number.isFinite(decision.expectedImpact.deltaPct) &&
      Number.isFinite(decision.expectedImpact.confidence),
  )
}

function impactCopy(impact: NonNullable<IntelligenceDecision['expectedImpact']>): {
  label: string
  value: string
  detail: string
} {
  const metric = plainLabel(impact.metric)
  if (impact.basis === 'not_estimated') {
    return {
      label: `Validation metric · ${metric}`,
      value:
        typeof impact.currentValue === 'number'
          ? impact.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })
          : 'Measure next',
      detail: 'Observed baseline · uplift not estimated',
    }
  }
  if (impact.basis === 'observed_gap') {
    const gap = impact.observedGapPct ?? impact.deltaPct
    return {
      label: `Observed peer gap · ${metric}`,
      value: formatModeledDelta(gap),
      detail: 'Measured comparison · not promised uplift',
    }
  }
  return {
    label: `Modeled ${metric} change`,
    value: formatModeledDelta(impact.deltaPct),
    detail: `${Math.round(impact.confidence * 100)}% confidence · model estimate`,
  }
}

function approvalImpactCopy(impact: NonNullable<IntelligenceDecision['expectedImpact']>): string {
  if (impact.basis === 'not_estimated') {
    return `${plainLabel(impact.metric)} is the validation metric; no causal uplift is estimated before measurement.`
  }
  if (impact.basis === 'observed_gap') {
    return `The ${formatModeledDelta(impact.observedGapPct ?? impact.deltaPct)} ${plainLabel(impact.metric)} figure is an observed peer gap, not a promised result.`
  }
  return `Its ${formatModeledDelta(impact.deltaPct)} ${plainLabel(impact.metric)} impact is a model estimate, not a guaranteed result.`
}

interface ExecutionReviewGate {
  allowed: boolean
  label: string
  reason: string
}

/**
 * Fresh goal-aware decisions are executable only after the bounded OpenAI
 * critic has supported the immutable action and its server-side validation
 * has passed. Historical records keep their previous operator flow because
 * they predate this persisted review contract.
 */
function getExecutionReviewGate(decision: IntelligenceDecision): ExecutionReviewGate {
  if (!decision.decisionContractVersion) {
    return {
      allowed: true,
      label: 'Legacy operator review',
      reason: 'This historical decision predates the OpenAI evidence-review contract.',
    }
  }
  if (decision.decisionContractVersion !== 'goal_aware_v1') {
    return {
      allowed: false,
      label: 'Unsupported decision contract',
      reason: 'Execution stays locked because this decision contract is not recognized by the current review gate.',
    }
  }

  const review = decision.intelligenceReview
  if (!review) {
    return {
      allowed: false,
      label: 'OpenAI review pending',
      reason: 'Execution stays locked until a persisted OpenAI evidence review is available.',
    }
  }
  if (review.source !== 'openai') {
    return {
      allowed: false,
      label: 'OpenAI review unavailable',
      reason: 'A deterministic fallback can explain the hold, but it cannot authorize execution.',
    }
  }
  if (review.validation.valid !== true) {
    return {
      allowed: false,
      label: 'Evidence validation held',
      reason: 'The OpenAI response did not pass the deterministic evidence validator.',
    }
  }
  if (review.verdict === 'hold') {
    return {
      allowed: false,
      label: 'Action held by review',
      reason: 'OpenAI found insufficient evidence to support this action.',
    }
  }
  if (review.verdict === 'reject') {
    return {
      allowed: false,
      label: 'Action rejected by review',
      reason: 'OpenAI found that the bounded evidence does not support this action.',
    }
  }
  if (review.verdict !== 'support') {
    return {
      allowed: false,
      label: 'Review state unavailable',
      reason: 'No supported execution verdict is recorded.',
    }
  }

  return {
    allowed: true,
    label: 'Supported for operator approval',
    reason: 'OpenAI supports the immutable action and deterministic validation passed.',
  }
}

function formatModeledDelta(deltaPct: number): string {
  const rounded = Math.round(Math.abs(deltaPct) * 10) / 10
  if (rounded === 0) return '0%'
  return `${deltaPct > 0 ? '+' : '−'}${rounded}%`
}

// Human-friendly labels for the action-type enums the backend emits.
const ACTION_LABEL: Record<string, string> = {
  pause_ad: 'Stop the ad',
  pause_adset: 'Stop the ad group',
  scale_adset: 'Increase budget',
  replace_creative: 'Refresh the creative',
  add_creative: 'Add a new creative',
  add_adset: 'Launch a new ad group',
  shift_budget_between_adsets: 'Reshuffle budget',
  reduce_total_budget: 'Lower the budget',
  narrow_placement: 'Focus placements',
  dayparting: 'Restrict active hours',
}

// One-line "what will actually change" description under each option.
const ACTION_EFFECT: Record<string, string> = {
  pause_ad: 'Stops delivery on the specific ad — spend goes to zero immediately.',
  pause_adset: 'Stops delivery on the whole ad group — spend goes to zero immediately.',
  scale_adset: 'Raises the daily budget so more people are reached.',
  replace_creative: 'Swaps the current image/video for a fresh one.',
  add_creative: 'Adds a new creative variant alongside the current ones.',
  add_adset: 'Creates a new ad group targeting a fresh audience.',
  shift_budget_between_adsets: 'Moves spend from the weakest ad group to the strongest.',
  reduce_total_budget: 'Lowers the daily budget without stopping delivery.',
  narrow_placement: 'Restricts delivery to the placements that actually convert.',
  dayparting: 'Runs ads only during the hours that actually convert.',
}

// Describes how big the change is, never whether it is a good idea — the
// verdict does that. "Safe to try" read as an endorsement and could sit in
// green directly above a review saying "wait before doing this".
const RISK_LABEL: Record<string, string> = {
  low: 'Small change',
  medium: 'Moderate change',
  high: 'Big change',
}

/** How each success metric is described to a non-technical operator. */
const KPI_PHRASE: Record<string, string> = {
  roas: 'how much money comes back for every ₹1 spent',
  cpa: 'what each sale costs to win',
  cpc: 'what each click costs',
  cpm: 'what it costs to reach 1,000 people',
  ctr: 'how often people click the ad',
  cvr: 'how often clicks turn into sales',
  reach: 'how many different people see the ad',
  frequency: 'how often the same person sees the ad',
}

function kpiPhrase(kpi: string): string {
  return KPI_PHRASE[kpi?.toLowerCase()] ?? plainLabel(kpi)
}

const RISK_STYLE: Record<string, string> = {
  low: 'chip-good',
  medium: 'chip-warn',
  high: 'chip-bad',
}

function hoursLeft(iso: string): { hours: number; minutes: number; expired: boolean } {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return { hours: 0, minutes: 0, expired: true }
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  return { hours, minutes, expired: false }
}

function relativeTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// Strip **bold** markdown + backend jargon so the evidence chain reads clean.
function cleanText(s: string): string {
  return (
    s
      // strip **bold** markers
      .replace(/\*\*(.+?)\*\*/g, '$1')
      // "Top hypothesis: X (confidence 5%, focus=creative)." → "X"
      .replace(/Top hypothesis:\s*([^(]+?)\s*\(confidence[^)]*\)\.?/gi, '$1.')
      // "Leak diagnosis: chronic_unprofitable" → "Type: chronic unprofitable"
      .replace(/Leak diagnosis:\s*([a-z_]+)/gi, (_, k: string) =>
        `Type: ${k.replace(/_/g, ' ')}`,
      )
      // dangling snake_case ids
      .replace(/\b([a-z]+_[a-z_]+)\b/g, (m) => m.replace(/_/g, ' '))
      .trim()
  )
}

/**
 * Extract the campaign name from the decision's reasoning paragraph.
 * The reasoning is written as: "The agent recommends X on <name>. <name> is running…"
 * so the token after " on " up to the first "." is the campaign name.
 * Falls back to the target/campaign id if the pattern isn't found.
 */
function extractCampaignName(d: IntelligenceDecision): string {
  if (d.campaignName?.trim()) return d.campaignName.trim()
  const m = d.reasoning.match(/ on ([^.]+?)\./)
  if (m?.[1]) return m[1].trim()
  return d.targetId && d.targetId !== 'unknown' ? d.targetId : 'Campaign'
}

// Split the reasoning into (headline sentence, condition sentence, mechanics sentence).
function splitReasoning(text: string): { intro: string; condition: string; effect: string } {
  const parts = cleanText(text).split(/(?<=\.) +/)
  return {
    intro: parts[0] ?? text,
    condition: parts[1] ?? '',
    effect: parts.slice(2).join(' '),
  }
}

interface CampaignBucket {
  campaignId: string
  campaignName: string
  metaCampaignId?: string
  decisions: IntelligenceDecision[]
  modeledImpactINR: number
  createdAtNewest: string
  status: 'below_break_even' | 'near_break_even' | 'above_break_even' | 'unscored'
}

function bucketByCampaign(decisions: IntelligenceDecision[]): CampaignBucket[] {
  const buckets = new Map<string, CampaignBucket>()
  for (const d of decisions) {
    const key = d.campaignId
    let b = buckets.get(key)
    if (!b) {
      const name = extractCampaignName(d)
      b = {
        campaignId: key,
        campaignName: name,
        metaCampaignId: d.metaCampaignId,
        decisions: [],
        modeledImpactINR: 0,
        createdAtNewest: d.createdAt,
        // Decision records do not yet persist objective, optimization goal or
        // return basis, so a ROAS/breakeven verdict would be unsafe here.
        status: 'unscored',
      }
      buckets.set(key, b)
    }
    b.decisions.push(d)
    // Alternative actions share the same forecast — keep the largest modeled
    // change, including its sign, rather than adding mutually exclusive plans.
    if (Math.abs(d.expectedProfitDeltaINR7d) > Math.abs(b.modeledImpactINR)) {
      b.modeledImpactINR = d.expectedProfitDeltaINR7d
    }
    if (d.createdAt > b.createdAtNewest) b.createdAtNewest = d.createdAt
  }
  // The legacy economic forecast is not proof-safe, so recency—not modeled
  // impact—determines the operator review order.
  return Array.from(buckets.values()).sort(
    (a, b) => b.createdAtNewest.localeCompare(a.createdAtNewest),
  )
}

export default function ProposedActionsPage({ params }: PageProps) {
  const { tenantId } = use(params)
  const searchParams = useSearchParams()
  // URL filters — set by links from campaigns list + campaign detail.
  //   ?campaignId=<id>  → only decisions on that campaign
  //   ?scope=campaign   → only targetType=campaign
  //   ?scope=adset      → only targetType=adset
  //   ?targetId=<id>    → only decisions with that exact target (Meta adset/ad id)
  const filterCampaignId = searchParams.get('campaignId') ?? ''
  const filterScope = searchParams.get('scope') ?? ''
  const filterTargetId = searchParams.get('targetId') ?? ''
  const isFiltered = Boolean(filterCampaignId || filterScope || filterTargetId)

  const [decisions, setDecisions] = useState<IntelligenceDecision[]>([])
  const [summary, setSummary] = useState<DecisionsSummary | null>(null)
  const [cycles, setCycles] = useState<IntelligenceCycle[]>([])
  const [budgetByCampaign, setBudgetByCampaign] = useState<Record<string, number>>({})
  const [tab, setTab] = useState<IntelligenceDecisionStatus>('shadow_review')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [priming, setPriming] = useState(false)
  const [approvalTarget, setApprovalTarget] = useState<IntelligenceDecision | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [now, setNow] = useState(Date.now())

  const flash = useCallback((kind: Toast['kind'], text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Campaigns are best-effort: they only supply the live daily budget so a
      // "cut by 20%" can also be shown in rupees. A failure here must never
      // block the recommendations themselves.
      const [list, sum, cyc, camps] = await Promise.all([
        getIntelligenceDecisions(tenantId, { status: tab, limit: 200 }),
        getIntelligenceDecisionsSummary(tenantId).catch(() => null),
        getIntelligenceCycles(tenantId, { limit: 50 }).catch(() => null),
        getCampaigns(tenantId).catch(() => [] as Campaign[]),
      ])
      setDecisions(list.decisions)
      setSummary(sum)
      setCycles(cyc?.cycles ?? [])
      setBudgetByCampaign(
        Object.fromEntries(
          (camps ?? [])
            .filter((c) => typeof c.budget === 'number' && c.budget > 0)
            .map((c) => [c._id, c.budget as number]),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tenantId, tab])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  void now

  async function handleApprove(d: IntelligenceDecision) {
    const reviewGate = getExecutionReviewGate(d)
    if (!reviewGate.allowed) {
      flash('error', reviewGate.reason)
      setApprovalTarget(null)
      return
    }
    setBusyId(d._id)
    try {
      const result = await approveIntelligenceDecision(tenantId, d._id)
      if (result.executed) {
        flash('success', 'Approved and applied to the live Meta campaign.')
      } else {
        flash(
          'error',
          result.executionError
            ? `Approval was recorded, but Meta could not apply it: ${result.executionError}`
            : 'Approval was recorded, but Meta did not confirm execution.',
        )
      }
      setApprovalTarget(null)
      await load()
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Approve failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(d: IntelligenceDecision) {
    if (!rejectReason.trim()) {
      flash('error', 'Give a short reason so the agent can learn.')
      return
    }
    setBusyId(d._id)
    try {
      await rejectIntelligenceDecision(tenantId, d._id, {
        reason: rejectReason.trim(),
      })
      flash('success', 'Rejected. Feedback saved for the learning engine.')
      setRejectingId(null)
      setRejectReason('')
      await load()
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePrimeNow() {
    setPriming(true)
    try {
      const res = await primeIntelligence(tenantId, {
        skipSync: true,
        maxCampaigns: 10,
      })
      flash('success', `${res.message} (${res.totalDecisions} new)`)
      await load()
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Run failed')
    } finally {
      setPriming(false)
    }
  }

  const visibleDecisions = useMemo(() => {
    if (!isFiltered) return decisions
    return decisions.filter((d) => {
      if (filterCampaignId && d.campaignId !== filterCampaignId) return false
      if (filterTargetId && d.targetId !== filterTargetId) return false
      if (filterScope && d.targetType !== filterScope) return false
      return true
    })
  }, [decisions, filterCampaignId, filterTargetId, filterScope, isFiltered])

  const buckets = useMemo(() => bucketByCampaign(visibleDecisions), [visibleDecisions])
  const hasLegacyVisibleDecisions = visibleDecisions.some((decision) => !hasGoalAwareContract(decision))

  // One row per campaign — its most recent cycle only. `cycles` comes back
  // newest-first from the API, so the first occurrence per campaignId wins.
  const latestCycleByCampaign = useMemo(() => {
    const seen = new Set<string>()
    const out: IntelligenceCycle[] = []
    for (const c of cycles) {
      if (seen.has(c.campaignId)) continue
      seen.add(c.campaignId)
      out.push(c)
    }
    return out
  }, [cycles])

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 stagger">
      <IntelligenceCenterNav tenantId={tenantId} active="recommendations" />
      {/* Shadow mode banner */}
      <div
        className="mb-7 flex items-start gap-3 rounded-2xl px-4 py-3.5 sm:items-center"
        style={{
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent-border)',
        }}
      >
        <ShieldCheck size={18} style={{ color: 'var(--accent-strong)' }} />
        <div className="flex-1">
          <p className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            Human-controlled live execution
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
            Recommendations are analysis until you act. Approving attempts the selected change on
            the live Meta campaign immediately; rejecting only records feedback.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="micro-label mb-2">Intelligence center · Recommendations</p>
          <h1 className="page-title">Decide what Meridian should do next</h1>
          <p className="page-subtitle">
            {tab === 'shadow_review'
              ? buckets.length === 0
                ? 'No recommendation currently passes every evidence gate. Open the latest campaign checks to see what was observed or withheld.'
                : hasLegacyVisibleDecisions
                  ? `${buckets.length} campaign${buckets.length === 1 ? '' : 's'} need review. Records missing objective or return evidence are clearly labeled.`
                  : `${buckets.length} campaign${buckets.length === 1 ? ' has' : 's have'} something waiting for your review.`
              : `Showing ${decisions.length} ${tab.replace('_', ' ')} decision${decisions.length === 1 ? '' : 's'}.`}
          </p>
          {tab === 'shadow_review' && buckets.length > 0 && hasLegacyVisibleDecisions && (
            <p className="mt-2 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              Review the action target and current Meta context. These legacy records cannot support a profit or ROAS claim.
            </p>
          )}
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            onClick={handlePrimeNow}
            disabled={priming}
            className="btn btn-primary flex-1 sm:flex-none"
            title="Ask the agent to re-analyze all campaigns right now"
          >
            {priming ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Analyze campaigns
          </button>
          <button onClick={load} disabled={loading} className="btn btn-ghost" aria-label="Refresh recommendations">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm"
          style={
            toast.kind === 'error'
              ? { background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }
              : { background: 'var(--good-bg)', border: '1px solid var(--good-border)', color: 'var(--good)' }
          }
        >
          {toast.kind === 'error' ? <AlertCircle size={14} /> : <Check size={14} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Active-filter chip — visible when arrived via a "See proposals" link */}
      {isFiltered && (
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-[13px]"
          style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--ink-2)' }}
        >
          <Info size={14} style={{ color: 'var(--accent-strong)' }} />
          <span className="flex-1">
            Filtered view —{' '}
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>
              {visibleDecisions.length}
            </span>{' '}
            of {decisions.length} decisions match.
            {filterScope && (
              <>
                {' '}
                Scope:{' '}
                <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                  {filterScope === 'adset' ? 'ad group' : filterScope}
                </span>
                .
              </>
            )}
            {filterTargetId && (
              <>
                {' '}
                Target: <span className="font-mono">…{filterTargetId.slice(-6)}</span>.
              </>
            )}
          </span>
          <Link
            href={`/dashboard/${tenantId}/proposed-actions`}
            className="btn btn-ghost"
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            <X size={12} /> Clear
          </Link>
        </div>
      )}

      {/* Summary strip */}
      {summary && (
        <section aria-label="Recommendation status" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Needs review', value: summary.counts.shadow_review, hint: 'Proposed' },
            { label: 'Approved', value: summary.counts.approved, hint: 'Live execution attempted' },
            { label: 'Rejected', value: summary.counts.rejected, hint: 'Feedback captured' },
            { label: 'Expired', value: summary.counts.expired, hint: 'No decision in window' },
          ].map((s) => (
            <div key={s.label} className="card px-4 py-3.5">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>
                {s.label}
              </p>
              <p className="mt-1 text-[28px] font-bold leading-none tabular-nums" style={{ color: 'var(--ink)' }}>
                {s.value}
              </p>
              <p className="mt-1.5 text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                {s.hint}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Latest AI analysis — the diagnosis narrative behind every cycle,
          whether or not it produced a decision. Answers "why is there
          nothing here" directly instead of leaving an empty list. */}
      {latestCycleByCampaign.length > 0 && (
        <section className="card mb-6 px-4 py-4 sm:px-5" aria-labelledby="latest-analysis-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="latest-analysis-title" className="section-title">Latest campaign checks</h2>
              <p className="explain mt-0.5">What Meridian observed before making—or withholding—a recommendation.</p>
            </div>
            <span className="chip chip-accent shrink-0">AI analysis</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {latestCycleByCampaign.map((c) => (
              <div
                key={c.cycleId}
                className="flex items-start gap-3 text-[13px] rounded-lg px-3 py-2.5"
                style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}
              >
                <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-strong)' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {c.campaignName || (c.metaCampaignId ? `Meta ID ${c.metaCampaignId}` : 'Campaign')}
                  </p>
                  <p className="mt-0.5" style={{ color: 'var(--ink-2)' }}>
                    {c.summary?.narrative ||
                      (c.status === 'failed'
                        ? 'This analysis run failed.'
                        : c.status === 'pending'
                          ? 'Analysis is still in progress.'
                          : 'Analysis completed, but no detailed reasoning was captured for this run.')}
                  </p>
                  <p className="text-[11.5px] mt-1" style={{ color: 'var(--ink-3)' }}>
                    {c.campaignName && c.metaCampaignId && <>Meta ID {c.metaCampaignId} · </>}
                    {c.summary
                      ? `${c.summary.decisionsProposed} suggestion${c.summary.decisionsProposed === 1 ? '' : 's'} proposed · `
                      : ''}
                    analyzed {relativeTime(c.completedAt ?? c.startedAt)}
                  </p>
                  {c.status === 'completed' && (
                    <CycleTracePanel tenantId={tenantId} cycleId={c.cycleId} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Recommendation status" style={{ borderColor: 'var(--hairline)' }}>
        {(
          [
            ['shadow_review', 'Waiting'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
            ['expired', 'Expired'],
          ] as Array<[IntelligenceDecisionStatus, string]>
        ).map(([key, label]) => {
          const isActive = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              role="tab"
              aria-selected={isActive}
              className="-mb-px min-h-11 shrink-0 border-b-2 px-4 py-2.5 text-[13.5px] font-semibold"
              style={{
                color: isActive ? 'var(--accent-strong)' : 'var(--ink-3)',
                borderColor: isActive ? 'var(--accent)' : 'transparent',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm"
          style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {!loading && buckets.length === 0 && !error && (
        <div className="card px-6 py-14 text-center">
          <div
            className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3"
            style={{ background: 'var(--good-bg)', color: 'var(--good)' }}
          >
            <CheckCircle2 size={26} />
          </div>
          <h3 className="text-[17px] font-semibold" style={{ color: 'var(--ink)' }}>
            {tab === 'shadow_review' ? 'No recommendation passed the evidence gates' : `No ${tab.replace('_', ' ')} decisions`}
          </h3>
          <p className="text-[13.5px] mt-1.5 max-w-md mx-auto" style={{ color: 'var(--ink-3)' }}>
            {tab === 'shadow_review'
              ? 'Open the latest campaign checks above to see what Meridian observed, why it withheld action, and all 16 engine steps.'
              : 'Nothing to show yet in this bucket.'}
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading recommendations">
          {[0, 1].map((item) => (
            <div key={item} className="card p-5 sm:p-6">
              <div className="skeleton h-4 w-2/5 rounded" />
              <div className="skeleton mt-3 h-3 w-4/5 rounded" />
              <div className="skeleton mt-5 h-20 w-full rounded-xl" />
            </div>
          ))}
          <span className="sr-only">Loading recommendations…</span>
        </div>
      )}

      {!loading && buckets.length > 0 && (
        <div className="flex flex-col gap-4">
          {buckets.map((b) => (
            <CampaignBucketCard
              key={b.campaignId}
              bucket={b}
              tenantId={tenantId}
              campaignDailyBudget={budgetByCampaign[b.campaignId] ?? null}
              busyId={busyId}
              rejectingId={rejectingId}
              rejectReason={rejectReason}
              setRejectReason={setRejectReason}
              onApprove={setApprovalTarget}
              onOpenReject={(id) => {
                setRejectingId(id)
                setRejectReason('')
              }}
              onCancelReject={() => {
                setRejectingId(null)
                setRejectReason('')
              }}
              onConfirmReject={handleReject}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(approvalTarget)}
        title="Approve and apply this change to Meta?"
        description={approvalTarget
          ? `${ACTION_LABEL[approvalTarget.actionType] ?? approvalTarget.actionType} will be attempted immediately on the live ${approvalTarget.targetType === 'adset' ? 'ad group' : approvalTarget.targetType === 'ad' ? 'ad' : 'campaign'}. ${hasGoalAwareContract(approvalTarget)
            ? `This recommendation optimizes ${plainLabel(approvalTarget.primaryKPI)} for the ${plainLabel(approvalTarget.objective)} objective. ${approvalImpactCopy(approvalTarget.expectedImpact)}`
            : 'This legacy record does not store objective or return-basis context, so verify the target in Meta first.'} The approval remains recorded even if Meta rejects execution.`
          : undefined}
        confirmLabel="Approve & apply to Meta"
        loading={Boolean(approvalTarget && busyId === approvalTarget._id)}
        onConfirm={() => { if (approvalTarget) void handleApprove(approvalTarget) }}
        onCancel={() => { if (!busyId) setApprovalTarget(null) }}
      />
    </div>
  )
}

// ── Campaign-level card. Each card = one campaign, with N alternative actions. ──

interface CampaignBucketCardProps {
  bucket: CampaignBucket
  tenantId: string
  campaignDailyBudget?: number | null
  busyId: string | null
  rejectingId: string | null
  rejectReason: string
  setRejectReason: (v: string) => void
  onApprove: (d: IntelligenceDecision) => void
  onOpenReject: (id: string) => void
  onCancelReject: () => void
  onConfirmReject: (d: IntelligenceDecision) => void
}

function CampaignBucketCard({
  bucket,
  tenantId,
  campaignDailyBudget,
  busyId,
  rejectingId,
  rejectReason,
  setRejectReason,
  onApprove,
  onOpenReject,
  onCancelReject,
  onConfirmReject,
}: CampaignBucketCardProps) {
  const statusStyle = { color: 'var(--info)', bg: 'var(--info-bg)', border: 'var(--info-border)', Icon: Info }
  const StatusIcon = statusStyle.Icon

  // Use the first decision for the stored evidence snapshot.
  const primary = bucket.decisions[0]
  const goalAware = hasGoalAwareContract(primary)
  const primaryImpact = goalAware ? impactCopy(primary.expectedImpact) : null
  const spend = Number(primary?.evidenceSnapshot?.metrics?.spend ?? 0)

  return (
    <article
      className="card px-4 py-5 sm:px-6"
      style={{ borderLeft: `3px solid ${statusStyle.color}` }}
    >
      {/* Header — campaign name + status badge + impact ₹ */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <StatusIcon size={16} style={{ color: statusStyle.color }} />
            <h3 className="text-[18px] font-semibold leading-tight break-words" style={{ color: 'var(--ink)' }}>
              {bucket.campaignName}
            </h3>
          </div>
          <p className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
            {bucket.metaCampaignId && (
              <>Meta ID {bucket.metaCampaignId} · </>
            )}
            {bucket.decisions.length} option{bucket.decisions.length === 1 ? '' : 's'} · updated {relativeTime(bucket.createdAtNewest)}
          </p>
        </div>
        {/* Deliberately not a hero number. This is a modeled estimate, and the
            forecast layer behind it is not yet calibrated — so it stays small
            and neutral rather than reading as a promised gain. The real money
            story is told in plain language by the review panel below. */}
        <div className="text-right shrink-0 max-w-[190px]">
          <p className="text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>
            {primaryImpact?.label ?? 'Economic effect'}
          </p>
          <p className="text-[15px] font-semibold tabular-nums leading-none mt-0.5" style={{ color: 'var(--ink-2)' }}>
            {primaryImpact?.value ?? 'Withheld'}
          </p>
          <p className="text-[10.5px] mt-1 leading-snug" style={{ color: 'var(--ink-3)' }}>
            {primaryImpact ? 'Estimate only — not a measured result' : 'Objective and return basis are not stored'}
          </p>
        </div>
      </div>

      <p className="text-[13.5px] mt-1 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
        {goalAware
          ? `This campaign is set up to drive ${plainLabel(primary.objective).toLowerCase()}, so it is judged on ${kpiPhrase(primary.primaryKPI)}.`
          : 'Older recommendation. Check its target against the live campaign before applying anything.'}
      </p>

      {/* Numeric snapshot chips */}
      {spend > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          <NumberChip label="Spent so far" value={formatCurrency(spend)} tone={statusStyle.color} />
        </div>
      )}

      {/* Options — one row per alternative action */}
      <div className="mt-5 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--hairline-light)' }}>
        <p className="text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--ink-3)' }}>
          {bucket.decisions.length === 1 ? 'Meridian suggests' : 'Meridian’s options'}
        </p>
        {bucket.decisions.map((d) => (
          <ActionOption
            key={d._id}
            d={d}
            tenantId={tenantId}
            campaignDailyBudget={campaignDailyBudget}
            busy={busyId === d._id}
            rejectingOpen={rejectingId === d._id}
            rejectReason={rejectReason}
            setRejectReason={setRejectReason}
            onApprove={() => onApprove(d)}
            onOpenReject={() => onOpenReject(d._id)}
            onCancelReject={onCancelReject}
            onConfirmReject={() => onConfirmReject(d)}
          />
        ))}
      </div>
    </article>
  )
}

// ── One action option (a row) ──────────────────────────────────────────

interface ActionOptionProps {
  d: IntelligenceDecision
  tenantId: string
  /** Live daily budget for this campaign, so a % change reads in rupees. */
  campaignDailyBudget?: number | null
  busy: boolean
  rejectingOpen: boolean
  rejectReason: string
  setRejectReason: (v: string) => void
  onApprove: () => void
  onOpenReject: () => void
  onCancelReject: () => void
  onConfirmReject: () => void
}

/**
 * The sixteen engine steps behind one suggestion, in a slide-over panel.
 *
 * Two deliberate choices here:
 *
 * 1. It opens in a panel, not inline. Sixteen steps expanded underneath a card
 *    pushed every other option off-screen, so comparing "why this one" against
 *    the alternatives meant scrolling past the reasoning for the first. The
 *    panel keeps the list in place behind it.
 *
 * 2. The engine's raw slice log is gone. It was a `key = value` dump —
 *    snapshotId, freshnessSec, metrics.campaignLevel.cpc, engineVersion — which
 *    is the right thing to persist and the wrong thing to put in front of an
 *    operator deciding whether to pause an ad. The headline and its bullets
 *    already carry the same facts as sentences. The full slice remains in
 *    intelligence_engine_outputs for anyone debugging the cascade itself.
 *
 * Loads lazily on first open and caches thereafter.
 */
interface TraceContent {
  stepsWithData: number
  totalSteps: number
  steps: DecisionTraceStep[]
}

interface ReasoningTracePanelProps {
  loadTrace: () => Promise<TraceContent>
  triggerLabel: string
  panelTitle: string
  triggerClassName?: string
}

function ReasoningTracePanel({
  loadTrace,
  triggerLabel,
  panelTitle,
  triggerClassName = 'mt-2 ml-4',
}: ReasoningTracePanelProps) {
  const [open, setOpen] = useState(false)
  const [trace, setTrace] = useState<TraceContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  async function openPanel() {
    setOpen(true)
    if (trace || loading) return
    setLoading(true)
    setError('')
    try {
      setTrace(await loadTrace())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the reasoning trace')
    } finally {
      setLoading(false)
    }
  }

  // Keep keyboard focus inside the decision trace while it is open. Closing
  // always returns focus to the exact control that launched the panel.
  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 80)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }
      if (e.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return

      if (!dialogRef.current?.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      trigger?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPanel}
        className={`${triggerClassName} inline-flex items-center gap-1 text-[12px] font-semibold`}
        style={{ color: 'var(--accent-strong)' }}
      >
        <ChevronRight size={12} />
        {triggerLabel}
      </button>

      {/* Rendered through a portal into <body>.
          This page's wrapper carries `stagger`, whose `animation: revealUp …
          both` leaves a persisting `transform: translateY(0)` on each card.
          Any non-none transform makes that element the containing block for
          `position: fixed` descendants — so an in-place panel anchored itself
          to the card instead of the viewport: the header rendered off-screen
          and the backdrop stopped short of the sidebar. */}
      {open && createPortal(
        <div
          ref={dialogRef}
          data-portal
          className="fixed inset-0 z-[100] flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div
            className="absolute inset-0 animate-fade-in"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="relative h-full w-full max-w-[560px] flex flex-col animate-panel-slide-in"
            style={{ background: 'var(--paper)', boxShadow: 'var(--shadow-overlay)' }}
          >
            <header
              className="px-5 py-4 flex items-start justify-between gap-3 shrink-0"
              style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--paper)' }}
            >
              <div className="min-w-0">
                <h2 id={titleId} className="section-title">{panelTitle}</h2>
                <p className="explain mt-0.5">
                  {trace
                    ? `${trace.stepsWithData} of ${trace.totalSteps} steps recorded output`
                    : 'Sixteen engines, in order'}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost shrink-0"
                aria-label="Close decision trace"
              >
                Close
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading && (
                <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  Loading the reasoning…
                </p>
              )}
              {error && (
                <p className="text-[12px]" style={{ color: 'var(--bad)' }}>{error}</p>
              )}

              {trace && (
                <ol className="flex flex-col gap-2.5">
                  {trace.steps.map(s => (
                    <li
                      key={s.step}
                      className="rounded-lg px-3.5 py-3"
                      style={{
                        background: 'var(--surface-warm)',
                        // Decisive steps are the causal path; the rest ran but
                        // didn't change the outcome. Dimming them lets the
                        // chain be read at a glance, not as 16 equal blocks.
                        border: s.decisive
                          ? '1px solid var(--accent)'
                          : '1px solid var(--hairline-light)',
                        opacity: s.status === 'no_data' ? 0.55 : 1,
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                          {s.label}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {s.decisive && (
                            <span className="chip chip-good" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                              drove this
                            </span>
                          )}
                          {s.status === 'no_data' && (
                            <span className="chip chip-neutral" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                              no data
                            </span>
                          )}
                          {s.meta?.degraded && (
                            <span className="chip chip-warn" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                              partial data
                            </span>
                          )}
                        </span>
                      </div>

                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-4)' }}>{s.question}</p>
                      <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: 'var(--ink)' }}>
                        {s.headline}
                      </p>

                      {s.details.length > 0 && (
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {s.details.map((line, i) => (
                            <li
                              key={i}
                              className="text-[12px] leading-relaxed pl-3"
                              style={{ color: 'var(--ink-2)', textIndent: '-0.6rem' }}
                            >
                              · {line}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  )
}

function DecisionTracePanel({ tenantId, decisionId }: { tenantId: string; decisionId: string }) {
  return (
    <ReasoningTracePanel
      loadTrace={() => getDecisionTrace(tenantId, decisionId)}
      triggerLabel="How it decided (16 steps)"
      panelTitle="How it decided"
    />
  )
}

function CycleTracePanel({ tenantId, cycleId }: { tenantId: string; cycleId: string }) {
  return (
    <ReasoningTracePanel
      loadTrace={() => getCycleTrace(tenantId, cycleId)}
      triggerLabel="View 16-step check"
      panelTitle="16-step campaign check"
      triggerClassName="mt-2"
    />
  )
}

function ActionOption({
  d,
  tenantId,
  campaignDailyBudget,
  busy,
  rejectingOpen,
  rejectReason,
  setRejectReason,
  onApprove,
  onOpenReject,
  onCancelReject,
  onConfirmReject,
}: ActionOptionProps) {
  const [showWhy, setShowWhy] = useState(false)
  const isPending = d.status === 'shadow_review'
  const timer = hoursLeft(d.reviewWindowExpiresAt)
  const label = ACTION_LABEL[d.actionType] ?? d.actionType
  const effect = ACTION_EFFECT[d.actionType] ?? ''
  const parts = splitReasoning(d.reasoning)
  const goalAware = hasGoalAwareContract(d)
  const goalAwareVersion = d.decisionContractVersion === 'goal_aware_v1'
  const readOnlyDiagnostic = d.campaignSource === 'manual'
  const executionReviewGate = getExecutionReviewGate(d)
  const reviewedAt = d.humanReviewedAt ?? d.reviewedAt
  const reviewNote = d.humanReviewNotes ?? d.rejectionReason

  return (
    <div
      className="rounded-lg px-4 py-3.5"
      style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}
    >
      {/* Row: label + risk + target + right-side buttons */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-[14.5px] font-semibold" style={{ color: 'var(--ink)' }}>
              {label}
            </p>
            <span className={`chip ${RISK_STYLE[d.risk] ?? 'chip-neutral'}`} style={{ fontSize: '10.5px', padding: '2px 8px' }}>
              {RISK_LABEL[d.risk] ?? d.risk}
            </span>
            {/* Target chip — tells the operator whether this hits the whole
                 campaign or a single ad group (and which one, by trailing id). */}
            <span
              className="chip chip-neutral"
              style={{ fontSize: '10.5px', padding: '2px 8px' }}
              title={d.targetType === 'adset' ? `Ad group Meta ID: ${d.targetId}` : `Campaign target`}
            >
              {d.targetType === 'adset'
                ? `Ad group · …${(d.targetId || '').slice(-6)}`
                : d.targetType === 'ad'
                  ? `Ad · …${(d.targetId || '').slice(-6)}`
                  : 'Whole campaign'}
            </span>
            {readOnlyDiagnostic && (
              <span
                className="chip chip-warn"
                style={{ fontSize: '10.5px', padding: '2px 8px' }}
                title="Created directly in Meta Ads Manager. Meridian can diagnose it, but cannot change it."
              >
                Read-only Meta diagnostic
              </span>
            )}
          </div>
          {effect && (
            <p className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              {effect}
            </p>
          )}
        </div>

        {isPending && !timer.expired && !rejectingOpen && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenReject}
              disabled={busy}
              className="btn btn-ghost"
              style={{ fontSize: '12.5px', padding: '6px 12px' }}
            >
              <XCircle size={13} />
              {readOnlyDiagnostic ? 'Dismiss' : 'Reject'}
            </button>
            {!readOnlyDiagnostic && executionReviewGate.allowed && (
              <button
                onClick={onApprove}
                disabled={busy}
                className="btn btn-primary"
                style={{ fontSize: '12.5px', padding: '6px 14px' }}
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Apply to Meta
              </button>
            )}
            {!readOnlyDiagnostic && !executionReviewGate.allowed && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-semibold"
                style={{ color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
                title={executionReviewGate.reason}
              >
                <ShieldCheck size={13} aria-hidden="true" />
                {executionReviewGate.label}
              </span>
            )}
          </div>
        )}
      </div>

      {goalAware ? (
        <>
          {readOnlyDiagnostic && (
            <div
              className="mt-2 rounded-lg px-3 py-2 text-[12px]"
              style={{ color: 'var(--ink-2)', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
            >
              Observed on a campaign created directly in Meta. Use this to verify Meridian&apos;s diagnosis; it is excluded from Meridian impact and cannot be applied here.
            </div>
          )}
          {/* The modeled estimate is already stated once in the card header and
              again, fully qualified, inside the evidence drawer. Repeating it
              here in an accent box made a projection look like a result. */}
          <button
            onClick={() => setShowWhy((s) => !s)}
            aria-expanded={showWhy}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: 'var(--accent-strong)' }}
          >
            <ChevronRight size={12} />
            {showWhy ? 'Hide reasoning' : 'Why this?'}
          </button>
          {showWhy && <p className="mt-2 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>{parts.effect}</p>}
          <DecisionTracePanel tenantId={tenantId} decisionId={d._id} />
        </>
      ) : goalAwareVersion ? (
        <div className="mt-2 rounded-lg px-3 py-2 text-[12px]" style={{ color: 'var(--ink-2)', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
          Goal-aware decision context is incomplete. Execution remains locked until objective, KPI, and modeled-impact fields are restored and reviewed.
        </div>
      ) : (
        <div className="mt-2 rounded-lg px-3 py-2 text-[12px]" style={{ color: 'var(--ink-2)', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
          Legacy profit/ROAS reasoning is withheld because this decision record does not store the objective or return basis.
        </div>
      )}

      <div className="mt-3">
        <MeridianReviewPanel
          review={d.intelligenceReview}
          evidence={d.intelligenceEvidence}
          currentDailyBudget={campaignDailyBudget}
        />
      </div>

      {/* Countdown / status footer */}
      <div className="mt-3 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
        {isPending ? (
          timer.expired ? (
            <span style={{ color: 'var(--bad)' }}>Review window expired</span>
          ) : (
            <>
              Auto-expires in{' '}
              <span
                className="font-semibold tabular-nums"
                style={{
                  color:
                    timer.hours < 4 ? 'var(--bad)' : timer.hours < 12 ? 'var(--warn)' : 'var(--ink-2)',
                }}
              >
                {timer.hours}h {timer.minutes}m
              </span>
            </>
          )
        ) : (
          <>
            {d.status === 'approved' && reviewedAt && (
              d.executedAt ? (
                <>Applied to Meta · {relativeTime(d.executedAt)}</>
              ) : d.executionError ? (
                <span style={{ color: 'var(--bad)' }}>Approved, but Meta execution failed · {relativeTime(reviewedAt)}</span>
              ) : (
                <>Approved · execution status unavailable · {relativeTime(reviewedAt)}</>
              )
            )}
            {d.status === 'rejected' && reviewedAt && (
              <>
                Rejected {relativeTime(reviewedAt)}
                {reviewNote && (
                  <> · <em style={{ color: 'var(--ink-2)' }}>{reviewNote}</em></>
                )}
              </>
            )}
            {d.status === 'expired' && <>Window closed without review</>}
          </>
        )}
      </div>

      {/* Reject reason inline */}
      {rejectingOpen && (
        <div
          className="mt-3 rounded-md px-3 py-3"
          style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}
        >
          <label className="text-[11.5px] font-semibold block mb-2" style={{ color: 'var(--bad)' }}>
            Why reject? Helps the agent learn.
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            placeholder="e.g. This campaign is a retargeting run — expected to break even."
            className="w-full rounded-md px-3 py-2 text-[12.5px]"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--hairline)',
              color: 'var(--ink)',
            }}
          />
          <div className="flex justify-end gap-2 mt-2.5">
            <button
              onClick={onCancelReject}
              disabled={busy}
              className="btn btn-ghost"
              style={{ fontSize: '12px', padding: '5px 12px' }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirmReject}
              disabled={busy || !rejectReason.trim()}
              className="btn btn-danger"
              style={{ fontSize: '12px', padding: '5px 12px' }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
              Confirm reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NumberChip({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span
      className="inline-flex items-baseline gap-1.5 rounded-md px-2.5 py-1 text-[12px]"
      style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}
    >
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: tone ?? 'var(--ink)' }}>
        {value}
      </span>
    </span>
  )
}
