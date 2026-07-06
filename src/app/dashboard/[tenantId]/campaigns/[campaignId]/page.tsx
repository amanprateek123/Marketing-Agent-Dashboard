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
  Sparkles, ArrowRightLeft, History, Zap, Ban, Layers, ExternalLink,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DebateLog } from '@/components/ui/DebateLog'
import { FormatBadge, PromptsVersionBadge, RegretLabel, LeakDiagnosisBadge, BreakevenBadge } from '@/components/badges'
import { getShadowActions, getIntelligenceDecisions } from '@/lib/api'
import { formatCurrency, formatDateTime, formatDate, formatRelativeTime, cn } from '@/lib/utils'
import type { Campaign, CampaignAdSet, CampaignAd, CampaignAction, AuditSnapshot, ShadowAction } from '@/types'
import { SegmentsPanel } from '@/components/campaign/SegmentsPanel'

/* ─── Local types ─── */
interface CreativePackage {
  _id: string; status: string
  copyVariants: Array<{ primaryText: string; headline?: string; cta?: string; hookStyle?: string }>
  selectedCopyIndex?: number; copySelectionReason?: string
  imagePrompt?: string; imageUrl?: string
  images?: Array<{ variantIndex?: number; imagePrompt?: string; imageUrl?: string }>
  videoPrompt?: string; videoUrl?: string
  video?: { videoUrl?: string; videoThumbnailUrl?: string; videoPrompt?: string }
  complianceNotes?: string
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

/* ─── Design tokens — mapped onto the global Editorial Intelligence Console palette ─── */
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
      <p className="display-num text-[22px] truncate" style={{ color: color || C.text }}>{value}</p>
      {sub && <p className="mono text-[11px] mt-0.5 tabular-nums" style={{ color: C.textMuted }}>{sub}</p>}
    </div>
  )
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
  return Number.isFinite(n) && n > 0 ? formatCurrency(n) : '—'
}
function fmtPct(v: unknown, digits = 2): string {
  const n = typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '—'
}
function fmtX(v: unknown): string {
  const n = typeof v === 'number' ? v : NaN
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(2)}x` : '—'
}
function fmtStr(v: unknown): string {
  if (v == null || v === '') return '—'
  return String(v)
}
function fmtRanking(v: unknown): { text: string; color: string } {
  const s = String(v ?? '').toUpperCase()
  if (s === 'ABOVE_AVERAGE') return { text: 'Above avg', color: C.green }
  if (s === 'AVERAGE')       return { text: 'Average',   color: C.textSecondary }
  if (s === 'BELOW_AVERAGE_10' || s === 'BELOW_AVERAGE_20' || s === 'BELOW_AVERAGE_35' || s.startsWith('BELOW')) return { text: 'Below avg', color: C.red }
  if (s === 'UNKNOWN' || s === '') return { text: 'Not rated', color: C.textFaint }
  return { text: s.toLowerCase().replace(/_/g, ' '), color: C.textSecondary }
}

interface AllFieldsPanelProps {
  kind: 'adset' | 'ad'
  data: CampaignAdSet | CampaignAd
  onClose?: () => void
}

function AllFieldsPanel({ kind, data }: AllFieldsPanelProps) {
  const isAdSet = kind === 'adset'
  const d = data as CampaignAdSet & CampaignAd
  const q = fmtRanking(d.qualityRanking)
  const e = fmtRanking(d.engagementRanking)
  const cv = fmtRanking(d.conversionRanking)
  return (
    <div
      className="rounded-xl px-5 py-4 z-30 pointer-events-none"
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.16)',
        minWidth: 620,
        maxWidth: 720,
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.textMuted }}>
        {isAdSet ? 'Ad set details' : 'Ad details'} · {d.name || '—'}
      </p>

      <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-[12px]">
        <FieldGroup title="Money">
          <F label="Spend"    value={fmtMoney(d.spend)} />
          <F label="Revenue"  value={fmtMoney(d.revenue)} />
          <F label="ROAS"     value={fmtX(d.roas)} />
          <F label="AOV"      value={fmtMoney(d.aov)} />
          <F label="CPA"      value={fmtMoney(d.cpa)} />
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
          {isAdSet && <F label="Learning phase" value={fmtStr(d.learningStage)} />}
          {isAdSet && <F label="Effective status" value={fmtStr(d.effectiveStatus)} />}
          {!isAdSet && <F label="Effective status" value={fmtStr(d.effectiveStatus)} />}
        </FieldGroup>

        <FieldGroup title="Funnel">
          <F label="Purchases"        value={fmtInt(d.conversions)} />
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
            <F label="Optimization"    value={fmtStr(d.optimizationGoal)} />
          </FieldGroup>
        ) : (
          <FieldGroup title="Creative">
            <F label="Creative ID" value={fmtStr(d.creativeId)} />
            <F label="Format"      value={fmtStr(d.format)} />
            <F label="Hook style"  value={fmtStr(d.hookStyle)} />
            {d.creativeCta && <F label="CTA" value={fmtStr(d.creativeCta)} />}
            {d.isDynamicCreative && <F label="Dynamic creative" value="Yes — Meta mixes assets" color={C.amber} />}
          </FieldGroup>
        )}

        {isAdSet && (
          <FieldGroup title="Bidding">
            <F label="Bid strategy" value={fmtStr(d.bidStrategy)} />
            <F label="Bid amount"   value={fmtMoney(d.bidAmount)} />
            <F label="Billing event" value={fmtStr(d.billingEvent)} />
          </FieldGroup>
        )}

        {isAdSet && (
          <FieldGroup title="Time window">
            <F label="From" value={fmtStr(d.dateStart)} />
            <F label="To"   value={fmtStr(d.dateStop)} />
          </FieldGroup>
        )}
      </div>

      {!isAdSet && (d.creativeTitle || d.creativeBody) && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.borderLight}` }}>
          {d.creativeTitle && <p className="text-[12px] font-semibold mb-1" style={{ color: C.text }}>{d.creativeTitle}</p>}
          {d.creativeBody && <p className="text-[12px] leading-relaxed" style={{ color: C.textSecondary }}>{d.creativeBody.length > 220 ? `${d.creativeBody.slice(0, 220)}…` : d.creativeBody}</p>}
        </div>
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
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-[11px]" style={{ color: C.textMuted }}>{label}</span>
      <span className="text-[12px] mono font-medium" style={{ color: color ?? C.text }}>{value}</span>
    </div>
  )
}

/**
 * Renders `children` in a portal to document.body, anchored to `anchorRef`.
 * Detaches the hover panel from any table `overflow` clipping.
 */
