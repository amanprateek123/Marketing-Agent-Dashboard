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
  Target,
  Bot,
  User,
  Trash2,
} from 'lucide-react'
import {
  FormatBadge,
} from '@/components/badges'
import { EmptyState } from '@/components/ui/EmptyState'
import { Details } from '@/components/plain/Details'
import { errorDetail } from '@/lib/plain-language'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { LaunchReview } from '@/components/campaign/LaunchReview'
import { formatCurrency } from '@/lib/utils'
import {
  getCampaigns,
  getCompany,
  getWeeklySpend,
  approveCampaign,
  rejectCampaign,
  deleteCampaign,
  updateCampaignBudget,
  getMetaAccounts,
  getMetaAccountAudiences,
} from '@/lib/api'
import type { Campaign, CampaignLaunchReview, Company, CopyVariant, CreativeImage, MetaAdAccount, MetaCustomAudience, AdSetConfig } from '@/types'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

type ActionState = 'idle' | 'loading' | 'success' | 'error'

interface Toast {
  kind: 'success' | 'error'
  text: string
}

const CAMPAIGN_OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_SALES: 'Sales · purchases',
  OUTCOME_AWARENESS: 'Awareness · reach',
  OUTCOME_TRAFFIC: 'Website traffic',
  OUTCOME_LEADS: 'Lead generation',
  OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_APP_PROMOTION: 'App growth',
  sales_purchase: 'Sales · purchases',
  awareness_reach: 'Awareness · reach',
  traffic: 'Website traffic',
  leads: 'Lead generation',
  engagement: 'Engagement',
  app_promotion: 'App growth',
}

function campaignObjectiveLabel(value: string): string {
  return CAMPAIGN_OBJECTIVE_LABELS[value]
    ?? value.replace(/^OUTCOME_/, '').replace(/_/g, ' ').toLowerCase()
}

