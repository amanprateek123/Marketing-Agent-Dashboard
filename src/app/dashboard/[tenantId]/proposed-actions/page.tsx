'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
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
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  getIntelligenceDecisions,
  getIntelligenceDecisionsSummary,
  approveIntelligenceDecision,
  rejectIntelligenceDecision,
  primeIntelligence,
  getIntelligenceCycles,
  DecisionsSummary,
  IntelligenceCycle,
} from '@/lib/api'
import type {
  IntelligenceDecision,
  IntelligenceDecisionStatus,
} from '@/types'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

interface Toast {
  kind: 'success' | 'error'
  text: string
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

const RISK_LABEL: Record<string, string> = {
  low: 'Safe to try',
  medium: 'Moderate change',
  high: 'Big change',
}

const RISK_STYLE: Record<string, string> = {
  low: 'chip-good',
  medium: 'chip-warn',
  high: 'chip-bad',
}

// Plain-English label for each engine that contributed to the decision.
const SOURCE_LABEL: Record<string, string> = {
  signal: 'What the agent noticed',
  revenue: 'The money side',
  snapshot: 'Current performance',
  diagnosis: 'Likely root cause',
  trend: 'How things are trending',
  memory: 'Similar past cases',
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
  totalImpactINR: number
  createdAtNewest: string
  status: 'losing' | 'break_even' | 'profitable'
}

function bucketByCampaign(decisions: IntelligenceDecision[]): CampaignBucket[] {
  const buckets = new Map<string, CampaignBucket>()
  for (const d of decisions) {
    const key = d.campaignId
    let b = buckets.get(key)
    if (!b) {
      const name = extractCampaignName(d)
      const roas = Number(d.evidenceSnapshot?.metrics?.roas ?? 0)
      const breakeven = Number(d.evidenceSnapshot?.metrics?.breakevenROAS ?? 0)
      let status: CampaignBucket['status'] = 'profitable'
      if (roas > 0 && breakeven > 0) {
        if (breakeven - roas > 0.05) status = 'losing'
        else if (roas < breakeven) status = 'break_even'
      }
      b = {
        campaignId: key,
        campaignName: name,
        metaCampaignId: d.metaCampaignId,
        decisions: [],
        totalImpactINR: 0,
        createdAtNewest: d.createdAt,
        status,
      }
      buckets.set(key, b)
    }
    b.decisions.push(d)
    // Alternative actions share the same impact — take the max, not the sum.
    b.totalImpactINR = Math.max(b.totalImpactINR, Math.abs(d.expectedProfitDeltaINR7d))
    if (d.createdAt > b.createdAtNewest) b.createdAtNewest = d.createdAt
  }
  // Rank buckets by impact size
  return Array.from(buckets.values()).sort((a, b) => b.totalImpactINR - a.totalImpactINR)
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
  const [tab, setTab] = useState<IntelligenceDecisionStatus>('shadow_review')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [priming, setPriming] = useState(false)
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
      const [list, sum, cyc] = await Promise.all([
        getIntelligenceDecisions(tenantId, { status: tab, limit: 200 }),
        getIntelligenceDecisionsSummary(tenantId).catch(() => null),
        getIntelligenceCycles(tenantId, { limit: 50 }).catch(() => null),
      ])
      setDecisions(list.decisions)
      setSummary(sum)
      setCycles(cyc?.cycles ?? [])
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
    setBusyId(d._id)
    try {
      await approveIntelligenceDecision(tenantId, d._id)
      flash('success', 'Recorded locally. Nothing sent to Meta.')
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

  const totalAtStake = useMemo(
    () => buckets.reduce((s, b) => s + b.totalImpactINR, 0),
    [buckets],
  )

  return (
    <div className="px-8 py-8 max-w-[1600px] mx-auto stagger">
      {/* Shadow mode banner */}
      <div
        className="rounded-xl px-4 py-3 mb-6 flex items-center gap-3"
        style={{
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent-border)',
        }}
      >
        <ShieldCheck size={18} style={{ color: 'var(--accent-strong)' }} />
        <div className="flex-1">
          <p className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            Shadow mode is ON — Meta is untouched
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
            The agent is watching your live campaigns. Everything below is a proposal only —
            approving records the decision here for review; nothing is sent to Meta.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="page-title">Things the agent wants to change</h1>
          <p className="page-subtitle">
            {tab === 'shadow_review'
              ? buckets.length === 0
                ? 'Nothing to review right now. Your campaigns are on track — or the agent hasn’t taken a fresh look yet.'
                : `${buckets.length} campaign${buckets.length === 1 ? '' : 's'} flagged. About ${formatCurrency(totalAtStake)} at stake over the next 7 days.`
              : `Showing ${decisions.length} ${tab.replace('_', ' ')} decision${decisions.length === 1 ? '' : 's'}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrimeNow}
            disabled={priming}
            className="btn btn-ghost"
            title="Ask the agent to re-analyze all campaigns right now"
          >
            {priming ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Look again now
          </button>
          <button onClick={load} disabled={loading} className="btn btn-ghost">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Waiting', value: summary.counts.shadow_review },
            { label: 'Approved', value: summary.counts.approved },
            { label: 'Rejected', value: summary.counts.rejected },
            { label: 'Expired', value: summary.counts.expired },
          ].map((s) => (
            <div key={s.label} className="card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
                {s.label}
              </p>
              <p className="text-[26px] font-semibold tabular-nums mt-0.5" style={{ color: 'var(--ink)' }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Latest AI analysis — the diagnosis narrative behind every cycle,
          whether or not it produced a decision. Answers "why is there
          nothing here" directly instead of leaving an empty list. */}
      {latestCycleByCampaign.length > 0 && (
        <div className="card px-5 py-4 mb-5">
          <p className="text-[11px] uppercase tracking-wide font-semibold mb-2.5" style={{ color: 'var(--ink-3)' }}>
            Latest AI analysis
          </p>
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: 'var(--hairline)' }}>
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
              className="px-4 py-2.5 text-[13.5px] font-semibold border-b-2 -mb-px"
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
            {tab === 'shadow_review' ? 'All caught up' : `No ${tab.replace('_', ' ')} decisions`}
          </h3>
          <p className="text-[13.5px] mt-1.5 max-w-md mx-auto" style={{ color: 'var(--ink-3)' }}>
            {tab === 'shadow_review'
              ? 'The agent found nothing that needs your attention. Click "Look again now" to force a fresh analysis.'
              : 'Nothing to show yet in this bucket.'}
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16" style={{ color: 'var(--ink-3)' }}>
          <Loader2 size={22} className="animate-spin mr-2" />
          <span className="text-[14px]">Loading proposals…</span>
        </div>
      )}

      {!loading && buckets.length > 0 && (
        <div className="flex flex-col gap-4">
          {buckets.map((b) => (
            <CampaignBucketCard
              key={b.campaignId}
              bucket={b}
              busyId={busyId}
              rejectingId={rejectingId}
              rejectReason={rejectReason}
              setRejectReason={setRejectReason}
              onApprove={handleApprove}
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
    </div>
  )
}

// ── Campaign-level card. Each card = one campaign, with N alternative actions. ──

interface CampaignBucketCardProps {
  bucket: CampaignBucket
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
  busyId,
  rejectingId,
  rejectReason,
  setRejectReason,
  onApprove,
  onOpenReject,
  onCancelReject,
  onConfirmReject,
}: CampaignBucketCardProps) {
  const statusStyle =
    bucket.status === 'losing'
      ? { color: 'var(--bad)', bg: 'var(--bad-bg)', border: 'var(--bad-border)', Icon: TrendingDown }
      : bucket.status === 'break_even'
        ? { color: 'var(--warn)', bg: 'var(--warn-bg)', border: 'var(--warn-border)', Icon: Info }
        : { color: 'var(--good)', bg: 'var(--good-bg)', border: 'var(--good-border)', Icon: TrendingUp }
  const StatusIcon = statusStyle.Icon

  // Use the first (highest-scored) decision to draw the "what's wrong" context.
  const primary = bucket.decisions[0]
  const roas = Number(primary?.evidenceSnapshot?.metrics?.roas ?? 0)
  const breakeven = Number(primary?.evidenceSnapshot?.metrics?.breakevenROAS ?? 0)
  const spend = Number(primary?.evidenceSnapshot?.metrics?.spend ?? 0)

  const parts = splitReasoning(primary?.reasoning ?? '')

  return (
    <article
      className="card px-6 py-5"
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
        <div className="text-right shrink-0">
          <p className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
            Est. impact over 7 days
          </p>
          <p
            className="text-[26px] font-semibold tabular-nums leading-none mt-0.5"
            style={{ color: statusStyle.color }}
          >
            {bucket.status === 'losing' || bucket.status === 'break_even' ? '−' : '+'}
            {formatCurrency(bucket.totalImpactINR)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--ink-3)' }}>
            {bucket.status === 'losing' ? 'loss avoided' : bucket.status === 'break_even' ? 'wasted spend saved' : 'profit gain'}
          </p>
        </div>
      </div>

      {/* What's going on — one-line summary from the primary decision */}
      {parts.condition && (
        <p className="text-[13.5px] mt-1 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {parts.condition}
        </p>
      )}

      {/* Numeric snapshot chips */}
      {roas > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          <NumberChip label="Current ROAS" value={`${roas.toFixed(2)}×`} tone={statusStyle.color} />
          <NumberChip label="Needs to be" value={`${breakeven.toFixed(2)}×`} />
          {spend > 0 && <NumberChip label="Spent so far" value={formatCurrency(spend)} />}
        </div>
      )}

      {/* Options — one row per alternative action */}
      <div className="mt-5 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--hairline-light)' }}>
        <p className="text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--ink-3)' }}>
          {bucket.decisions.length === 1 ? 'The agent recommends' : "The agent's options"}
        </p>
        {bucket.decisions.map((d) => (
          <ActionOption
            key={d._id}
            d={d}
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
  busy: boolean
  rejectingOpen: boolean
  rejectReason: string
  setRejectReason: (v: string) => void
  onApprove: () => void
  onOpenReject: () => void
  onCancelReject: () => void
  onConfirmReject: () => void
}

function ActionOption({
  d,
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
              Not this
            </button>
            <button
              onClick={onApprove}
              disabled={busy}
              className="btn btn-primary"
              style={{ fontSize: '12.5px', padding: '6px 14px' }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Go with this
            </button>
          </div>
        )}
      </div>

      {/* Why? disclosure */}
      <button
        onClick={() => setShowWhy((s) => !s)}
        className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold"
        style={{ color: 'var(--accent-strong)' }}
      >
        <ChevronRight
          size={12}
          style={{ transform: showWhy ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
        />
        {showWhy ? 'Hide reasoning' : 'Why this?'}
      </button>

      {showWhy && (
        <div className="mt-2 flex flex-col gap-2 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
          {parts.effect && (
            <p className="leading-relaxed">
              <span style={{ color: 'var(--ink-3)' }}>Estimated effect: </span>
              {parts.effect}
            </p>
          )}
          <ol className="flex flex-col gap-1.5 mt-1">
            {d.evidenceChain.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span
                  className="chip chip-neutral shrink-0"
                  style={{ fontSize: '10px', padding: '2px 7px', minWidth: 'max-content' }}
                >
                  {SOURCE_LABEL[step.source] ?? step.source}
                </span>
                <span className="flex-1">{cleanText(step.step)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

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
            {d.status === 'approved' && d.reviewedAt && (
              <>Approved · {relativeTime(d.reviewedAt)}</>
            )}
            {d.status === 'rejected' && d.reviewedAt && (
              <>
                Rejected {relativeTime(d.reviewedAt)}
                {d.rejectionReason && (
                  <> · <em style={{ color: 'var(--ink-2)' }}>{d.rejectionReason}</em></>
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
