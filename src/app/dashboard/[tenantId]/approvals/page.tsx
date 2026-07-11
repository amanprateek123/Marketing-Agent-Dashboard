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
  getWeeklySpend,
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
  const [weeklySpend, setWeeklySpend] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [c, list, spend] = await Promise.all([
        getCompany(tenantId),
        getCampaigns(tenantId),
        getWeeklySpend(tenantId),
      ])
      setCompany(c)
      setCampaigns(list)
      setWeeklySpend(spend.weeklySpend)
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

  // Rolling-7-day spend from the backend — the same figure that actually
  // gates new campaign creation (previously this summed active campaigns'
  // `budget` field locally, which is a per-day budget setting, not spend,
  // and never changed with the calendar — it only moved when a campaign was
  // created/paused/edited).
  const committedWeekly = weeklySpend ?? 0

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
    <div className="px-8 py-8 max-w-[1600px] mx-auto stagger">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="page-title">Ads waiting for you to review</h1>
          <p className="page-subtitle">
            {pending.length === 0
              ? 'Nothing waiting right now.'
              : pending.length === 1
                ? '1 new ad idea. Approve to launch it on Meta.'
                : `${pending.length} new ad ideas. Approve to launch them on Meta.`}
          </p>
        </div>

        <button onClick={load} disabled={loading} className="btn btn-ghost">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Toast */}
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
          style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}
        >
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div
          className="flex items-center justify-center py-20 gap-2.5"
          style={{ color: 'var(--ink-2)' }}
        >
          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <span className="text-sm">Loading approvals…</span>
        </div>
      ) : pending.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ShieldCheck}
            title="All caught up 🎉"
            subtitle="The agent will drop new ad ideas here when it has them ready for you to approve."
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
    pct >= 90 ? { fg: 'var(--bad)', bar: 'var(--bad)', chip: 'chip-bad' }
    : pct >= 70 ? { fg: 'var(--warn)', bar: 'var(--warn)', chip: 'chip-warn' }
    : { fg: 'var(--good)', bar: 'var(--good)', chip: 'chip-good' }

  return (
    <div className="card px-5 py-4 mb-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="micro-label">Weekly budget in use</span>
        </div>
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span className="font-semibold" style={{ color: tone.fg }}>
            {formatCurrency(committed)}
          </span>
          <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>
            of {formatCurrency(cap)} available
          </span>
          <span className={`chip ${tone.chip} ml-1`}>{pct}% used</span>
        </div>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--muted)' }}
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
    <div className="card overflow-hidden">
      {/* Header strip */}
      <div
        className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ borderBottom: '1px solid var(--hairline-light)', background: 'var(--surface-warm)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Megaphone size={14} style={{ color: 'var(--ink-3)' }} />
          <Link
            href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
            className="text-sm font-semibold truncate transition-opacity hover:opacity-70"
            style={{ color: 'var(--ink)' }}
            title={campaign.name || campaign.topic || 'Untitled'}
          >
            {campaign.name || campaign.topic || 'Untitled campaign'}
          </Link>
          {campaign.name && campaign.topic && (
            <span className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
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
              className="chip chip-neutral mono hover:opacity-75 transition-opacity"
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
            style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}
          >
            {image?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.imageUrl}
                alt={variant?.headline || 'Ad creative'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2" style={{ color: 'var(--ink-3)' }}>
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
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
            >
              <PlayCircle size={13} />
              Watch video variant
              <ExternalLink size={11} className="ml-auto" />
            </a>
          )}

          {roasEntries.length > 0 && (
            <div className="card-inset p-3 space-y-1.5">
              <p className="micro-label">
                Learned Audience ROAS
              </p>
              {roasEntries.map(({ audience, roas, n }) => (
                <div key={audience} className="flex items-center justify-between gap-2">
                  <span
                    className="text-[11px] capitalize truncate"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {audience.replace(/_/g, ' ')}
                  </span>
                  <span
                    className="text-[11px] font-semibold mono tabular-nums"
                    style={{ color: roas >= 1.5 ? 'var(--good)' : roas >= 1 ? 'var(--warn)' : 'var(--bad)' }}
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
                style={{ color: 'var(--ink)' }}
              >
                {variant.primaryText || '—'}
              </p>
              {variant.headline && (
                <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                  <span className="micro-label mr-2">
                    Headline
                  </span>
                  {variant.headline}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {variant.cta && (
                  <span className="chip chip-good">
                    CTA · {variant.cta}
                  </span>
                )}
                {variant.hookStyle && (
                  <span className="chip chip-accent capitalize">
                    {variant.hookStyle.replace(/_/g, ' ')}
                  </span>
                )}
                {campaign.objective && (
                  <span className="chip chip-neutral capitalize">
                    {campaign.objective.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs italic" style={{ color: 'var(--ink-3)' }}>
              No copy variant selected yet — creative may still be in progress.
            </p>
          )}

          {/* Audience-stage badges */}
          {variants.length > 1 && (
            <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              Showing variant {idx + 1} of {variants.length}
            </p>
          )}

          {/* Budget + cap row */}
          <div className="card-inset p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="micro-label">
                  Daily budget
                </p>
                {budgetEditing ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm" style={{ color: 'var(--ink-3)' }}>₹</span>
                    <input
                      type="number"
                      value={budgetDraft}
                      onChange={(e) => setBudgetDraft(e.target.value)}
                      className="input mono w-28 tabular-nums"
                      style={{ padding: '4px 8px', borderColor: 'var(--accent-border)' }}
                      autoFocus
                    />
                    <button
                      onClick={saveBudget}
                      disabled={budgetState === 'loading'}
                      className="btn btn-accent"
                      style={{ padding: '5px 12px', fontSize: '12px' }}
                    >
                      {budgetState === 'loading' ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setBudgetEditing(false)
                        setBudgetDraft(String(campaign.budget ?? 0))
                      }}
                      className="text-xs"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-base font-semibold mono tabular-nums"
                      style={{ color: 'var(--ink)' }}
                    >
                      {formatCurrency(budget)}
                    </span>
                    <button
                      onClick={() => setBudgetEditing(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded transition-opacity hover:opacity-70"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Pencil size={10} /> Edit
                    </button>
                  </div>
                )}
              </div>

              {weeklyCap > 0 && (
                <div className="text-right">
                  <p className="micro-label">
                    If approved
                  </p>
                  <p
                    className="text-sm font-semibold mono tabular-nums mt-1"
                    style={{ color: overCap ? 'var(--bad)' : 'var(--ink)' }}
                  >
                    {formatCurrency(projectedCommitted)} / {formatCurrency(weeklyCap)}{' '}
                    <span
                      className={`chip ml-1 ${
                        overCap ? 'chip-bad' : projectedPct >= 70 ? 'chip-warn' : 'chip-good'
                      }`}
                    >
                      {projectedPct}%
                    </span>
                  </p>
                </div>
              )}
            </div>
            {overCap && (
              <p className="text-[11px] mt-2" style={{ color: 'var(--bad)' }}>
                Approving this campaign will exceed your weekly cap.
              </p>
            )}
          </div>

          {/* Account picker if multiple */}
          {accountIds.length > 1 && (
            <div className="space-y-1">
              <p className="micro-label">
                Launch on Meta account
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {accountIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => setAccountId(id)}
                    className={`chip transition-all ${accountId === id ? 'chip-accent' : 'chip-neutral'}`}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap pt-2">
            <button
              onClick={() => setApproveOpen(true)}
              disabled={approveState === 'loading' || !accountId}
              className="btn btn-lg btn-primary"
            >
              {approveState === 'loading' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Yes, launch this ad
            </button>

            <button
              onClick={() => setRejectOpen(true)}
              disabled={rejectState === 'loading'}
              className="btn btn-lg btn-danger"
            >
              <XCircle size={16} />
              No, reject this
            </button>

            <Link
              href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
              className="ml-auto inline-flex items-center gap-1 font-medium hover:underline"
              style={{ color: 'var(--accent-strong)', fontSize: 14 }}
            >
              See full details <ChevronRight size={14} />
            </Link>
          </div>

          {!accountId && (
            <p style={{ color: 'var(--bad)', fontSize: 13 }}>
              Connect a Meta account in Settings before you can launch this.
            </p>
          )}
        </div>
      </div>

      {/* Approve confirmation */}
      <ConfirmModal
        open={approveOpen}
        title="Launch this ad on Meta?"
        description={`We'll create the live ad on your ${accountId} account, spending up to ${formatCurrency(budget)} per day.${
          overCap ? ' Heads up: this will push you over your weekly budget.' : ''
        }`}
        confirmLabel="Yes, launch it"
        loading={approveState === 'loading'}
        onCancel={() => setApproveOpen(false)}
        onConfirm={doApprove}
      />

      {/* Reject inline drawer */}
      {rejectOpen && (
        <div
          className="px-5 py-4"
          style={{ background: 'var(--bad-bg)', borderTop: '1px solid var(--bad-border)' }}
        >
          <p className="micro-label mb-2" style={{ color: 'var(--bad)' }}>
            Reason for rejection
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="What's wrong with this campaign? The agent will learn from this."
            className="input resize-none"
            style={{ borderColor: 'var(--bad-border)' }}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={doReject}
              disabled={rejectState === 'loading' || !rejectReason.trim()}
              className="btn btn-danger"
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              {rejectState === 'loading' ? 'Rejecting…' : 'Confirm reject'}
            </button>
            <button
              onClick={() => {
                setRejectOpen(false)
                setRejectReason('')
              }}
              className="text-xs"
              style={{ color: 'var(--ink-3)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