export default function ApprovalsPage({ params }: PageProps) {
  const { tenantId } = use(params)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [weeklySpend, setWeeklySpend] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  // Friendly account names — best-effort (needs a Meta access token on
  // file), falls back to raw act_XXXX ids everywhere below when empty.
  const [accountOptions, setAccountOptions] = useState<MetaAdAccount[]>([])

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
      getMetaAccounts(tenantId, true).then((res) => setAccountOptions(res.accounts)).catch(() => {})
    } catch (err) {
      setError(errorDetail(err))
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

  const headerSubtitle = loading
    ? 'Meridian is gathering your latest campaign drafts and launch controls.'
    : error
      ? 'Campaign drafts could not be loaded. Retry before making any launch decision.'
      : pending.length === 0
        ? 'Nothing is waiting right now. Meridian will bring completed campaign drafts here before any Meta spend can begin.'
        : pending.length === 1
          ? 'Meridian prepared 1 campaign strategy. Verify the creative, destination, tracking and budget before choosing whether it launches.'
          : `Meridian prepared ${pending.length} campaign strategies. Verify each creative, destination, tracking setup and budget before choosing what launches.`

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1600px] mx-auto stagger">
      {/* Header */}
      <div className="flex items-end justify-between gap-5 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="micro-label">Human launch control</span>
            <span className="chip chip-good">
              <ShieldCheck size={10} /> Spend protected
            </span>
          </div>
          <h1 className="page-title">Review the strategy. Control every launch.</h1>
          <p className="page-subtitle max-w-3xl">
            {headerSubtitle}
          </p>
        </div>

        <button onClick={load} disabled={loading} className="btn btn-ghost">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <ApprovalJourney pending={pending.length} loading={loading} />

      {/* Toast */}
      {toast && (
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm"
          role={toast.kind === 'error' ? 'alert' : 'status'}
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
          role="alert"
          style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}
        >
          <AlertCircle size={14} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">We couldn&apos;t load your drafts. Try again.</p>
            <Details className="mt-1.5" title="What went wrong" items={[{ label: 'Message', value: error }]} />
          </div>
          <button type="button" onClick={load} className="btn btn-ghost">
            <RefreshCw size={12} /> Try again
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="card flex items-center justify-center py-20 gap-3" aria-live="polite">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
          >
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Preparing your launch reviews</p>
            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>Checking the latest campaign drafts and budget controls…</p>
          </div>
        </div>
      ) : error ? null : pending.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ShieldCheck}
            title="Every launch decision is complete"
            subtitle="Start a conversation with Campaign Copilot when you are ready to turn another growth goal into a campaign."
          />
          <div className="flex justify-center pb-8 -mt-5">
            <Link href={`/dashboard/${tenantId}/campaign-copilot`} className="btn btn-accent">
              <Bot size={14} /> Build with Campaign Copilot
            </Link>
          </div>
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
              accountOptions={accountOptions}
              onChanged={load}
              flash={flash}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ApprovalJourney({ pending, loading }: { pending: number; loading: boolean }) {
  const steps = [
    {
      label: 'Strategy prepared',
      detail: loading ? 'Checking campaign drafts…' : 'Goal, audience, budget and creative',
      done: !loading,
    },
    { label: 'Safety review', detail: 'Destination, tracking and limits', done: false },
    { label: 'Your decision', detail: pending ? `${pending} waiting for approval` : 'No decisions waiting', done: false },
    { label: 'Meta launch', detail: 'Only after your approval', done: false },
  ]

  return (
    <section className="card overflow-hidden mb-5" aria-label="Approval journey">
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-px"
        style={{ background: 'var(--hairline-light)' }}
      >
        {steps.map((step, index) => {
          const active = !loading && pending > 0 && (index === 1 || index === 2)
          return (
            <div
              key={step.label}
              className="px-4 py-3.5 flex items-center gap-3"
              style={{ background: active ? 'var(--accent-bg)' : 'var(--surface)' }}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{
                  color: step.done ? '#fff' : active ? 'var(--accent)' : 'var(--ink-3)',
                  background: step.done ? 'var(--good)' : active ? 'var(--surface)' : 'var(--muted)',
                  border: active ? '1px solid var(--accent-border)' : undefined,
                }}
              >
                {step.done ? <Check size={13} /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold truncate" style={{ color: 'var(--ink)' }}>
                  {step.label}
                </span>
                <span className="block text-[10.5px] truncate" style={{ color: 'var(--ink-3)' }}>
                  {step.detail}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Weekly cap progress bar ────────────────────────────────────────────────
function WeeklyCapBar({ committed, cap }: { committed: number; cap: number }) {
  const pct = Math.min(100, Math.round((committed / cap) * 100))
  const remaining = Math.max(0, cap - committed)
  const tone =
    pct >= 90 ? { fg: 'var(--bad)', bar: 'var(--bad)', chip: 'chip-bad' }
    : pct >= 70 ? { fg: 'var(--warn)', bar: 'var(--warn)', chip: 'chip-warn' }
    : { fg: 'var(--good)', bar: 'var(--good)', chip: 'chip-good' }

  return (
    <div className="card px-5 py-4 mb-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} style={{ color: tone.fg }} />
          <div>
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Weekly spend guard</span>
            <p className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
              Protects every Meridian-managed launch
            </p>
          </div>
        </div>
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span className="font-semibold" style={{ color: tone.fg }}>
            {formatCurrency(committed)}
          </span>
          <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>
            of {formatCurrency(cap)} used
          </span>
          <span className={`chip ${tone.chip} ml-1`}>{pct}% used</span>
        </div>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--muted)' }}
        role="progressbar"
        aria-label="Weekly spend guard usage"
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={Math.min(committed, cap)}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: tone.bar }}
        />
      </div>
      <p className="text-[10.5px] mt-2 text-right" style={{ color: 'var(--ink-3)' }}>
        {formatCurrency(remaining)} remains within this week&apos;s limit
      </p>
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
  accountOptions,
  onChanged,
  flash,
}: {
  tenantId: string
  campaign: Campaign
  company: Company | null
  committedWeekly: number
  weeklyCap: number
  accountIds: string[]
  accountOptions: MetaAdAccount[]
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

  // Prefer the account the campaign was built for (Create Campaign form, or
  // a prior manual pick) — audiences below are only valid on that same
  // account. Falls back to the tenant's first configured account.
  const preferredAccountId = campaign.metaAccountId
    ? campaign.metaAccountId.startsWith('act_')
      ? campaign.metaAccountId
      : `act_${campaign.metaAccountId}`
    : undefined
  const [accountId, setAccountId] = useState<string | null>(
    (preferredAccountId && accountIds.includes(preferredAccountId) ? preferredAccountId : accountIds[0]) ?? null,
  )
  const [approveState, setApproveState] = useState<ActionState>('idle')
  const [approveOpen, setApproveOpen] = useState(false)

  // Pre-launch review. Null while loading, or when /review itself failed —
  // in that case we don't block the operator (the launch endpoint runs the
  // same checks server-side and will refuse on its own), we just can't show
  // them the destination up front.
  const [review, setReview] = useState<CampaignLaunchReview | null>(null)
  const launchBlocked = !!review && !review.ready

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectState, setRejectState] = useState<ActionState>('idle')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteState, setDeleteState] = useState<ActionState>('idle')

  function accountLabel(id: string) {
    const bare = id.replace(/^act_/, '')
    const found = accountOptions.find((a) => a.id.replace(/^act_/, '') === bare)
    return found ? found.name : `Ad account ending ${bare.slice(-4)}`
  }

  // Custom/lookalike audiences are account-scoped Meta objects — resolve
  // metaAudienceId -> name against whichever account is currently selected,
  // live, since audiences created for one account aren't valid (or even
  // visible) under another.
  const [audienceNames, setAudienceNames] = useState<Record<string, MetaCustomAudience>>({})
  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    getMetaAccountAudiences(tenantId, accountId.startsWith('act_') ? accountId : `act_${accountId}`)
      .then((list) => {
        if (cancelled) return
        const byId: Record<string, MetaCustomAudience> = {}
        for (const a of list) byId[a.id] = a
        setAudienceNames(byId)
      })
      .catch(() => { if (!cancelled) setAudienceNames({}) })
    return () => { cancelled = true }
  }, [tenantId, accountId])

  const adSets: AdSetConfig[] = campaign.campaignConfig?.adSets ?? []

  const budget = campaign.budget ?? 0
  const projectedWeeklyCampaign = budget * 7
  const projectedCommitted = committedWeekly + projectedWeeklyCampaign
  const projectedPct = weeklyCap > 0
    ? Math.min(100, Math.round((projectedCommitted / weeklyCap) * 100))
    : 0
  const overCap = weeklyCap > 0 && projectedCommitted > weeklyCap

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
    } catch {
      setBudgetState('error')
      flash('error', "We couldn't change the budget. Try again.")
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
    } catch {
      setApproveState('error')
      flash('error', "We couldn't launch the campaign. Try again.")
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
    } catch {
      setRejectState('error')
      flash('error', "We couldn't reject the campaign. Try again.")
      setTimeout(() => setRejectState('idle'), 3000)
    }
  }

  async function doDelete() {
    setDeleteState('loading')
    try {
      await deleteCampaign(tenantId, campaign._id)
      setDeleteState('success')
      flash('success', 'Campaign deleted')
      setDeleteOpen(false)
      onChanged()
    } catch {
      setDeleteState('error')
      flash('error', "We couldn't delete the draft. Try again.")
      setTimeout(() => setDeleteState('idle'), 3000)
    }
  }

  return (
    <article className="card overflow-hidden animate-fade-up" aria-labelledby={`campaign-${campaign._id}`}>
      {/* Header strip */}
      <div
        className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{ borderBottom: '1px solid var(--hairline-light)', background: 'var(--surface-warm)' }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
          >
            <Megaphone size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="chip chip-warn">Pending your decision</span>
              <span className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>No spend started</span>
            </div>
            <Link
              id={`campaign-${campaign._id}`}
              href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
              className="text-base font-semibold truncate block transition-opacity hover:opacity-70"
              style={{ color: 'var(--ink)' }}
              title={campaign.name || campaign.topic || 'Untitled'}
            >
              {campaign.name || campaign.topic || 'Untitled campaign'}
            </Link>
            {campaign.name && campaign.topic && (
              <p className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                {campaign.topic}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <span className="chip chip-accent" title={campaign.source === 'agent' ? 'Strategy and campaign prepared by Meridian' : campaign.source === 'human' ? 'Created using Meridian tools' : 'Created in Meridian'}>
            {campaign.source === 'agent' ? <Bot size={11} /> : <User size={11} />}
            {campaign.source === 'agent' ? 'Built with AI' : 'Built in Meridian'}
          </span>
          <FormatBadge format={campaign.creativeFormat} />
          {campaign.runId && (
            <Link
              href={`/dashboard/${tenantId}/runs/${campaign.runId}`}
              className="chip chip-neutral hover:opacity-75 transition-opacity"
              title="See how this campaign was made"
            >
              See how it was made
            </Link>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 grid gap-5 lg:grid-cols-[minmax(240px,300px)_1fr]">
        {/* Left: Creative preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="micro-label">What customers will see</p>
            {variants.length > 1 && (
              <span className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                Creative {idx + 1} of {variants.length}
              </span>
            )}
          </div>
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

        </div>

        {/* Right: strategy, safety and launch decision */}
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="micro-label">Campaign message</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                Review the customer-facing copy, then verify how delivery is configured.
              </p>
            </div>
            {campaign.objective && (
              <span className="chip chip-accent capitalize">
                <Target size={10} /> Goal · {campaignObjectiveLabel(campaign.objective)}
              </span>
            )}
          </div>
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
              </div>
            </div>
          ) : (
            <p className="text-xs italic" style={{ color: 'var(--ink-3)' }}>
              No copy variant selected yet — creative may still be in progress.
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
                This campaign projects {formatCurrency(projectedWeeklyCampaign)} over seven days and would exceed your weekly cap.
              </p>
            )}
            {!overCap && weeklyCap > 0 && (
              <p className="text-[10.5px] mt-2" style={{ color: 'var(--ink-3)' }}>
                Seven-day projection: {formatCurrency(projectedWeeklyCampaign)}. The server rechecks this limit atomically when you approve.
              </p>
            )}
          </div>

          {/* Account picker — always shown, even with one account, so it's
              always clear where this will actually launch. */}
          {accountIds.length > 0 && (
            <div className="space-y-1">
              <p className="micro-label">
                Launch on Meta account
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {accountIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => setAccountId(id)}
                    disabled={accountIds.length === 1}
                    className={`chip transition-all ${accountId === id ? 'chip-accent' : 'chip-neutral'}`}
                  >
                    {accountLabel(id)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* What approving actually does — destination, tracking, targeting.
              Server-resolved (GET /review), so this is the URL, pixel and
              conversion event Meta will really receive, not fields read off
              the campaign document. `ready` gates the launch button below. */}
          <LaunchReview
            tenantId={tenantId}
            campaignId={campaign._id}
            products={company?.products ?? []}
            onReview={setReview}
          />

          {/* Ad-set targeting with audience names resolved live against the
              SELECTED account — the review can't do this, since it doesn't
              know which account the operator has picked in this session. */}
          {adSets.some((a) => a.metaAudienceId) && (
            <div className="space-y-2">
              <p className="micro-label flex items-center gap-1.5">
                <Target size={11} /> Audiences on the selected account
              </p>
              <div className="space-y-2">
                {adSets.map((a, i) => (
                  <AdSetTargetingRow key={i} adSet={a} showBudgetSplit={adSets.length > 1} audienceNames={audienceNames} copyVariants={variants} />
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div
            className="rounded-xl p-3.5 sm:p-4 flex items-center justify-between gap-4 flex-wrap"
            style={{
              background: launchBlocked ? 'var(--warn-bg)' : 'var(--good-bg)',
              border: `1px solid ${launchBlocked ? 'var(--warn-border)' : 'var(--good-border)'}`,
            }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {launchBlocked ? 'This launch still needs attention' : 'Final decision stays with you'}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                {launchBlocked
                  ? 'Resolve the safety blockers above before Meta can receive this campaign.'
                  : `Approval creates the campaign on ${accountId ? accountLabel(accountId) : 'your selected account'} with a ${formatCurrency(budget)}/day limit.`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setApproveOpen(true)}
                disabled={approveState === 'loading' || !accountId || launchBlocked}
                className="btn btn-lg btn-accent"
                title={
                  launchBlocked
                    ? `Fix ${review!.blockers.length} thing${review!.blockers.length === 1 ? '' : 's'} above first`
                    : undefined
                }
              >
                {approveState === 'loading' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {launchBlocked ? 'Resolve blockers first' : 'Approve & launch on Meta'}
              </button>

              <button
                onClick={() => setRejectOpen(true)}
                disabled={rejectState === 'loading'}
                className="btn btn-danger"
              >
                <XCircle size={14} />
                Reject
              </button>

              <button
                onClick={() => setDeleteOpen(true)}
                disabled={deleteState === 'loading'}
                className="btn btn-ghost"
                title="Remove this pending campaign entirely — different from Reject, which keeps a record with a reason"
              >
                {deleteState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
            <Link
              href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
              className="w-full inline-flex items-center justify-end gap-1 font-medium hover:underline"
              style={{ color: 'var(--accent-strong)', fontSize: 13 }}
            >
              View every campaign detail <ChevronRight size={14} />
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
        title="Approve this campaign for Meta launch?"
        description={`Meridian will create the campaign on ${accountId ? accountLabel(accountId) : 'your selected account'}, with a daily limit of ${formatCurrency(budget)}.${
          overCap ? ' Heads up: this will push you over your weekly budget.' : ''
        }`}
        confirmLabel="Approve & launch"
        loading={approveState === 'loading'}
        onCancel={() => setApproveOpen(false)}
        onConfirm={doApprove}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={deleteOpen}
        title="Delete this pending campaign?"
        description="This removes the campaign and its creative entirely — it never launched to Meta, so there's nothing to clean up there. This can't be undone; use Reject instead if you want to keep a record with a reason."
        confirmLabel="Yes, delete it"
        loading={deleteState === 'loading'}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={doDelete}
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
    </article>
  )
}

// ── Ad set targeting row ────────────────────────────────────────────────────
function audienceTypeLabel(type: string) {
  switch (type) {
    case 'custom': return 'Custom audience'
    case 'retarget': return 'Retarget (custom audience)'
    case 'lookalike': return 'Lookalike audience'
    case 'interest': return 'Interest-based (prospecting)'
    case 'advantage_plus': return 'Advantage+ (automatic)'
    default: return type
  }
}

function AdSetTargetingRow({
  adSet,
  showBudgetSplit,
  audienceNames,
  copyVariants,
}: {
  adSet: AdSetConfig
  showBudgetSplit: boolean
  audienceNames: Record<string, MetaCustomAudience>
  copyVariants: CopyVariant[]
}) {
  const resolvedAudience = adSet.metaAudienceId ? audienceNames[adSet.metaAudienceId] : undefined
  // Only worth calling out when it's a genuine subset — every ad set gets
  // every variant by default, so showing this for the common case is noise.
  const isCreativeSubset = !!adSet.ads?.length && adSet.ads.length < copyVariants.length

  return (
    <div className="card-inset p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{adSet.name}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {showBudgetSplit && <span className="chip chip-neutral">{adSet.budgetPercent}% of budget</span>}
          <span className="chip chip-accent">{audienceTypeLabel(adSet.audienceType)}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--ink-2)' }}>
        {adSet.metaAudienceId && resolvedAudience && (
          <span>
            <span className="micro-label mr-1">Audience</span>
            {resolvedAudience.name}
            {resolvedAudience.approxSizeLower != null && resolvedAudience.approxSizeLower >= 0 ? ` (~${resolvedAudience.approxSizeLower.toLocaleString()})` : ''}
          </span>
        )}
        {adSet.metaAudienceId && !resolvedAudience && (
          <span>
            <span className="micro-label mr-1">Audience</span>
            <span className="mono">{adSet.metaAudienceId}</span>{' '}
            <span style={{ color: 'var(--warn)' }}>— not found on the selected account. It may belong to a different ad account and fail at launch.</span>
          </span>
        )}
        {(adSet.ageMin != null || adSet.ageMax != null) && (
          <span><span className="micro-label mr-1">Age</span>{adSet.ageMin ?? 18}–{adSet.ageMax ?? 65}</span>
        )}
        {adSet.gender && adSet.gender !== 'all' && (
          <span className="capitalize"><span className="micro-label mr-1">Gender</span>{adSet.gender}</span>
        )}
        {adSet.geoLocations?.length ? (
          <span><span className="micro-label mr-1">Geo</span>{adSet.geoLocations.join(', ')}</span>
        ) : null}
        {adSet.interests?.length ? (
          <span><span className="micro-label mr-1">Interests</span>{adSet.interests.length} selected</span>
        ) : null}
        {adSet.optimizationGoal && (
          <span className="capitalize"><span className="micro-label mr-1">Optimizing for</span>{adSet.optimizationGoal.replace(/_/g, ' ').toLowerCase()}</span>
        )}
        {isCreativeSubset && (
          <span>
            <span className="micro-label mr-1">Creatives</span>
            {adSet.ads!.map(i => copyVariants[i]?.headline || `Variant ${i + 1}`).join(', ')}
          </span>
        )}
      </div>
    </div>
  )
}
