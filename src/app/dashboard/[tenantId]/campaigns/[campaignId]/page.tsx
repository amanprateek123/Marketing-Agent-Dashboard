'use client'

import { useState, useEffect, use, useMemo, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import * as Tabs from '@radix-ui/react-tabs'
import {
  ArrowLeft, Loader2, ThumbsUp, Pause, Play, CheckCircle, XCircle,
  ChevronRight, AlertCircle, Bot, User, Users,
  TrendingUp, DollarSign, BarChart3, RefreshCw, Target, ChevronDown,
  Image as ImageIcon, Shield, Clock, Activity, FlameKindling,
  Sparkles, ArrowRightLeft, History, Zap, Ban, Layers, ExternalLink, Info,
  Pencil, Flag, Plus, AlertTriangle,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DebateLog } from '@/components/ui/DebateLog'
import { PageSelect } from '@/components/ui/PageSelect'
import { FormatBadge, PromptsVersionBadge, RegretLabel, LeakDiagnosisBadge } from '@/components/badges'
import { getShadowActions, getIntelligenceDecisions, syncCampaigns, getMetaAccounts, getMetaAccountAudiences, updateAdSetBudget, updateAdSetPlacement, getMetaPages, swapCampaignPage, addAdSet, addCreativeToAdSet, addCreativesSheetToAdSet } from '@/lib/api'
import type { BulkAdsResult } from '@/lib/api'
import { cn } from '@/lib/utils'
import { plainStatus, humanise, formatInr, formatWhen, formatRelative } from '@/lib/plain-language'
import { Details } from '@/components/plain/Details'
import { PlainErrorNote, plainFailure } from '@/components/campaign/PlainErrorNote'
import { describeAudience } from '@/components/campaign/audienceText'
import type { Campaign, CampaignAdSet, CampaignAd, CampaignAction, AuditSnapshot, ShadowAction, AdSetConfig, MetaCustomAudience, CampaignLaunchReview, Product, MetaPage, PlacementPreset } from '@/types'
import { PLACEMENT_PRESET_OPTIONS, OPTIMIZATION_OPTIONS, OPTIMIZATION_LABELS, APP_OPTIMIZATION_OPTIONS, APP_OPTIMIZATION_LABELS } from '@/types'
import { LaunchReview } from '@/components/campaign/LaunchReview'
import { CampaignSetup } from '@/components/campaign/CampaignSetup'
import { SegmentsPanel } from '@/components/campaign/SegmentsPanel'
import { AdMediaModal } from '@/components/campaign/AdMediaModal'
import { CreativeSourceFields, type CreativeSourceValue } from '@/components/creative/CreativeSourceFields'
import { SheetAttachPicker, type SheetAttachSelection } from '@/components/creative/SheetAttachPicker'

/* ─── Local types ─── */
interface CreativePackage {
  _id: string; status: string
  copyVariants: Array<{ primaryText: string; headline?: string; cta?: string; hookStyle?: string }>
  selectedCopyIndex?: number; copySelectionReason?: string
  imagePrompt?: string; imageUrl?: string
  images?: Array<{ variantIndex?: number; imagePrompt?: string; imageUrl?: string; aspectRatio?: string }>
  videoPrompt?: string; videoUrl?: string
  video?: { variantIndex?: number; videoUrl?: string; videoThumbnailUrl?: string; videoPrompt?: string }
  /** Additive to `video` — multiple videos and/or multiple sizes of the same video, each tagged by variantIndex + aspectRatio. */
  videos?: Array<{ variantIndex?: number; videoUrl?: string; videoThumbnailUrl?: string; videoPrompt?: string; aspectRatio?: string }>
  complianceNotes?: string
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

/* ─── Design tokens — mapped onto the global Meridian production-light palette ─── */
const C = {
  bg: 'var(--paper)', surface: 'var(--surface)', surfaceMuted: 'var(--surface-warm)',
  border: 'var(--hairline)', borderLight: 'var(--hairline-light)',
  text: 'var(--ink)', textSecondary: 'var(--ink-2)', textMuted: 'var(--ink-3)', textFaint: 'var(--ink-4)',
  accent: 'var(--accent)', accentLight: 'var(--accent-bg)', accentBorder: 'var(--accent-border)',
  green: 'var(--good)', greenBg: 'var(--good-bg)', greenBorder: 'var(--good-border)',
  amber: 'var(--warn)', amberBg: 'var(--warn-bg)', amberBorder: 'var(--warn-border)',
  red: 'var(--bad)', redBg: 'var(--bad-bg)', redBorder: 'var(--bad-border)',
  indigo: 'var(--accent-strong)', indigoBg: 'var(--accent-bg)', indigoBorder: 'var(--accent-border)',
  purple: 'var(--accent)', purpleBg: 'var(--accent-bg)', purpleBorder: 'var(--accent-border)',
  orange: 'var(--warn)', orangeBg: 'var(--warn-bg)', orangeBorder: 'var(--warn-border)',
  blue: 'var(--info)', blueBg: 'var(--info-bg)', blueBorder: 'var(--info-border)',
} as const

/* ═════════════════════════════════════════════════════════════════
   METRIC CELL — large number, subtle label
   ═════════════════════════════════════════════════════════════════ */
function MetricCell({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="micro-label mb-1.5">{label}</p>
      <p className="display-num break-words text-[19px] sm:text-[22px]" style={{ color: color || C.text }}>{value}</p>
      {sub && <p className="mono text-[11px] mt-0.5 tabular-nums" style={{ color: C.textMuted }}>{sub}</p>}
    </div>
  )
}

type DetailObjectiveGroup = 'sales' | 'awareness' | 'traffic' | 'leads' | 'app' | 'engagement' | 'unknown'

interface DetailObjectiveContext {
  group: DetailObjectiveGroup
  objectiveLabel: string
  optimizationGoal: string
  resultLabel: string
  efficiencyLabel: string
}

interface ObjectiveMetricInput {
  spend?: number
  impressions?: number
  reach?: number
  clicks?: number
  conversions?: number
  roas?: number
  cpc?: number
  cpm?: number
  landingPageView?: number
  thruplay?: number
  video3s?: number
}

interface ObjectiveMetricPresentation {
  result?: number
  resultValue: string
  efficiency?: number
  efficiencyValue: string
}

function detailObjectiveGroup(objective?: string): DetailObjectiveGroup {
  const normalized = (objective ?? '').toLowerCase()
  if (!normalized) return 'unknown'
  if (/awareness|reach|impression|recall|thruplay|video.view/.test(normalized)) return 'awareness'
  if (/traffic|link.click|landing.page/.test(normalized)) return 'traffic'
  if (/lead|message/.test(normalized)) return 'leads'
  if (/app|install/.test(normalized)) return 'app'
  if (/engagement/.test(normalized)) return 'engagement'
  if (/sale|purchase|conversion|catalog/.test(normalized)) return 'sales'
  return 'unknown'
}

function plainObjectiveLabel(objective: string | undefined, group: DetailObjectiveGroup): string {
  if (!objective) {
    return ({
      sales: 'Sales', awareness: 'Awareness', traffic: 'Traffic', leads: 'Leads',
      app: 'App growth', engagement: 'Engagement', unknown: 'Objective not recorded',
    })[group]
  }
  return plainStatus('objective', objective.toLowerCase()).label
}

function detailObjectiveContext(campaign: Campaign, adSets: CampaignAdSet[]): DetailObjectiveContext {
  const explicitObjective = campaign.objective ?? campaign.campaignConfig?.objective
  const group = detailObjectiveGroup(explicitObjective)
  const goals = adSets.map((adSet) => adSet.optimizationGoal?.toUpperCase()).filter((goal): goal is string => Boolean(goal))
  const uniqueGoals = [...new Set(goals)]
  const optimizationGoal = uniqueGoals.length > 1
    ? 'MIXED'
    : uniqueGoals.length === 1
      ? uniqueGoals[0]
      : campaign.campaignConfig?.adSets?.[0]?.optimizationGoal?.toUpperCase() ?? ''

  if (optimizationGoal === 'MIXED') {
    return {
      group,
      objectiveLabel: plainObjectiveLabel(explicitObjective, group),
      optimizationGoal,
      resultLabel: 'Goal-specific results',
      efficiencyLabel: 'Goal-specific efficiency',
    }
  }

  if (optimizationGoal === 'REACH') {
    return { group, objectiveLabel: plainObjectiveLabel(explicitObjective, group), optimizationGoal, resultLabel: 'Reach', efficiencyLabel: 'Cost / 1K reached' }
  }
  if (optimizationGoal === 'IMPRESSIONS' || optimizationGoal === 'AD_RECALL_LIFT') {
    return { group, objectiveLabel: plainObjectiveLabel(explicitObjective, group), optimizationGoal, resultLabel: 'Impressions', efficiencyLabel: 'CPM' }
  }
  if (optimizationGoal === 'THRUPLAY' || optimizationGoal === 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS') {
    return {
      group,
      objectiveLabel: plainObjectiveLabel(explicitObjective, group),
      optimizationGoal,
      resultLabel: optimizationGoal === 'THRUPLAY' ? 'ThruPlays' : '3-sec views (proxy)',
      efficiencyLabel: optimizationGoal === 'THRUPLAY' ? 'Cost / ThruPlay' : 'Cost / 3-sec view',
    }
  }
  if (optimizationGoal === 'LANDING_PAGE_VIEWS' || optimizationGoal === 'LINK_CLICKS') {
    return {
      group,
      objectiveLabel: plainObjectiveLabel(explicitObjective, group),
      optimizationGoal,
      resultLabel: optimizationGoal === 'LANDING_PAGE_VIEWS' ? 'Landing-page views' : 'Clicks',
      efficiencyLabel: optimizationGoal === 'LANDING_PAGE_VIEWS' ? 'Cost / LPV' : 'CPC',
    }
  }
  if (group === 'sales') return { group, objectiveLabel: plainObjectiveLabel(explicitObjective, group), optimizationGoal, resultLabel: 'Purchases', efficiencyLabel: 'Raw ROAS' }
  if (group === 'leads') return { group, objectiveLabel: plainObjectiveLabel(explicitObjective, group), optimizationGoal, resultLabel: 'Leads', efficiencyLabel: 'Cost / lead' }
  if (group === 'app') return { group, objectiveLabel: plainObjectiveLabel(explicitObjective, group), optimizationGoal, resultLabel: 'App results', efficiencyLabel: 'Cost / result' }
  if (group === 'engagement') return { group, objectiveLabel: plainObjectiveLabel(explicitObjective, group), optimizationGoal, resultLabel: 'Engagement results', efficiencyLabel: 'Cost / engagement' }
  if (group === 'awareness') return { group, objectiveLabel: plainObjectiveLabel(explicitObjective, group), optimizationGoal, resultLabel: 'Impressions', efficiencyLabel: 'CPM' }
  if (group === 'traffic') return { group, objectiveLabel: plainObjectiveLabel(explicitObjective, group), optimizationGoal, resultLabel: 'Clicks', efficiencyLabel: 'CPC' }
  return { group, objectiveLabel: plainObjectiveLabel(explicitObjective, group), optimizationGoal, resultLabel: 'Results', efficiencyLabel: 'Cost / result' }
}

function detailContextForAdSet(parent: DetailObjectiveContext, optimizationGoal?: string): DetailObjectiveContext {
  if (parent.optimizationGoal !== 'MIXED' || !optimizationGoal) return parent
  const goal = optimizationGoal.toUpperCase()
  if (goal === 'REACH') return { ...parent, optimizationGoal: goal, resultLabel: 'Reach', efficiencyLabel: 'Cost / 1K reached' }
  if (goal === 'IMPRESSIONS' || goal === 'AD_RECALL_LIFT') return { ...parent, optimizationGoal: goal, resultLabel: 'Impressions', efficiencyLabel: 'CPM' }
  if (goal === 'THRUPLAY') return { ...parent, optimizationGoal: goal, resultLabel: 'ThruPlays', efficiencyLabel: 'Cost / ThruPlay' }
  if (goal === 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS') return { ...parent, optimizationGoal: goal, resultLabel: '3-sec views (proxy)', efficiencyLabel: 'Cost / 3-sec view' }
  if (goal === 'LANDING_PAGE_VIEWS') return { ...parent, optimizationGoal: goal, resultLabel: 'Landing-page views', efficiencyLabel: 'Cost / LPV' }
  if (goal === 'LINK_CLICKS') return { ...parent, optimizationGoal: goal, resultLabel: 'Clicks', efficiencyLabel: 'CPC' }
  return { ...parent, optimizationGoal: goal }
}

function presentObjectiveMetrics(context: DetailObjectiveContext, metrics: ObjectiveMetricInput): ObjectiveMetricPresentation {
  if (context.optimizationGoal === 'MIXED') {
    return { result: undefined, resultValue: 'See ad sets', efficiency: undefined, efficiencyValue: 'See ad sets' }
  }
  const spend = metrics.spend
  let result: number | undefined
  let efficiency: number | undefined

  if (context.optimizationGoal === 'REACH') {
    result = metrics.reach
    efficiency = spend != null && result != null && result > 0 ? (spend / result) * 1000 : undefined
  } else if (context.optimizationGoal === 'IMPRESSIONS' || context.optimizationGoal === 'AD_RECALL_LIFT' || (context.group === 'awareness' && !context.optimizationGoal)) {
    result = metrics.impressions
    efficiency = metrics.cpm ?? (spend != null && result != null && result > 0 ? (spend / result) * 1000 : undefined)
  } else if (context.optimizationGoal === 'THRUPLAY') {
    result = metrics.thruplay
    efficiency = spend != null && result != null && result > 0 ? spend / result : undefined
  } else if (context.optimizationGoal === 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS') {
    result = metrics.video3s
    efficiency = spend != null && result != null && result > 0 ? spend / result : undefined
  } else if (context.optimizationGoal === 'LANDING_PAGE_VIEWS') {
    result = metrics.landingPageView
    efficiency = spend != null && result != null && result > 0 ? spend / result : undefined
  } else if (context.optimizationGoal === 'LINK_CLICKS' || context.group === 'traffic') {
    result = metrics.clicks
    efficiency = metrics.cpc ?? (spend != null && result != null && result > 0 ? spend / result : undefined)
  } else {
    result = metrics.conversions
    efficiency = context.group === 'sales'
      ? metrics.roas
      : spend != null && result != null && result > 0
        ? spend / result
        : undefined
  }

  return {
    result,
    resultValue: result == null ? '—' : result.toLocaleString('en-IN'),
    efficiency,
    efficiencyValue: efficiency == null
      ? '—'
      : context.group === 'sales'
        ? `${efficiency.toFixed(2)}x`
        : formatInr(efficiency, { decimals: efficiency < 100 ? 2 : 0 }),
  }
}

/* ═════════════════════════════════════════════════════════════════
   HOVER PANEL — renders EVERY performance/targeting field
   ═════════════════════════════════════════════════════════════════ */
function fmtInt(v: unknown): string {
  const n = typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : '—'
}
function fmtMoney(v: unknown): string {
  const n = typeof v === 'number' ? v : NaN
  return Number.isFinite(n) && n > 0 ? formatInr(n, { decimals: n < 100 ? 2 : 0 }) : '—'
}
function fmtPct(v: unknown, digits = 2): string {
  const n = typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '—'
}
function fmtStr(v: unknown): string {
  if (v == null || v === '') return '—'
  return String(v)
}
/** An enum-ish value (SOME_CODE / some_code) as plain words; never the raw code. */
function fmtCode(v: unknown): string {
  if (v == null || v === '') return '—'
  return humanise(String(v).toLowerCase())
}
function fmtDay(v: unknown): string {
  if (v == null || v === '') return '—'
  return formatWhen(String(v))
}
function fmtRanking(v: unknown): { text: string; color: string } {
  const s = String(v ?? '').toUpperCase()
  if (s === 'ABOVE_AVERAGE') return { text: 'Above avg', color: C.green }
  if (s === 'AVERAGE')       return { text: 'Average',   color: C.textSecondary }
  if (s === 'BELOW_AVERAGE_10' || s === 'BELOW_AVERAGE_20' || s === 'BELOW_AVERAGE_35' || s.startsWith('BELOW')) return { text: 'Below avg', color: C.red }
  if (s === 'UNKNOWN' || s === '') return { text: 'Not rated', color: C.textFaint }
  return { text: humanise(s.toLowerCase()), color: C.textSecondary }
}

interface AllFieldsPanelProps {
  kind: 'adset' | 'ad'
  data: CampaignAdSet | CampaignAd
  objectiveContext: DetailObjectiveContext
  onClose?: () => void
}

function AllFieldsPanel({ kind, data, objectiveContext, onClose }: AllFieldsPanelProps) {
  const isAdSet = kind === 'adset'
  const d = data as CampaignAdSet & CampaignAd
  const objectiveMetrics = presentObjectiveMetrics(objectiveContext, {
    spend: d.metrics?.spend ?? d.spend,
    impressions: d.impressions,
    reach: d.reach,
    clicks: d.clicks,
    conversions: d.metrics?.conversions ?? d.conversions,
    roas: d.metrics?.roas ?? d.roas,
    cpc: d.metrics?.cpc ?? d.cpc,
    cpm: d.metrics?.cpm ?? d.cpm,
    landingPageView: d.landingPageView,
    thruplay: d.thruplay,
    video3s: d.video3s,
  })
  const q = fmtRanking(d.qualityRanking)
  const e = fmtRanking(d.engagementRanking)
  const cv = fmtRanking(d.conversionRanking)
  return (
    <div
      className="relative rounded-xl px-5 py-4 z-30"
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.16)',
        width: 'min(720px, calc(100vw - 32px))',
        maxHeight: 'min(760px, calc(100vh - 40px))',
        overflowY: 'auto',
      }}
    >
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close details"
          className="absolute top-3 right-3 p-1 rounded-lg transition-opacity hover:opacity-70"
          style={{ color: C.textMuted }}
        >
          <XCircle size={16} />
        </button>
      )}
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 pr-6" style={{ color: C.textMuted }}>
        {isAdSet ? 'Ad set details' : 'Ad details'} · {d.name || '—'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-[12px]">
        <FieldGroup title="Outcome">
          <F label="Spend"    value={fmtMoney(d.spend)} />
          <F label={objectiveContext.resultLabel} value={objectiveMetrics.resultValue} />
          <F label={objectiveContext.efficiencyLabel} value={objectiveMetrics.efficiencyValue} />
          {objectiveContext.group === 'sales' && <F label="Attributed action value" value={fmtMoney(d.revenue)} />}
          {objectiveContext.group === 'sales' && <F label="AOV" value={fmtMoney(d.aov)} />}
          {objectiveContext.group === 'sales' && <F label="CPA" value={fmtMoney(d.cpa)} />}
          <F label="CPC"      value={fmtMoney(d.cpc)} />
          <F label="CPM"      value={fmtMoney(d.cpm)} />
        </FieldGroup>

        <FieldGroup title="Delivery">
          <F label="Impressions" value={fmtInt(d.impressions)} />
          <F label="Reach"       value={fmtInt(d.reach)} />
          <F label="Frequency"   value={typeof d.frequency === 'number' ? d.frequency.toFixed(2) : '—'} />
          <F label="Clicks"      value={fmtInt(d.clicks)} />
          <F label="CTR"         value={fmtPct(d.ctr)} />
          {!isAdSet && <F label="Link clicks" value={fmtInt(d.inlineLinkClicks)} />}
          {!isAdSet && <F label="Link CTR"    value={fmtPct(d.linkCtr)} />}
          {isAdSet && <F label="Learning phase" value={fmtCode(d.learningStage)} />}
          <F label="Status in Meta" value={d.effectiveStatus ? plainStatus('campaignStatus', String(d.effectiveStatus).toLowerCase()).label : '—'} />
        </FieldGroup>

        <FieldGroup title="Funnel">
          <F label={objectiveContext.group === 'sales' ? 'Purchases' : 'Meta results'} value={fmtInt(d.conversions)} />
          <F label="Add to cart"      value={fmtInt(d.addToCart)} />
          <F label="Initiate checkout" value={fmtInt(d.initiateCheckout)} />
          <F label="Landing page view" value={fmtInt(d.landingPageView)} />
          <F label="Conversion rate"  value={fmtPct(d.cvr)} />
        </FieldGroup>

        <FieldGroup title="Video watch">
          {!isAdSet && <F label="Hook rate (3s)" value={fmtPct(d.hookRate)} />}
          {!isAdSet && <F label="Hold rate"      value={fmtPct(d.holdRate)} />}
          <F label="25%"  value={fmtInt(d.videoP25) + (d.videoP25Pct ? ` (${d.videoP25Pct.toFixed(1)}%)` : '')} />
          <F label="50%"  value={fmtInt(d.videoP50) + (d.videoP50Pct ? ` (${d.videoP50Pct.toFixed(1)}%)` : '')} />
          <F label="75%"  value={fmtInt(d.videoP75) + (d.videoP75Pct ? ` (${d.videoP75Pct.toFixed(1)}%)` : '')} />
          <F label="100%" value={fmtInt(d.videoP100) + (d.videoP100Pct ? ` (${d.videoP100Pct.toFixed(1)}%)` : '')} />
        </FieldGroup>

        <FieldGroup title="Rankings">
          <F label="Quality"     value={q.text}  color={q.color} />
          <F label="Engagement"  value={e.text}  color={e.color} />
          <F label="Conversion"  value={cv.text} color={cv.color} />
        </FieldGroup>

        {isAdSet ? (
          <FieldGroup title="Targeting">
            <F label="Age"       value={fmtStr(d.age)} />
            <F label="Gender"    value={fmtStr(d.gender)} />
            <F label="Placement" value={fmtStr(d.placement)} />
            <F label="Geo"       value={fmtStr(d.geo)} />
            <F label="Audience size" value={fmtInt(d.audienceSize)} />
            {d.interests && d.interests.length > 0 && (
              <F label="Interests" value={d.interests.slice(0,3).join(', ')} />
            )}
            {d.targetingDetail?.advantageAudience != null && (
              <F
                label="Advantage+ audience"
                value={d.targetingDetail.advantageAudience ? 'On (Meta may expand beyond this)' : 'Off (strict)'}
                color={d.targetingDetail.advantageAudience ? C.amber : C.green}
              />
            )}
            {(d.targetingDetail?.geo?.regions?.length ?? 0) > 0 && (
              <F label="Regions" value={`${d.targetingDetail!.geo!.regions!.length} selected`} />
            )}
            {(d.targetingDetail?.customAudiences?.length ?? 0) > 0 && (
              <F label="Custom audiences" value={d.targetingDetail!.customAudiences!.map(a => a.name).filter(Boolean).slice(0,2).join(', ') || `${d.targetingDetail!.customAudiences!.length}`} />
            )}
            {(d.targetingDetail?.excludedCustomAudiences?.length ?? 0) > 0 && (
              <F label="Excluded audiences" value={`${d.targetingDetail!.excludedCustomAudiences!.length} excluded`} />
            )}
            <F label="Daily budget"    value={fmtMoney(d.dailyBudget)} />
            <F label="Lifetime budget" value={fmtMoney(d.lifetimeBudget)} />
            <F label="Optimising for"  value={fmtCode(d.optimizationGoal)} />
          </FieldGroup>
        ) : (
          <FieldGroup title="Creative">
            <F label="Format"      value={fmtCode(d.format)} />
            <F label="Hook style"  value={fmtCode(d.hookStyle)} />
            {d.creativeCta && <F label="Button" value={fmtCode(d.creativeCta)} />}
            {d.isDynamicCreative && <F label="Dynamic creative" value="Yes — Meta mixes assets" color={C.amber} />}
          </FieldGroup>
        )}

        {isAdSet && (
          <FieldGroup title="Bidding">
            <F label="Bid strategy" value={fmtCode(d.bidStrategy)} />
            <F label="Bid amount"   value={fmtMoney(d.bidAmount)} />
            <F label="Charged per" value={fmtCode(d.billingEvent)} />
          </FieldGroup>
        )}

        {isAdSet && (
          <FieldGroup title="Time window">
            <F label="From" value={fmtDay(d.dateStart)} />
            <F label="To"   value={fmtDay(d.dateStop)} />
          </FieldGroup>
        )}
      </div>

      {!isAdSet && (d.creativeTitle || d.creativeBody) && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.borderLight}` }}>
          {d.creativeTitle && <p className="text-[12px] font-semibold mb-1" style={{ color: C.text }}>{d.creativeTitle}</p>}
          {d.creativeBody && <p className="text-[12px] leading-relaxed" style={{ color: C.textSecondary }}>{d.creativeBody.length > 220 ? `${d.creativeBody.slice(0, 220)}…` : d.creativeBody}</p>}
        </div>
      )}
      {!isAdSet && d.creativeId && (
        <Details className="mt-3" reference={String(d.creativeId)} />
      )}
    </div>
  )
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="col-span-1">
      <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: C.accent }}>{title}</p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function F({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex min-w-0 justify-between items-baseline gap-3">
      <span className="shrink-0 text-[11px]" style={{ color: C.textMuted }}>{label}</span>
      <span className="min-w-0 break-words text-right text-[12px] mono font-medium" style={{ color: color ?? C.text }}>{value}</span>
    </div>
  )
}

/**
 * Renders `children` in a portal to document.body, anchored to `anchorRef`.
 * Detaches the details panel from any table `overflow` clipping. Opened by a
 * click (not hover, which used to auto-open this on mouseenter and made it
 * impossible to move the mouse toward the panel without it disappearing) —
 * closes on outside click or Escape via `onClose`.
 */
function AnchoredPortal({
  anchorRef,
  onClose,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const handlePointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handlePointer)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      window.removeEventListener('keydown', handleKey)
    }
  }, [anchorRef, onClose])

  useLayoutEffect(() => {
    if (!anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const gap = 8
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const margin = 16
    // Measure the panel that just rendered off-screen, so we know its actual height.
    const measured = panelRef.current?.getBoundingClientRect()
    const panelWidth = Math.min(measured?.width || 700, viewportW - margin * 2)
    const panelHeight = measured?.height || 460

    // Horizontal: align to the row, then clamp inside the visible viewport.
    const viewportLeft = window.scrollX + margin
    const viewportRight = window.scrollX + viewportW - margin
    let left = window.scrollX + r.right - panelWidth
    left = Math.max(viewportLeft, Math.min(left, viewportRight - panelWidth))

    // Vertical: prefer below; flip above if we'd overflow the viewport bottom.
    const spaceBelow = viewportH - r.bottom
    const spaceAbove = r.top
    let top: number
    if (spaceBelow >= panelHeight + gap || spaceBelow >= spaceAbove) {
      top = window.scrollY + r.bottom + gap
    } else {
      top = window.scrollY + r.top - panelHeight - gap
    }
    // Final safety clamp — never go negative
    if (top < window.scrollY + margin) top = window.scrollY + margin
    // The portal must measure its rendered panel before it can be positioned.
    setPos({ top, left })
  }, [anchorRef, children])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        // Hide while measuring so the panel doesn't flash off-screen
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 1000,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

/* ═════════════════════════════════════════════════════════════════
   AD THUMBNAIL — Meta's creative thumbnail_url; poster frame for video ads
   ═════════════════════════════════════════════════════════════════ */
function AdThumbnail({ thumbnailUrl, isVideo }: { thumbnailUrl?: string; isVideo?: boolean }) {
  const [errored, setErrored] = useState(false)
  const showImage = !!thumbnailUrl && !errored
  return (
    <div
      className="relative shrink-0 rounded-lg overflow-hidden"
      style={{ width: 40, height: 40, background: C.surfaceMuted, border: `1px solid ${C.borderLight}` }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className="w-full h-full"
          style={{ objectFit: 'cover' }}
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon size={14} style={{ color: C.textFaint }} />
        </div>
      )}
      {isVideo && (
        <div
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-tl-md"
          style={{ width: 16, height: 16, background: 'rgba(0,0,0,0.65)' }}
        >
          <Play size={8} fill="#fff" style={{ color: '#fff' }} />
        </div>
      )}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════
   AD ROW
   ═════════════════════════════════════════════════════════════════ */
function AdRow({ ad, objectiveContext, onViewAd }: { ad: CampaignAd; objectiveContext: DetailObjectiveContext; onViewAd?: (ad: CampaignAd) => void }) {
  const hasMedia = !!(ad.thumbnailUrl || ad.creativeVideoId)
  const [histOpen, setHistOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const rowRef = useRef<HTMLTableRowElement | null>(null)
  const spend = ad.metrics?.spend ?? ad.spend
  const ctr = ad.metrics?.ctr ?? ad.ctr
  const performance = presentObjectiveMetrics(objectiveContext, {
    spend,
    impressions: ad.impressions,
    reach: ad.reach,
    clicks: ad.clicks,
    conversions: ad.metrics?.conversions ?? ad.conversions,
    roas: ad.metrics?.roas ?? ad.roas,
    cpc: ad.metrics?.cpc ?? ad.cpc,
    cpm: ad.metrics?.cpm ?? ad.cpm,
    landingPageView: ad.landingPageView,
    thruplay: ad.thruplay,
    video3s: ad.video3s,
  })
  const fatigued = ctr != null && ad.ctrBaseline != null && ctr < ad.ctrBaseline * 0.65
  const hist = ad.replacementHistory || []
  return (
    <>
      <tr
        ref={rowRef}
        className="group relative"
      >
        <td>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => hasMedia && onViewAd?.(ad)}
              disabled={!hasMedia}
              className={hasMedia ? 'cursor-pointer' : 'cursor-default'}
              title={hasMedia ? (ad.creativeVideoId ? 'Play video' : 'View image') : undefined}
            >
              <AdThumbnail thumbnailUrl={ad.thumbnailUrl} isVideo={!!ad.creativeVideoId || ad.format === 'video'} />
            </button>
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate" style={{ color: C.text }}>{ad.name || '—'}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {ad.hookStyle && <span className="text-[11px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.borderLight}` }}>{humanise(ad.hookStyle)}</span>}
                {ad.format && <FormatBadge format={ad.format} />}
                {fatigued && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: C.redBg, color: C.red }}><FlameKindling size={9} />Fatigue</span>}
                {hist.length > 0 && <button onClick={e => { e.stopPropagation(); setHistOpen(h => !h) }} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md transition-opacity hover:opacity-70" style={{ color: C.accent }}><History size={9} className="inline mr-0.5" />{hist.length} swap{hist.length !== 1 ? 's' : ''}</button>}
              </div>
            </div>
          </div>
        </td>
        <td>{ad.status?.trim() ? <StatusBadge status={ad.status} domain="campaignStatus" /> : <span style={{ color: C.textFaint }}>—</span>}</td>
        <td className="num mono font-medium" style={{ color: C.textSecondary }}>{spend ? formatInr(spend) : '—'}</td>
        <td className="num mono font-medium" style={{ color: performance.result == null ? C.textFaint : C.text }}>{performance.resultValue}</td>
        <td className="num mono font-semibold" style={{ color: performance.efficiency == null ? C.textFaint : objectiveContext.group === 'sales' ? (performance.efficiency >= 1 ? C.green : C.red) : C.textSecondary }}>{performance.efficiencyValue}</td>
        <td className="num mono" style={{ color: C.textSecondary }}>{ad.impressions?.toLocaleString('en-IN') ?? '—'}</td>
        <td className="num mono" style={{ color: fatigued ? C.red : C.textSecondary }}>
          {ctr != null ? <>{ctr.toFixed(2)}%{ad.ctrBaseline != null && <span className="ml-1 text-[10px]" style={{ color: C.textMuted }}>/{ad.ctrBaseline.toFixed(1)}%</span>}</> : '—'}
        </td>
        <td>
          <button
            onClick={() => setDetailsOpen(v => !v)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md transition-opacity hover:opacity-70"
            style={{ background: detailsOpen ? C.accentLight : C.bg, color: detailsOpen ? C.accent : C.textMuted, border: `1px solid ${detailsOpen ? C.accentBorder : C.borderLight}` }}
          >
            <Info size={10} /> Details
          </button>
        </td>
      </tr>
      {detailsOpen && (
        <AnchoredPortal anchorRef={rowRef} onClose={() => setDetailsOpen(false)}>
          <AllFieldsPanel kind="ad" data={ad} objectiveContext={objectiveContext} onClose={() => setDetailsOpen(false)} />
        </AnchoredPortal>
      )}
      {histOpen && hist.length > 0 && (
        <tr><td colSpan={8} style={{ background: C.surfaceMuted }}>
          <p className="micro-label mb-2">Opening line history</p>
          {hist.map((e, j) => (
            <div key={j} className="flex min-w-0 flex-wrap items-center gap-2 text-xs py-1">
              <span className="min-w-0 break-words px-1.5 py-0.5 rounded" style={{ background: C.redBg, color: C.red, fontSize: 11 }}>{e.oldHook}</span>
              <span style={{ color: C.textMuted }}>&rarr;</span>
              <span className="min-w-0 break-words px-1.5 py-0.5 rounded" style={{ background: C.greenBg, color: C.green, fontSize: 11 }}>{e.newHook}</span>
              <span style={{ color: C.textMuted }}>{formatWhen(e.replacedAt)}</span>
              <span className="min-w-0 break-words" style={{ color: C.textSecondary }}>— {e.reason}</span>
            </div>
          ))}
        </td></tr>
      )}
    </>
  )
}

