'use client'

import { useState, useEffect, use, useMemo } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Pencil,
  Loader2,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Inbox,
  PlayCircle,
  ImageOff,
  ExternalLink,
  Megaphone,
  Check,
  ChevronRight,
} from 'lucide-react'
import {
  FormatBadge,
  PromptsVersionBadge,
} from '@/components/badges'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { formatCurrency } from '@/lib/utils'
import {
  getCampaigns,
  getCompany,
  approveCampaign,
  rejectCampaign,
  updateCampaignBudget,
} from '@/lib/api'
import type { Campaign, Company, CopyVariant, CreativeImage } from '@/types'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

type ActionState = 'idle' | 'loading' | 'success' | 'error'

interface Toast {
  kind: 'success' | 'error'
  text: string
}

export default function ApprovalsPage({ params }: PageProps) {
  const { tenantId } = use(params)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [c, list] = await Promise.all([
        getCompany(tenantId),
        getCampaigns(tenantId),
      ])
      setCompany(c)
      setCampaigns(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  function flash(kind: Toast['kind'], text: string) {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  const pending = useMemo(
    () => campaigns.filter((c) => c.status === 'pending_approval'),
    [campaigns],
  )

  // Committed weekly spend = sum of budgets on currently-active campaigns
  const committedWeekly = useMemo(
    () =>
      campaigns
        .filter((c) => c.status === 'active')
        .reduce((s, c) => s + (c.budget || 0), 0),
    [campaigns],
  )

  const weeklyCap =
    company?.weeklyBudgetCap ?? company?.budgetSettings?.weeklyBudgetCap ?? 0

  const accountIds = useMemo(() => {
    const ids = company?.meta?.accountIds?.length
      ? company.meta.accountIds
      : company?.meta?.accountId
        ? [company.meta.accountId]
        : []
    return ids.map((id) => (id.startsWith('act_') ? id : `act_${id}`))
  }, [company])

  return (
    <div
      className="px-6 py-6 max-w-6xl mx-auto animate-fade-up"
      style={{ background: '#f8f9fb', minHeight: '100vh' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{ background: '#fef3c7', border: '1px solid #fde68a' }}
          >
            <Inbox size={16} style={{ color: '#b45309' }} />
          </div>
          <div>
            <h1
              className="text-lg font-bold tracking-tight"
              style={{ color: '#111827' }}
            >
              Approvals Inbox
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              {pending.length} campaign{pending.length === 1 ? '' : 's'} awaiting approval
            </p>
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:border-sky-300 hover:text-sky-600 disabled:opacity-60"
          style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#4b5563' }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm"
          style={
            toast.kind === 'error'
              ? { background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }
              : { background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' }
          }
        >
          {toast.kind === 'error' ? <AlertCircle size={14} /> : <Check size={14} />}
          {toast.text}
        </div>
      )}

      {/* Weekly cap header */}
      {weeklyCap > 0 && (
        <WeeklyCapBar committed={committedWeekly} cap={weeklyCap} />
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl p-4 mb-5 flex items-center gap-3 text-sm"
          style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
        >
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div
          className="flex items-center justify-center py-20 gap-2.5"
          style={{ color: '#9ca3af' }}
        >
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading approvals…</span>
        </div>
      ) : pending.length === 0 ? (
        <div
          className="rounded-2xl"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
          }}
        >
          <EmptyState
            icon={ShieldCheck}
            title="Inbox zero"
            subtitle="No campaigns are waiting on you. New ones will appear here as the pipeline produces them."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {pending.map((campaign) => (
            <ApprovalCard
              key={campaign._id}
              tenantId={tenantId}
              campaign={campaign}
              company={company}
              committedWeekly={committedWeekly}
              weeklyCap={weeklyCap}
              accountIds={accountIds}
              onChanged={load}
              flash={flash}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Weekly cap progress bar ────────────────────────────────────────────────
function WeeklyCapBar({ committed, cap }: { committed: number; cap: number }) {
  const pct = Math.min(100, Math.round((committed / cap) * 100))
  const tone =
    pct >= 90 ? { fg: '#b91c1c', bar: '#dc2626', bg: '#fee2e2' }
    : pct >= 70 ? { fg: '#b45309', bar: '#f59e0b', bg: '#fef3c7' }
    : { fg: '#166534', bar: '#22c55e', bg: '#dcfce7' }

  return (
    <div
      className="rounded-xl px-4 py-3 mb-5"
      style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: '#6b7280' }}
          >
            Weekly cap committed
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-sm font-bold" style={{ color: tone.fg }}>
            {formatCurrency(committed)}
          </span>
          <span className="text-xs" style={{ color: '#9ca3af' }}>
            of {formatCurrency(cap)}
          </span>
          <span
            className="text-[11px] px-1.5 py-0.5 rounded font-semibold ml-1"
            style={{ background: tone.bg, color: tone.fg }}
          >
            {pct}%
          </span>
        </div>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: '#f3f4f6' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: tone.bar }}
        />
      </div>
    </div>
  )
}

// ── Single campaign card ───────────────────────────────────────────────────
function ApprovalCard({
  tenantId,
  campaign,
  company,
  committedWeekly,
  weeklyCap,
  accountIds,
  onChanged,
  flash,
}: {
  tenantId: string
  campaign: Campaign
  company: Company | null
  committedWeekly: number
  weeklyCap: number
  accountIds: string[]
  onChanged: () => void
  flash: (kind: Toast['kind'], text: string) => void
}) {
  const cp = campaign.creativePackage
  const variants: CopyVariant[] = cp?.copyVariants ?? []
  const idx = cp?.selectedCopyIndex ?? 0
  const variant = variants[idx]
  const image: CreativeImage | undefined = cp?.images?.[idx] ?? cp?.images?.[0]
  const videoUrl = cp?.video?.videoUrl

  const [budgetEditing, setBudgetEditing] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState(String(campaign.budget ?? 0))
  const [budgetState, setBudgetState] = useState<ActionState>('idle')

  const [accountId, setAccountId] = useState<string | null>(
    accountIds[0] ?? null,
  )
  const [approveState, setApproveState] = useState<ActionState>('idle')
  const [approveOpen, setApproveOpen] = useState(false)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectState, setRejectState] = useState<ActionState>('idle')

  const budget = campaign.budget ?? 0
  const projectedCommitted = committedWeekly + budget
  const projectedPct = weeklyCap > 0
    ? Math.min(100, Math.round((projectedCommitted / weeklyCap) * 100))
    : 0
  const overCap = weeklyCap > 0 && projectedCommitted > weeklyCap

  // Learned audience ROAS from learnings.campaign.audienceScores. Entries are
  // { roas, n } objects (legacy: flat numbers) — Number() on the object shape
  // rendered ₹NaN here. Normalize both shapes; this was also never CPA.
  const audienceScores = company?.learnings?.campaign?.audienceScores ?? {}
  const roasEntries = Object.entries(audienceScores)
    .map(([audience, v]) => ({
      audience,
      roas: typeof v === 'number' ? v : Number((v as { roas?: number })?.roas) || 0,
      n: typeof v === 'number' ? null : Number((v as { n?: number })?.n) || null,
    }))
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 4)

  async function saveBudget() {
    const parsed = Number(budgetDraft)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      flash('error', 'Budget must be a positive number')
      return
    }
    setBudgetState('loading')
    try {
      await updateCampaignBudget(tenantId, campaign._id, parsed)
      setBudgetState('success')
      setBudgetEditing(false)
      flash('success', `Budget updated to ${formatCurrency(parsed)}`)
      onChanged()
      setTimeout(() => setBudgetState('idle'), 1200)
    } catch (err) {
      setBudgetState('error')
      flash('error', err instanceof Error ? err.message : 'Failed to update budget')
      setTimeout(() => setBudgetState('idle'), 2500)
    }
  }

  async function doApprove() {
    if (!accountId) {
      flash('error', 'Pick a Meta ad account first')
      return
    }
    setApproveState('loading')
    try {
      await approveCampaign(tenantId, campaign._id, accountId)
      setApproveState('success')
      flash('success', 'Approved & launching on Meta')
      setApproveOpen(false)
      onChanged()
    } catch (err) {
      setApproveState('error')
      flash('error', err instanceof Error ? err.message : 'Approval failed')
      setTimeout(() => setApproveState('idle'), 3000)
    }
  }

  async function doReject() {
    if (!rejectReason.trim()) {
      flash('error', 'Add a reason')
      return
    }
    setRejectState('loading')
    try {
      await rejectCampaign(tenantId, campaign._id, rejectReason)
      setRejectState('success')
      flash('success', 'Campaign rejected')
      setRejectOpen(false)
      setRejectReason('')
      onChanged()
    } catch (err) {
      setRejectState('error')
      flash('error', err instanceof Error ? err.message : 'Reject failed')
      setTimeout(() => setRejectState('idle'), 3000)
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
      }}
    >
      {/* Header strip */}
      <div
        className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Megaphone size={14} style={{ color: '#9ca3af' }} />
          <Link
            href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
            className="text-sm font-semibold truncate hover:text-sky-600 transition-colors"
            style={{ color: '#111827' }}
            title={campaign.name || campaign.topic || 'Untitled'}
          >
            {campaign.name || campaign.topic || 'Untitled campaign'}
          </Link>
          {campaign.name && campaign.topic && (
            <span className="text-[11px] truncate" style={{ color: '#9ca3af' }}>
              · {campaign.topic}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <FormatBadge format={campaign.creativeFormat} />
          <PromptsVersionBadge version={campaign.promptsVersion} />
          {campaign.runId && (
            <Link
              href={`/dashboard/${tenantId}/runs/${campaign.runId}`}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded hover:underline"
              style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}
            >
              run · {campaign.runId.slice(0, 8)}
            </Link>
          )}
        </div>
      </div>

      <div className="p-5 grid gap-5 lg:grid-cols-[260px,1fr]">
        {/* Left: Creative preview */}
        <div className="space-y-2">
          <div
            className="aspect-square w-full rounded-xl overflow-hidden flex items-center justify-center"
            style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}
          >
            {image?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.imageUrl}
                alt={variant?.headline || 'Ad creative'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2" style={{ color: '#9ca3af' }}>
                <ImageOff size={20} />
                <span className="text-xs">No image yet</span>
              </div>
            )}
          </div>

          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-sky-50"
              style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca' }}
            >
              <PlayCircle size={13} />
              Watch video variant
              <ExternalLink size={11} className="ml-auto" />
            </a>
          )}

          {roasEntries.length > 0 && (
            <div
              className="rounded-lg p-3 space-y-1.5"
              style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: '#9ca3af' }}
              >
                Learned Audience ROAS
              </p>
              {roasEntries.map(({ audience, roas, n }) => (
                <div key={audience} className="flex items-center justify-between gap-2">
                  <span
                    className="text-[11px] capitalize truncate"
                    style={{ color: '#4b5563' }}
                  >
                    {audience.replace(/_/g, ' ')}
                  </span>
                  <span
                    className="text-[11px] font-semibold tabular-nums"
                    style={{ color: roas >= 1.5 ? '#15803d' : roas >= 1 ? '#b45309' : '#b91c1c' }}
                  >
                    {roas.toFixed(2)}x{n !== null ? ` · n=${n}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Copy + actions */}
        <div className="min-w-0 space-y-4">
          {variant ? (
            <div className="space-y-2">
              <p
                className="text-base font-semibold leading-snug"
                style={{ color: '#111827' }}
              >
                {variant.primaryText || '—'}
              </p>
              {variant.headline && (
                <p className="text-sm" style={{ color: '#4b5563' }}>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider mr-2"
                    style={{ color: '#9ca3af' }}
                  >
                    Headline
                  </span>
                  {variant.headline}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {variant.cta && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                    style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}
                  >
                    CTA · {variant.cta}
                  </span>
                )}
                {variant.hookStyle && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize"
                    style={{ background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe' }}
                  >
                    {variant.hookStyle.replace(/_/g, ' ')}
                  </span>
                )}
                {campaign.objective && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize"
                    style={{ background: '#f3f4f6', color: '#4b5563' }}
                  >
                    {campaign.objective.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs italic" style={{ color: '#9ca3af' }}>
              No copy variant selected yet — creative may still be in progress.
            </p>
          )}

          {/* Audience-stage badges */}
          {variants.length > 1 && (
            <p className="text-[11px]" style={{ color: '#9ca3af' }}>
              Showing variant {idx + 1} of {variants.length}
            </p>
          )}

          {/* Budget + cap row */}
          <div
            className="rounded-lg p-3"
            style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: '#9ca3af' }}
                >
                  Daily budget
                </p>
                {budgetEditing ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm" style={{ color: '#6b7280' }}>₹</span>
                    <input
                      type="number"
                      value={budgetDraft}
                      onChange={(e) => setBudgetDraft(e.target.value)}
                      className="w-28 px-2 py-1 rounded text-sm tabular-nums"
                      style={{ background: '#ffffff', border: '1px solid #c7d2fe', outline: 'none', color: '#111827' }}
                      autoFocus
                    />
                    <button
                      onClick={saveBudget}
                      disabled={budgetState === 'loading'}
                      className="px-2.5 py-1 rounded text-xs font-semibold disabled:opacity-60"
                      style={{ background: '#4f46e5', color: '#fff' }}
                    >
                      {budgetState === 'loading' ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setBudgetEditing(false)
                        setBudgetDraft(String(campaign.budget ?? 0))
                      }}
                      className="text-xs"
                      style={{ color: '#9ca3af' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-base font-bold tabular-nums"
                      style={{ color: '#111827' }}
                    >
                      {formatCurrency(budget)}
                    </span>
                    <button
                      onClick={() => setBudgetEditing(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:bg-slate-100"
                      style={{ color: '#4f46e5' }}
                    >
                      <Pencil size={10} /> Edit
                    </button>
                  </div>
                )}
              </div>

              {weeklyCap > 0 && (
                <div className="text-right">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: '#9ca3af' }}
                  >
                    If approved
                  </p>
                  <p
                    className="text-sm font-semibold tabular-nums mt-1"
                    style={{ color: overCap ? '#b91c1c' : '#111827' }}
                  >
                    {formatCurrency(projectedCommitted)} / {formatCurrency(weeklyCap)}{' '}
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded font-semibold ml-1"
                      style={
                        overCap
                          ? { background: '#fee2e2', color: '#b91c1c' }
                          : projectedPct >= 70
                            ? { background: '#fef3c7', color: '#b45309' }
                            : { background: '#dcfce7', color: '#166534' }
                      }
                    >
                      {projectedPct}%
                    </span>
                  </p>
                </div>
              )}
            </div>
            {overCap && (
              <p className="text-[11px] mt-2" style={{ color: '#b91c1c' }}>
                Approving this campaign will exceed your weekly cap.
              </p>
            )}
          </div>

          {/* Account picker if multiple */}
          {accountIds.length > 1 && (
            <div className="space-y-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: '#9ca3af' }}
              >
                Launch on Meta account
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {accountIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => setAccountId(id)}
                    className="px-2.5 py-1 rounded-full text-xs font-mono transition-all"
                    style={
                      accountId === id
                        ? { background: '#4f46e5', color: '#fff' }
                        : { background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }
                    }
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap pt-2">
            <button
              onClick={() => setApproveOpen(true)}
              disabled={approveState === 'loading' || !accountId}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{
                background: '#16a34a',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(22,163,74,0.18)',
              }}
            >
              {approveState === 'loading' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Approve & launch
            </button>

            <button
              onClick={() => setRejectOpen(true)}
              disabled={rejectState === 'loading'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
              }}
            >
              <XCircle size={14} />
              Reject
            </button>

            <Link
              href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium hover:underline"
              style={{ color: '#4f46e5' }}
            >
              View full detail <ChevronRight size={11} />
            </Link>
          </div>

          {!accountId && (
            <p className="text-[11px]" style={{ color: '#b91c1c' }}>
              Connect a Meta account in Settings before approving.
            </p>
          )}
        </div>
      </div>

      {/* Approve confirmation */}
      <ConfirmModal
        open={approveOpen}
        title="Launch on Meta?"
        description={`This will create the live campaign on ${accountId}. Daily budget ${formatCurrency(budget)}.${
          overCap ? ' Note: this will exceed your weekly cap.' : ''
        }`}
        confirmLabel="Approve & launch"
        loading={approveState === 'loading'}
        onCancel={() => setApproveOpen(false)}
        onConfirm={doApprove}
      />

      {/* Reject inline drawer */}
      {rejectOpen && (
        <div
          className="px-5 py-4"
          style={{ background: '#fef2f2', borderTop: '1px solid #fecaca' }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: '#b91c1c' }}
          >
            Reason for rejection
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="What's wrong with this campaign? The agent will learn from this."
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{ background: '#ffffff', border: '1px solid #fca5a5', color: '#111827', outline: 'none' }}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={doReject}
              disabled={rejectState === 'loading' || !rejectReason.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
              style={{ background: '#dc2626', color: '#ffffff' }}
            >
              {rejectState === 'loading' ? 'Rejecting…' : 'Confirm reject'}
            </button>
            <button
              onClick={() => {
                setRejectOpen(false)
                setRejectReason('')
              }}
              className="text-xs"
              style={{ color: '#6b7280' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
