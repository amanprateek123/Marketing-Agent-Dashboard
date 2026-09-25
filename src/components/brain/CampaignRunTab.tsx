'use client'

/**
 * What is being built, and what will actually go out.
 *
 * This tab is for the person deciding whether to spend the money, not for anyone debugging the
 * pipeline. So it deliberately shows none of the machinery: no Foundry run ids, no agent names,
 * no stage-dispatch rows, no raw JSON, no Meta object ids. All of that exists and none of it
 * answers "is this campaign worth switching on".
 *
 * What it does show, in the order a person actually asks for it:
 *
 *   1. Which campaign runs exist, newest first — pick one.
 *   2. Where that one has got to, in four plain steps.
 *   3. The brief it is working to: budget, audiences, how many ads, which languages.
 *   4. The finished ads themselves — the picture and the exact words that ship with it.
 *
 * The bridge does the translating; nothing here re-derives a label from a raw status, because two
 * places deciding what `short` means is how they end up disagreeing.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDashed,
  Clock,
  ImageIcon,
  Loader2,
  Megaphone,
  TriangleAlert,
} from 'lucide-react'
import {
  getCampaignRun,
  getCampaignRunCreatives,
  getCampaignRuns,
} from '@/lib/brain-api'
import type {
  BrainCampaignCreative,
  BrainCampaignRun,
  BrainCampaignRunSummary,
  BrainCampaignStep,
  BrainRunTone,
  BrainTabKey,
} from '@/types/brain'
import { cn } from '@/lib/utils'
import { errorDetail, formatRelative, formatWhen, humanise, plainStatus } from '@/lib/plain-language'
import { BrainError, BrainSkeleton, BudgetAuthorityNotice, SectionCard, plainIfCode } from './shared'
import { CreativePreviewModal } from '@/components/ui/CreativePreviewModal'

/** Tone → chip class. One table, so the whole tab says the same colour for the same thing. */
const TONE_CHIP: Record<BrainRunTone, string> = {
  progress: 'chip-accent',
  waiting: 'chip-warn',
  good: 'chip-good',
  bad: 'chip-bad',
  idle: 'chip-neutral',
}

/** The four steps, drawn as state rather than as prose. */
const STEP_ICON = {
  done: Check,
  running: Loader2,
  waiting_for_human: Clock,
  blocked: CircleDashed,
  failed: TriangleAlert,
  idle: CircleDashed,
} as const

const STEP_TONE: Record<string, BrainRunTone> = {
  done: 'good',
  running: 'progress',
  waiting_for_human: 'waiting',
  blocked: 'idle',
  failed: 'bad',
  idle: 'idle',
}

/** Step state in words — from the shared vocabulary, so it matches the Pipeline tab. */
function stepWord(state: string): string {
  return plainStatus('stageState', state).label
}

/** A date-only or ISO value as a human date; anything else (already words) passes through. */
function humanDate(value: string | null | undefined): string {
  if (!value) return '—'
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? formatWhen(value) : value
}

/** Meta call-to-action codes ("LEARN_MORE") read as words ("Learn more"). */
function plainCta(cta: string): string {
  return /^[A-Z0-9]+(_[A-Z0-9]+)*$/.test(cta) ? humanise(cta) : cta
}

interface CampaignRunTabProps {
  tenantId: string
  onGoToTab: (tab: BrainTabKey) => void
}