/* ═════════════════════════════════════════════════════════════════
   AD SET ROW
   ═════════════════════════════════════════════════════════════════ */
function AdSetRow({
  adSet,
  formatTag,
  siblingFormat,
  groupHead,
  tenantId,
  campaignId,
  proposalsCount,
  onViewAd,
  onBudgetChanged,
  onCreativeAdded,
  objectiveContext,
  focusId,
}: {
  adSet: CampaignAdSet
  formatTag?: 'video' | 'image'
  siblingFormat?: 'video' | 'image'
  groupHead?: boolean
  tenantId?: string
  campaignId?: string
  proposalsCount?: number
  onViewAd?: (ad: CampaignAd) => void
  onBudgetChanged?: () => void
  onCreativeAdded?: () => void
  objectiveContext: DetailObjectiveContext
  focusId?: string
}) {
  // Arriving from a recommendation link (?focus=…): open this ad group and
  // scroll it into view, so the operator lands on the exact row being
  // discussed rather than hunting for it.
  const isFocused =
    !!focusId &&
    (focusId === adSet.metaAdSetId ||
      focusId === adSet.id ||
      (adSet.ads ?? []).some((ad) => ad.id === focusId))
  const [open, setOpen] = useState(isFocused)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [addCreativeOpen, setAddCreativeOpen] = useState(false)
  const [placementOpen, setPlacementOpen] = useState(false)
  const rowRef = useRef<HTMLTableRowElement | null>(null)
  useEffect(() => {
    if (!isFocused) return
    rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [isFocused])
  const ads = adSet.ads || []
  const spend = adSet.metrics?.spend ?? adSet.spend
  const ctr = adSet.metrics?.ctr ?? adSet.ctr
  const impressions = adSet.impressions
  const rowObjectiveContext = detailContextForAdSet(objectiveContext, adSet.optimizationGoal)
  const performance = presentObjectiveMetrics(rowObjectiveContext, {
    spend,
    impressions,
    reach: adSet.reach,
    clicks: adSet.clicks,
    conversions: adSet.metrics?.conversions ?? adSet.conversions,
    roas: adSet.metrics?.roas ?? adSet.roas,
    cpc: adSet.cpc,
    cpm: adSet.cpm,
    landingPageView: adSet.landingPageView,
  })
  const adSetId = adSet.id || adSet.metaAdSetId

  const [budgetEditing, setBudgetEditing] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState(String(adSet.dailyBudget ?? ''))
  const [budgetState, setBudgetState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [budgetError, setBudgetError] = useState<string | null>(null)

  async function saveBudget() {
    const parsed = Number(budgetDraft)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setBudgetError('Enter a positive number')
      return
    }
    if (!tenantId || !campaignId || !adSetId) {
      setBudgetError("We can't change this ad set's budget from here.")
      return
    }
    setBudgetState('loading')
    setBudgetError(null)
    try {
      await updateAdSetBudget(tenantId, campaignId, adSetId, parsed)
      setBudgetEditing(false)
      setBudgetState('idle')
      onBudgetChanged?.()
    } catch (err) {
      setBudgetState('error')
      setBudgetError(plainFailure("We couldn't change the budget. Try again.", err))
    }
  }

  return (
    <>
      <tr
        ref={rowRef}
        className="group cursor-pointer relative"
        onClick={() => setOpen(!open)}
        style={isFocused ? { background: C.accentLight, boxShadow: `inset 3px 0 0 ${C.accent}` } : undefined}
      >
        <td>
          <div className="flex items-center gap-2.5">
            {siblingFormat && (
              <span
                className="inline-flex items-center justify-center w-4"
                style={{ color: C.textFaint }}
                title={`Linked to its ${siblingFormat} sibling`}
              >
                {groupHead ? '┐' : '┘'}
              </span>
            )}
            <ChevronRight size={14} className={cn('transition-transform', open && 'rotate-90')} style={{ color: ads.length ? C.accent : C.textFaint }} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold" style={{ color: C.text }}>{adSet.name || '—'}</p>
                {formatTag && <FormatBadge format={formatTag} />}
                {siblingFormat && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: C.surfaceMuted, color: C.textMuted, border: `1px solid ${C.borderLight}` }}
                    title={`Paired with sibling ${siblingFormat} ad set`}
                  >
                    <ArrowRightLeft size={9} /> linked · {siblingFormat}
                  </span>
                )}
                {adSet.addedByAudit && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBorder}` }}>Audit</span>}
              </div>
              {adSet.audienceType && <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>{plainStatus('audienceKind', adSet.audienceType).label}</p>}
            </div>
          </div>
        </td>
        <td>{adSet.status?.trim() ? <StatusBadge status={adSet.status} domain="campaignStatus" /> : <span style={{ color: C.textFaint }}>—</span>}</td>
        <td className="num" onClick={(e) => e.stopPropagation()}>
          {budgetEditing ? (
            <div className="flex items-center gap-1.5 justify-end">
              <input
                type="number"
                value={budgetDraft}
                onChange={(e) => setBudgetDraft(e.target.value)}
                className="input mono tabular-nums text-xs"
                style={{ width: 76, padding: '2px 6px' }}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') saveBudget(); if (e.key === 'Escape') { setBudgetEditing(false); setBudgetError(null) } }}
              />
              <button
                onClick={saveBudget}
                disabled={budgetState === 'loading'}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: C.accent, color: '#fff' }}
              >
                {budgetState === 'loading' ? <Loader2 size={10} className="animate-spin" /> : 'Save'}
              </button>
              <button
                onClick={() => { setBudgetEditing(false); setBudgetDraft(String(adSet.dailyBudget ?? '')); setBudgetError(null) }}
                className="text-[10px]"
                style={{ color: C.textMuted }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setBudgetEditing(true)}
              className="inline-flex items-center gap-1 hover:opacity-70"
              style={{ color: C.textSecondary }}
              title="Edit daily budget"
              disabled={!adSetId}
            >
              <span className="mono font-medium">{adSet.dailyBudget ? formatInr(adSet.dailyBudget) : '—'}</span>
              {adSetId && <Pencil size={10} style={{ color: C.textFaint }} />}
            </button>
          )}
          {budgetError && <PlainErrorNote compact className="mt-1 text-left" error={budgetError} />}
        </td>
        <td className="num mono font-medium" style={{ color: C.textSecondary }}>{spend ? formatInr(spend) : '—'}</td>
        <td className="num mono font-medium" style={{ color: performance.result == null ? C.textFaint : C.text }}>{performance.resultValue}</td>
        <td className="num mono font-semibold" style={{ color: performance.efficiency == null ? C.textFaint : rowObjectiveContext.group === 'sales' ? (performance.efficiency >= 1 ? C.green : C.red) : C.textSecondary }}>{performance.efficiencyValue}</td>
        <td className="num mono" style={{ color: C.textSecondary }}>{impressions?.toLocaleString('en-IN') ?? '—'}</td>
        <td className="num mono" style={{ color: C.textSecondary }}>{ctr != null && ctr > 0 ? `${ctr.toFixed(2)}%` : '—'}</td>
        <td>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setDetailsOpen(v => !v) }}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md transition-opacity hover:opacity-70"
              style={{ background: detailsOpen ? C.accentLight : C.surfaceMuted, color: detailsOpen ? C.accent : C.textMuted, border: `1px solid ${detailsOpen ? C.accentBorder : C.borderLight}` }}
              title="Every number and setting for this ad set"
            >
              <Info size={10} /> Details
            </button>
            {tenantId && campaignId && adSet.id && (
              <button
                onClick={(e) => { e.stopPropagation(); setAddCreativeOpen(v => !v) }}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md transition-opacity hover:opacity-70"
                style={{ background: addCreativeOpen ? C.accentLight : C.surfaceMuted, color: addCreativeOpen ? C.accent : C.textMuted, border: `1px solid ${addCreativeOpen ? C.accentBorder : C.borderLight}` }}
                title="Add your own ad (copy + image/video) to this ad set"
              >
                <Plus size={10} /> Add Creative
              </button>
            )}
            {tenantId && campaignId && adSet.id && (
              <button
                onClick={(e) => { e.stopPropagation(); setPlacementOpen(v => !v) }}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md transition-opacity hover:opacity-70"
                style={{ background: placementOpen ? C.accentLight : C.surfaceMuted, color: placementOpen ? C.accent : C.textMuted, border: `1px solid ${placementOpen ? C.accentBorder : C.borderLight}` }}
                title="Change which Meta surfaces this ad set can serve on"
              >
                <Layers size={10} /> Placements
              </button>
            )}
            {tenantId && adSet.id && proposalsCount && proposalsCount > 0 && (
              <Link
                href={`/dashboard/${tenantId}/proposed-actions?targetId=${adSet.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md transition-opacity hover:opacity-80"
                style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accentBorder}` }}
                title={`${proposalsCount} agent proposal${proposalsCount === 1 ? '' : 's'} for this ad group`}
              >
                {proposalsCount} proposal{proposalsCount === 1 ? '' : 's'}
              </Link>
            )}
          </div>
        </td>
      </tr>
      {detailsOpen && (
        <AnchoredPortal anchorRef={rowRef} onClose={() => setDetailsOpen(false)}>
          <AllFieldsPanel kind="adset" data={adSet} objectiveContext={rowObjectiveContext} onClose={() => setDetailsOpen(false)} />
        </AnchoredPortal>
      )}
      {addCreativeOpen && tenantId && campaignId && adSet.id && (
        <AnchoredPortal anchorRef={rowRef} onClose={() => setAddCreativeOpen(false)}>
          <AddCreativePanel
            tenantId={tenantId}
            campaignId={campaignId}
            adSetId={adSet.id}
            adSetName={adSet.name}
            onClose={() => setAddCreativeOpen(false)}
            onAdded={() => onCreativeAdded?.()}
          />
        </AnchoredPortal>
      )}
      {placementOpen && tenantId && campaignId && adSet.id && (
        <AnchoredPortal anchorRef={rowRef} onClose={() => setPlacementOpen(false)}>
          <ChangePlacementsPanel
            tenantId={tenantId}
            campaignId={campaignId}
            adSetId={adSet.id}
            adSetName={adSet.name}
            onClose={() => setPlacementOpen(false)}
            onChanged={() => onCreativeAdded?.()}
          />
        </AnchoredPortal>
      )}
      {open && ads.length > 0 && (
        <tr><td colSpan={9} style={{ background: C.surfaceMuted }}>
          <div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Ad', 'Status', 'Spend', rowObjectiveContext.resultLabel, rowObjectiveContext.efficiencyLabel, 'Times shown', 'Click rate', 'Details'].map((h, i) => <th key={h} className={i < 2 ? '' : 'num'}>{h}</th>)}</tr></thead>
          <tbody>{ads.map((ad, i) => <AdRow key={ad.id || i} ad={ad} objectiveContext={rowObjectiveContext} onViewAd={onViewAd} />)}</tbody></table></div>
        </td></tr>
      )}
    </>
  )
}

/* ═════════════════════════════════════════════════════════════════
   ADD CREATIVE — operator writes their own copy + uploads their own
   image/video, added as a new ad to an EXISTING live ad set. Distinct from
   the AI's add_creative/replace_creative (which generate creative
   themselves) and backfill-variants (which only re-adds a variant already
   sitting in the package).
   ═════════════════════════════════════════════════════════════════ */

function AddCreativePanel({
  tenantId,
  campaignId,
  adSetId,
  adSetName,
  onClose,
  onAdded,
}: {
  tenantId: string
  campaignId: string
  adSetId: string
  adSetName?: string
  onClose: () => void
  onAdded: () => void
}) {
  // Whole sheet is the default — attaching every creative in a Gallery sheet
  // at once is the common case; "Single creative" stays for the occasional
  // one-off ad.
  const [sourceMode, setSourceMode] = useState<'sheet' | 'single'>('sheet')
  const [sheetSelection, setSheetSelection] = useState<SheetAttachSelection | null>(null)
  const [creative, setCreative] = useState<CreativeSourceValue>({ assetType: 'image', mediaUrl: '', primaryText: '', headline: '', cta: 'Shop Now' })
  const [name, setName] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkAdsResult | null>(null)

  async function handleSubmit() {
    setError(null)
    setResult(null)
    if (sourceMode === 'sheet') {
      if (!sheetSelection || sheetSelection.selectedCount === 0) { setError('Pick at least one creative from the sheet'); return }
      setSubmitState('loading')
      try {
        const res = await addCreativesSheetToAdSet(tenantId, campaignId, adSetId, {
          sheetId: sheetSelection.sheetId,
          excludeAssetIds: sheetSelection.excludeAssetIds,
        })
        setResult(res)
        onAdded()
        if (res.failed.length === 0) onClose()
        else setSubmitState('idle')
      } catch (err) {
        setSubmitState('error')
        setError(plainFailure("We couldn't add these ads. Try again.", err))
      }
      return
    }
    if (!creative.mediaUrl) { setError(`Pick or upload a${creative.assetType === 'image' ? 'n image' : ' video'} first`); return }
    if (!creative.primaryText.trim() || !creative.headline.trim()) { setError('Primary text and headline are required'); return }
    setSubmitState('loading')
    try {
      await addCreativeToAdSet(tenantId, campaignId, adSetId, {
        name: name.trim() || undefined,
        ...creative,
      })
      onAdded()
      onClose()
    } catch (err) {
      setSubmitState('error')
      setError(plainFailure("We couldn't add this ad. Try again.", err))
    }
  }

  return (
    <div
      className="relative rounded-xl px-5 py-4 z-30"
      style={{ background: C.bg, border: `1px solid ${C.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.16)', width: 'min(calc(100vw - 32px), 560px)', minWidth: 0, maxWidth: 560 }}
    >
      <button onClick={onClose} aria-label="Close creative picker" className="absolute top-3 right-3 p-1 rounded-lg transition-opacity hover:opacity-70" style={{ color: C.textMuted }}>
        <XCircle size={16} />
      </button>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-3 pr-6" style={{ color: C.textMuted }}>
        Add creative{adSetName ? ` · ${adSetName}` : ''}
      </p>
      <div className="flex gap-1.5 mb-3">
        {([{ value: 'sheet', label: 'Whole sheet' }, { value: 'single', label: 'Single creative' }] as const).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSourceMode(opt.value)}
            className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold"
            style={sourceMode === opt.value ? { background: C.accent, color: '#fff' } : { background: C.surface, color: C.textSecondary, border: `1px solid ${C.border}` }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="space-y-2.5">
        {sourceMode === 'sheet' ? (
          <SheetAttachPicker tenantId={tenantId} onChange={setSheetSelection} />
        ) : (
          <>
            <CreativeSourceFields tenantId={tenantId} onChange={setCreative} />
            <div>
              <p className="micro-label mb-1">Ad name <span className="font-normal normal-case" style={{ color: C.textFaint }}>(optional)</span></p>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input text-sm w-full" placeholder="auto" />
            </div>
          </>
        )}
        {result?.failed.length ? (
          <p className="text-[11px] flex items-start gap-1" style={{ color: C.amber }}>
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span className="min-w-0 break-words">{result.createdAds.length} ad{result.createdAds.length === 1 ? '' : 's'} added, but {result.failed.length} could not be added. Try those again.</span>
          </p>
        ) : null}
        {result?.failed.length ? (
          <Details title="What went wrong" items={result.failed.map((f, i) => ({ label: `Ad ${i + 1}`, value: f.error }))} />
        ) : null}
        {error && <PlainErrorNote error={error} />}
        <button onClick={handleSubmit} disabled={submitState === 'loading'} className="btn btn-accent w-full">
          {submitState === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          {submitState === 'loading'
            ? (sourceMode === 'sheet' ? 'Creating ads — this can take a few minutes if the sheet has video…' : 'Adding…')
            : sourceMode === 'sheet' && sheetSelection
              ? `Add ${sheetSelection.selectedCount} creative${sheetSelection.selectedCount === 1 ? '' : 's'}`
              : 'Add Creative'}
        </button>
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════
   CHANGE PLACEMENTS — operator switches which Meta surfaces an
   EXISTING live ad set can serve on. Manual counterpart to the AI
   audit loop's narrow_placement action, but broadening as well as
   narrowing, and expressed as the same fixed preset used at ad-set
   creation rather than raw Facebook/Instagram position arrays.
   ═════════════════════════════════════════════════════════════════ */
function ChangePlacementsPanel({
  tenantId,
  campaignId,
  adSetId,
  adSetName,
  onClose,
  onChanged,
}: {
  tenantId: string
  campaignId: string
  adSetId: string
  adSetName?: string
  onClose: () => void
  onChanged: () => void
}) {
  const [preset, setPreset] = useState<PlacementPreset>('vertical')
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitState('loading')
    setError(null)
    try {
      await updateAdSetPlacement(tenantId, campaignId, adSetId, preset)
      onChanged()
      onClose()
    } catch (err) {
      setSubmitState('error')
      setError(plainFailure("We couldn't change where these ads show. Try again.", err))
    }
  }

  return (
    <div
      className="relative rounded-xl px-5 py-4 z-30"
      style={{ background: C.bg, border: `1px solid ${C.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.16)', width: 'min(calc(100vw - 32px), 420px)', minWidth: 0, maxWidth: 420 }}
    >
      <button onClick={onClose} aria-label="Close placement editor" className="absolute top-3 right-3 p-1 rounded-lg transition-opacity hover:opacity-70" style={{ color: C.textMuted }}>
        <XCircle size={16} />
      </button>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-3 pr-6" style={{ color: C.textMuted }}>
        Change placements{adSetName ? ` · ${adSetName}` : ''}
      </p>
      <div className="space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          {PLACEMENT_PRESET_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPreset(opt.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={preset === opt.value ? { background: C.accent, color: '#fff' } : { background: C.surface, color: C.textSecondary, border: `1px solid ${C.border}` }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {error && <PlainErrorNote error={error} />}
        <button onClick={handleSubmit} disabled={submitState === 'loading'} className="btn btn-accent w-full">
          {submitState === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
          {submitState === 'loading' ? 'Updating…' : 'Update Placements'}
        </button>
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════
   ACTION TYPE BADGE
   ═════════════════════════════════════════════════════════════════ */
const ACTION_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pause_ad:                    { bg: C.redBg, color: C.red, border: C.redBorder, label: 'Pause Ad' },
  pause_adset:                 { bg: C.redBg, color: C.red, border: C.redBorder, label: 'Pause Ad Set' },
  scale_adset:                 { bg: C.greenBg, color: C.green, border: C.greenBorder, label: 'Scale Ad Set' },
  replace_creative:            { bg: C.orangeBg, color: C.orange, border: C.orangeBorder, label: 'Replace Creative' },
  add_creative:                { bg: C.blueBg, color: C.blue, border: C.blueBorder, label: 'Add Creative' },
  add_adset:                   { bg: C.purpleBg, color: C.purple, border: C.purpleBorder, label: 'Add Ad Set' },
  shift_budget_between_adsets: { bg: C.indigoBg, color: C.indigo, border: C.indigoBorder, label: 'Shift Budget' },
  reduce_total_budget:         { bg: C.amberBg, color: C.amber, border: C.amberBorder, label: 'Reduce Budget' },
  narrow_placement:            { bg: C.surfaceMuted, color: C.textSecondary, border: C.border, label: 'Narrow Placement' },
  dayparting:                  { bg: C.surfaceMuted, color: C.textSecondary, border: C.border, label: 'Dayparting' },
  refresh_audience:            { bg: C.blueBg, color: C.blue, border: C.blueBorder, label: 'Refresh Audience' },
}

function TypeBadge({ type }: { type: string }) {
  const s = ACTION_STYLES[type] || { bg: 'var(--muted)', color: 'var(--ink-3)', border: 'var(--hairline)', label: plainStatus('actionType', type).label }
  const icons: Record<string, React.ReactNode> = {
    pause_ad: <Pause size={11} />,
    pause_adset: <Pause size={11} />,
    scale_adset: <TrendingUp size={11} />,
    replace_creative: <ArrowRightLeft size={11} />,
    add_creative: <Sparkles size={11} />,
    add_adset: <Target size={11} />,
    shift_budget_between_adsets: <ArrowRightLeft size={11} />,
    reduce_total_budget: <DollarSign size={11} />,
    narrow_placement: <Layers size={11} />,
    dayparting: <Clock size={11} />,
    refresh_audience: <Users size={11} />,
  }
  return <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{icons[type] || <Zap size={11} />}{plainStatus('actionType', type).label}</span>
}

// ── Auto-vs-human chip ──
function SourceChip({ source }: { source?: 'auto' | 'human' }) {
  if (!source) return null
  return source === 'auto' ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accentBorder}` }}>
      <Bot size={10} /> Auto
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.border}` }}>
      <User size={10} /> Human
    </span>
  )
}

// ── Urgency dot ──
function UrgencyDotChip({ urgency }: { urgency?: 'high' | 'medium' | 'low' }) {
  if (!urgency) return null
  const color = urgency === 'high' ? C.red : urgency === 'medium' ? C.amber : C.textMuted
  return (
    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: C.textSecondary }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {plainStatus('urgency', urgency).label}
    </span>
  )
}

// ── Dayparting 24h grid ──
function DaypartingGrid({ activeHours }: { activeHours: number[] }) {
  const set = new Set(activeHours)
  return (
    <div className="space-y-1">
      <p className="micro-label">Hours the ads run (UTC — add 5½ hours for India time)</p>
      <div className="grid grid-cols-24 gap-0.5" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            title={`${h.toString().padStart(2, '0')}:00 UTC — ${set.has(h) ? 'ads run' : 'ads off'}`}
            className="h-5 rounded-sm flex items-center justify-center text-[8px] font-mono"
            style={{
              background: set.has(h) ? C.accent : C.surfaceMuted,
              color: set.has(h) ? '#fff' : C.textFaint,
              border: `1px solid ${set.has(h) ? C.accent : C.borderLight}`,
            }}
          >
            {h % 6 === 0 ? h : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function ReplaceBadge({ status }: { status?: string }) {
  if (!status) return null
  const m: Record<string, { bg: string; c: string; b: string; spin?: boolean }> = { queued: { bg: C.blueBg, c: C.blue, b: C.blueBorder, spin: true }, producing: { bg: C.blueBg, c: C.blue, b: C.blueBorder, spin: true }, complete: { bg: C.greenBg, c: C.green, b: C.greenBorder }, failed: { bg: C.redBg, c: C.red, b: C.redBorder } }
  const s = m[status] || { bg: 'var(--muted)', c: 'var(--ink-3)', b: 'var(--hairline)' }
  return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: s.bg, color: s.c, border: `1px solid ${s.b}` }}>{s.spin ? <Loader2 size={10} className="animate-spin" /> : status === 'complete' ? <CheckCircle size={10} /> : <XCircle size={10} />}{plainStatus('actionStatus', status).label}</span>
}

/* ═════════════════════════════════════════════════════════════════
   ACTIONS SECTION
   ═════════════════════════════════════════════════════════════════ */
const GROWTH = [
  'scale_adset', 'replace_creative', 'add_creative', 'add_adset',
  'shift_budget_between_adsets', 'reduce_total_budget',
  'narrow_placement', 'dayparting', 'refresh_audience',
]
const FILTERS = ['all', 'pending', 'executed', 'overridden'] as const

function ActionsPanel({ tenantId, campaignId, adSetNames = {} }: { tenantId: string; campaignId: string; adSetNames?: Record<string, string> }) {
  const [actions, setActions] = useState<CampaignAction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [st, setSt] = useState<Record<string, { a?: string; o?: string }>>({})
  // Legacy action records do not persist objective, return basis or the
  // economics version behind their narrative. Keep history reviewable, but
  // withhold the narrative and one-click execution until that contract is
  // migrated and the refund basis is reconciled.
  const executionAllowed = false

  async function load(f?: string) {
    try {
      const q = f && f !== 'all' ? `?status=${f}` : ''
      const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}/actions${q}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setActions(Array.isArray(d) ? d : d.actions ?? [])
    } catch { setActions([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load(filter) }, [tenantId, campaignId, filter]) // eslint-disable-line
  useEffect(() => {
    if (!actions.some(a => a.replacementStatus === 'queued' || a.replacementStatus === 'producing')) return
    const t = setInterval(() => load(filter), 30000); return () => clearInterval(t)
  }, [actions, filter]) // eslint-disable-line

  function upd(id: string, k: 'a' | 'o', v: string) { setSt(p => ({ ...p, [id]: { ...p[id], [k]: v } })) }
  async function approve(id: string) {
    upd(id, 'a', 'loading')
    try { const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}/actions/${id}/approve`, { method: 'POST' }); if (!r.ok) throw new Error(); upd(id, 'a', 'success'); setTimeout(() => { upd(id, 'a', ''); load(filter) }, 1400) }
    catch { upd(id, 'a', 'error'); setTimeout(() => upd(id, 'a', ''), 3000) }
  }
  async function override(id: string) {
    upd(id, 'o', 'loading')
    try { const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}/actions/${id}/override`, { method: 'POST' }); if (!r.ok) throw new Error(); upd(id, 'o', 'success'); setTimeout(() => { upd(id, 'o', ''); load(filter) }, 1400) }
    catch { upd(id, 'o', 'error'); setTimeout(() => upd(id, 'o', ''), 3000) }
  }

  const counts = useMemo(() => ({ all: actions.length, pending: actions.filter(a => a.status === 'pending').length, executed: actions.filter(a => a.status === 'executed').length, overridden: actions.filter(a => a.status === 'overridden').length }), [actions])

  return (
    <div>
      <div className="mb-4 rounded-xl px-4 py-3" style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}` }}>
        <p className="text-sm font-semibold" style={{ color: C.amber }}>These older suggestions can&apos;t be acted on from here</p>
        <p className="text-xs mt-1" style={{ color: C.textSecondary }}>They were saved before we recorded the campaign goal and the numbers behind each one, so the reasoning and the one-click buttons are hidden. Check each against the campaign today before changing anything.</p>
      </div>
      {/* Filter row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1">
          {FILTERS.map(f => {
            const n = counts[f]; const on = filter === f
            return <button key={f} onClick={() => { setFilter(f); setLoading(true) }} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={on ? { background: C.accent, color: '#fff' } : { background: C.surface, color: C.textMuted, border: `1px solid ${C.border}` }}>{f === 'all' ? 'All' : plainStatus('actionStatus', f).label}{n > 0 && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={on ? { background: 'rgba(23,20,15,0.10)' } : { background: C.borderLight }}>{n}</span>}</button>
          })}
        </div>
        <button onClick={() => load(filter)} className="btn btn-ghost"><RefreshCw size={11} />Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20" style={{ color: C.textMuted }}><Loader2 size={18} className="animate-spin" /></div>
      ) : actions.length === 0 ? (
        <div className="py-20 text-center rounded-2xl" style={{ background: C.surfaceMuted, border: `2px dashed ${C.border}` }}>
          <Zap size={28} style={{ color: C.textFaint, margin: '0 auto 10px' }} />
          <p className="text-sm font-semibold" style={{ color: C.textMuted }}>No suggested changes</p>
          <p className="text-xs mt-1" style={{ color: C.textFaint }}>Suggestions show up here when the campaign check finds something worth changing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map(action => {
            const aS = st[action.actionId]?.a || '', oS = st[action.actionId]?.o || ''
            const pending = action.status === 'pending'
            const growth = GROWTH.includes(action.type)
            const pause = action.type === 'pause_ad' || action.type === 'pause_adset'
            const hasRepl = action.type === 'replace_creative' || action.type === 'add_creative'
            const typeS = ACTION_STYLES[action.type] || { border: C.border }

            return (
              <div key={action.actionId} className="card card-hover overflow-hidden">
                {/* Color top bar */}
                <div className="h-1" style={{ background: typeS.border }} />

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex min-w-0 items-center gap-3 flex-wrap">
                      <TypeBadge type={action.type} />
                      <span className="min-w-0 break-words text-sm font-semibold" style={{ color: C.text }}>{typeof action.targetName === 'string' ? action.targetName : 'This campaign'}</span>
                      <SourceChip source={action.source} />
                      <UrgencyDotChip urgency={action.urgency} />
                    </div>
                    <StatusBadge status={action.status} domain="actionStatus" />
                  </div>

                  <p className="text-[13px] leading-relaxed mb-4" style={{ color: C.textSecondary }}>The reasoning for this older suggestion is hidden. Check it against how the campaign is doing today.</p>

                  {/* Info chips */}
                  <div className="flex min-w-0 items-center gap-2 flex-wrap">
                    {action.type === 'replace_creative' && action.metrics?.fatiguedHook && action.metrics?.replacementHook && (
                      <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}` }}>
                        <span className="min-w-0 break-words px-1 py-0.5 rounded text-[11px]" style={{ background: C.redBg, color: C.red }}>{humanise(String(action.metrics.fatiguedHook))}</span>
                        <span style={{ color: C.textMuted }}>&rarr;</span>
                        <span className="min-w-0 break-words px-1 py-0.5 rounded text-[11px]" style={{ background: C.greenBg, color: C.green }}>{humanise(String(action.metrics.replacementHook))}</span>
                      </span>
                    )}
                    {action.type === 'replace_creative' && Array.isArray(action.metrics?.forcedHookStyles) && action.metrics.forcedHookStyles.length > 0 && (
                      <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` }}>
                        Use: {(action.metrics.forcedHookStyles as string[]).map((h) => humanise(h).toLowerCase()).join(', ')}
                      </span>
                    )}
                    {action.type === 'replace_creative' && Array.isArray(action.metrics?.avoidHookStyles) && action.metrics.avoidHookStyles.length > 0 && (
                      <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` }}>
                        Avoid: {(action.metrics.avoidHookStyles as string[]).map((h) => humanise(h).toLowerCase()).join(', ')}
                      </span>
                    )}
                    {action.type === 'add_creative' && action.metrics?.newHook && (
                      <span className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>Opening line: <strong className="break-words" style={{ color: C.blue }}>{humanise(String(action.metrics.newHook))}</strong></span>
                    )}
                    {action.type === 'add_adset' && action.metrics?.audienceType && (
                      <span className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>Audience: <strong>{plainStatus('audienceKind', String(action.metrics.audienceType)).label}</strong></span>
                    )}
                    {action.type === 'scale_adset' && (action.metrics?.oldBudgetPercent != null || action.metrics?.newBudgetPercent != null) && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>
                        <strong style={{ color: C.textMuted }}>{Number(action.metrics.oldBudgetPercent ?? 0)}%</strong>
                        <span>&rarr;</span>
                        <strong style={{ color: C.green }}>{Number(action.metrics.newBudgetPercent ?? 0)}%</strong>
                      </span>
                    )}
                    {action.type === 'shift_budget_between_adsets' && (
                      <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>
                        <strong className="min-w-0 break-words" style={{ color: C.red }}>{adSetNames[String(action.metrics?.donorAdSetId ?? '')] ?? 'A weaker ad set'}</strong>
                        <span>&rarr;</span>
                        <strong className="min-w-0 break-words" style={{ color: C.green }}>{adSetNames[String(action.metrics?.recipientAdSetId ?? '')] ?? 'a stronger ad set'}</strong>
                        {action.metrics?.shiftPercent != null && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[11px]" style={{ background: C.indigoBg, color: C.indigo }}>
                            {Number(action.metrics.shiftPercent)}%
                          </span>
                        )}
                      </span>
                    )}
                    {action.type === 'reduce_total_budget' && (action.metrics?.oldDailyBudget != null || action.metrics?.newDailyBudget != null) && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>
                        <strong style={{ color: C.textMuted }}>{action.metrics?.oldDailyBudget != null ? formatInr(Number(action.metrics.oldDailyBudget)) : '—'}</strong>
                        <span>&rarr;</span>
                        <strong style={{ color: C.amber }}>{action.metrics?.newDailyBudget != null ? formatInr(Number(action.metrics.newDailyBudget)) : '—'}</strong>
                        <span className="text-[10px]" style={{ color: C.textMuted }}>a day</span>
                      </span>
                    )}
                    {action.type === 'narrow_placement' && Array.isArray(action.metrics?.droppedPlacements) && action.metrics.droppedPlacements.length > 0 && (
                      <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>
                        Stop showing on: {(action.metrics.droppedPlacements as string[]).map((p) => (
                          <span key={p} className="px-1 py-0.5 rounded text-[11px] ml-1" style={{ background: C.redBg, color: C.red }}>{humanise(p)}</span>
                        ))}
                      </span>
                    )}
                    {action.type === 'refresh_audience' && action.metrics?.newAudience && (
                      <span className="inline-flex min-w-0 max-w-full items-start gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue }}>
                        <Users size={11} className="mt-0.5 shrink-0" />
                        <span className="flex min-w-0 flex-col text-[11px]">
                          <span className="font-semibold">New audience</span>
                          {(describeAudience(action.metrics.newAudience).length ? describeAudience(action.metrics.newAudience) : ['A fresh audience that has not seen these ads']).map((line) => (
                            <span key={line} className="break-words">{line}</span>
                          ))}
                        </span>
                      </span>
                    )}
                    {hasRepl && action.replacementStatus && <ReplaceBadge status={action.replacementStatus} />}
                    {action.recommendedAt && <span className="text-[11px] tabular-nums flex items-center gap-1" style={{ color: C.textMuted }}><Clock size={10} />Suggested {formatRelative(action.recommendedAt)}</span>}
                    {pending && action.executeAt && <span className="text-[11px] tabular-nums flex items-center gap-1 font-semibold" style={{ color: C.amber }}><Clock size={10} />Happens {formatRelative(action.executeAt)}</span>}
                  </div>

                  {/* Dayparting visual */}
                  {action.type === 'dayparting' && Array.isArray(action.metrics?.activeHours) && (
                    <div className="mt-4">
                      <DaypartingGrid activeHours={action.metrics.activeHours as number[]} />
                    </div>
                  )}

                  {/* Buttons — every pending action gets buttons */}
                  {pending && (
                    <div className="flex items-center gap-2.5 mt-4 pt-4" style={{ borderTop: `1px solid ${C.borderLight}` }}>
                      {executionAllowed && growth && (
                        <button onClick={() => approve(action.actionId)} disabled={aS === 'loading'} className="btn" style={aS === 'success' ? { background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` } : aS === 'error' ? { background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` } : { background: C.green, color: '#fff' }}>
                          {aS === 'loading' ? <Loader2 size={13} className="animate-spin" /> : aS === 'success' ? <CheckCircle size={13} /> : <ThumbsUp size={13} />}
                          {aS === 'loading' ? 'Approving…' : aS === 'success' ? 'Approved' : aS === 'error' ? "Couldn't approve — try again" : 'Approve'}
                        </button>
                      )}
                      {executionAllowed && pause && (
                        <button onClick={() => approve(action.actionId)} disabled={aS === 'loading'} className="btn" style={aS === 'success' ? { background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` } : aS === 'error' ? { background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` } : { background: C.red, color: '#fff' }}>
                          {aS === 'loading' ? <Loader2 size={13} className="animate-spin" /> : aS === 'success' ? <CheckCircle size={13} /> : <Pause size={13} />}
                          {aS === 'loading' ? 'Doing it…' : aS === 'success' ? 'Done' : aS === 'error' ? "Couldn't do it — try again" : 'Do it now'}
                        </button>
                      )}
                      {!executionAllowed && <span className="chip chip-warn">Can&apos;t be done from here</span>}
                      <button onClick={() => override(action.actionId)} disabled={oS === 'loading'} className="btn btn-ghost">
                        {oS === 'loading' ? <Loader2 size={13} className="animate-spin" /> : oS === 'success' ? <CheckCircle size={13} /> : <Ban size={13} />}
                        {oS === 'loading' ? 'Saving…' : oS === 'success' ? 'Done' : oS === 'error' ? "Couldn't save — try again" : "Don't do this"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════
   AUDIT — Bayesian / Power-calc / Thompson / DiD helpers
   ═════════════════════════════════════════════════════════════════ */
function BayesianVerdictPanel({ b }: { b: NonNullable<AuditSnapshot['bayesian']> }) {
  // Contribution breakeven is intentionally not used here while the refund
  // basis is being reconciled. This panel is only a raw value-vs-spend check.
  const rawThreshold = 1.0
  const passed = b.lowerROAS != null && b.lowerROAS >= rawThreshold
  const conf = b.confidenceLevel ?? 0.95
  return (
    <div
      className="rounded-lg p-3 grid grid-cols-2 gap-3"
      style={{ background: passed ? C.greenBg : C.surfaceMuted, border: `1px solid ${passed ? C.greenBorder : C.border}` }}
    >
      <div>
        <p className="micro-label">Estimated return per ₹1</p>
        <p className="text-base font-bold tabular-nums" style={{ color: C.text }}>
          {b.shrunkenROAS != null ? `${b.shrunkenROAS.toFixed(2)}x` : '—'}
        </p>
      </div>
      <div>
        <p className="micro-label">
          Cautious estimate ({Math.round(conf * 100)}% sure)
        </p>
        <p className="text-base font-bold tabular-nums" style={{ color: passed ? C.green : C.text }}>
          {b.lowerROAS != null ? `${b.lowerROAS.toFixed(2)}x` : '—'}
        </p>
      </div>
      {passed && (
        <div className="col-span-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md" style={{ background: C.surface, color: C.green, border: `1px solid ${C.greenBorder}` }}>
            <CheckCircle size={10} /> Even the cautious estimate brings back more than it spends ({Math.round(conf * 100)}% sure)
          </span>
        </div>
      )}
      <p className="col-span-2 text-[10.5px]" style={{ color: C.textMuted }}>An estimate from past results — not profit, and not proof the ads caused the sales.</p>
    </div>
  )
}

function PowerCalcBadge({ p }: { p: NonNullable<AuditSnapshot['powerCalc']> }) {
  const tone = p.reachedFloor
    ? { bg: C.greenBg, fg: C.green, border: C.greenBorder, label: 'Enough data to judge' }
    : { bg: C.amberBg, fg: C.amber, border: C.amberBorder, label: 'Not enough data yet' }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md whitespace-nowrap"
      style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` }}
      title={p.minDays != null ? `Needs ${p.minDays} days of results${p.daysObserved != null ? `; has ${p.daysObserved}` : ''}` : undefined}
    >
      <BarChart3 size={10} /> {tone.label}
      {p.daysObserved != null && p.minDays != null && (
        <span className="font-mono">{p.daysObserved} of {p.minDays} days</span>
      )}
    </span>
  )
}