function HoverPortal({
  anchorRef,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const gap = 8
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    // Measure the panel that just rendered off-screen, so we know its actual height.
    const measured = panelRef.current?.getBoundingClientRect()
    const panelWidth = measured?.width || 700
    const panelHeight = measured?.height || 460

    // Horizontal: align to row's right edge, clamp to viewport with 20px margin.
    let left = r.right - panelWidth
    if (left < 20) left = Math.max(20, r.left)
    if (left + panelWidth > viewportW - 20) left = viewportW - panelWidth - 20

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
    if (top < window.scrollY + 20) top = window.scrollY + 20
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
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

/* ═════════════════════════════════════════════════════════════════
   AD ROW
   ═════════════════════════════════════════════════════════════════ */
function AdRow({ ad }: { ad: CampaignAd }) {
  const [histOpen, setHistOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const rowRef = useRef<HTMLTableRowElement | null>(null)
  const spend = ad.metrics?.spend ?? ad.spend
  const ctr = ad.metrics?.ctr ?? ad.ctr
  const revenue = ad.metrics?.revenue ?? ad.revenue
  const roas = ad.metrics?.roas ?? ad.roas
  const conversions = ad.metrics?.conversions ?? ad.conversions
  const fatigued = ctr != null && ad.ctrBaseline != null && ctr < ad.ctrBaseline * 0.65
  const hist = ad.replacementHistory || []
  return (
    <>
      <tr
        ref={rowRef}
        className="group relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <td>
          <p className="text-[13px] font-medium" style={{ color: C.text }}>{ad.name || '—'}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {ad.hookStyle && <span className="text-[11px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.borderLight}` }}>{ad.hookStyle}</span>}
            {ad.format && <FormatBadge format={ad.format} />}
            {fatigued && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: C.redBg, color: C.red }}><FlameKindling size={9} />Fatigue</span>}
            {hist.length > 0 && <button onClick={e => { e.stopPropagation(); setHistOpen(h => !h) }} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md transition-opacity hover:opacity-70" style={{ color: C.accent }}><History size={9} className="inline mr-0.5" />{hist.length} swap{hist.length !== 1 ? 's' : ''}</button>}
          </div>
        </td>
        <td>{ad.status?.trim() ? <StatusBadge status={ad.status} /> : <span style={{ color: C.textFaint }}>—</span>}</td>
        <td className="num mono font-medium" style={{ color: C.textSecondary }}>{spend ? formatCurrency(spend) : '—'}</td>
        <td className="num mono font-medium" style={{ color: revenue && revenue > 0 ? C.text : C.textFaint }}>{revenue && revenue > 0 ? formatCurrency(revenue) : '—'}</td>
        <td className="num mono font-semibold" style={{ color: roas != null && roas > 0 ? (roas >= 2 ? C.green : roas >= 1 ? C.amber : C.red) : C.textFaint }}>{roas && roas > 0 ? `${roas.toFixed(2)}x` : '—'}</td>
        <td className="num mono" style={{ color: C.textSecondary }}>{conversions ?? '—'}</td>
        <td className="num mono" style={{ color: fatigued ? C.red : C.textSecondary }}>
          {ctr != null ? <>{ctr.toFixed(2)}%{ad.ctrBaseline != null && <span className="ml-1 text-[10px]" style={{ color: C.textMuted }}>/{ad.ctrBaseline.toFixed(1)}%</span>}</> : '—'}
        </td>
        <td>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
            style={{ background: C.bg, color: C.textMuted, border: `1px solid ${C.borderLight}` }}
          >
            hover
          </span>
        </td>
      </tr>
      {hovered && (
        <HoverPortal anchorRef={rowRef}>
          <AllFieldsPanel kind="ad" data={ad} />
        </HoverPortal>
      )}
      {histOpen && hist.length > 0 && (
        <tr><td colSpan={8} style={{ background: C.surfaceMuted }}>
          <p className="micro-label mb-2">Hook History</p>
          {hist.map((e, j) => (
            <div key={j} className="flex items-center gap-2 text-xs py-1">
              <code className="px-1.5 py-0.5 rounded" style={{ background: C.redBg, color: C.red, fontSize: 11 }}>{e.oldHook}</code>
              <span style={{ color: C.textMuted }}>&rarr;</span>
              <code className="px-1.5 py-0.5 rounded" style={{ background: C.greenBg, color: C.green, fontSize: 11 }}>{e.newHook}</code>
              <span style={{ color: C.textMuted }}>{formatDate(e.replacedAt)}</span>
              <span style={{ color: C.textSecondary }}>— {e.reason}</span>
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
  proposalsCount,
}: {
  adSet: CampaignAdSet
  formatTag?: 'video' | 'image'
  siblingFormat?: 'video' | 'image'
  groupHead?: boolean
  tenantId?: string
  proposalsCount?: number
}) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const rowRef = useRef<HTMLTableRowElement | null>(null)
  const ads = adSet.ads || []
  const spend = adSet.metrics?.spend ?? adSet.spend
  const ctr = adSet.metrics?.ctr ?? adSet.ctr
  const roas = adSet.metrics?.roas ?? adSet.roas
  const conv = adSet.metrics?.conversions ?? adSet.conversions
  const revenue = adSet.metrics?.revenue ?? adSet.revenue
  const impressions = adSet.impressions
  return (
    <>
      <tr
        ref={rowRef}
        className="group cursor-pointer relative"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
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
              {adSet.audienceType && <p className="text-xs mt-0.5 capitalize" style={{ color: C.textMuted }}>{adSet.audienceType.replace(/_/g, ' ')}</p>}
            </div>
          </div>
        </td>
        <td>{adSet.status?.trim() ? <StatusBadge status={adSet.status} /> : <span style={{ color: C.textFaint }}>—</span>}</td>
        <td className="num mono font-medium" style={{ color: C.textSecondary }}>{spend ? formatCurrency(spend) : '—'}</td>
        <td className="num mono font-medium" style={{ color: revenue && revenue > 0 ? C.text : C.textFaint }}>{revenue != null && revenue > 0 ? formatCurrency(revenue) : '—'}</td>
        <td className="num mono font-semibold" style={{ color: roas != null && roas > 0 ? (roas >= 2 ? C.green : roas >= 1 ? C.amber : C.red) : C.textFaint }}>{roas != null && roas > 0 ? `${roas.toFixed(2)}x` : '—'}</td>
        <td className="num mono font-medium" style={{ color: C.text }}>{conv ?? '—'}</td>
        <td className="num mono" style={{ color: C.textSecondary }}>{impressions?.toLocaleString() ?? '—'}</td>
        <td className="num mono" style={{ color: C.textSecondary }}>{ctr != null && ctr > 0 ? `${ctr.toFixed(2)}%` : '—'}</td>
        <td>
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: C.surfaceMuted, color: C.textMuted, border: `1px solid ${C.borderLight}` }}
              title="Hover the row for all 25+ fields"
            >
              hover for details
            </span>
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
      {hovered && (
        <HoverPortal anchorRef={rowRef}>
          <AllFieldsPanel kind="adset" data={adSet} />
        </HoverPortal>
      )}
      {open && ads.length > 0 && (
        <tr><td colSpan={8} style={{ background: C.surfaceMuted }}>
          <table className="w-full"><thead><tr>{['Ad / Hook', 'Status', 'Spend', 'Revenue', 'ROAS', 'Conv.', 'CTR', 'Details'].map((h, i) => <th key={h} className={i < 2 ? '' : 'num'}>{h}</th>)}</tr></thead>
          <tbody>{ads.map((ad, i) => <AdRow key={ad.id || i} ad={ad} />)}</tbody></table>
        </td></tr>
      )}
    </>
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
  const s = ACTION_STYLES[type] || { bg: 'var(--muted)', color: 'var(--ink-3)', border: 'var(--hairline)', label: type.replace(/_/g, ' ') }
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
  return <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{icons[type] || <Zap size={11} />}{s.label}</span>
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
    <span className="inline-flex items-center gap-1 text-[11px] capitalize" style={{ color: C.textSecondary }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {urgency}
    </span>
  )
}

// ── Dayparting 24h grid ──
function DaypartingGrid({ activeHours }: { activeHours: number[] }) {
  const set = new Set(activeHours)
  return (
    <div className="space-y-1">
      <p className="micro-label">Active hours (UTC)</p>
      <div className="grid grid-cols-24 gap-0.5" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            title={`${h.toString().padStart(2, '0')}:00 — ${set.has(h) ? 'active' : 'paused'}`}
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
  return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: s.bg, color: s.c, border: `1px solid ${s.b}` }}>{s.spin ? <Loader2 size={10} className="animate-spin" /> : status === 'complete' ? <CheckCircle size={10} /> : <XCircle size={10} />}{status[0].toUpperCase() + status.slice(1)}</span>
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

function ActionsPanel({ tenantId, campaignId }: { tenantId: string; campaignId: string }) {
  const [actions, setActions] = useState<CampaignAction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [st, setSt] = useState<Record<string, { a?: string; o?: string }>>({})

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
      {/* Filter row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1">
          {FILTERS.map(f => {
            const n = counts[f]; const on = filter === f
            return <button key={f} onClick={() => { setFilter(f); setLoading(true) }} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize" style={on ? { background: C.accent, color: '#fff' } : { background: C.surface, color: C.textMuted, border: `1px solid ${C.border}` }}>{f}{n > 0 && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={on ? { background: 'rgba(23,20,15,0.10)' } : { background: C.borderLight }}>{n}</span>}</button>
          })}
        </div>
        <button onClick={() => load(filter)} className="btn btn-ghost"><RefreshCw size={11} />Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20" style={{ color: C.textMuted }}><Loader2 size={18} className="animate-spin" /></div>
      ) : actions.length === 0 ? (
        <div className="py-20 text-center rounded-2xl" style={{ background: C.surfaceMuted, border: `2px dashed ${C.border}` }}>
          <Zap size={28} style={{ color: C.textFaint, margin: '0 auto 10px' }} />
          <p className="text-sm font-semibold" style={{ color: C.textMuted }}>No actions</p>
          <p className="text-xs mt-1" style={{ color: C.textFaint }}>Actions appear when the auditor recommends changes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map(action => {
            const aS = st[action.actionId]?.a || '', oS = st[action.actionId]?.o || ''
            const pending = action.status === 'pending'
            const growth = GROWTH.includes(action.type)
            const pause = action.type === 'pause_ad' || action.type === 'pause_adset'
            const hasRepl = action.type === 'replace_creative' || action.type === 'add_creative'
            const reason = typeof action.reason === 'string' ? action.reason : JSON.stringify(action.reason)
            const typeS = ACTION_STYLES[action.type] || { border: C.border }

            return (
              <div key={action.actionId} className="card card-hover overflow-hidden">
                {/* Color top bar */}
                <div className="h-1" style={{ background: typeS.border }} />

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <TypeBadge type={action.type} />
                      <span className="text-sm font-semibold" style={{ color: C.text }}>{typeof action.targetName === 'string' ? action.targetName : JSON.stringify(action.targetName)}</span>
                      <SourceChip source={action.source} />
                      <UrgencyDotChip urgency={action.urgency} />
                    </div>
                    <StatusBadge status={action.status} />
                  </div>

                  {/* Reason */}
                  {reason && <p className="text-[13px] leading-relaxed mb-4" style={{ color: C.textSecondary }}>{reason}</p>}

                  {/* Info chips */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {action.type === 'replace_creative' && action.metrics?.fatiguedHook && action.metrics?.replacementHook && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}` }}>
                        <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: C.redBg, color: C.red }}>{String(action.metrics.fatiguedHook)}</code>
                        <span style={{ color: C.textMuted }}>&rarr;</span>
                        <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: C.greenBg, color: C.green }}>{String(action.metrics.replacementHook)}</code>
                      </span>
                    )}
                    {action.type === 'replace_creative' && Array.isArray(action.metrics?.forcedHookStyles) && action.metrics.forcedHookStyles.length > 0 && (
                      <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` }}>
                        Force: {(action.metrics.forcedHookStyles as string[]).join(', ').replace(/_/g, ' ')}
                      </span>
                    )}
                    {action.type === 'replace_creative' && Array.isArray(action.metrics?.avoidHookStyles) && action.metrics.avoidHookStyles.length > 0 && (
                      <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` }}>
                        Avoid: {(action.metrics.avoidHookStyles as string[]).join(', ').replace(/_/g, ' ')}
                      </span>
                    )}
                    {action.type === 'add_creative' && action.metrics?.newHook && (
                      <span className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>Hook: <code className="font-bold" style={{ color: C.blue }}>{String(action.metrics.newHook)}</code></span>
                    )}
                    {action.type === 'add_adset' && action.metrics?.audienceType && (
                      <span className="text-xs px-2.5 py-1.5 rounded-lg capitalize" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>Audience: <strong>{String(action.metrics.audienceType).replace(/_/g, ' ')}</strong></span>
                    )}
                    {action.type === 'scale_adset' && (action.metrics?.oldBudgetPercent != null || action.metrics?.newBudgetPercent != null) && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>
                        <strong style={{ color: C.textMuted }}>{Number(action.metrics.oldBudgetPercent ?? 0)}%</strong>
                        <span>&rarr;</span>
                        <strong style={{ color: C.green }}>{Number(action.metrics.newBudgetPercent ?? 0)}%</strong>
                      </span>
                    )}
                    {action.type === 'shift_budget_between_adsets' && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>
                        <strong style={{ color: C.red }}>{String(action.metrics?.donorAdSetId ?? '?')}</strong>
                        <span>&rarr;</span>
                        <strong style={{ color: C.green }}>{String(action.metrics?.recipientAdSetId ?? '?')}</strong>
                        {action.metrics?.shiftPercent != null && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[11px]" style={{ background: C.indigoBg, color: C.indigo }}>
                            {Number(action.metrics.shiftPercent)}%
                          </span>
                        )}
                      </span>
                    )}
                    {action.type === 'reduce_total_budget' && (action.metrics?.oldDailyBudget != null || action.metrics?.newDailyBudget != null) && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>
                        <strong style={{ color: C.textMuted }}>{action.metrics?.oldDailyBudget != null ? formatCurrency(Number(action.metrics.oldDailyBudget)) : '—'}</strong>
                        <span>&rarr;</span>
                        <strong style={{ color: C.amber }}>{action.metrics?.newDailyBudget != null ? formatCurrency(Number(action.metrics.newDailyBudget)) : '—'}</strong>
                        <span className="text-[10px]" style={{ color: C.textMuted }}>/day</span>
                      </span>
                    )}
                    {action.type === 'narrow_placement' && Array.isArray(action.metrics?.droppedPlacements) && action.metrics.droppedPlacements.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.surfaceMuted, border: `1px solid ${C.borderLight}`, color: C.textSecondary }}>
                        Drop: {(action.metrics.droppedPlacements as string[]).map((p) => (
                          <code key={p} className="px-1 py-0.5 rounded text-[11px] ml-1" style={{ background: C.redBg, color: C.red }}>{p}</code>
                        ))}
                      </span>
                    )}
                    {action.type === 'refresh_audience' && action.metrics?.newAudience && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg max-w-full" style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue }}>
                        <Users size={11} />
                        <code className="text-[11px] truncate" style={{ maxWidth: 320 }} title={JSON.stringify(action.metrics.newAudience)}>
                          {JSON.stringify(action.metrics.newAudience)}
                        </code>
                      </span>
                    )}
                    {hasRepl && action.replacementStatus && <ReplaceBadge status={action.replacementStatus} />}
                    {action.recommendedAt && <span className="text-[11px] tabular-nums flex items-center gap-1" style={{ color: C.textMuted }}><Clock size={10} />{formatRelativeTime(action.recommendedAt)}</span>}
                    {pending && action.executeAt && <span className="text-[11px] tabular-nums flex items-center gap-1 font-semibold" style={{ color: C.amber }}><Clock size={10} />exec {formatRelativeTime(action.executeAt)}</span>}
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
                      {growth && (
                        <button onClick={() => approve(action.actionId)} disabled={aS === 'loading'} className="btn" style={aS === 'success' ? { background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` } : aS === 'error' ? { background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` } : { background: C.green, color: '#fff' }}>
                          {aS === 'loading' ? <Loader2 size={13} className="animate-spin" /> : aS === 'success' ? <CheckCircle size={13} /> : <ThumbsUp size={13} />}
                          {aS === 'loading' ? 'Approving…' : aS === 'success' ? 'Approved!' : aS === 'error' ? 'Failed' : 'Approve'}
                        </button>
                      )}
                      {pause && (
                        <button onClick={() => approve(action.actionId)} disabled={aS === 'loading'} className="btn" style={aS === 'success' ? { background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` } : aS === 'error' ? { background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` } : { background: C.red, color: '#fff' }}>
                          {aS === 'loading' ? <Loader2 size={13} className="animate-spin" /> : aS === 'success' ? <CheckCircle size={13} /> : <Pause size={13} />}
                          {aS === 'loading' ? 'Executing…' : aS === 'success' ? 'Executed!' : aS === 'error' ? 'Failed' : 'Execute Now'}
                        </button>
                      )}
                      <button onClick={() => override(action.actionId)} disabled={oS === 'loading'} className="btn btn-ghost">
                        {oS === 'loading' ? <Loader2 size={13} className="animate-spin" /> : oS === 'success' ? <CheckCircle size={13} /> : <Ban size={13} />}
                        {oS === 'loading' ? 'Overriding…' : oS === 'success' ? 'Done' : 'Override'}
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
  const breakeven = b.breakeven ?? 1.0
  const passed = b.lowerROAS != null && b.lowerROAS > breakeven
  const conf = b.confidenceLevel ?? 0.95
  return (
    <div
      className="rounded-lg p-3 grid grid-cols-2 gap-3"
      style={{ background: passed ? C.greenBg : C.surfaceMuted, border: `1px solid ${passed ? C.greenBorder : C.border}` }}
    >
      <div>
        <p className="micro-label">Shrunken ROAS</p>
        <p className="text-base font-bold tabular-nums" style={{ color: C.text }}>
          {b.shrunkenROAS != null ? `${b.shrunkenROAS.toFixed(2)}x` : '—'}
        </p>
      </div>
      <div>
        <p className="micro-label">
          Lower ROAS · {Math.round(conf * 100)}%
        </p>
        <p className="text-base font-bold tabular-nums" style={{ color: passed ? C.green : C.text }}>
          {b.lowerROAS != null ? `${b.lowerROAS.toFixed(2)}x` : '—'}
        </p>
      </div>
      {passed && (
        <div className="col-span-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md" style={{ background: C.surface, color: C.green, border: `1px solid ${C.greenBorder}` }}>
            <CheckCircle size={10} /> Above breakeven ({breakeven.toFixed(2)}x) at {Math.round(conf * 100)}% confidence
          </span>
        </div>
      )}
    </div>
  )
}

function PowerCalcBadge({ p }: { p: NonNullable<AuditSnapshot['powerCalc']> }) {
  const tone = p.reachedFloor
    ? { bg: C.greenBg, fg: C.green, border: C.greenBorder, label: 'Power floor reached' }
    : { bg: C.amberBg, fg: C.amber, border: C.amberBorder, label: 'Below power floor' }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md whitespace-nowrap"
      style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` }}
      title={p.minDays != null ? `Min ${p.minDays}d required${p.daysObserved != null ? `, ${p.daysObserved}d observed` : ''}` : undefined}
    >
      <BarChart3 size={10} /> {tone.label}
      {p.daysObserved != null && p.minDays != null && (
        <span className="font-mono">{p.daysObserved}/{p.minDays}d</span>
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
      <p className="micro-label mb-2">Thompson allocation</p>
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
      <svg width={w} height={h} aria-label="DiD creative fatigue">
        <path d={cfPath} fill="none" stroke={C.textFaint} strokeWidth={1.25} strokeDasharray="3 2" />
        <path d={obsPath} fill="none" stroke={isFatigued ? C.red : C.green} strokeWidth={1.5} />
        {data.map((d, i) => (
          <circle key={i} cx={xAt(d.day)} cy={yAt(d.observed)} r={1.5} fill={isFatigued ? C.red : C.green} />
        ))}
      </svg>
      <div className="text-[10px] leading-tight" style={{ color: C.textMuted }}>
        <div>obs vs <span style={{ color: C.textFaint }}>cf</span></div>
        <div className="font-mono tabular-nums" style={{ color: isFatigued ? C.red : C.green }}>
          {(fatigueRatio * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  )
}

function shadowFieldText(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v.replace(/_/g, ' ')
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const t = typeof obj.type === 'string' ? obj.type : undefined
    const tn = typeof obj.targetName === 'string' ? obj.targetName : undefined
    const r = typeof obj.reason === 'string' ? obj.reason : undefined
    if (t || tn) return [t?.replace(/_/g, ' '), tn].filter(Boolean).join(' · ')
    if (r) return r
    try { return JSON.stringify(v) } catch { return String(v) }
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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    setLoading(true)
    load()
    return () => { cancelled = true }
  }, [tenantId, campaignId])

  if (loading) return <div className="py-6 text-center" style={{ color: C.textMuted }}><Loader2 size={14} className="animate-spin mx-auto" /></div>
  if (error) return <p className="text-xs px-3 py-3 rounded-md" style={{ background: C.redBg, color: C.red }}>Shadow actions: {error}</p>
  if (actions.length === 0) return <p className="text-xs italic px-3 py-6 text-center" style={{ color: C.textMuted }}>No shadow actions captured.</p>

  return (
    <div className="card-inset overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Proposed</th>
            <th>Blocked because</th>
            <th>Regret</th>
            <th className="num">Age</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a, i) => (
            <tr key={i}>
              <td className="text-xs font-semibold capitalize" style={{ color: C.text }}>
                {shadowFieldText(a.proposedAction)}
              </td>
              <td className="text-xs" style={{ color: C.textSecondary }}>
                {shadowFieldText(a.blockedReason)}
              </td>
              <td>
                <RegretLabel label={a.regretLabel} />
              </td>
              <td className="num mono text-[11px]" style={{ color: C.textMuted }}>
                {a.age || (a.proposedAt ? formatRelativeTime(a.proposedAt) : '—')}
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
interface PageProps { params: Promise<{ tenantId: string; campaignId: string }> }

export default function CampaignDetailPage({ params }: PageProps) {
  const { tenantId, campaignId } = use(params)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approveState, setApproveState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [pauseState, setPauseState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectState, setRejectState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [pkg, setPkg] = useState<CreativePackage | null>(null)
  const [pkgLoading, setPkgLoading] = useState(false)
  const [imgState, setImgState] = useState<Record<number, string>>({})
  const [vidRetry, setVidRetry] = useState<string>('idle')
  const [vidRewrite, setVidRewrite] = useState<string>('idle')
  const [snaps, setSnaps] = useState<AuditSnapshot[]>([])
  const [snapsLoading, setSnapsLoading] = useState(false)
  const [tab, setTab] = useState('overview')
  // Open shadow_review counts keyed by Meta adset ID, populated once per load.
  const [adsetProposals, setAdsetProposals] = useState<Record<string, number>>({})

  const flash = (m: string, t: 'success' | 'error') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 4000) }

  /* ─── Creative helpers ─── */
  function pollImg(pkgId: string, vi: number, done: () => void) { let n = 0; const t = setInterval(async () => { n++; try { const r = await fetch(`${API}/creative/${tenantId}/packages/${pkgId}`); if (r.ok) { const p = await r.json(); if (p.images?.[vi]?.imageUrl) { setPkg(p); done(); clearInterval(t) } } } catch {}; if (n >= 18) { done(); clearInterval(t) } }, 10000) }
  function pollVid(pkgId: string, done: () => void) { let n = 0; const t = setInterval(async () => { n++; try { const r = await fetch(`${API}/creative/${tenantId}/packages/${pkgId}`); if (r.ok) { const p = await r.json(); if (p.video?.videoUrl) { setPkg(p); done(); clearInterval(t) } } } catch {}; if (n >= 18) { done(); clearInterval(t) } }, 10000) }
  async function rerollImg(vi: number) { const id = campaign?.creativePackageId; if (!id) return; setImgState(p => ({ ...p, [vi]: 'loading' })); try { const r = await fetch(`${API}/creative/${tenantId}/packages/${id}/regenerate-image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variantIndex: vi }) }); if (!r.ok) throw new Error(); setImgState(p => ({ ...p, [vi]: 'polling' })); pollImg(id, vi, () => setImgState(p => ({ ...p, [vi]: 'idle' }))) } catch { setImgState(p => ({ ...p, [vi]: 'idle' })); flash('Image regeneration failed', 'error') } }
  async function newImgPrompt(vi: number) { const id = campaign?.creativePackageId; if (!id) return; setImgState(p => ({ ...p, [vi]: 'loading' })); try { const r = await fetch(`${API}/creative/${tenantId}/packages/${id}/regenerate-image-prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variantIndex: vi }) }); if (!r.ok) throw new Error(); setImgState(p => ({ ...p, [vi]: 'polling' })); pollImg(id, vi, () => setImgState(p => ({ ...p, [vi]: 'idle' }))) } catch { setImgState(p => ({ ...p, [vi]: 'idle' })); flash('Prompt rewrite failed', 'error') } }
  async function rerollVid() { const id = campaign?.creativePackageId; if (!id) return; setVidRetry('loading'); try { const r = await fetch(`${API}/creative/${tenantId}/packages/${id}/regenerate-video`, { method: 'POST' }); if (!r.ok) throw new Error(); setVidRetry('polling'); pollVid(id, () => setVidRetry('idle')) } catch { setVidRetry('idle'); flash('Video regeneration failed', 'error') } }
  async function rewriteVid() { const id = campaign?.creativePackageId; if (!id) return; setVidRewrite('loading'); try { const r = await fetch(`${API}/creative/${tenantId}/packages/${id}/regenerate-video-prompt`, { method: 'POST' }); if (!r.ok) throw new Error(); setVidRewrite('polling'); pollVid(id, () => setVidRewrite('idle')) } catch { setVidRewrite('idle'); flash('Video rewrite failed', 'error') } }

  /* ─── Data fetch ─── */
  async function fetchCampaign() {
    try {
      const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}`); if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d: Campaign = await r.json(); setCampaign(d); setError(null)
      if (d.creativePackageId) { setPkgLoading(true); fetch(`${API}/creative/${tenantId}/packages/${d.creativePackageId}`).then(r => r.ok ? r.json() : null).then(p => { if (p) setPkg(p) }).catch(() => {}).finally(() => setPkgLoading(false)) }
      if (d.status === 'pending_approval') { fetch(`${API}/companies/${tenantId}`).then(r => r.ok ? r.json() : null).then(c => { const ids: string[] = c?.meta?.accountIds || []; setAccountIds(ids); if (ids.length && !selectedAccountId) setSelectedAccountId(ids[0]) }).catch(() => {}) }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
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

  /* ─── Campaign actions ─── */
  async function doPause() { const reason = window.prompt('Reason for pausing?', 'Manual pause'); if (!reason?.trim()) return; setPauseState('loading'); try { const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}/pause`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() }) }); if (!r.ok) throw new Error(); setPauseState('success'); flash('Campaign paused', 'success'); fetchCampaign() } catch (e) { setPauseState('error'); flash(e instanceof Error ? e.message : 'Failed', 'error'); setTimeout(() => setPauseState('idle'), 3000) } }
  async function doResume() { try { const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}/resume`, { method: 'POST' }); if (!r.ok) throw new Error(); flash('Campaign resumed', 'success'); fetchCampaign() } catch (e) { flash(e instanceof Error ? e.message : 'Failed', 'error') } }
  async function doApprove() { if (!selectedAccountId) { flash('Select a Meta ad account', 'error'); return }; setApproveState('loading'); try { const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: selectedAccountId.startsWith('act_') ? selectedAccountId : `act_${selectedAccountId}` }) }); if (!r.ok) throw new Error(); const d = await r.json(); setApproveState('success'); flash(`Launched! Meta ID: ${d.metaCampaignId || 'assigned'}`, 'success'); fetchCampaign() } catch (e) { setApproveState('error'); flash(e instanceof Error ? e.message : 'Failed', 'error'); setTimeout(() => setApproveState('idle'), 3000) } }
  async function doReject() { setRejectState('loading'); try { const r = await fetch(`${API}/campaigns/${tenantId}/${campaignId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: rejectReason }) }); if (!r.ok) throw new Error(); setRejectState('success'); flash('Rejected', 'success'); setRejectOpen(false); setRejectReason(''); fetchCampaign() } catch (e) { setRejectState('error'); flash(e instanceof Error ? e.message : 'Failed', 'error'); setTimeout(() => setRejectState('idle'), 3000) } }

  /* ─── Guards ─── */
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 size={24} className="animate-spin" style={{ color: C.accent }} /></div>
  if (error || !campaign) return (
    <div className="p-8 max-w-3xl mx-auto min-h-screen">
      <Link href={`/dashboard/${tenantId}/campaigns`} className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: C.textMuted }}><ArrowLeft size={14} />Back</Link>
      <div className="rounded-2xl p-5" style={{ background: C.redBg, border: `1px solid ${C.redBorder}` }}><p className="text-sm font-medium" style={{ color: C.red }}><AlertCircle size={15} className="inline mr-2" />{error || 'Campaign not found'}</p></div>
    </div>
  )

  /* ─── Derived ─── */
  const live = (campaign.metaAdSets?.length ? campaign.metaAdSets : campaign.adSets) || []
  const planned = campaign.campaignConfig?.adSets || []
  const usePlanned = live.length === 0 && planned.length > 0
  const pendingActs = (campaign.pendingActions || []).filter(a => a.status === 'pending' && GROWTH.includes(a.type)).length
  const isPendingApproval = campaign.status === 'pending_approval'
  const debate = campaign.reviewDebateLog || []

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { id: 'adsets', label: 'Ad Sets', count: live.length || planned.length || undefined, icon: <Layers size={14} /> },
    { id: 'segments', label: 'Segments', icon: <Users size={14} /> },
    { id: 'actions', label: 'Actions', badge: pendingActs || undefined, icon: <Zap size={14} /> },
    { id: 'audit', label: 'Audit', count: snaps.length || undefined, icon: <Activity size={14} /> },
    ...(campaign.creativePackageId ? [{ id: 'creative', label: 'Creative', icon: <ImageIcon size={14} /> }] : []),
  ]

  /* ─── ROAS color ─── */
  const rc = campaign.roas != null ? (campaign.roas >= 2 ? C.green : campaign.roas >= 1 ? C.amber : C.red) : C.textFaint

  return (
    <div className="min-h-screen">
      {/* Toast */}
      {toast && <div className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl" style={toast.type === 'success' ? { background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green } : { background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red }}>{toast.message}</div>}

      {/* ─── TOP BAR ─── */}
      <div className="px-8 pt-8 pb-0 max-w-6xl mx-auto stagger">
        <Link href={`/dashboard/${tenantId}/campaigns`} className="inline-flex items-center gap-1.5 text-sm font-medium mb-5 transition-opacity hover:opacity-70" style={{ color: C.textMuted }}><ArrowLeft size={14} />Campaigns</Link>

        {/* ─── HEADER ─── */}
        <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
          <div>
            <p className="micro-label mb-2">Campaign</p>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="page-title">{campaign.name || campaign.topic || 'Untitled'}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            {campaign.topic && campaign.name && <p className="page-subtitle mb-2">{campaign.topic}</p>}
            <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: C.textMuted }}>
              {campaign.source === 'agent' && <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md" style={{ background: C.accentLight, color: C.accent }}><Bot size={11} />Agent</span>}
              {campaign.source === 'manual' && <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.border}` }}><User size={11} />Manual</span>}
              {campaign.objective && <span className="font-medium px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, border: `1px solid ${C.border}`, color: C.textSecondary }}>{campaign.objective}</span>}
              {campaign.budgetModel && (
                <span
                  className="font-bold px-2 py-0.5 rounded-md uppercase"
                  style={
                    campaign.budgetModel === 'abo'
                      ? { background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green }
                      : campaign.budgetModel === 'asc'
                        ? { background: C.amberBg, border: `1px solid ${C.amberBorder}`, color: C.amber }
                        : { background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue }
                  }
                  title={
                    campaign.budgetModel === 'abo'
                      ? 'Ad-set budgets — budget-shift actions are executable'
                      : campaign.budgetModel === 'asc'
                        ? 'Advantage+ Shopping — campaign budget + creative levers only'
                        : 'Campaign budget optimization — Meta allocates across ad sets'
                  }
                >
                  {campaign.budgetModel}
                </span>
              )}
              <FormatBadge format={campaign.creativeFormat} />
              <PromptsVersionBadge version={campaign.promptsVersion} />
              {campaign.metaCampaignId && <code className="mono text-[11px]" style={{ color: C.textMuted }}>{campaign.metaCampaignId}</code>}
              {campaign.launchedAt && <span className="mono"><Clock size={10} className="inline mr-1" />{formatDate(campaign.launchedAt)}</span>}
              {campaign.lastAuditedAt && <span className="mono"><Shield size={10} className="inline mr-1" />{formatDateTime(campaign.lastAuditedAt)}</span>}
              {campaign.runId && <Link href={`/dashboard/${tenantId}/runs/${campaign.runId}`} className="font-semibold transition-opacity hover:opacity-70" style={{ color: C.accent }}>View Run<ExternalLink size={10} className="inline ml-0.5" /></Link>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {campaign.status === 'active' && <button onClick={doPause} disabled={pauseState !== 'idle'} className="btn" style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, color: C.amber }}>{pauseState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />}{pauseState === 'loading' ? 'Pausing…' : 'Pause'}</button>}
            {campaign.status === 'paused' && <button onClick={doResume} className="btn btn-accent"><Play size={14} fill="currentColor" />Resume</button>}
          </div>
        </div>

        {/* ─── METRICS STRIP ─── */}
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
            <MetricCell label="Impressions" value={campaign.impressions?.toLocaleString() ?? '—'} />
            <MetricCell label="Clicks" value={campaign.clicks?.toLocaleString() ?? '—'} />
            <MetricCell label="CTR" value={campaign.ctr != null ? `${campaign.ctr.toFixed(2)}%` : '—'} color={C.amber} />
            <MetricCell label="CPC" value={campaign.cpc ? formatCurrency(campaign.cpc) : '—'} />
            <div>
              <MetricCell label="ROAS" value={campaign.roas != null ? `${campaign.roas.toFixed(2)}x` : '—'} color={rc} />
              {/* Breakeven context — sourced from the latest audit signals.breakeven.
                  Without this, ROAS in isolation is misleading (1.2x looks fine
                  until you know breakeven is 5x for low-margin products). */}
              {snaps[0]?.breakeven?.breakevenROAS != null && (
                <div className="mt-1.5">
                  <BreakevenBadge
                    roas={campaign.roas}
                    breakeven={snaps[0].breakeven.breakevenROAS}
                    source={snaps[0].breakeven.source}
                  />
                </div>
              )}
            </div>
            <MetricCell label="Conversions" value={campaign.conversions ?? '—'} color={C.green} />
          </div>
          {campaign.budget != null && campaign.budget > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4" style={{ borderTop: `1px solid ${C.borderLight}` }}>
              <MetricCell label="Daily Budget" value={formatCurrency(campaign.budget)} />
              <MetricCell label="Total Spend" value={formatCurrency(campaign.spend || 0)} />
              {campaign.spend != null && campaign.launchedAt && (() => { const d = Math.max(1, Math.round((Date.now() - new Date(campaign.launchedAt).getTime()) / 86400000)); return <><MetricCell label="Avg Daily" value={formatCurrency(campaign.spend / d)} /><MetricCell label="Days Live" value={`${d}`} /></> })()}
            </div>
          )}
          {/* Verdict strip */}
          {snaps.length > 0 && (() => {
            const v = snaps[0].verdict
            const s = v.verdict === 'act' ? { bg: C.redBg, b: C.redBorder, c: C.red, l: 'Act Now' } : v.verdict === 'watch' ? { bg: C.amberBg, b: C.amberBorder, c: C.amber, l: 'Watch' } : { bg: C.greenBg, b: C.greenBorder, c: C.green, l: 'All Good' }
            return (
              <div className="mt-4 rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: s.bg, border: `1px solid ${s.b}` }}>
                <Shield size={14} className="mt-0.5 shrink-0" style={{ color: s.c }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold" style={{ color: s.c }}>{s.l}</span>
                    {v.urgency && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: s.b, color: s.c }}>{v.urgency === 'immediate' ? 'Immediate' : v.urgency}</span>}
                    <LeakDiagnosisBadge leak={v.leakDiagnosis} />
                    <span className="text-[11px]" style={{ color: C.textMuted }}>{formatDateTime(snaps[0].auditedAt)}</span>
                  </div>
                  {v.contextInsight && <p className="text-sm mt-1 leading-relaxed" style={{ color: s.c }}>{v.contextInsight}</p>}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ─── APPROVAL PANEL ─── */}
      {isPendingApproval && (
        <div className="px-8 max-w-6xl mx-auto mb-6">
          <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.greenBorder}`, background: C.greenBg }}>
            <div className="px-6 py-4 flex items-center gap-3" style={{ background: C.greenBg, borderBottom: `1px solid ${C.greenBorder}` }}>
              <ThumbsUp size={16} style={{ color: C.green }} />
              <div><h2 className="section-title text-[17px]" style={{ color: C.green }}>Awaiting Approval</h2><p className="text-xs mt-0.5" style={{ color: C.green }}>Review creative, then select a Meta account to launch.</p></div>
            </div>
            <div className="p-6 space-y-6">
              {pkgLoading ? <div className="flex items-center gap-2 py-6" style={{ color: C.textMuted }}><Loader2 size={14} className="animate-spin" />Loading creative…</div> : pkg?.copyVariants?.length ? (
                <div><p className="micro-label mb-3">Copy Variants</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{pkg.copyVariants.map((v, i) => {
                  const sel = i === (pkg.selectedCopyIndex ?? -1)
                  return <div key={i} className="rounded-xl p-4 space-y-2" style={{ background: sel ? C.surface : C.surfaceMuted, border: sel ? `2px solid ${C.green}` : `1px solid ${C.border}` }}>
                    <div className="flex gap-2 flex-wrap">{sel && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: C.greenBg, color: C.green }}>Selected</span>}{v.hookStyle && <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textMuted }}>{v.hookStyle}</span>}</div>
                    {v.headline && <p className="text-sm font-semibold" style={{ color: C.text }}>{v.headline}</p>}
                    <p className="text-xs leading-relaxed" style={{ color: C.textSecondary }}>{v.primaryText}</p>
                    {v.cta && <span className="inline-block text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: C.accentLight, color: C.accent }}>CTA: {v.cta}</span>}
                  </div>
                })}</div></div>
              ) : null}
              <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.greenBorder}` }}>
                <label className="micro-label block mb-2" style={{ color: C.green }}>Meta Ad Account</label>
                {accountIds.length === 0 ? <p className="text-xs" style={{ color: C.textMuted }}>No accounts found.</p> : (
                  <div className="relative mb-4"><select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm appearance-none pr-10" style={{ background: C.surfaceMuted, border: `1px solid ${C.border}`, color: C.text }}>{accountIds.map(id => <option key={id} value={id}>act_{id}</option>)}</select><ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.textMuted }} /></div>
                )}
                <div className="flex gap-3">
                  <button onClick={doApprove} disabled={approveState !== 'idle' || !selectedAccountId} className="btn flex-1" style={{ background: C.green, color: '#fff' }}>{approveState === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <ThumbsUp size={16} />}{approveState === 'loading' ? 'Launching…' : approveState === 'success' ? 'Launched!' : 'Approve & Launch'}</button>
                  <button onClick={() => setRejectOpen(o => !o)} className="btn btn-danger"><XCircle size={14} className="inline mr-1.5" />Reject</button>
                </div>
                {rejectOpen && <div className="mt-4 pt-4 space-y-3" style={{ borderTop: `1px solid ${C.redBorder}` }}><textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason…" rows={3} className="w-full rounded-xl px-4 py-3 text-sm resize-none" style={{ border: `1px solid ${C.redBorder}`, color: C.text }} /><div className="flex gap-2"><button onClick={doReject} disabled={rejectState === 'loading' || !rejectReason.trim()} className="btn" style={{ background: C.red, color: '#fff' }}>{rejectState === 'loading' ? 'Rejecting…' : 'Confirm'}</button><button onClick={() => { setRejectOpen(false); setRejectReason('') }} className="text-xs" style={{ color: C.textMuted }}>Cancel</button></div></div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debate */}
      {debate.length > 0 && <div className="px-8 max-w-6xl mx-auto mb-6"><div className="card p-6"><p className="micro-label mb-4">Review Debate</p><DebateLog rounds={debate} /></div></div>}

      {/* ═══════════════════════════════════════════════════════════
         TABS
         ═══════════════════════════════════════════════════════════ */}
      <div className="px-8 max-w-6xl mx-auto pb-12">
        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List className="flex gap-1 mb-6" style={{ borderBottom: `2px solid ${C.border}` }}>
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
              {(campaign.reviewNotes || campaign.reviewAdjustments?.budgetAdjusted) && (
                <div className="card p-6">
                  <p className="micro-label mb-3">Review Notes</p>
                  {campaign.reviewAdjustments?.budgetAdjusted && <div className="px-3 py-2 rounded-lg mb-3 text-sm" style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, color: C.amber }}>Budget: {campaign.reviewAdjustments.originalBudget > 0 && formatCurrency(campaign.reviewAdjustments.originalBudget) + ' → '}{formatCurrency(campaign.reviewAdjustments.recommendedBudget)}</div>}
                  {campaign.reviewNotes && <p className="text-sm leading-relaxed" style={{ color: C.textSecondary }}>{campaign.reviewNotes}</p>}
                </div>
              )}
              {(campaign.campaignConfig?.scaleRules || campaign.campaignConfig?.pauseRules) && (
                <div className="card p-6">
                  <p className="micro-label mb-3">Automation Rules</p>
                  <div className="grid md:grid-cols-2 gap-5">
                    {campaign.campaignConfig?.scaleRules && <div><p className="text-xs font-bold mb-1" style={{ color: C.green }}>Scale Rules</p><p className="text-xs leading-relaxed" style={{ color: C.textSecondary }}>{campaign.campaignConfig.scaleRules}</p></div>}
                    {campaign.campaignConfig?.pauseRules && <div><p className="text-xs font-bold mb-1" style={{ color: C.red }}>Pause Rules</p><p className="text-xs leading-relaxed" style={{ color: C.textSecondary }}>{campaign.campaignConfig.pauseRules}</p></div>}
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
                  <p className="text-xs font-medium mt-1" style={{ color: C.textMuted }}>{pendingActs > 0 ? 'Actions need your decision' : 'No pending actions'}</p>
                </button>
              </div>
            </div>
          </Tabs.Content>

          {/* ── AD SETS ── */}
          <Tabs.Content value="adsets">
            <div className="card overflow-hidden">
              {usePlanned ? (
                <div className="overflow-x-auto"><table className="data-table"><thead><tr>{['Ad Set', 'Audience', 'Budget %', 'Age', 'Geo', 'Goal'].map((h, i) => <th key={h} className={i === 0 ? '' : 'num'}>{h}</th>)}</tr></thead>
                <tbody>{planned.map((a, i) => <tr key={i}><td><p className="text-sm font-semibold" style={{ color: C.text }}>{a.name}</p><span className="text-[11px] px-1.5 py-0.5 rounded-md mt-1 inline-block" style={{ background: C.accentLight, color: C.accent }}>{a.audienceType}</span></td><td className="num" style={{ color: C.textSecondary }}>{a.audienceType}</td><td className="num mono font-bold" style={{ color: C.accent }}>{a.budgetPercent}%</td><td className="num mono" style={{ color: C.textSecondary }}>{a.ageMin && a.ageMax ? `${a.ageMin}–${a.ageMax}` : '—'}</td><td className="num" style={{ color: C.textSecondary }}>{a.geoLocations?.join(', ') || '—'}</td><td className="num text-xs" style={{ color: C.textMuted }}>{a.optimizationGoal?.replace(/_/g, ' ') || '—'}</td></tr>)}</tbody></table></div>
              ) : (
                <><div className="overflow-x-auto"><table className="data-table"><thead><tr>{['Ad Set', 'Status', 'Spend', 'Revenue', 'ROAS', 'Conv.', 'Impr.', 'CTR', 'Details'].map((h, i) => <th key={h} className={i < 2 ? '' : 'num'}>{h}</th>)}</tr></thead><tbody>{groupSiblings(live).map((row, i) => <AdSetRow key={row.adSet.metaAdSetId || row.adSet.id || i} adSet={row.adSet} formatTag={row.formatTag} siblingFormat={row.siblingFormat} groupHead={row.groupHead} tenantId={tenantId} proposalsCount={row.adSet.id ? adsetProposals[row.adSet.id] : 0} />)}</tbody></table></div>{live.length === 0 && <div className="py-16 text-center"><p className="text-sm" style={{ color: C.textMuted }}>No ad sets synced yet</p></div>}</>
              )}
            </div>
          </Tabs.Content>

          {/* ── SEGMENTS ── */}
          <Tabs.Content value="segments"><SegmentsPanel tenantId={tenantId} campaignId={campaignId} /></Tabs.Content>

          {/* ── ACTIONS ── */}
          <Tabs.Content value="actions"><ActionsPanel tenantId={tenantId} campaignId={campaignId} /></Tabs.Content>

          {/* ── AUDIT ── */}
          <Tabs.Content value="audit">
            <div className="card overflow-hidden">
              {snapsLoading ? <div className="py-16 text-center" style={{ color: C.textMuted }}><Loader2 size={16} className="animate-spin mx-auto" /></div>
              : snaps.length === 0 ? <div className="py-16 text-center"><Activity size={24} style={{ color: C.textFaint, margin: '0 auto 8px' }} /><p className="text-sm font-medium" style={{ color: C.textMuted }}>No audit snapshots</p></div>
              : (
                <div className="p-6 space-y-6">
                  {snaps.length >= 3 && (() => {
                    const rd = snaps.map(s => s.metrics.roas ?? 0).reverse(), sd = snaps.map(s => s.metrics.spend ?? 0).reverse()
                    return <div className="grid grid-cols-2 gap-4">{[{ l: 'ROAS', d: rd, c: C.green, u: 'x', I: TrendingUp }, { l: 'Spend', d: sd, c: C.accent, u: '₹', I: DollarSign }].map(({ l, d, c, u, I }) => {
                      const latest = d[d.length - 1], prev = d[d.length - 2] ?? latest, delta = prev ? ((latest - prev) / prev) * 100 : 0
                      const min = Math.min(...d), max = Math.max(...d), rng = max - min || 1, W = 180, H = 48
                      const pts = d.map((v, i) => `${(i / (d.length - 1)) * W},${H - ((v - min) / rng) * H}`).join(' ')
                      return <div key={l} className="card-inset p-5">
                        <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-1.5"><I size={13} style={{ color: c }} /><p className="text-xs font-bold" style={{ color: C.textSecondary }}>{l} Trend</p></div><span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: delta >= 0 ? C.greenBg : C.redBg, color: delta >= 0 ? C.green : C.red }}>{delta >= 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(1)}%</span></div>
                        <div className="flex items-end gap-5"><svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none"><polyline points={pts} stroke={c} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" /><circle cx={W} cy={H - ((latest - min) / rng) * H} r={4} fill={c} /></svg><div><p className="display-num text-xl" style={{ color: c }}>{u === '₹' ? formatCurrency(latest) : `${latest.toFixed(2)}x`}</p><p className="text-[10px] mt-1 font-semibold" style={{ color: C.textMuted }}>Latest</p></div></div>
                      </div>
                    })}</div>
                  })()}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <p className="micro-label">Shadow Actions</p>
                      <span className="text-[10px]" style={{ color: C.textFaint }}>What the agent considered but blocked.</span>
                    </div>
                    <ShadowActionsPanel tenantId={tenantId} campaignId={campaignId} />
                  </div>

                  <div>
                    <p className="micro-label mb-4">Timeline</p>
                    {snaps.slice(0, 15).map((snap, i) => {
                      const v = snap.verdict, vc = v.verdict === 'act' ? C.red : v.verdict === 'watch' ? C.amber : C.green
                      const vb = v.verdict === 'act' ? C.redBg : v.verdict === 'watch' ? C.amberBg : C.greenBg
                      const vl = v.verdict === 'act' ? 'Act' : v.verdict === 'watch' ? 'Watch' : 'OK'
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
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: vb, color: vc }}>{vl}{v.urgency === 'immediate' ? ' • Now' : v.urgency === '48h' ? ' • 48h' : v.urgency === '7d' ? ' • 7d' : ''}</span>
                            {sk && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: insufficient ? C.amberBg : C.surfaceMuted, color: insufficient ? C.amber : C.textMuted }}>{insufficient ? 'No evidence yet' : 'All clear'}</span>}
                            <LeakDiagnosisBadge leak={v.leakDiagnosis} />
                            <span className="text-[11px]" style={{ color: C.textMuted }}>{formatDateTime(snap.auditedAt)}</span>
                            {snap.metrics.roas != null && <span className="text-[11px] font-semibold tabular-nums" style={{ color: C.textSecondary }}>ROAS {snap.metrics.roas.toFixed(2)}x</span>}
                            {snap.metrics.spend != null && <span className="text-[11px] tabular-nums" style={{ color: C.textMuted }}>· {formatCurrency(snap.metrics.spend)}</span>}
                            {snap.powerCalc && <PowerCalcBadge p={snap.powerCalc} />}
                          </div>
                          {snap.bayesian && <div className="mt-2"><BayesianVerdictPanel b={snap.bayesian} /></div>}
                          {snap.adSets && snap.adSets.length > 0 && <div className="mt-2"><ThompsonAllocationBar adSets={snap.adSets} /></div>}
                          {sk ? <div className="flex gap-3 mt-0.5">{[snap.metrics.spend != null && `${formatCurrency(snap.metrics.spend)} spent`, snap.metrics.conversions != null && `${snap.metrics.conversions} conv.`, snap.metrics.ctr != null && `CTR ${snap.metrics.ctr.toFixed(2)}%`].filter(Boolean).map((t, k) => <span key={k} className="text-[11px] tabular-nums" style={{ color: C.textMuted }}>{t}</span>)}</div> : v.contextInsight ? <p className="text-[13px] leading-relaxed" style={{ color: C.textSecondary }}>{v.contextInsight}</p> : null}
                          {v.recommendedActions?.length ? <div className="flex flex-wrap gap-1 mt-1.5">{v.recommendedActions.map((a, j) => <span key={j} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textMuted }}>{typeof a === 'string' ? a : (a.reason ?? a.targetName ?? a.type ?? '')}</span>)}</div> : null}
                          {snap.adSets?.length && !sk ? (() => { const w = snap.adSets!.filter(a => a.metrics?.roas != null && a.metrics.roas >= 1.5); const rr = snap.adSets!.some(a => (a.metrics?.conversions ?? 0) >= 20); const fw = snap.ads?.filter(a => a.metrics?.ctr != null && a.metrics.ctr < 0.5) || []; if (!w.length && !rr && !fw.length) return null; return <div className="flex flex-wrap gap-1.5 mt-2">{w.map((a, k) => <span key={k} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: C.greenBg, color: C.green }}><TrendingUp size={9} />{a.name}: {a.metrics!.roas!.toFixed(1)}x</span>)}{rr && <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: C.blueBg, color: C.blue }}><Target size={9} />Retarget ready</span>}{fw.length > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: C.amberBg, color: C.amber }}><FlameKindling size={9} />{fw.length} fatigue</span>}</div> })() : null}
                          {snap.ads?.length ? (
                            <details className="mt-2">
                              <summary className="text-[11px] cursor-pointer font-semibold" style={{ color: C.textMuted }}>{snap.ads.length} ad{snap.ads.length !== 1 ? 's' : ''}</summary>
                              <div className="card-inset mt-1.5 overflow-hidden">
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      {['Ad', 'Hook', 'Impr.', 'Spend', 'CTR', 'Conv.', 'Fatigue (DiD)'].map(h => (
                                        <th key={h}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {snap.ads.map((a, j) => (
                                      <tr key={a.id || j}>
                                        <td className="text-xs font-medium" style={{ color: C.text }}>{a.name || '—'}</td>
                                        <td>{a.hookStyle ? <span className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textMuted }}>{a.hookStyle}</span> : '—'}</td>
                                        <td className="mono text-xs" style={{ color: C.textSecondary }}>{a.metrics?.impressions?.toLocaleString() ?? '—'}</td>
                                        <td className="mono text-xs" style={{ color: C.textSecondary }}>{a.metrics?.spend ? formatCurrency(a.metrics.spend) : '—'}</td>
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
                  {pkg?.copyVariants?.length ? <div><p className="micro-label mb-3">Copy Variants</p><div className="grid md:grid-cols-3 gap-3">{pkg.copyVariants.map((v, i) => { const sel = i === (pkg.selectedCopyIndex ?? -1); return <div key={i} className="rounded-xl p-4 space-y-2" style={{ background: sel ? C.surface : C.surfaceMuted, border: sel ? `2px solid ${C.green}` : `1px solid ${C.border}` }}><div className="flex gap-2 flex-wrap">{sel && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: C.greenBg, color: C.green }}>Selected</span>}{v.hookStyle && <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: C.surfaceMuted, color: C.textMuted }}>{v.hookStyle}</span>}</div>{v.headline && <p className="text-sm font-semibold" style={{ color: C.text }}>{v.headline}</p>}<p className="text-xs leading-relaxed" style={{ color: C.textSecondary }}>{v.primaryText}</p>{v.cta && <span className="inline-block text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: C.accentLight, color: C.accent }}>CTA: {v.cta}</span>}</div> })}</div></div> : null}
                  <div>
                    <p className="micro-label mb-3">Images</p>
                    {pkgLoading ? <Loader2 size={14} className="animate-spin" style={{ color: C.textMuted }} /> : (pkg?.images ?? []).length > 0 ? (
                      <div className="grid grid-cols-3 gap-4">{pkg!.images!.map((img, i) => { const sel = i === (pkg!.selectedCopyIndex ?? 0); const s = imgState[i] || 'idle'; return <div key={i} className="space-y-2"><div className="relative rounded-xl overflow-hidden" style={{ border: sel ? `2px solid ${C.green}` : `1px solid ${C.border}` }}>{sel && <span className="absolute top-2 left-2 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: C.green, color: '#fff' }}>Selected</span>}{s === 'polling' && <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(23,20,15,0.55)' }}><Loader2 size={20} className="animate-spin" style={{ color: C.accent }} /></div>}{img.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img.imageUrl} alt={`V${i+1}`} className="w-full" style={{ maxHeight: 280, objectFit: 'contain', display: 'block' }} /> : <div className="flex items-center justify-center" style={{ height: 180, background: C.surfaceMuted }}><p className="text-[10px]" style={{ color: C.textMuted }}>V{i+1}</p></div>}</div>{img.imagePrompt && <details><summary className="text-[10px] cursor-pointer" style={{ color: C.textMuted }}>Prompt</summary><p className="text-[10px] font-mono mt-1 p-2 rounded-lg" style={{ background: C.surfaceMuted, color: C.textSecondary }}>{img.imagePrompt}</p></details>}<div className="flex gap-1.5"><button onClick={() => rerollImg(i)} disabled={s !== 'idle'} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.border}` }}><RefreshCw size={10} className={s === 'loading' ? 'animate-spin' : ''} />{s === 'idle' ? 'Re-roll' : 'Working…'}</button><button onClick={() => newImgPrompt(i)} disabled={s !== 'idle'} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40" style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accentBorder}` }}><Sparkles size={10} />New prompt</button></div></div> })}</div>
                    ) : <div className="py-10 text-center rounded-xl" style={{ background: C.surfaceMuted, border: `2px dashed ${C.border}` }}><p className="text-xs" style={{ color: C.textMuted }}>No images</p></div>}
                  </div>
                  {(pkg?.video?.videoUrl || pkg?.video?.videoPrompt) && <div className="pt-5" style={{ borderTop: `1px solid ${C.borderLight}` }}><div className="flex items-center justify-between mb-3"><p className="micro-label">Video</p><div className="flex gap-1.5"><button onClick={rerollVid} disabled={vidRetry !== 'idle' || vidRewrite !== 'idle'} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-40" style={{ background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.border}` }}><RefreshCw size={10} className={cn('inline mr-1', vidRetry !== 'idle' && 'animate-spin')} />{vidRetry === 'idle' ? 'Re-roll' : 'Working…'}</button><button onClick={rewriteVid} disabled={vidRewrite !== 'idle' || vidRetry !== 'idle'} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-40" style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accentBorder}` }}><Sparkles size={10} className={cn('inline mr-1', vidRewrite !== 'idle' && 'animate-spin')} />{vidRewrite === 'idle' ? 'Rewrite' : 'Working…'}</button></div></div>{pkg.video?.videoUrl ? <video controls className="rounded-xl w-full" style={{ maxHeight: 320, border: `1px solid ${C.border}` }}><source src={pkg.video.videoUrl} type="video/mp4" /></video> : <p className="text-xs font-mono p-3 rounded-lg" style={{ background: C.surfaceMuted, color: C.textSecondary }}>{vidRetry === 'polling' ? 'Generating…' : pkg.video?.videoPrompt}</p>}{pkg.video?.videoPrompt && pkg.video?.videoUrl && <details className="mt-2"><summary className="text-[10px] cursor-pointer" style={{ color: C.textMuted }}>Prompt</summary><p className="text-[10px] font-mono mt-1 p-3 rounded-lg" style={{ background: C.surfaceMuted, color: C.textSecondary }}>{pkg.video.videoPrompt}</p></details>}</div>}
                  {pkg?.complianceNotes && <div className="rounded-xl px-4 py-3" style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}` }}><p className="text-xs font-bold mb-1" style={{ color: C.amber }}>Compliance</p><p className="text-xs leading-relaxed" style={{ color: C.amber }}>{pkg.complianceNotes}</p></div>}
                </div>
              </div>
            </Tabs.Content>
          )}
        </Tabs.Root>
      </div>
    </div>
  )
}