export function CampaignRunTab({ tenantId, onGoToTab }: CampaignRunTabProps) {
  const [runs, setRuns] = useState<BrainCampaignRunSummary[] | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  /** Bumped to retry. A counter rather than a callback so the effect stays the only fetcher. */
  const [reload, setReload] = useState(0)

  // The fetch lives inside the effect, with a cancel flag, rather than in a useCallback the
  // effect then calls: nothing is set synchronously in the effect body, and a response for an
  // old tenant cannot land after the component has moved on.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const next = await getCampaignRuns(tenantId)
        if (cancelled) return
        setRuns(next)
        setError('')
      } catch (err) {
        if (cancelled) return
        setError(errorDetail(err) || 'Could not read the campaigns.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, reload])

  if (error) return <BrainError message={error} onRetry={() => setReload((n) => n + 1)} />
  if (!runs) return <BrainSkeleton rows={3} />

  if (selected) {
    return (
      <CampaignRunDetail
        tenantId={tenantId}
        runId={selected}
        onBack={() => setSelected(null)}
        onGoToTab={onGoToTab}
      />
    )
  }

  return <CampaignRunList runs={runs} onOpen={setSelected} />
}

/* ── The list ───────────────────────────────────────────────────────────────── */

function CampaignRunList({
  runs,
  onOpen,
}: {
  runs: BrainCampaignRunSummary[]
  onOpen: (runId: string) => void
}) {
  const live = runs.filter((r) => r.isLive).length
  const active = runs.filter((r) => r.tone === 'progress' || r.tone === 'waiting').length

  return (
    <SectionCard
      title="Campaigns the Brain has set up"
      description={
        runs.length === 0
          ? 'Nothing has been set up yet.'
          : `${runs.length} in total · ${active} still in progress · ${live} live`
      }
      padded={false}
    >
      {runs.length === 0 ? (
        <div className="py-12 text-center">
          <Megaphone size={22} aria-hidden="true" style={{ color: 'var(--ink-4)' }} className="mx-auto" />
          <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
            No campaigns yet
          </p>
          <p className="explain mx-auto mt-1 max-w-[46ch]">
            The Brain starts one when it decides a product is worth spending on. You will see it
            here from the moment it begins.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Type</th>
                <th scope="col">Where it is</th>
                <th scope="col">Ads</th>
                <th scope="col">Started</th>
                <th scope="col" aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.runId}
                  onClick={() => onOpen(run.runId)}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${run.product}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpen(run.runId)
                    }
                  }}
                >
                  <td>
                    <span className="block max-w-[32ch] break-words text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                      {run.product}
                    </span>
                  </td>
                  <td>
                    <span className="explain">{plainIfCode(run.campaignType, 'campaignType')}</span>
                  </td>
                  <td>
                    {/* While a run is moving, where it has got to is the news. Once it has stopped,
                        how it ended is — a cancelled run led by "Finished" reads as a success. */}
                    {(() => {
                      const moving = run.tone === 'progress' || run.tone === 'waiting'
                      const lead = moving ? run.stageLabel : run.statusLabel
                      const rest = moving ? run.statusLabel : run.stageLabel
                      return (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={cn('chip', TONE_CHIP[run.tone])}>{lead}</span>
                          {rest !== lead && <span className="explain">{rest}</span>}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="num">
                    <span className="explain tabular-nums">
                      {run.creativesChosen === null
                        ? '—'
                        : run.creativesPlanned
                          ? `${run.creativesChosen} of ${run.creativesPlanned}`
                          : String(run.creativesChosen)}
                    </span>
                  </td>
                  <td>
                    <span className="explain whitespace-nowrap">{humanDate(run.startedOn)}</span>
                  </td>
                  <td>
                    <ArrowRight size={14} style={{ color: 'var(--accent)' }} aria-hidden="true" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

/* ── One campaign ───────────────────────────────────────────────────────────── */

function CampaignRunDetail({
  tenantId,
  runId,
  onBack,
  onGoToTab,
}: {
  tenantId: string
  runId: string
  onBack: () => void
  onGoToTab: (tab: BrainTabKey) => void
}) {
  const [run, setRun] = useState<BrainCampaignRun | null>(null)
  const [creatives, setCreatives] = useState<BrainCampaignCreative[] | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<BrainCampaignCreative | null>(null)
  const [reload, setReload] = useState(0)

  // The cancel flag matters here more than on the list: opening a second campaign while the
  // first is still loading would otherwise paint the wrong run's ads under the right run's title.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [detail, ads] = await Promise.all([
          getCampaignRun(tenantId, runId),
          getCampaignRunCreatives(tenantId, runId),
        ])
        if (cancelled) return
        setRun(detail)
        setCreatives(ads)
        setError('')
      } catch (err) {
        if (cancelled) return
        setError(errorDetail(err) || 'Could not read that campaign.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, runId, reload])

  const back = (
    <button type="button" onClick={onBack} className="btn btn-ghost">
      <ArrowLeft size={14} aria-hidden="true" />
      All campaigns
    </button>
  )

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <div>{back}</div>
        <BrainError message={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    )
  }
  if (!run) {
    return (
      <div className="flex flex-col gap-4">
        <div>{back}</div>
        <BrainSkeleton rows={3} />
      </div>
    )
  }

  const gateStep = run.steps.find((s) => s.gateId)

  return (
    <div className="flex flex-col gap-4">
      <div>{back}</div>

      {/* What this is, and whether it needs you. */}
      <SectionCard
        title={<span className="break-words">{run.product}</span>}
        description={`${plainIfCode(run.campaignType, 'campaignType')} · started ${humanDate(run.startedOn)}${
          run.updatedAt ? ` · last update ${formatRelative(run.updatedAt)}` : ''
        }`}
        action={<span className={cn('chip', TONE_CHIP[run.tone])}>{run.statusLabel}</span>}
      >
        {run.whatHappened && <p className="insight-quote break-words">{run.whatHappened}</p>}

        {run.needsYou && (
          <div
            className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
          >
            <span className="flex min-w-0 items-center gap-2 break-words text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
              <Clock size={14} aria-hidden="true" className="shrink-0" />
              {run.needsYou}
            </span>
            {gateStep?.gateId && (
              <button type="button" className="btn btn-accent" onClick={() => onGoToTab('approvals')}>
                Go to approvals
              </button>
            )}
          </div>
        )}

        {/* The brain's own verdict on the budget. When the contract and the authorised amount
            disagree, the Builder will not build — so it is said here, with the brain's reason. */}
        {run.budgetAuthority && (
          <div className="mt-3">
            <BudgetAuthorityNotice authority={run.budgetAuthority} />
          </div>
        )}
      </SectionCard>

      {/* Where it has got to. */}
      <SectionCard
        title="Where it has got to"
        description="Four steps, from writing the ads to switching them on."
      >
        <ol className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {run.steps.map((step, index) => (
            <StepCard key={step.key} step={step} index={index} />
          ))}
        </ol>
      </SectionCard>

      {/* The brief — "the fields going in", as labelled facts. */}
      {run.brief.length > 0 && (
        <SectionCard
          title="What it was told to do"
          description="The instructions this campaign is being built to."
        >
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {run.brief.map((field) => (
              <div key={field.label} className="card-inset min-w-0 p-3.5">
                <dt className="micro-label">{field.label}</dt>
                <dd className="mt-1 break-words text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                  {field.value}
                </dd>
                {field.hint && <p className="explain mt-1 break-words">{field.hint}</p>}
              </div>
            ))}
          </dl>
        </SectionCard>
      )}

      {/* Who it will be shown to. */}
      {run.audiences.length > 0 && (
        <SectionCard
          title="Who it will be shown to"
          description={
            run.audiences.length === 1
              ? 'One audience.'
              : `${run.audiences.length} audiences, each with its own share of the budget.`
          }
        >
          <ul className="flex flex-col gap-3">
            {run.audiences.map((audience, index) => (
              <li key={`${audience.name}-${index}`} className="card-inset p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="min-w-0 break-words text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {audience.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {audience.budget && <span className="chip chip-accent">{audience.budget}</span>}
                    {audience.adsPlanned !== null && (
                      <span className="explain">
                        {audience.adsPlanned} ad{audience.adsPlanned === 1 ? '' : 's'}
                      </span>
                    )}
                  </span>
                </div>
                {audience.excludes && <p className="explain mt-1.5 break-words">{audience.excludes}</p>}
                {audience.why && (
                  <p className="mt-2 break-words text-[13px]" style={{ color: 'var(--ink-2)' }}>
                    {audience.why}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* The ads themselves. */}
      <CreativeGrid
        creatives={creatives}
        onOpen={setPreview}
        stillBuilding={run.tone === 'progress'}
      />

      {preview && (
        <CreativePreviewModal
          open
          onClose={() => setPreview(null)}
          mediaUrl={preview.imageUrl ?? ''}
          mediaType="image"
          headline={preview.headline ?? undefined}
          primaryText={preview.caption ?? undefined}
          cta={preview.callToAction ? plainCta(preview.callToAction) : undefined}
          meta={[preview.language, preview.style].filter(Boolean).join(' · ') || undefined}
        />
      )}
    </div>
  )
}

function StepCard({ step, index }: { step: BrainCampaignStep; index: number }) {
  const tone = STEP_TONE[step.state] ?? 'idle'
  const Icon = STEP_ICON[step.state] ?? CircleDashed
  const isWaiting = step.state === 'waiting_for_human'

  return (
    <li
      className="card min-w-0 p-4"
      style={
        isWaiting
          ? { borderColor: 'var(--warn-border)', background: 'var(--warn-bg)' }
          : undefined
      }
    >
      <span className="micro-label">Step {index + 1}</span>
      <p className="mt-1 break-words text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
        {step.label}
      </p>
      <span className={cn('chip mt-2', TONE_CHIP[tone])}>
        <Icon size={12} className={step.state === 'running' ? 'animate-spin' : undefined} />
        {stepWord(step.state)}
      </span>
      <p className="explain mt-2 break-words">{step.what}</p>
    </li>
  )
}

/* ── The ads ────────────────────────────────────────────────────────────────── */

function CreativeGrid({
  creatives,
  onOpen,
  stillBuilding,
}: {
  creatives: BrainCampaignCreative[] | null
  onOpen: (creative: BrainCampaignCreative) => void
  stillBuilding: boolean
}) {
  const withPictures = useMemo(
    () => (creatives ?? []).filter((c) => c.imageUrl).length,
    [creatives],
  )

  if (!creatives) {
    return (
      <SectionCard title="The ads going out">
        <BrainSkeleton rows={1} />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="The ads going out"
      description={
        creatives.length === 0
          ? stillBuilding
            ? 'None chosen yet — the ads are still being made.'
            : 'No ads were chosen for this campaign.'
          : `${creatives.length} chosen${
              withPictures < creatives.length
                ? ` · ${creatives.length - withPictures} without a preview`
                : ''
            }`
      }
    >
      {creatives.length === 0 ? (
        <div className="py-10 text-center">
          <ImageIcon size={20} aria-hidden="true" style={{ color: 'var(--ink-4)' }} className="mx-auto" />
          <p className="explain mx-auto mt-2 max-w-[44ch]">
            {stillBuilding
              ? 'Ads appear here as soon as they have been scored and kept. Nothing has cleared that bar yet.'
              : 'This campaign finished without any ads being approved.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {creatives.map((creative) => (
            <li key={creative.id}>
              <button
                type="button"
                onClick={() => creative.imageUrl && onOpen(creative)}
                disabled={!creative.imageUrl}
                className="card-hover flex h-full w-full min-w-0 flex-col gap-3 rounded-xl p-3.5 text-left disabled:cursor-default"
                aria-label={`Preview ${creative.headline ?? 'this ad'}`}
              >
                <div
                  className="flex w-full items-center justify-center overflow-hidden rounded-[10px]"
                  style={{
                    aspectRatio: '4/5',
                    background: 'var(--surface-warm)',
                    border: creative.imageUrl ? undefined : '1px dashed var(--hairline-strong)',
                  }}
                >
                  {creative.imageUrl ? (
                    // object-contain, not -cover: these are 1:1 deliverables and cropping a square
                    // into a 4:5 tile eats the headline at both edges.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={creative.imageUrl}
                      alt={creative.headline ?? 'Ad creative'}
                      className="h-full w-full max-w-full object-contain"
                    />
                  ) : (
                    // Never a broken <img>. When the picture cannot be fetched, say so.
                    <span className="flex flex-col items-center gap-1.5 px-3 text-center">
                      <ImageIcon size={18} aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
                      <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                        Preview unavailable
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn('chip', TONE_CHIP[creative.tone])}>{creative.statusLabel}</span>
                  {creative.language && <span className="chip chip-neutral">{creative.language}</span>}
                  {creative.score !== null && (
                    <span className="explain tabular-nums" title="How well the ad checker rated this ad">
                      Rated {creative.score}
                    </span>
                  )}
                </div>

                {creative.headline && (
                  <p className="break-words text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {creative.headline}
                  </p>
                )}
                {creative.caption && (
                  <p className="break-words text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    {creative.caption}
                  </p>
                )}

                <div
                  className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3"
                  style={{ borderTop: '1px solid var(--hairline-light)' }}
                >
                  {creative.callToAction && (
                    <span className="text-[11.5px] font-semibold" style={{ color: 'var(--accent)' }}>
                      {plainCta(creative.callToAction)}
                    </span>
                  )}
                  {creative.description && (
                    <span className="explain min-w-0 break-words">{creative.description}</span>
                  )}
                </div>

                {creative.note && <p className="explain break-words">{creative.note}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