function ThompsonAllocationBar({ adSets }: { adSets: NonNullable<AuditSnapshot['adSets']> }) {
  const allocs = adSets
    .filter((a) => typeof a.thompsonAllocation === 'number')
    .map((a) => ({ name: a.name || a.id || '?', alloc: a.thompsonAllocation as number }))
  if (allocs.length === 0) return null
  const total = allocs.reduce((s, a) => s + a.alloc, 0) || 1
  return (
    <div>
      <p className="micro-label mb-2">Suggested budget split</p>
      <div className="rounded-md overflow-hidden flex h-2" style={{ border: `1px solid ${C.borderLight}` }}>
        {allocs.map((a, i) => {
          const pct = (a.alloc / total) * 100
          const palette = [C.accent, C.green, C.purple, C.amber, C.red, C.indigo, C.blue]
          return <div key={i} title={`${a.name}: ${pct.toFixed(0)}%`} style={{ width: `${pct}%`, background: palette[i % palette.length] }} />
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {allocs.map((a, i) => {
          const pct = (a.alloc / total) * 100
          const palette = [C.accent, C.green, C.purple, C.amber, C.red, C.indigo, C.blue]
          return (
            <div key={i} className="flex items-center gap-1 text-[11px]" style={{ color: C.textSecondary }}>
              <span className="w-2 h-2 rounded-sm" style={{ background: palette[i % palette.length] }} />
              <span className="truncate max-w-[160px]">{a.name}</span>
              <span className="font-mono tabular-nums" style={{ color: C.textMuted }}>{pct.toFixed(0)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type DiDPoint = { day: number; observed: number; counterfactual: number }
function MiniDiDChart({ data }: { data: DiDPoint[] }) {
  if (!data || data.length === 0) return null
  const w = 180, h = 44, pad = 2
  const maxY = Math.max(...data.map((d) => Math.max(d.observed, d.counterfactual)), 1)
  const minDay = Math.min(...data.map((d) => d.day))
  const maxDay = Math.max(...data.map((d) => d.day))
  const dx = maxDay === minDay ? 1 : maxDay - minDay
  const xAt = (d: number) => pad + ((d - minDay) / dx) * (w - 2 * pad)
  const yAt = (v: number) => h - pad - (v / maxY) * (h - 2 * pad)
  const obsPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(d.day)},${yAt(d.observed)}`).join(' ')
  const cfPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(d.day)},${yAt(d.counterfactual)}`).join(' ')
  const last = data[data.length - 1]
  const fatigueRatio = last.counterfactual > 0 ? last.observed / last.counterfactual : 1
  const isFatigued = fatigueRatio < 0.85
  return (
    <div className="inline-flex items-center gap-2">
      <svg width={w} height={h} aria-label="Ad tiredness: actual results against expected">
        <path d={cfPath} fill="none" stroke={C.textFaint} strokeWidth={1.25} strokeDasharray="3 2" />
        <path d={obsPath} fill="none" stroke={isFatigued ? C.red : C.green} strokeWidth={1.5} />
        {data.map((d, i) => (
          <circle key={i} cx={xAt(d.day)} cy={yAt(d.observed)} r={1.5} fill={isFatigued ? C.red : C.green} />
        ))}
      </svg>
      <div className="text-[10px] leading-tight" style={{ color: C.textMuted }}>
        <div>actual vs <span style={{ color: C.textFaint }}>expected</span></div>
        <div className="font-mono tabular-nums" style={{ color: isFatigued ? C.red : C.green }}>
          {(fatigueRatio * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  )
}

function shadowFieldText(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return /^[a-z0-9]+(_[a-z0-9]+)+$/i.test(v) ? humanise(v) : v
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const t = typeof obj.type === 'string' ? obj.type : undefined
    const tn = typeof obj.targetName === 'string' ? obj.targetName : undefined
    const r = typeof obj.reason === 'string' ? obj.reason : undefined
    if (t || tn) return [t ? plainStatus('actionType', t).label : undefined, tn].filter(Boolean).join(' · ')
    if (r) return r
    const a = describeAudience(obj)
    return a.length ? a.join(', ') : '—'
  }
  return String(v)
}

function ShadowActionsPanel({ tenantId, campaignId }: { tenantId: string; campaignId: string }) {
  const [actions, setActions] = useState<ShadowAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const d = await getShadowActions(tenantId, campaignId)
        if (!cancelled) {
          setActions(d)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(plainFailure("We couldn't load the held-back suggestions. Try again.", e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    setLoading(true)
    load()
    return () => { cancelled = true }
  }, [tenantId, campaignId])

  if (loading) return <div className="py-6 text-center" style={{ color: C.textMuted }}><Loader2 size={14} className="animate-spin mx-auto" /></div>
  if (error) return <PlainErrorNote className="px-3 py-3 rounded-md" error={error} />
  if (actions.length === 0) return <p className="text-xs italic px-3 py-6 text-center" style={{ color: C.textMuted }}>No held-back suggestions for this campaign.</p>

  return (
    <div className="card-inset overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Suggested change</th>
            <th>Held back because</th>
            <th>Would it have helped?</th>
            <th className="num">When</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a, i) => (
            <tr key={i}>
              <td className="text-xs font-semibold break-words" style={{ color: C.text }}>
                {shadowFieldText(a.proposedAction)}
              </td>
              <td className="text-xs break-words" style={{ color: C.textSecondary }}>
                {shadowFieldText(a.blockedReason)}
              </td>
              <td>
                <RegretLabel label={a.regretLabel} />
              </td>
              <td className="num mono text-[11px]" style={{ color: C.textMuted }}>
                {a.proposedAt ? formatRelative(a.proposedAt) : a.age || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════
   SIBLING GROUPING — pair *_VIDEO ↔ *_IMAGE ad sets
   ═════════════════════════════════════════════════════════════════ */
type SiblingFormat = 'video' | 'image'

interface AdSetGroupRow {
  adSet: CampaignAdSet
  formatTag?: SiblingFormat
  siblingFormat?: SiblingFormat
  groupHead?: boolean
}

function detectFormatTag(name?: string): SiblingFormat | undefined {
  if (!name) return undefined
  if (/_VIDEO\b/i.test(name)) return 'video'
  if (/_IMAGE\b/i.test(name)) return 'image'
  return undefined
}

function siblingBaseName(name?: string) {
  return name?.replace(/_(VIDEO|IMAGE)\b/i, '') ?? ''
}

function groupSiblings(adSets: CampaignAdSet[]): AdSetGroupRow[] {
  const byBase = new Map<string, CampaignAdSet[]>()
  for (const a of adSets) {
    const base = siblingBaseName(a.name)
    if (!base) continue
    if (!byBase.has(base)) byBase.set(base, [])
    byBase.get(base)!.push(a)
  }

  const out: AdSetGroupRow[] = []
  const seen = new Set<CampaignAdSet>()

  for (const a of adSets) {
    if (seen.has(a)) continue
    const base = siblingBaseName(a.name)
    const fmt = detectFormatTag(a.name)
    const peers = (byBase.get(base) ?? []).filter((p) => p !== a && detectFormatTag(p.name) && detectFormatTag(p.name) !== fmt)
    const sibling = peers[0]
    if (sibling && fmt) {
      const sibFmt = detectFormatTag(sibling.name)!
      out.push({ adSet: a, formatTag: fmt, siblingFormat: sibFmt, groupHead: true })
      out.push({ adSet: sibling, formatTag: sibFmt, siblingFormat: fmt, groupHead: false })
      seen.add(a)
      seen.add(sibling)
    } else {
      out.push({ adSet: a, formatTag: fmt })
      seen.add(a)
    }
  }
  return out
}

/* ═════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═════════════════════════════════════════════════════════════════ */
interface PageProps {
  params: Promise<{ tenantId: string; campaignId: string }>
  /** `?tab=adsets&focus=<metaAdSetId|metaAdId>` — lets the recommendations page
   *  link straight to the ad group or ad it is talking about. */
  searchParams: Promise<{ tab?: string; focus?: string }>
}

export default function CampaignDetailPage({ params, searchParams }: PageProps) {
  const { tenantId, campaignId } = use(params)
  const { tab: initialTab, focus: focusId } = use(searchParams)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approveState, setApproveState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [pauseState, setPauseState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [syncing, setSyncing] = useState(false)
  const [viewAd, setViewAd] = useState<CampaignAd | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectState, setRejectState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  // Bare account id -> friendly name, best-effort (needs a Meta access token
  // on file) — the picker falls back to raw act_XXXX ids when this is empty.
  const [accountNames, setAccountNames] = useState<Record<string, string>>({})
  // Custom/lookalike audiences are account-scoped Meta objects — resolve
  // metaAudienceId -> name against whichever account is currently selected
  // in the picker above, live, since audiences created for one account
  // aren't valid (or even visible) under another.
  const [audienceNames, setAudienceNames] = useState<Record<string, MetaCustomAudience>>({})
  const [pkg, setPkg] = useState<CreativePackage | null>(null)
  const [pkgLoading, setPkgLoading] = useState(false)
  const [imgState, setImgState] = useState<Record<number, string>>({})
  const [vidRetry, setVidRetry] = useState<string>('idle')
  const [vidRewrite, setVidRewrite] = useState<string>('idle')
  const [snaps, setSnaps] = useState<AuditSnapshot[]>([])
  const [snapsLoading, setSnapsLoading] = useState(false)
  const [tab, setTab] = useState(initialTab ?? 'overview')
  // Open shadow_review counts keyed by Meta adset ID, populated once per load.
  const [adsetProposals, setAdsetProposals] = useState<Record<string, number>>({})
  // Pre-launch review — what approving actually does (destination, pixel,
  // conversion event, blockers). Only loaded for pending_approval campaigns.
  // Null while loading, or if /review itself errored — in that case we don't
  // block the operator, since /approve runs the same checks server-side.
  const [review, setReview] = useState<CampaignLaunchReview | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const launchBlocked = !!review && !review.ready

  const [swapPanelOpen, setSwapPanelOpen] = useState(false)
  const [metaPages, setMetaPages] = useState<MetaPage[]>([])
  const [metaPagesState, setMetaPagesState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [swapPageId, setSwapPageId] = useState('')
  const [swapState, setSwapState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [swapError, setSwapError] = useState<string | null>(null)

  const [addAdSetOpen, setAddAdSetOpen] = useState(false)
  const [accountAudiences, setAccountAudiences] = useState<MetaCustomAudience[]>([])
  const [accountAudiencesState, setAccountAudiencesState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [newAdSetName, setNewAdSetName] = useState('')
  const [newAdSetAudienceType, setNewAdSetAudienceType] = useState<'advantage_plus' | 'retarget' | 'lookalike'>('advantage_plus')
  const [newAdSetAudienceId, setNewAdSetAudienceId] = useState('')
  const [newAdSetBudget, setNewAdSetBudget] = useState('')
  const [newAdSetCreative, setNewAdSetCreative] = useState<CreativeSourceValue>({ assetType: 'image', mediaUrl: '', primaryText: '', headline: '', cta: 'Shop Now' })
  // Whole sheet is the default — attaching every creative in a Gallery sheet
  // at once is the common case; "Single creative" stays for the occasional
  // one-off ad set.
  const [newAdSetSourceMode, setNewAdSetSourceMode] = useState<'sheet' | 'single'>('sheet')
  const [newAdSetSheetSelection, setNewAdSetSheetSelection] = useState<SheetAttachSelection | null>(null)
  const [newAdSetState, setNewAdSetState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [newAdSetError, setNewAdSetError] = useState<string | null>(null)
  const [newAdSetResult, setNewAdSetResult] = useState<BulkAdsResult | null>(null)
  const [newAdSetPlacementPreset, setNewAdSetPlacementPreset] = useState<PlacementPreset>('vertical')
  // '' means "inherit the campaign's existing goal" (the default, unchanged
  // behavior) — the effective value is computed against the live campaign
  // below rather than defaulted here, since `campaign` loads async.
  const [newAdSetOptimizationGoal, setNewAdSetOptimizationGoal] = useState('')
  // Gates submission when the operator picks a goal that differs from the
  // campaign's existing one — mixed goals in one campaign blend the audit
  // loop's ROAS/CPA comparison and the Day-14/30 learning writeback, so this
  // makes them confirm they understand that before it's allowed through.
  const [newAdSetGoalConfirmed, setNewAdSetGoalConfirmed] = useState(false)

  const flash = (m: string, t: 'success' | 'error') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 4000) }

  /* ─── Creative helpers ─── */
  function pollImg(pkgId: string, vi: number, done: () => void) { let n = 0; const t = setInterval(async () => { n++; try { const r = await fetch(`${API}/creative/${tenantId}/packages/${pkgId}`); if (r.ok) { const p = await r.json(); if (p.images?.[vi]?.imageUrl) { setPkg(p); done(); clearInterval(t) } } } catch {}; if (n >= 18) { done(); clearInterval(t) } }, 10000) }
  function pollVid(pkgId: string, done: () => void) { let n = 0; const t = setInterval(async () => { n++; try { const r = await fetch(`${API}/creative/${tenantId}/packages/${pkgId}`); if (r.ok) { const p = await r.json(); if (p.video?.videoUrl) { setPkg(p); done(); clearInterval(t) } } } catch {}; if (n >= 18) { done(); clearInterval(t) } }, 10000) }
  async function rerollImg(vi: number) { const id = campaign?.creativePackageId; if (!id) return; setImgState(p => ({ ...p, [vi]: 'loading' })); try { const r = await fetch(`${API}/creative/${tenantId}/packages/${id}/regenerate-image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variantIndex: vi }) }); if (!r.ok) throw new Error(); setImgState(p => ({ ...p, [vi]: 'polling' })); pollImg(id, vi, () => setImgState(p => ({ ...p, [vi]: 'idle' }))) } catch { setImgState(p => ({ ...p, [vi]: 'idle' })); flash("We couldn't make a new image. Try again.", 'error') } }
  async function newImgPrompt(vi: number) { const id = campaign?.creativePackageId; if (!id) return; setImgState(p => ({ ...p, [vi]: 'loading' })); try { const r = await fetch(`${API}/creative/${tenantId}/packages/${id}/regenerate-image-prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variantIndex: vi }) }); if (!r.ok) throw new Error(); setImgState(p => ({ ...p, [vi]: 'polling' })); pollImg(id, vi, () => setImgState(p => ({ ...p, [vi]: 'idle' }))) } catch { setImgState(p => ({ ...p, [vi]: 'idle' })); flash("We couldn't rewrite the image idea. Try again.", 'error') } }
  async function rerollVid() { const id = campaign?.creativePackageId; if (!id) return; setVidRetry('loading'); try { const r = await fetch(`${API}/creative/${tenantId}/packages/${id}/regenerate-video`, { method: 'POST' }); if (!r.ok) throw new Error(); setVidRetry('polling'); pollVid(id, () => setVidRetry('idle')) } catch { setVidRetry('idle'); flash("We couldn't make a new video. Try again.", 'error') } }
  async function rewriteVid() { const id = campaign?.creativePackageId; if (!id) return; setVidRewrite('loading'); try { const r = await fetch(`${API}/creative/${tenantId}/packages/${id}/regenerate-video-prompt`, { method: 'POST' }); if (!r.ok) throw new Error(); setVidRewrite('polling'); pollVid(id, () => setVidRewrite('idle')) } catch { setVidRewrite('idle'); flash("We couldn't rewrite the video idea. Try again.", 'error') } }

  /* ─── Data fetch ─── */
  async function fetchCampaign() {
    try {
      const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}`); if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d: Campaign = await r.json(); setCampaign(d); setError(null)
      if (d.creativePackageId) { setPkgLoading(true); fetch(`${API}/creative/${tenantId}/packages/${d.creativePackageId}`).then(r => r.ok ? r.json() : null).then(p => { if (p) setPkg(p) }).catch(() => {}).finally(() => setPkgLoading(false)) }
      if (d.status === 'pending_approval') {
        fetch(`${API}/companies/${tenantId}`).then(r => r.ok ? r.json() : null).then(c => {
          const ids: string[] = c?.meta?.accountIds || []
          setAccountIds(ids)
          // Products power the one-click "which product is this for?" fix in
          // the launch review panel.
          setProducts(c?.products ?? [])
          if (!ids.length || selectedAccountId) return
          // Prefer the account the Create Campaign form was built for
          // (audiences picked there are only valid on that same account) —
          // fall back to the first configured account if it wasn't set or
          // isn't in the tenant's current allowed list.
          const preferred = d.metaAccountId?.replace(/^act_/, '')
          setSelectedAccountId(preferred && ids.includes(preferred) ? preferred : ids[0])
        }).catch(() => {})
        getMetaAccounts(tenantId, true).then(res => {
          const names: Record<string, string> = {}
          for (const acc of res.accounts) names[acc.id.replace(/^act_/, '')] = acc.name || acc.id
          setAccountNames(names)
        }).catch(() => {})
      }
    } catch (e) { setError(plainFailure("We couldn't load this campaign. Try again.", e)) }
    finally { setLoading(false) }
  }

  /**
   * There's no single-campaign sync endpoint — Meta sync is always
   * tenant-wide, so this refreshes every active campaign, not just this one.
   * Fire-and-forget on the backend, so we poll this campaign on a fixed
   * cadence afterwards rather than waiting on one response to know it's done.
   */
  async function handleRefresh() {
    setSyncing(true)
    try {
      await syncCampaigns(tenantId)
    } catch {
      setSyncing(false)
      flash("We couldn't fetch the latest numbers from Meta. Try again.", 'error')
      return
    }
    const POLL_MS = 5000
    const MAX_POLLS = 12 // ~60s
    let n = 0
    const poll = async () => {
      n++
      await fetchCampaign()
      if (n >= MAX_POLLS) { setSyncing(false); flash('Latest numbers fetched from Meta', 'success'); return }
      setTimeout(poll, POLL_MS)
    }
    setTimeout(poll, POLL_MS)
  }

  /** Runs in the background on the server (40 ads × ~3 Meta calls can take minutes) — this just re-polls the campaign while the status field says it's still going, and stops itself once it flips to complete/failed. */
  useEffect(() => {
    if (campaign?.pageSwapStatus?.status !== 'running') return
    const t = setTimeout(() => { fetchCampaign() }, 4000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.pageSwapStatus?.status, campaign?.pageSwapStatus?.swapped, campaign?.pageSwapStatus?.failed])

  async function openSwapPanel() {
    setSwapPanelOpen(v => !v)
    if (metaPages.length === 0 && metaPagesState === 'idle') {
      setMetaPagesState('loading')
      try {
        const res = await getMetaPages(tenantId)
        setMetaPages(res.pages)
        setMetaPagesState('idle')
      } catch {
        setMetaPagesState('error')
      }
    }
  }

  async function doSwapPage() {
    if (!swapPageId) { setSwapError('Pick a Facebook Page first'); return }
    setSwapState('loading')
    setSwapError(null)
    try {
      const res = await swapCampaignPage(tenantId, campaignId, swapPageId)
      flash(res.message, 'success')
      setSwapState('idle')
      fetchCampaign()
    } catch (err) {
      setSwapState('error')
      setSwapError(plainFailure("We couldn't start switching the Page. Try again.", err))
    }
  }

  async function openAddAdSetPanel() {
    setAddAdSetOpen(v => !v)
    if (accountAudiences.length === 0 && accountAudiencesState === 'idle' && campaign?.metaAccountId) {
      setAccountAudiencesState('loading')
      try {
        const auds = await getMetaAccountAudiences(tenantId, campaign.metaAccountId)
        setAccountAudiences(auds)
        setAccountAudiencesState('idle')
      } catch {
        setAccountAudiencesState('error')
      }
    }
  }

  async function doAddAdSet() {
    const budget = Number(newAdSetBudget)
    if (!Number.isFinite(budget) || budget <= 0) { setNewAdSetError('Enter a positive daily budget'); return }
    if (newAdSetSourceMode === 'sheet') {
      if (!newAdSetSheetSelection || newAdSetSheetSelection.selectedCount === 0) { setNewAdSetError('Pick at least one creative from the sheet'); return }
    } else {
      if (!newAdSetCreative.mediaUrl) { setNewAdSetError(`Pick or upload a${newAdSetCreative.assetType === 'image' ? 'n image' : ' video'} first`); return }
      if (!newAdSetCreative.primaryText.trim() || !newAdSetCreative.headline.trim()) { setNewAdSetError('Primary text and headline are required'); return }
    }
    if (newAdSetAudienceType !== 'advantage_plus' && !newAdSetAudienceId) { setNewAdSetError('Pick an audience'); return }
    if (newAdSetGoalMismatch && !newAdSetGoalConfirmed) { setNewAdSetError('Tick the box under the goal warning below before creating this ad set'); return }
    setNewAdSetState('loading')
    setNewAdSetError(null)
    setNewAdSetResult(null)
    try {
      const res = await addAdSet(tenantId, campaignId, {
        name: newAdSetName.trim() || undefined,
        audienceType: newAdSetAudienceType,
        metaAudienceId: newAdSetAudienceType !== 'advantage_plus' ? newAdSetAudienceId : undefined,
        dailyBudget: budget,
        placementPreset: newAdSetPlacementPreset,
        optimizationGoal: effectiveNewAdSetGoal,
        ...(newAdSetSourceMode === 'sheet'
          ? { sheetId: newAdSetSheetSelection!.sheetId, excludeAssetIds: newAdSetSheetSelection!.excludeAssetIds }
          : newAdSetCreative),
      })
      flash(res.message, 'success')
      setNewAdSetResult(res)
      setNewAdSetState('idle')
      if (res.failed.length === 0) {
        setAddAdSetOpen(false)
        setNewAdSetName(''); setNewAdSetBudget(''); setNewAdSetAudienceId('')
        setNewAdSetCreative({ assetType: 'image', mediaUrl: '', primaryText: '', headline: '', cta: 'Shop Now' })
        setNewAdSetSheetSelection(null)
        setNewAdSetPlacementPreset('vertical')
        setNewAdSetOptimizationGoal(''); setNewAdSetGoalConfirmed(false)
      }
      fetchCampaign()
    } catch (err) {
      setNewAdSetState('error')
      setNewAdSetError(plainFailure("We couldn't add the ad set. Try again.", err))
    }
  }

  useEffect(() => {
    fetchCampaign()
    setSnapsLoading(true)
    fetch(`${API}/campaigns/${tenantId}/${campaignId}/audit-snapshots`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setSnaps(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setSnapsLoading(false))

    // Load open shadow_review decisions once, index by target (Meta adset ID)
    // so each AdSetRow can render its own count without a per-row fetch.
    getIntelligenceDecisions(tenantId, { status: 'shadow_review', limit: 500 })
      .then(res => {
        const byAdset: Record<string, number> = {}
        for (const d of res.decisions) {
          if (d.targetType === 'adset' && d.targetId) {
            byAdset[d.targetId] = (byAdset[d.targetId] || 0) + 1
          }
        }
        setAdsetProposals(byAdset)
      })
      .catch(() => {})
  }, [tenantId, campaignId]) // eslint-disable-line

  useEffect(() => {
    if (!selectedAccountId) return
    let cancelled = false
    getMetaAccountAudiences(tenantId, selectedAccountId.startsWith('act_') ? selectedAccountId : `act_${selectedAccountId}`)
      .then(list => {
        if (cancelled) return
        const byId: Record<string, MetaCustomAudience> = {}
        for (const a of list) byId[a.id] = a
        setAudienceNames(byId)
      })
      .catch(() => { if (!cancelled) setAudienceNames({}) })
    return () => { cancelled = true }
  }, [tenantId, selectedAccountId])

  /* ─── Campaign actions ─── */
  async function doPause() { const reason = window.prompt('Why are you pausing this campaign? (A short note for the team.)', 'Paused by hand'); if (!reason?.trim()) return; setPauseState('loading'); try { const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}/pause`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() }) }); if (!r.ok) throw new Error(); setPauseState('success'); flash('Campaign paused', 'success'); fetchCampaign() } catch { setPauseState('error'); flash("We couldn't pause the campaign. Try again.", 'error'); setTimeout(() => setPauseState('idle'), 3000) } }
  async function doResume() { try { const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}/resume`, { method: 'POST' }); if (!r.ok) throw new Error(); flash('Campaign resumed', 'success'); fetchCampaign() } catch { flash("We couldn't resume the campaign. Try again.", 'error') } }
  async function doApprove() { if (!selectedAccountId) { flash('Pick the Meta ad account to launch on', 'error'); return }; setApproveState('loading'); try { const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: selectedAccountId.startsWith('act_') ? selectedAccountId : `act_${selectedAccountId}` }) }); if (!r.ok) throw new Error(); await r.json(); setApproveState('success'); flash('Launched — the campaign is now live on Meta', 'success'); fetchCampaign() } catch { setApproveState('error'); flash("We couldn't launch the campaign. Try again.", 'error'); setTimeout(() => setApproveState('idle'), 3000) } }
  async function doReject() { setRejectState('loading'); try { const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: rejectReason }) }); if (!r.ok) throw new Error(); setRejectState('success'); flash('Campaign rejected', 'success'); setRejectOpen(false); setRejectReason(''); fetchCampaign() } catch { setRejectState('error'); flash("We couldn't reject the campaign. Try again.", 'error'); setTimeout(() => setRejectState('idle'), 3000) } }

  /* ─── Guards ─── */
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 size={24} className="animate-spin" style={{ color: C.accent }} /></div>
  if (error || !campaign) return (
    <div className="p-8 max-w-3xl mx-auto min-h-screen">
      <Link href={`/dashboard/${tenantId}/campaigns`} className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: C.textMuted }}><ArrowLeft size={14} />Back</Link>
      <div className="rounded-2xl p-5" style={{ background: C.redBg, border: `1px solid ${C.redBorder}` }}><p className="text-sm font-medium" style={{ color: C.red }}><AlertCircle size={15} className="inline mr-2" />{error ? "We couldn't load this campaign. Try again." : "We couldn't find this campaign. It may have been deleted."}</p></div>
      {error && <PlainErrorNote className="mt-3" error={error} />}
    </div>
  )

  /* ─── Derived ─── */
  const live = (campaign.metaAdSets?.length ? campaign.metaAdSets : campaign.adSets) || []
  const planned = campaign.campaignConfig?.adSets || []
  const usePlanned = live.length === 0 && planned.length > 0
  const objectiveContext = detailObjectiveContext(campaign, live)
  const runtimeCampaign = campaign as Campaign & { reach?: number; cpm?: number; frequency?: number }
  const hasCampaignLandingPageViews = live.some((adSet) => adSet.landingPageView != null)
  const campaignLandingPageViews = hasCampaignLandingPageViews ? live.reduce((sum, adSet) => sum + (adSet.landingPageView ?? 0), 0) : undefined
  const campaignAds = live.flatMap((adSet) => adSet.ads ?? [])
  const hasCampaignThruplays = campaignAds.some((ad) => ad.thruplay != null)
  const campaignThruplays = hasCampaignThruplays ? campaignAds.reduce((sum, ad) => sum + (ad.thruplay ?? 0), 0) : undefined
  const hasCampaignVideo3s = campaignAds.some((ad) => ad.video3s != null)
  const campaignVideo3s = hasCampaignVideo3s ? campaignAds.reduce((sum, ad) => sum + (ad.video3s ?? 0), 0) : undefined
  const campaignHasRecordedReturnBasis = campaign.revenueBasis === 'meta_action_value' ||
    campaign.revenueBasis === 'no_attributed_revenue'
  const campaignHasConfiguredEstimate = campaign.revenueBasis === 'configured_conversion_value'
  const campaignReturnResolved = campaignHasRecordedReturnBasis &&
    campaign.revenueAttributionSource != null &&
    campaign.revenueAttributionSource !== 'unknown' &&
    campaign.revenueAttributionSource !== 'unresolved' &&
    campaign.revenueAttributionSource !== 'account_fallback'
  const campaignValueAvailable = campaignReturnResolved || campaignHasConfiguredEstimate
  const campaignValueLabel = campaign.revenueBasis === 'configured_conversion_value'
    ? 'Estimated sales value'
    : campaign.revenueBasis === 'no_attributed_revenue'
      ? 'Sales value recorded'
      : 'Sales value (reported by Meta)'
  const campaignValueNote = campaignReturnResolved
    ? 'As reported by Meta; not cash in the bank'
    : campaignHasConfiguredEstimate
      ? 'An estimate from your settings, not real sales'
      : "We can't tell where this figure came from yet"
  const campaignPerformance = presentObjectiveMetrics(objectiveContext, {
    spend: campaign.spend,
    impressions: campaign.impressions,
    reach: runtimeCampaign.reach,
    clicks: campaign.clicks,
    conversions: campaign.conversions,
    roas: campaignReturnResolved ? campaign.roas : undefined,
    cpc: campaign.cpc,
    cpm: runtimeCampaign.cpm,
    landingPageView: campaignLandingPageViews,
    thruplay: campaignThruplays,
    video3s: campaignVideo3s,
  })
  const attributedActionValue = campaignValueAvailable ? campaign.revenue : undefined
  // What a new ad set inherits by default — same source the backend itself
  // falls back to (campaignConfig.adSets[0]) when no override is sent.
  const inheritedOptimizationGoal = live[0]?.optimizationGoal || campaign.campaignConfig?.adSets?.[0]?.optimizationGoal || 'OFFSITE_CONVERSIONS'
  const isAppCampaign = campaign.objective === 'OUTCOME_APP_PROMOTION'
  const newAdSetGoalOptions = isAppCampaign ? APP_OPTIMIZATION_OPTIONS : OPTIMIZATION_OPTIONS
  const newAdSetGoalLabels = isAppCampaign ? APP_OPTIMIZATION_LABELS : OPTIMIZATION_LABELS
  const effectiveNewAdSetGoal = newAdSetOptimizationGoal || inheritedOptimizationGoal
  const newAdSetGoalMismatch = effectiveNewAdSetGoal !== inheritedOptimizationGoal
  const pendingActs = (campaign.pendingActions || []).filter(a => a.status === 'pending' && GROWTH.includes(a.type)).length
  const isPendingApproval = campaign.status === 'pending_approval'
  const debate = campaign.reviewDebateLog || []

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { id: 'adsets', label: 'Ad sets', count: live.length || planned.length || undefined, icon: <Layers size={14} /> },
    { id: 'segments', label: 'Who it reaches', icon: <Users size={14} /> },
    { id: 'actions', label: 'Suggested changes', badge: pendingActs || undefined, icon: <Zap size={14} /> },
    { id: 'audit', label: 'Health checks', count: snaps.length || undefined, icon: <Activity size={14} /> },
    ...(campaign.creativePackageId ? [{ id: 'creative', label: 'Creative', icon: <ImageIcon size={14} /> }] : []),
  ]

  /* ─── ROAS color ─── */
  // This screen uses the demo's deliberately simple spend-versus-attributed-value signal:
  // 1.00x means attributed action value covered ad spend. Product breakeven
  // remains visible as separate context below instead of being conflated with
  // the raw ROAS colour.
  const rc = campaignReturnResolved && campaign.roas != null ? (campaign.roas >= 1 ? C.green : C.red) : C.textFaint

  return (
    <div className="min-h-screen">
      {/* Toast */}
      {toast && <div className="fixed top-5 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl break-words" style={toast.type === 'success' ? { background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green } : { background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red }}>{toast.message}</div>}

      <AdMediaModal tenantId={tenantId} ad={viewAd} onClose={() => setViewAd(null)} />

      {/* ─── TOP BAR ─── */}
      <div className="px-4 pt-6 pb-0 sm:px-6 lg:px-8 lg:pt-8 max-w-[1600px] mx-auto stagger">
        <Link href={`/dashboard/${tenantId}/campaigns`} className="inline-flex items-center gap-1.5 text-sm font-medium mb-5 transition-opacity hover:opacity-70" style={{ color: C.textMuted }}><ArrowLeft size={14} />Campaigns</Link>

        {/* ─── HEADER ─── */}
        <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
          <div className="min-w-0">
            <p className="micro-label mb-2">Campaign</p>
            <div className="flex min-w-0 flex-wrap items-center gap-3 mb-1.5">
              <h1 className="page-title min-w-0 break-words">{campaign.name || campaign.topic || 'Untitled'}</h1>
              <StatusBadge status={campaign.status} domain="campaignStatus" />
            </div>
            {campaign.topic && campaign.name && <p className="page-subtitle mb-2">{campaign.topic}</p>}
            <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: C.textMuted }}>
              {campaign.source === 'agent' && <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md" style={{ background: C.accentLight, color: C.accent }}><Bot size={11} />AI built</span>}
              {campaign.source === 'human' && <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.border}` }}><User size={11} />Dashboard built</span>}
              {campaign.source === 'manual' && <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md" title="Created directly in Meta Ads Manager and synced here for read-only visibility" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.border}` }}><ExternalLink size={11} />Made in Meta</span>}
              <span className="font-medium px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, border: `1px solid ${C.border}`, color: C.textSecondary }}>{objectiveContext.objectiveLabel}</span>
              {objectiveContext.optimizationGoal && <span className="font-medium px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, border: `1px solid ${C.border}`, color: C.textSecondary }}>Aiming for: {objectiveContext.optimizationGoal === 'MIXED' ? 'different goals per ad set' : humanise(objectiveContext.optimizationGoal).toLowerCase()}</span>}
              <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, border: `1px solid ${C.border}`, color: C.textSecondary }}>
                <Clock size={10} /> {campaign.dataAsOf ? `Numbers from ${formatRelative(campaign.dataAsOf)}` : "We don't know how fresh these numbers are"}
              </span>
              {campaign.budgetModel && (
                <span
                  className="font-bold px-2 py-0.5 rounded-md"
                  style={
                    campaign.budgetModel === 'abo'
                      ? { background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green }
                      : campaign.budgetModel === 'asc'
                        ? { background: C.amberBg, border: `1px solid ${C.amberBorder}`, color: C.amber }
                        : { background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue }
                  }
                  title={
                    campaign.budgetModel === 'abo'
                      ? 'Each ad set has its own budget, so money can be moved between them'
                      : campaign.budgetModel === 'asc'
                        ? "Meta's automated shopping campaign — only the overall budget and the ads can be changed"
                        : 'One budget for the whole campaign — Meta decides how to split it across ad sets'
                  }
                >
                  {campaign.budgetModel === 'abo' ? 'Budget per ad set' : campaign.budgetModel === 'asc' ? 'Meta shopping campaign' : 'Meta splits the budget'}
                </span>
              )}
              <FormatBadge format={campaign.creativeFormat} />
              <PromptsVersionBadge version={campaign.promptsVersion} />
              {campaign.launchedAt && <span><Clock size={10} className="inline mr-1" />Launched {formatWhen(campaign.launchedAt)}</span>}
              {campaign.status === 'paused' && campaign.pausedAt && (
                <span title={campaign.pauseReason} style={{ color: C.textMuted }}>
                  <Pause size={10} className="inline mr-1" />Paused {formatRelative(campaign.pausedAt)}
                </span>
              )}
              {campaign.lastAuditedAt && <span><Shield size={10} className="inline mr-1" />Last checked {formatWhen(campaign.lastAuditedAt)}</span>}
              {campaign.runId && <Link href={`/dashboard/${tenantId}/runs/${campaign.runId}`} className="font-semibold transition-opacity hover:opacity-70" style={{ color: C.accent }}>See how it was made<ExternalLink size={10} className="inline ml-0.5" /></Link>}
            </div>
            {(campaign.metaCampaignId || campaign.runId || campaign.metaAccountId) && (
              <Details
                className="mt-3 max-w-md"
                reference={campaign.metaCampaignId || campaign.runId}
                items={[
                  ...(campaign.metaCampaignId ? [{ label: 'Meta campaign', value: campaign.metaCampaignId }] : []),
                  ...(campaign.metaAccountId ? [{ label: 'Meta ad account', value: campaign.metaAccountId }] : []),
                  ...(campaign.runId ? [{ label: 'Build', value: campaign.runId }] : []),
                ]}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={syncing}
              className="btn"
              style={{ background: C.surfaceMuted, border: `1px solid ${C.border}`, color: C.textSecondary }}
              title="Fetches the latest numbers from Meta for all running campaigns, this one included"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : undefined} />
              {syncing ? 'Fetching…' : 'Refresh'}
            </button>
            {campaign.metaCampaignId && (
              <button
                onClick={openSwapPanel}
                className="btn"
                style={swapPanelOpen ? { background: C.accentLight, border: `1px solid ${C.accentBorder}`, color: C.accent } : { background: C.surfaceMuted, border: `1px solid ${C.border}`, color: C.textSecondary }}
                title="Change which Facebook Page this campaign's live ads post as — the campaign and its ads stay the same"
              >
                <Flag size={14} /> Change Page
              </button>
            )}
            {campaign.status === 'active' && <button onClick={doPause} disabled={pauseState !== 'idle'} className="btn" style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, color: C.amber }}>{pauseState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />}{pauseState === 'loading' ? 'Pausing…' : 'Pause'}</button>}
            {campaign.status === 'paused' && <button onClick={doResume} className="btn btn-accent"><Play size={14} fill="currentColor" />Resume</button>}
          </div>
        </div>

        {/* Swap Page panel */}
        {swapPanelOpen && campaign.metaCampaignId && (
          <div className="card p-4 mb-5">
            <p className="micro-label mb-1">Change Facebook Page</p>
            <p className="text-xs mb-3" style={{ color: C.textMuted }}>
              Every live ad is re-posted under the Page you pick — the campaign and its {live.reduce((n, a) => n + (a.ads?.length ?? 0), 0)} ads stay the same. The Page must already be allowed on this campaign&apos;s Meta ad account, or Meta will turn every ad down.
            </p>
            {metaPagesState === 'loading' && <p className="text-xs" style={{ color: C.textMuted }}>Loading Pages…</p>}
            {metaPagesState === 'error' && <p className="text-xs" style={{ color: C.red }}>We couldn&apos;t load your Facebook Pages. Check that Meta is connected in Settings, then try again.</p>}
            {metaPagesState === 'idle' && metaPages.length > 0 && !campaign.pageSwapStatus && (
              <div className="space-y-2.5">
                <PageSelect pages={metaPages} value={swapPageId} onChange={setSwapPageId} />
                {swapError && <PlainErrorNote error={swapError} />}
                <button
                  onClick={doSwapPage}
                  disabled={swapState === 'loading' || !swapPageId}
                  className="btn btn-accent"
                >
                  {swapState === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Flag size={13} />}
                  {swapState === 'loading' ? 'Starting…' : 'Change Page'}
                </button>
              </div>
            )}
            {campaign.pageSwapStatus && (
              <div className="card-inset p-3 mt-1">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <p className="text-sm font-semibold" style={{ color: C.text }}>
                    {campaign.pageSwapStatus.status === 'running' ? 'Changing the Page…' : campaign.pageSwapStatus.status === 'complete' ? 'Done' : "Couldn't finish"}
                  </p>
                  <p className="text-xs mono" style={{ color: C.textMuted }}>
                    {campaign.pageSwapStatus.swapped} changed · {campaign.pageSwapStatus.failed} didn&apos;t work · {campaign.pageSwapStatus.total} in all
                  </p>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: C.surfaceMuted }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round(((campaign.pageSwapStatus.swapped + campaign.pageSwapStatus.failed) / Math.max(1, campaign.pageSwapStatus.total)) * 100)}%`,
                      background: campaign.pageSwapStatus.failed > 0 ? C.amber : C.accent,
                    }}
                  />
                </div>
                {campaign.pageSwapStatus.status !== 'running' && (
                  <button
                    onClick={() => { setSwapPageId(''); setCampaign(c => c ? { ...c, pageSwapStatus: null } : c) }}
                    className="text-xs font-medium mt-2.5"
                    style={{ color: C.accent }}
                  >
                    Pick a different Page
                  </button>
                )}
                {campaign.pageSwapStatus.results.filter(r => r.status === 'failed').length > 0 && (
                  <Details
                    className="mt-2"
                    title="Ads that didn't change"
                    items={campaign.pageSwapStatus.results.filter(r => r.status === 'failed').map((r, i) => {
                      const ad = campaignAds.find((a) => a.id === r.adId)
                      return { label: ad?.name || `Ad ${i + 1}`, value: r.error || 'Meta turned this down.' }
                    })}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Syncing-from-Meta banner — stays up for the whole poll window */}
        {syncing && (
          <div
            className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm"
            style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue }}
          >
            <Loader2 size={14} className="animate-spin" />
            Fetching the latest numbers from Meta — this page updates by itself over the next minute.
          </div>
        )}

        {/* ─── METRICS STRIP ─── */}
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-6 md:gap-6">
            <MetricCell label="Spend" value={campaign.spend != null ? formatInr(campaign.spend) : '—'} />
            <MetricCell label={objectiveContext.resultLabel} value={campaignPerformance.resultValue} color={campaignPerformance.result == null ? C.textFaint : C.text} />
            {objectiveContext.group === 'sales' ? (
              <>
                <div>
                  <MetricCell label="Return per ₹1 spent" value={campaignPerformance.efficiencyValue} color={rc} />
                  <p className="mt-1 text-[10.5px] leading-snug" style={{ color: campaignReturnResolved ? C.textMuted : C.amber }}>{campaignValueNote}</p>
                </div>
                <MetricCell label={campaignValueAvailable ? campaignValueLabel : 'Sales value'} value={attributedActionValue != null ? formatInr(attributedActionValue) : 'Not available'} sub={campaignValueNote} />
              </>
            ) : (
              <MetricCell label={objectiveContext.efficiencyLabel} value={campaignPerformance.efficiencyValue} />
            )}
            <MetricCell label="Times shown" value={campaign.impressions?.toLocaleString('en-IN') ?? '—'} />
            {objectiveContext.group !== 'sales' && <MetricCell label="Clicks" value={campaign.clicks?.toLocaleString('en-IN') ?? '—'} sub={objectiveContext.resultLabel === 'Clicks' ? 'Main result' : undefined} />}
            <MetricCell label="Click rate" value={campaign.ctr != null ? `${campaign.ctr.toFixed(2)}%` : '—'} color={C.textSecondary} />
          </div>
          {campaign.budget != null && campaign.budget > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4" style={{ borderTop: `1px solid ${C.borderLight}` }}>
              <MetricCell label="Daily budget" value={formatInr(campaign.budget)} />
              <MetricCell label="Spent so far" value={formatInr(campaign.spend || 0)} />
              {campaign.spend != null && campaign.launchedAt && (() => { const d = Math.max(1, Math.round((Date.now() - new Date(campaign.launchedAt).getTime()) / 86400000)); return <><MetricCell label="Average a day" value={formatInr(campaign.spend / d)} /><MetricCell label="Days live" value={`${d}`} /></> })()}
            </div>
          )}
          {/* Verdict strip */}
          {snaps.length > 0 && (
            <div className="mt-4 rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: C.surfaceMuted, border: `1px solid ${C.border}` }}>
              <Shield size={14} className="mt-0.5 shrink-0" style={{ color: C.textMuted }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold" style={{ color: C.textSecondary }}>Latest health check</span>
                  <span className="text-[11px]" style={{ color: C.textMuted }}>{formatWhen(snaps[0].auditedAt)}</span>
                </div>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: C.textSecondary }}>Open Health checks to see the numbers behind it.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── APPROVAL PANEL ─── */}
      {isPendingApproval && (
        <div className="px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto mb-6">
          <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.greenBorder}`, background: C.greenBg }}>
            <div className="px-6 py-4 flex items-center gap-3" style={{ background: C.greenBg, borderBottom: `1px solid ${C.greenBorder}` }}>
              <ThumbsUp size={16} style={{ color: C.green }} />
              <div className="flex-1"><h2 className="section-title text-[17px]" style={{ color: C.green }}>Waiting for your approval</h2><p className="text-xs mt-0.5" style={{ color: C.green }}>Check the ads, then pick the Meta ad account to launch on.</p></div>
              <Link href={`/dashboard/${tenantId}/campaigns/new?edit=${campaignId}`} className="btn text-xs shrink-0" style={{ background: C.surface, border: `1px solid ${C.greenBorder}`, color: C.green }}>
                <Pencil size={12} /> Edit
              </Link>
            </div>
            <div className="p-6 space-y-6">
              {/* Destination, tracking and blockers first — resolved by the
                  same code the launch uses, so this is what Meta will really
                  receive. Everything below is the creative that ships to it. */}
              <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <LaunchReview
                  tenantId={tenantId}
                  campaignId={campaignId}
                  products={products}
                  onReview={setReview}
                />
              </div>

              {pkgLoading ? <div className="flex items-center gap-2 py-6" style={{ color: C.textMuted }}><Loader2 size={14} className="animate-spin" />Loading creative…</div> : pkg?.copyVariants?.length ? (
                <div className="flex gap-4 flex-wrap md:flex-nowrap">
                  {(() => {
                    const selIdx = pkg.selectedCopyIndex ?? 0
                    const selectedImage = pkg.images?.find(img => img.variantIndex === selIdx) ?? pkg.images?.[0]
                    // `videos[]` (per-variant, possibly several sizes) takes
                    // priority over the legacy singular `video` field — most
                    // packages only ever populate one or the other.
                    const videoUrl = pkg.videos?.find(v => v.variantIndex === selIdx)?.videoUrl
                      ?? (pkg.video?.variantIndex === undefined || pkg.video?.variantIndex === selIdx ? pkg.video?.videoUrl : undefined)
                    return (
                      <div className="shrink-0 space-y-2 max-w-full" style={{ width: 200 }}>
                        <div className="aspect-square w-full rounded-xl overflow-hidden flex items-center justify-center" style={{ background: C.surfaceMuted, border: `1px solid ${C.border}` }}>
                          {selectedImage?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={selectedImage.imageUrl} alt="Selected ad creative" className="w-full h-full object-cover" />
                          ) : videoUrl ? (
                            <video src={videoUrl} className="w-full h-full object-cover" muted playsInline />
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 text-center px-2" style={{ color: C.textMuted }}>
                              <ImageIcon size={18} />
                              <span className="text-[11px]">No image yet</span>
                            </div>
                          )}
                        </div>
                        {videoUrl && (
                          <a href={videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium" style={{ background: C.accentLight, border: `1px solid ${C.accentBorder}`, color: C.accent }}>
                            <Play size={11} /> Watch the video <ExternalLink size={10} className="ml-auto" />
                          </a>
                        )}
                      </div>
                    )
                  })()}
                  <div className="min-w-0 flex-1">
                    <p className="micro-label mb-3">Ad text options</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{pkg.copyVariants.map((v, i) => {
                      const sel = i === (pkg.selectedCopyIndex ?? -1)
                      const sizeCount = pkg.images?.filter(img => img.variantIndex === i).length ?? 0
                      const variantVideos = pkg.videos?.filter(vid => vid.variantIndex === i) ?? []
                      const legacyVideoUrl = pkg.video?.variantIndex === i || (pkg.video?.variantIndex === undefined && i === 0) ? pkg.video?.videoUrl : undefined
                      const videoUrl = variantVideos[0]?.videoUrl ?? legacyVideoUrl
                      const videoSizeCount = variantVideos.length || (legacyVideoUrl ? 1 : 0)
                      return <div key={i} className="rounded-xl p-4 space-y-2" style={{ background: sel ? C.surface : C.surfaceMuted, border: sel ? `2px solid ${C.green}` : `1px solid ${C.border}` }}>
                        <div className="flex gap-2 flex-wrap items-center">
                          {sel && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: C.greenBg, color: C.green }}>Selected</span>}
                          {v.hookStyle && <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textMuted }}>{humanise(v.hookStyle)}</span>}
                          {sizeCount > 1 && <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: C.accentLight, color: C.accent }} title="Several image sizes — Meta shows the one that fits each spot">{sizeCount} sizes</span>}
                          {videoUrl && (
                            <a href={videoUrl} target="_blank" rel="noreferrer" className="text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1" style={{ background: C.greenBg, color: C.green }} title={videoSizeCount > 1 ? `Video ad — ${videoSizeCount} sizes` : 'Video ad'}>
                              <Play size={10} /> {videoSizeCount > 1 ? `Video · ${videoSizeCount} sizes` : 'Video'}
                            </a>
                          )}
                        </div>
                        {v.headline && <p className="text-sm font-semibold break-words" style={{ color: C.text }}>{v.headline}</p>}
                        <p className="text-xs leading-relaxed break-words" style={{ color: C.textSecondary }}>{v.primaryText}</p>
                        {v.cta && <span className="inline-block text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: C.accentLight, color: C.accent }}>Button: {v.cta}</span>}
                      </div>
                    })}</div>
                  </div>
                </div>
              ) : null}
              {(campaign.campaignConfig?.adSets?.length ?? 0) > 0 && (
                <div>
                  <p className="micro-label mb-3 flex items-center gap-1.5"><Target size={11} /> Who it reaches ({campaign.campaignConfig!.adSets!.length} ad set{campaign.campaignConfig!.adSets!.length === 1 ? '' : 's'})</p>
                  <div className="space-y-2">
                    {campaign.campaignConfig!.adSets!.map((a: AdSetConfig, i: number) => {
                      const resolved = a.metaAudienceId ? audienceNames[a.metaAudienceId] : undefined
                      return (
                        <div key={i} className="rounded-xl p-3 space-y-1.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                          <div className="flex min-w-0 items-center justify-between gap-2 flex-wrap">
                            <p className="min-w-0 break-words text-sm font-semibold" style={{ color: C.text }}>{a.name}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {campaign.campaignConfig!.adSets!.length > 1 && <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textMuted }}>{a.budgetPercent}% of budget</span>}
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ background: C.accentLight, color: C.accent }}>{plainStatus('audienceKind', a.audienceType).label}</span>
                            </div>
                          </div>
                          <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: C.textSecondary }}>
                            {a.metaAudienceId && resolved && (
                              <span><span className="micro-label mr-1">Audience</span>{resolved.name}{resolved.approxSizeLower != null && resolved.approxSizeLower >= 0 ? ` (about ${resolved.approxSizeLower.toLocaleString('en-IN')} people)` : ''}</span>
                            )}
                            {a.metaAudienceId && !resolved && (
                              <span><span className="micro-label mr-1">Audience</span><span style={{ color: C.amber }}>A saved audience we can&apos;t find on the selected ad account. It may belong to a different account and fail at launch.</span></span>
                            )}
                            {(a.ageMin != null || a.ageMax != null) && <span><span className="micro-label mr-1">Age</span>{a.ageMin ?? 18}–{a.ageMax ?? 65}</span>}
                            {a.gender && a.gender !== 'all' && <span><span className="micro-label mr-1">Gender</span>{humanise(a.gender)}</span>}
                            {a.geoLocations?.length ? <span className="min-w-0 break-words"><span className="micro-label mr-1">Location</span>{a.geoLocations.join(', ')}</span> : null}
                            {a.interests?.length ? <span><span className="micro-label mr-1">Interests</span>{a.interests.length} selected</span> : null}
                            {a.optimizationGoal && <span><span className="micro-label mr-1">Aiming for</span>{humanise(a.optimizationGoal).toLowerCase()}</span>}
                            {a.ads?.length && pkg?.copyVariants?.length && a.ads.length < pkg.copyVariants.length ? (
                              <span className="min-w-0 break-words"><span className="micro-label mr-1">Ads</span>{a.ads.map(vi => pkg.copyVariants[vi]?.headline || `Variant ${vi + 1}`).join(', ')}</span>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.greenBorder}` }}>
                <label className="micro-label block mb-2" style={{ color: C.green }}>Meta ad account</label>
                {accountIds.length === 0 ? <p className="text-xs" style={{ color: C.textMuted }}>No Meta ad accounts are connected yet. Add one in Settings.</p> : (
                  <div className="relative mb-4"><select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm appearance-none pr-10" style={{ background: C.surfaceMuted, border: `1px solid ${C.border}`, color: C.text }}>{accountIds.map(id => <option key={id} value={id}>{accountNames[id] || `Ad account ending ${id.slice(-4)}`}</option>)}</select><ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.textMuted }} /></div>
                )}
                <div className="flex gap-3">
                  <button onClick={doApprove} disabled={approveState !== 'idle' || !selectedAccountId || launchBlocked} className="btn flex-1" style={{ background: C.green, color: '#fff' }} title={launchBlocked ? `Fix ${review!.blockers.length} thing${review!.blockers.length === 1 ? '' : 's'} above first` : undefined}>{approveState === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <ThumbsUp size={16} />}{approveState === 'loading' ? 'Launching…' : approveState === 'success' ? 'Launched' : approveState === 'error' ? "Couldn't launch — try again" : launchBlocked ? 'Fix the issues above first' : 'Approve and launch'}</button>
                  <button onClick={() => setRejectOpen(o => !o)} className="btn btn-danger"><XCircle size={14} className="inline mr-1.5" />Reject</button>
                </div>
                {rejectOpen && <div className="mt-4 pt-4 space-y-3" style={{ borderTop: `1px solid ${C.redBorder}` }}><textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why are you rejecting it?" rows={3} className="w-full rounded-xl px-4 py-3 text-sm resize-none" style={{ border: `1px solid ${C.redBorder}`, color: C.text }} /><div className="flex gap-2"><button onClick={doReject} disabled={rejectState === 'loading' || !rejectReason.trim()} className="btn" style={{ background: C.red, color: '#fff' }}>{rejectState === 'loading' ? 'Rejecting…' : 'Reject campaign'}</button><button onClick={() => { setRejectOpen(false); setRejectReason('') }} className="text-xs" style={{ color: C.textMuted }}>Cancel</button></div></div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debate */}
      {debate.length > 0 && <div className="px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto mb-6"><div className="card p-6"><p className="micro-label mb-4">How the AI reviewers discussed it</p><DebateLog rounds={debate} /></div></div>}

      {/* ═══════════════════════════════════════════════════════════
         TABS
         ═══════════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto pb-12">
        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List className="flex gap-1 mb-6 overflow-x-auto" style={{ borderBottom: `2px solid ${C.border}` }}>
            {tabs.map(t => (
              <Tabs.Trigger key={t.id} value={t.id} className="flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-all -mb-0.5" style={tab === t.id ? { color: C.accent, borderBottom: `2px solid ${C.accent}` } : { color: C.textMuted, borderBottom: '2px solid transparent' }}>
                {t.icon}{t.label}
                {t.count != null && <span className="text-[10px] font-bold ml-0.5 px-1.5 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textMuted }}>{t.count}</span>}
                {t.badge != null && <span className="text-[10px] font-bold ml-0.5 px-1.5 py-0.5 rounded-md" style={{ background: C.amberBg, color: C.amber }}>{t.badge}</span>}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* ── OVERVIEW ── */}
          <Tabs.Content value="overview">
            <div className="space-y-5">
              {/* What this campaign IS — destination, conversion being bought,
                  what Meta may pay for one, who can see it. The metrics above
                  say how it's doing; this says what it's doing. Skipped while
                  pending, where the Awaiting Approval panel already shows it. */}
              {!isPendingApproval && (
                <CampaignSetup tenantId={tenantId} campaign={campaign} />
              )}
              {(campaign.reviewNotes || campaign.reviewAdjustments?.budgetAdjusted) && (
                <div className="card p-6">
                  <p className="micro-label mb-3">Review notes</p>
                  {campaign.reviewAdjustments?.budgetAdjusted && <div className="px-3 py-2 rounded-lg mb-3 text-sm" style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, color: C.amber }}>Budget: {campaign.reviewAdjustments.originalBudget > 0 && formatInr(campaign.reviewAdjustments.originalBudget) + ' → '}{formatInr(campaign.reviewAdjustments.recommendedBudget)}</div>}
                  {campaign.reviewNotes && <p className="text-sm leading-relaxed" style={{ color: C.textSecondary }}>{campaign.reviewNotes}</p>}
                </div>
              )}
              {(campaign.campaignConfig?.scaleRules || campaign.campaignConfig?.pauseRules) && (
                <div className="card p-6">
                  <p className="micro-label mb-3">Automatic rules</p>
                  <div className="grid md:grid-cols-2 gap-5">
                    {campaign.campaignConfig?.scaleRules && <div><p className="text-xs font-bold mb-1" style={{ color: C.green }}>When to spend more</p><p className="text-xs leading-relaxed" style={{ color: C.textSecondary }}>{campaign.campaignConfig.scaleRules}</p></div>}
                    {campaign.campaignConfig?.pauseRules && <div><p className="text-xs font-bold mb-1" style={{ color: C.red }}>When to pause</p><p className="text-xs leading-relaxed" style={{ color: C.textSecondary }}>{campaign.campaignConfig.pauseRules}</p></div>}
                  </div>
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <button onClick={() => setTab('adsets')} className="card card-hover p-6 text-left group">
                  <Layers size={16} className="mb-3" style={{ color: C.accent }} />
                  <p className="display-num text-[32px]" style={{ color: C.text }}>{live.length || planned.length}</p>
                  <p className="text-xs font-medium mt-1" style={{ color: C.textMuted }}>{usePlanned ? 'Planned ad sets' : 'Live ad sets'}</p>
                </button>
                <button onClick={() => setTab('actions')} className="card card-hover p-6 text-left group">
                  <Zap size={16} className="mb-3" style={{ color: pendingActs > 0 ? C.amber : C.textMuted }} />
                  <p className="display-num text-[32px]" style={{ color: pendingActs > 0 ? C.amber : C.text }}>{pendingActs > 0 ? pendingActs : '0'}</p>
                  <p className="text-xs font-medium mt-1" style={{ color: C.textMuted }}>{pendingActs > 0 ? 'Suggested changes need your decision' : 'No suggested changes waiting'}</p>
                </button>
              </div>
            </div>
          </Tabs.Content>

          {/* ── AD SETS ── */}
          <Tabs.Content value="adsets">
            {!usePlanned && campaign.metaCampaignId && (
              <div className="flex justify-end mb-3">
                <button
                  onClick={openAddAdSetPanel}
                  className="btn"
                  style={addAdSetOpen ? { background: C.accentLight, border: `1px solid ${C.accentBorder}`, color: C.accent } : { background: C.surfaceMuted, border: `1px solid ${C.border}`, color: C.textSecondary }}
                >
                  <Plus size={14} /> Add ad set
                </button>
              </div>
            )}
            {addAdSetOpen && (
              <div className="card p-4 mb-4">
                <p className="micro-label mb-1">Add ad set</p>
                <p className="text-xs mb-3" style={{ color: C.textMuted }}>
                  Creates a new ad set in this same live campaign, seeded with a whole Gallery sheet&rsquo;s worth of ads or a single creative you pick or upload fresh.
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="micro-label mb-1.5">Where the ads come from</p>
                    <div className="flex gap-1.5">
                      {([{ value: 'sheet', label: 'Whole sheet' }, { value: 'single', label: 'Single creative' }] as const).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setNewAdSetSourceMode(opt.value)}
                          className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold"
                          style={newAdSetSourceMode === opt.value ? { background: C.accent, color: '#fff' } : { background: C.surface, color: C.textSecondary, border: `1px solid ${C.border}` }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="micro-label mb-1">Name <span className="font-normal normal-case" style={{ color: C.textFaint }}>(optional — we&rsquo;ll name it if you leave this blank)</span></p>
                    <input value={newAdSetName} onChange={e => setNewAdSetName(e.target.value)} placeholder="e.g. Diwali lookalike" className="input text-sm w-full" />
                  </div>
                  <div>
                    <p className="micro-label mb-1.5">Audience</p>
                    <div className="flex gap-2 flex-wrap">
                      {([{ value: 'advantage_plus', label: 'Meta picks the audience' }, { value: 'retarget', label: 'People who already visited' }, { value: 'lookalike', label: 'People similar to past buyers' }] as const).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => { setNewAdSetAudienceType(opt.value); setNewAdSetAudienceId('') }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={newAdSetAudienceType === opt.value ? { background: C.accent, color: '#fff' } : { background: C.surface, color: C.textSecondary, border: `1px solid ${C.border}` }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {newAdSetAudienceType !== 'advantage_plus' && (
                    <div>
                      <p className="micro-label mb-1">{newAdSetAudienceType === 'retarget' ? 'Saved audience' : 'Lookalike audience'}</p>
                      {accountAudiencesState === 'loading' && <p className="text-xs" style={{ color: C.textMuted }}>Loading audiences…</p>}
                      {accountAudiencesState === 'error' && <p className="text-xs" style={{ color: C.red }}>We couldn&apos;t load the saved audiences for this ad account. Try again.</p>}
                      {accountAudiencesState === 'idle' && (
                        <select value={newAdSetAudienceId} onChange={e => setNewAdSetAudienceId(e.target.value)} className="input text-sm w-full">
                          <option value="">Select an audience…</option>
                          {accountAudiences.filter(a => newAdSetAudienceType === 'retarget' ? a.type === 'custom' : a.type === 'lookalike').map(a => (
                            <option key={a.id} value={a.id}>{a.name}{a.approxSizeLower ? ` (about ${a.approxSizeLower.toLocaleString('en-IN')}–${a.approxSizeUpper?.toLocaleString('en-IN')} people)` : ''}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  <div>
                    <p className="micro-label mb-1.5">Where the ads show</p>
                    <div className="flex gap-2 flex-wrap">
                      {PLACEMENT_PRESET_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setNewAdSetPlacementPreset(opt.value)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={newAdSetPlacementPreset === opt.value ? { background: C.accent, color: '#fff' } : { background: C.surface, color: C.textSecondary, border: `1px solid ${C.border}` }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="micro-label mb-1.5">What Meta should aim for</p>
                    <select
                      value={effectiveNewAdSetGoal}
                      onChange={e => { setNewAdSetOptimizationGoal(e.target.value); setNewAdSetGoalConfirmed(false) }}
                      className="input text-sm w-full"
                    >
                      {newAdSetGoalOptions.map(g => (
                        <option key={g} value={g}>{newAdSetGoalLabels[g] ?? humanise(g)}{g === inheritedOptimizationGoal ? ' (current)' : ''}</option>
                      ))}
                    </select>
                    {newAdSetGoalMismatch && (
                      <div className="mt-2 rounded-lg px-3 py-2.5 text-[11px] leading-relaxed flex items-start gap-2" style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, color: C.amber }}>
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold mb-1">This ad set won&rsquo;t match the campaign&rsquo;s current goal ({newAdSetGoalLabels[inheritedOptimizationGoal] ?? humanise(inheritedOptimizationGoal)}).</p>
                          <p className="mb-2">When ad sets in one campaign aim for different things, their results can&rsquo;t be compared fairly, and what the system learns from this campaign gets muddled.</p>
                          <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                            <input type="checkbox" checked={newAdSetGoalConfirmed} onChange={e => setNewAdSetGoalConfirmed(e.target.checked)} />
                            I understand — create it anyway
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="micro-label mb-1.5">Ads</p>
                    {newAdSetSourceMode === 'sheet' ? (
                      <SheetAttachPicker tenantId={tenantId} onChange={setNewAdSetSheetSelection} />
                    ) : (
                      <CreativeSourceFields tenantId={tenantId} onChange={setNewAdSetCreative} />
                    )}
                  </div>
                  <div className="w-40">
                    <p className="micro-label mb-1">Daily budget</p>
                    <div className="flex items-stretch overflow-hidden" style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface }}>
                      <span className="flex items-center px-2.5 text-xs font-medium mono" style={{ background: C.surfaceMuted, color: C.textMuted, borderRight: `1px solid ${C.border}` }}>₹</span>
                      <input type="number" value={newAdSetBudget} onChange={e => setNewAdSetBudget(e.target.value)} placeholder="1000" className="flex-1 min-w-0 px-3 py-2 text-sm tabular-nums outline-none mono bg-transparent" style={{ color: C.text }} />
                    </div>
                  </div>
                  {newAdSetResult?.failed.length ? (
                    <p className="text-[11px] flex items-start gap-1" style={{ color: C.amber }}>
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      <span className="min-w-0 break-words">{newAdSetResult.createdAds.length} ad{newAdSetResult.createdAds.length === 1 ? '' : 's'} created, but {newAdSetResult.failed.length} could not be added. Try those again.</span>
                    </p>
                  ) : null}
                  {newAdSetResult?.failed.length ? (
                    <Details title="What went wrong" items={newAdSetResult.failed.map((f, i) => ({ label: `Ad ${i + 1}`, value: f.error }))} />
                  ) : null}
                  {newAdSetError && <PlainErrorNote error={newAdSetError} />}
                  <button onClick={doAddAdSet} disabled={newAdSetState === 'loading' || (newAdSetGoalMismatch && !newAdSetGoalConfirmed)} className="btn btn-accent">
                    {newAdSetState === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    {newAdSetState === 'loading'
                      ? (newAdSetSourceMode === 'sheet' ? 'Creating ads — this can take a few minutes if the sheet has video…' : 'Creating…')
                      : newAdSetSourceMode === 'sheet' && newAdSetSheetSelection
                        ? `Create ad set (${newAdSetSheetSelection.selectedCount} ad${newAdSetSheetSelection.selectedCount === 1 ? '' : 's'})`
                        : 'Create ad set'}
                  </button>
                </div>
              </div>
            )}
            <div className="card overflow-hidden">
              {usePlanned ? (
                <div className="overflow-x-auto"><table className="data-table"><thead><tr>{['Ad set', 'Audience', 'Share of budget', 'Age', 'Location', 'Aiming for'].map((h, i) => <th key={h} className={i === 0 ? '' : 'num'}>{h}</th>)}</tr></thead>
                <tbody>{planned.map((a, i) => <tr key={i}><td><p className="text-sm font-semibold break-words" style={{ color: C.text }}>{a.name}</p></td><td className="num" style={{ color: C.textSecondary }}>{plainStatus('audienceKind', a.audienceType).label}</td><td className="num mono font-bold" style={{ color: C.accent }}>{a.budgetPercent}%</td><td className="num mono" style={{ color: C.textSecondary }}>{a.ageMin && a.ageMax ? `${a.ageMin}–${a.ageMax}` : '—'}</td><td className="num break-words" style={{ color: C.textSecondary }}>{a.geoLocations?.join(', ') || '—'}</td><td className="num text-xs" style={{ color: C.textMuted }}>{a.optimizationGoal ? humanise(a.optimizationGoal) : '—'}</td></tr>)}</tbody></table></div>
              ) : (
                <><div className="overflow-x-auto"><table className="data-table"><thead><tr>{['Ad set', 'Status', 'Daily budget', 'Spend', objectiveContext.resultLabel, objectiveContext.efficiencyLabel, 'Times shown', 'Click rate', 'Details'].map((h, i) => <th key={h} className={i < 2 ? '' : 'num'}>{h}</th>)}</tr></thead><tbody>{groupSiblings(live).map((row, i) => <AdSetRow key={row.adSet.metaAdSetId || row.adSet.id || i} adSet={row.adSet} formatTag={row.formatTag} siblingFormat={row.siblingFormat} groupHead={row.groupHead} tenantId={tenantId} campaignId={campaignId} proposalsCount={row.adSet.id ? adsetProposals[row.adSet.id] : 0} objectiveContext={objectiveContext} focusId={focusId} onViewAd={setViewAd} onBudgetChanged={fetchCampaign} onCreativeAdded={fetchCampaign} />)}</tbody></table></div>{live.length === 0 && <div className="py-16 text-center"><p className="text-sm" style={{ color: C.textMuted }}>No ad sets yet. They appear here once Meta reports them.</p></div>}</>
              )}
            </div>
          </Tabs.Content>

          {/* ── SEGMENTS ── */}
          <Tabs.Content value="segments"><SegmentsPanel tenantId={tenantId} campaignId={campaignId} objectiveGroup={objectiveContext.group} returnEvidenceAvailable={campaignReturnResolved} /></Tabs.Content>

          {/* ── ACTIONS ── */}
          <Tabs.Content value="actions"><ActionsPanel tenantId={tenantId} campaignId={campaignId} adSetNames={Object.fromEntries(live.flatMap((a) => [a.id, a.metaAdSetId].filter((k): k is string => !!k && !!a.name).map((k) => [k, a.name as string])))} /></Tabs.Content>

          {/* ── AUDIT ── */}
          <Tabs.Content value="audit">
            <div className="card overflow-hidden">
              {snapsLoading ? <div className="py-16 text-center" style={{ color: C.textMuted }}><Loader2 size={16} className="animate-spin mx-auto" /></div>
              : snaps.length === 0 ? <div className="py-16 text-center"><Activity size={24} style={{ color: C.textFaint, margin: '0 auto 8px' }} /><p className="text-sm font-medium" style={{ color: C.textMuted }}>No health checks yet</p><p className="text-xs mt-1" style={{ color: C.textFaint }}>The campaign is checked automatically once it has been running for a while.</p></div>
              : (
                <div className="p-6 space-y-6">
                  {snaps.length >= 3 && (() => {
                    const chronological = [...snaps].reverse()
                    const primaryIsResult = ['leads', 'app', 'engagement'].includes(objectiveContext.group)
                    const primaryValues = chronological
                      .map((snapshot) => objectiveContext.group === 'sales'
                        ? snapshot.metrics.roas
                        : primaryIsResult
                          ? snapshot.metrics.conversions
                          : snapshot.metrics.ctr)
                      .filter((value): value is number => value != null)
                    const spendValues = chronological.map((snapshot) => snapshot.metrics.spend).filter((value): value is number => value != null)
                    const primaryLabel = objectiveContext.group === 'sales'
                      ? 'Return per ₹1'
                      : primaryIsResult
                        ? objectiveContext.resultLabel
                        : 'Click rate'
                    const primaryUnit = objectiveContext.group === 'sales' ? 'x' : primaryIsResult ? 'count' : '%'
                    const series = [
                      { l: primaryLabel, d: primaryValues, c: C.green, u: primaryUnit, I: TrendingUp, directional: true },
                      { l: 'Spend', d: spendValues, c: C.accent, u: '₹', I: DollarSign, directional: false },
                    ].filter((item) => item.d.length >= 2)
                    return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{series.map(({ l, d, c, u, I, directional }) => {
                      const latest = d[d.length - 1], prev = d[d.length - 2] ?? latest, delta = prev ? ((latest - prev) / prev) * 100 : 0
                      const min = Math.min(...d), max = Math.max(...d), rng = max - min || 1, W = 180, H = 48
                      const pts = d.map((v, i) => `${2 + (i / (d.length - 1)) * (W - 6)},${H - 2 - ((v - min) / rng) * (H - 4)}`).join(' ')
                      return <div key={l} className="card-inset p-5">
                        <div className="flex items-center justify-between gap-3 mb-3"><div className="flex items-center gap-1.5"><I size={13} style={{ color: c }} /><p className="text-xs font-bold" style={{ color: C.textSecondary }}>{l} trend</p></div><span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={directional ? { background: delta >= 0 ? C.greenBg : C.redBg, color: delta >= 0 ? C.green : C.red } : { background: C.accentLight, color: C.accent }}>{delta >= 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(1)}%</span></div>
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4"><svg className="w-full min-w-0" style={{ maxWidth: 280 }} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" fill="none"><polyline points={pts} stroke={c} strokeWidth={2} vectorEffect="non-scaling-stroke" fill="none" strokeLinejoin="round" strokeLinecap="round" /><circle cx={W - 4} cy={H - 2 - ((latest - min) / rng) * (H - 4)} r={3} fill={c} /></svg><div className="shrink-0"><p className="display-num text-xl" style={{ color: c }}>{u === '₹' ? formatInr(latest) : u === 'x' ? `${latest.toFixed(2)}x` : u === '%' ? `${latest.toFixed(2)}%` : latest.toLocaleString('en-IN')}</p><p className="text-[10px] mt-1 font-semibold" style={{ color: C.textMuted }}>Latest check</p></div></div>
                      </div>
                    })}</div>
                  })()}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <p className="micro-label">Held-back suggestions</p>
                      <span className="text-[10px]" style={{ color: C.textFaint }}>Changes the system thought about but did not make.</span>
                    </div>
                    <ShadowActionsPanel tenantId={tenantId} campaignId={campaignId} />
                  </div>

                  <div>
                    <p className="micro-label mb-4">Past checks</p>
                    {snaps.slice(0, 15).map((snap, i) => {
                      const v = snap.verdict, vc = v.verdict === 'act' ? C.red : v.verdict === 'watch' ? C.amber : C.green
                      const vb = v.verdict === 'act' ? C.redBg : v.verdict === 'watch' ? C.amberBg : C.greenBg
                      const vl = v.verdict === 'act' ? 'Needs a change' : v.verdict === 'watch' ? 'Keep an eye on it' : 'All good'
                      // Synthetic verdicts (skipped Claude call): cooldown, all-green legacy
                      // ('agent skipped'), all-green healthy, all-green insufficient evidence.
                      // Match all four phrasings so condensed-row treatment fires regardless of
                      // when the snapshot was written.
                      const ci = v.contextInsight ?? ''
                      const sk = /agent skipped|campaign healthy|INSUFFICIENT EVIDENCE|Cooldown —/.test(ci)
                      const insufficient = /INSUFFICIENT EVIDENCE/.test(ci)
                      return <div key={i} className="flex gap-3 py-3" style={{ borderBottom: i < Math.min(snaps.length, 15) - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
                        <div className="flex flex-col items-center shrink-0 mt-1"><div className="w-2.5 h-2.5 rounded-full" style={{ background: vc }} />{i < Math.min(snaps.length, 15) - 1 && <div className="w-px flex-1 mt-1" style={{ background: C.border, minHeight: 16 }} />}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: vb, color: vc }}>{vl}{v.urgency && ['immediate', '48h', '7d'].includes(v.urgency) ? ` • ${plainStatus('urgency', v.urgency).label}` : ''}</span>
                            {sk && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: insufficient ? C.amberBg : C.surfaceMuted, color: insufficient ? C.amber : C.textMuted }}>{insufficient ? 'No evidence yet' : 'All clear'}</span>}
                            <LeakDiagnosisBadge leak={v.leakDiagnosis} />
                            <span className="text-[11px]" style={{ color: C.textMuted }}>{formatWhen(snap.auditedAt)}</span>
                            {objectiveContext.group === 'sales' && snap.metrics.roas != null && <span className="text-[11px] font-semibold tabular-nums" style={{ color: C.textSecondary }}>₹{snap.metrics.roas.toFixed(2)} back per ₹1</span>}
                            {['leads', 'app', 'engagement'].includes(objectiveContext.group) && snap.metrics.conversions != null && <span className="text-[11px] font-semibold tabular-nums" style={{ color: C.textSecondary }}>{objectiveContext.resultLabel} {snap.metrics.conversions.toLocaleString('en-IN')}</span>}
                            {['awareness', 'traffic'].includes(objectiveContext.group) && snap.metrics.ctr != null && <span className="text-[11px] font-semibold tabular-nums" style={{ color: C.textSecondary }}>Click rate {snap.metrics.ctr.toFixed(2)}%</span>}
                            {snap.metrics.spend != null && <span className="text-[11px] tabular-nums" style={{ color: C.textMuted }}>· {formatInr(snap.metrics.spend)} spent</span>}
                            {snap.powerCalc && <PowerCalcBadge p={snap.powerCalc} />}
                          </div>
                          {objectiveContext.group === 'sales' && campaignReturnResolved && snap.bayesian && <div className="mt-2"><BayesianVerdictPanel b={snap.bayesian} /></div>}
                          {snap.adSets && snap.adSets.length > 0 && <div className="mt-2"><ThompsonAllocationBar adSets={snap.adSets} /></div>}
                          {sk ? <div className="flex gap-3 mt-0.5 flex-wrap">{[
                            snap.metrics.spend != null && `${formatInr(snap.metrics.spend)} spent`,
                            ['sales', 'leads', 'app', 'engagement'].includes(objectiveContext.group) && snap.metrics.conversions != null && `${snap.metrics.conversions} ${objectiveContext.resultLabel.toLowerCase()}`,
                            snap.metrics.ctr != null && `Click rate ${snap.metrics.ctr.toFixed(2)}%`,
                          ].filter(Boolean).map((t, k) => <span key={k} className="text-[11px] tabular-nums" style={{ color: C.textMuted }}>{t}</span>)}</div> : v.contextInsight ? <p className="text-[13px] leading-relaxed break-words" style={{ color: C.textSecondary }}>{v.contextInsight}</p> : null}
                          {v.recommendedActions?.length ? <div className="flex flex-wrap gap-1 mt-1.5">{v.recommendedActions.map((a, j) => <span key={j} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textMuted }}>{typeof a === 'string' ? (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(a) ? plainStatus('actionType', a).label : a) : (a.reason ?? a.targetName ?? (a.type ? plainStatus('actionType', a.type).label : ''))}</span>)}</div> : null}
                          {snap.adSets?.length && !sk ? (() => { const sales = objectiveContext.group === 'sales'; const w = sales ? snap.adSets!.filter(a => a.metrics?.roas != null && a.metrics.roas >= 1) : []; const rr = sales && snap.adSets!.some(a => (a.metrics?.conversions ?? 0) >= 20); const fw = snap.ads?.filter(a => a.metrics?.ctr != null && a.metrics.ctr < 0.5) || []; if (!w.length && !rr && !fw.length) return null; return <div className="flex flex-wrap gap-1.5 mt-2">{w.map((a, k) => <span key={k} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: C.greenBg, color: C.green }}><TrendingUp size={9} />{a.name}: ₹{a.metrics!.roas!.toFixed(1)} back per ₹1</span>)}{rr && <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: C.blueBg, color: C.blue }}><Target size={9} />Enough buyers to win back visitors</span>}{fw.length > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: C.amberBg, color: C.amber }}><FlameKindling size={9} />{fw.length} tired ad{fw.length === 1 ? '' : 's'}</span>}</div> })() : null}
                          {snap.ads?.length ? (
                            <details className="mt-2">
                              <summary className="text-[11px] cursor-pointer font-semibold" style={{ color: C.textMuted }}>{snap.ads.length} ad{snap.ads.length !== 1 ? 's' : ''}</summary>
                              <div className="card-inset mt-1.5 overflow-x-auto">
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      {['Ad', 'Opening style', 'Times shown', 'Spend', 'Click rate', 'Results', 'Getting tired?'].map(h => (
                                        <th key={h}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {snap.ads.map((a, j) => (
                                      <tr key={a.id || j}>
                                        <td className="text-xs font-medium" style={{ color: C.text }}>{a.name || '—'}</td>
                                        <td>{a.hookStyle ? <span className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textMuted }}>{humanise(a.hookStyle)}</span> : '—'}</td>
                                        <td className="mono text-xs" style={{ color: C.textSecondary }}>{a.metrics?.impressions?.toLocaleString('en-IN') ?? '—'}</td>
                                        <td className="mono text-xs" style={{ color: C.textSecondary }}>{a.metrics?.spend ? formatInr(a.metrics.spend) : '—'}</td>
                                        <td className="mono text-xs" style={{ color: C.textSecondary }}>{a.metrics?.ctr != null ? `${a.metrics.ctr.toFixed(2)}%` : '—'}</td>
                                        <td className="mono text-xs" style={{ color: C.textSecondary }}>{a.metrics?.conversions ?? '—'}</td>
                                        <td>
                                          {a.didFatigue && a.didFatigue.length > 0
                                            ? <MiniDiDChart data={a.didFatigue} />
                                            : <span className="text-[11px]" style={{ color: C.textFaint }}>—</span>}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          ) : null}
                        </div>
                      </div>
                    })}
                  </div>
                </div>
              )}
            </div>
          </Tabs.Content>

          {/* ── CREATIVE ── */}
          {campaign.creativePackageId && (
            <Tabs.Content value="creative">
              <div className="card overflow-hidden">
                <div className="p-6 space-y-6">
                  {pkg?.copyVariants?.length ? <div><p className="micro-label mb-3">Ad text options</p><div className="grid md:grid-cols-3 gap-3">{pkg.copyVariants.map((v, i) => { const sel = i === (pkg.selectedCopyIndex ?? -1); const vidCount = pkg.videos?.filter(vid => vid.variantIndex === i).length ?? 0; return <div key={i} className="rounded-xl p-4 space-y-2" style={{ background: sel ? C.surface : C.surfaceMuted, border: sel ? `2px solid ${C.green}` : `1px solid ${C.border}` }}><div className="flex gap-2 flex-wrap">{sel && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: C.greenBg, color: C.green }}>Selected</span>}{v.hookStyle && <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textMuted }}>{humanise(v.hookStyle)}</span>}{vidCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1" style={{ background: C.greenBg, color: C.green }}><Play size={10} /> Video</span>}</div>{v.headline && <p className="text-sm font-semibold" style={{ color: C.text }}>{v.headline}</p>}<p className="text-xs leading-relaxed" style={{ color: C.textSecondary }}>{v.primaryText}</p>{v.cta && <span className="inline-block text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: C.accentLight, color: C.accent }}>Button: {v.cta}</span>}</div> })}</div></div> : null}
                  <div>
                    {(() => {
                      const ASPECT_ORDER = ['9:16', '4:5', '1:1', '16:9']
                      const byVariant = new Map<number, NonNullable<typeof pkg>['images']>()
                      for (const img of pkg?.images ?? []) {
                        const vi = img.variantIndex ?? 0
                        if (!byVariant.has(vi)) byVariant.set(vi, [])
                        byVariant.get(vi)!.push(img)
                      }
                      return (
                        <>
                          <p className="micro-label mb-3">Images ({byVariant.size})</p>
                          {pkgLoading ? <Loader2 size={14} className="animate-spin" style={{ color: C.textMuted }} /> : byVariant.size > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                              {[...byVariant.entries()].map(([variantIndex, sizes]) => {
                                const sorted = [...(sizes ?? [])].sort((a, b) => ASPECT_ORDER.indexOf(a.aspectRatio ?? '') - ASPECT_ORDER.indexOf(b.aspectRatio ?? ''))
                                const primary = sorted[0]
                                const sel = variantIndex === (pkg?.selectedCopyIndex ?? 0)
                                const s = imgState[variantIndex] || 'idle'
                                const headline = pkg?.copyVariants?.[variantIndex]?.headline ?? `Variant ${variantIndex + 1}`
                                return (
                                  <div key={variantIndex} className="space-y-2">
                                    <div className="relative rounded-xl overflow-hidden" style={{ border: sel ? `2px solid ${C.green}` : `1px solid ${C.border}` }}>
                                      {sel && <span className="absolute top-2 left-2 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: C.green, color: '#fff' }}>Selected</span>}
                                      {s === 'polling' && <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(23,20,15,0.55)' }}><Loader2 size={20} className="animate-spin" style={{ color: C.accent }} /></div>}
                                      {primary?.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={primary.imageUrl} alt={`V${variantIndex + 1}`} className="w-full max-w-full" style={{ maxHeight: 280, objectFit: 'contain', display: 'block' }} />
                                      ) : (
                                        <div className="flex items-center justify-center" style={{ height: 180, background: C.surfaceMuted }}><p className="text-[10px]" style={{ color: C.textMuted }}>No image yet</p></div>
                                      )}
                                    </div>
                                    <p className="text-xs font-semibold truncate" style={{ color: C.text }} title={headline}>{headline}</p>
                                    {sorted.length > 1 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {sorted.map((sz, szi) => sz.imageUrl && (
                                          <a key={szi} href={sz.imageUrl} target="_blank" rel="noreferrer" className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.border}` }}>
                                            {sz.aspectRatio ?? 'Standard'}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                    {primary?.imagePrompt && <details><summary className="text-[10px] cursor-pointer" style={{ color: C.textMuted }}>What the image was asked to show</summary><p className="text-[10px] break-words mt-1 p-2 rounded-lg" style={{ background: C.surfaceMuted, color: C.textSecondary }}>{primary.imagePrompt}</p></details>}
                                    <div className="flex gap-1.5">
                                      <button onClick={() => rerollImg(variantIndex)} disabled={s !== 'idle'} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.border}` }}><RefreshCw size={10} className={s === 'loading' ? 'animate-spin' : ''} />{s === 'idle' ? 'Make another' : 'Working…'}</button>
                                      <button onClick={() => newImgPrompt(variantIndex)} disabled={s !== 'idle'} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40" style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accentBorder}` }}><Sparkles size={10} />New idea</button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : <div className="py-10 text-center rounded-xl" style={{ background: C.surfaceMuted, border: `2px dashed ${C.border}` }}><p className="text-xs" style={{ color: C.textMuted }}>No images yet</p></div>}
                        </>
                      )
                    })()}
                  </div>
                  {(pkg?.video?.videoUrl || pkg?.video?.videoPrompt) && <div className="pt-5" style={{ borderTop: `1px solid ${C.borderLight}` }}><div className="flex items-center justify-between mb-3"><p className="micro-label">Video</p><div className="flex gap-1.5"><button onClick={rerollVid} disabled={vidRetry !== 'idle' || vidRewrite !== 'idle'} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-40" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.border}` }}><RefreshCw size={10} className={cn('inline mr-1', vidRetry !== 'idle' && 'animate-spin')} />{vidRetry === 'idle' ? 'Make another' : 'Working…'}</button><button onClick={rewriteVid} disabled={vidRewrite !== 'idle' || vidRetry !== 'idle'} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-40" style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accentBorder}` }}><Sparkles size={10} className={cn('inline mr-1', vidRewrite !== 'idle' && 'animate-spin')} />{vidRewrite === 'idle' ? 'Rewrite' : 'Working…'}</button></div></div>{pkg.video?.videoUrl ? <video controls className="rounded-xl w-full" style={{ maxHeight: 320, border: `1px solid ${C.border}` }}><source src={pkg.video.videoUrl} type="video/mp4" /></video> : <p className="text-xs break-words p-3 rounded-lg" style={{ background: C.surfaceMuted, color: C.textSecondary }}>{vidRetry === 'polling' ? 'Making the video…' : pkg.video?.videoPrompt}</p>}{pkg.video?.videoPrompt && pkg.video?.videoUrl && <details className="mt-2"><summary className="text-[10px] cursor-pointer" style={{ color: C.textMuted }}>What the video was asked to show</summary><p className="text-[10px] break-words mt-1 p-3 rounded-lg" style={{ background: C.surfaceMuted, color: C.textSecondary }}>{pkg.video.videoPrompt}</p></details>}</div>}
                  {(pkg?.videos?.length ?? 0) > 0 && (() => {
                    const byVariant = new Map<number, NonNullable<typeof pkg>['videos']>()
                    for (const v of pkg!.videos!) {
                      const vi = v.variantIndex ?? 0
                      if (!byVariant.has(vi)) byVariant.set(vi, [])
                      byVariant.get(vi)!.push(v)
                    }
                    const ASPECT_ORDER = ['9:16', '4:5', '1:1', '16:9']
                    return (
                      <div className="pt-5" style={{ borderTop: `1px solid ${C.borderLight}` }}>
                        <p className="micro-label mb-3">Videos ({byVariant.size})</p>
                        <div className="grid md:grid-cols-3 gap-4">
                          {[...byVariant.entries()].map(([variantIndex, sizes]) => {
                            const sorted = [...(sizes ?? [])].sort((a, b) => ASPECT_ORDER.indexOf(a.aspectRatio ?? '') - ASPECT_ORDER.indexOf(b.aspectRatio ?? ''))
                            const primary = sorted[0]
                            const headline = pkg?.copyVariants?.[variantIndex]?.headline ?? `Variant ${variantIndex + 1}`
                            return (
                              <div key={variantIndex} className="space-y-2">
                                {primary?.videoUrl && <video controls className="rounded-xl w-full" style={{ maxHeight: 280, border: `1px solid ${C.border}` }}><source src={primary.videoUrl} type="video/mp4" /></video>}
                                <p className="text-xs font-semibold truncate" style={{ color: C.text }} title={headline}>{headline}</p>
                                {sorted.length > 1 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {sorted.map((s, si) => s.videoUrl && (
                                      <a key={si} href={s.videoUrl} target="_blank" rel="noreferrer" className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.border}` }}>
                                        {s.aspectRatio ?? 'Standard'}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                  {pkg?.complianceNotes && <div className="rounded-xl px-4 py-3" style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}` }}><p className="text-xs font-bold mb-1" style={{ color: C.amber }}>Ad rules to keep in mind</p><p className="text-xs leading-relaxed" style={{ color: C.amber }}>{pkg.complianceNotes}</p></div>}
                </div>
              </div>
            </Tabs.Content>
          )}
        </Tabs.Root>
      </div>
    </div>
  )
}
