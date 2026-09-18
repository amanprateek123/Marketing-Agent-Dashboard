'use client'

import {
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FileCheck2,
  Globe2,
  Image as ImageIcon,
  IndianRupee,
  Loader2,
  MapPin,
  MessageCircleMore,
  MessageSquarePlus,
  Package,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
  WandSparkles,
} from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CampaignQueries } from '@/components/intelligence/CampaignQueries'
import {
  confirmCampaignCopilotSession,
  getCampaignCopilotSession,
  sendCampaignCopilotMessage,
  startCampaignCopilotSession,
} from '@/lib/api'
import type {
  CampaignCopilotMessage,
  CampaignCopilotMissingField,
  CampaignCopilotPlan,
  CampaignCopilotRecommendations,
  CampaignCopilotSession,
  CampaignCopilotSessionResponse,
} from '@/types'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

type UnknownRecord = Record<string, unknown>

interface PlanCardItem {
  key: string
  label: string
  value: string
  detail?: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
}

interface RecommendationItem {
  key: string
  label: string
  value: string
  reason?: string
}

const STARTER_PROMPTS = [
  'Build a purchase campaign for Nadi Astrology',
  'I want more awareness for one of my products',
  'Recommend the best goal, audience and budget for me',
]

const OBJECTIVE_LABELS: Record<string, string> = {
  sales_purchase: 'Sales · purchases',
  leads: 'Lead generation',
  traffic: 'Website traffic',
  engagement: 'Engagement',
  awareness_reach: 'Awareness · reach',
  awareness: 'Awareness',
  reach: 'Reach',
  app_promotion: 'App promotion',
}

const FIELD_LABELS: Record<string, string> = {
  productName: 'Product',
  product: 'Product',
  productMode: 'Existing or new product',
  landingUrl: 'Landing page',
  pageId: 'Facebook Page',
  accountId: 'Meta ad account',
  objective: 'Campaign goal',
  optimizationGoal: 'Delivery optimization',
  dailyBudget: 'Daily budget',
  budget: 'Daily budget',
  audienceType: 'Audience approach',
  audienceName: 'Audience',
  targetSegment: 'Target customer',
  geoLocations: 'Locations',
  language: 'Language',
  creativeFormat: 'Creative format',
  conversionEvent: 'Conversion event',
  conversionValue: 'Conversion value',
  pixelId: 'Meta Pixel',
  customConversionId: 'Custom conversion',
  appPlatform: 'App platform',
  metaAppId: 'Meta app',
  metaAppStoreUrl: 'App store page',
}

function createClientMessageId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function isSessionRecord(value: UnknownRecord): boolean {
  return (
    Array.isArray(value.messages) &&
    (typeof value.status === 'string' ||
      typeof value.sessionId === 'string' ||
      typeof value.id === 'string' ||
      typeof value._id === 'string')
  )
}

/** Browser persistence is optional; it must never change a request's outcome. */
function readStoredSessionId(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function storeSessionId(key: string, sessionId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, sessionId)
  } catch {
    // The server session remains durable when storage is blocked or unavailable.
  }
}

function forgetStoredSessionId(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Starting a fresh in-memory conversation must still work without storage.
  }
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function fieldLabel(value: string): string {
  return FIELD_LABELS[value] ?? humanize(value)
}

function objectiveLabel(value?: string | null): string {
  if (!value) return ''
  return OBJECTIVE_LABELS[value] ?? humanize(value)
}

function formatMoney(value: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `₹${Math.round(value).toLocaleString('en-IN')}`
  }
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string') return humanize(value)
  if (typeof value === 'number') return value.toLocaleString('en-IN')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(', ')
  if (isRecord(value)) {
    return Object.values(value).map(displayValue).filter(Boolean).join(' · ')
  }
  return String(value)
}

function sessionIdOf(session: CampaignCopilotSession | null): string | null {
  if (!session) return null
  const id = session.sessionId ?? session.id ?? session._id
  return typeof id === 'string' && id ? id : null
}

function normalizeMessage(value: unknown, index: number): CampaignCopilotMessage | null {
  if (!isRecord(value)) return null
  const rawContent = value.content ?? value.text ?? value.message
  if (typeof rawContent !== 'string' || !rawContent.trim()) return null
  const rawRole = typeof value.role === 'string' ? value.role : 'assistant'
  return {
    id:
      typeof value.id === 'string'
        ? value.id
        : typeof value._id === 'string'
          ? value._id
          : `message-${index}`,
    role: rawRole,
    content: rawContent,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
  }
}

/** Accept both a direct session and the wrapped shapes used by older builds. */
function normalizeSession(
  payload: CampaignCopilotSessionResponse,
  fallback?: CampaignCopilotSession | null,
): CampaignCopilotSession {
  const outer = isRecord(payload) ? payload : {}
  // Prefer an actual direct session before inspecting legacy wrapper keys. This
  // avoids mistaking an unrelated, future `session` extension field for the
  // response envelope.
  const nested = isSessionRecord(outer)
    ? outer
    : isRecord(outer.session)
      ? outer.session
      : isRecord(outer.data)
        ? outer.data
        : outer

  const nestedMessages: unknown[] | null = Array.isArray(nested.messages)
    ? nested.messages
    : null
  const responseMessages = nestedMessages
    ? nestedMessages
        .map((message, index) => normalizeMessage(message, index))
        .filter((message): message is CampaignCopilotMessage => message !== null)
    : []

  const messages = nestedMessages
    ? responseMessages
    : [...(fallback?.messages ?? [])]

  const reply =
    typeof outer.assistantMessage === 'string'
      ? outer.assistantMessage
      : typeof outer.reply === 'string'
        ? outer.reply
        : null
  if (reply && !messages.some((message) => message.content === reply)) {
    messages.push({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: reply,
      createdAt: new Date().toISOString(),
    })
  }

  const status =
    typeof nested.status === 'string'
      ? nested.status
      : fallback?.status ?? 'collecting'

  const sessionId =
    typeof nested.sessionId === 'string'
      ? nested.sessionId
      : typeof nested.id === 'string'
        ? nested.id
        : typeof nested._id === 'string'
          ? nested._id
          : sessionIdOf(fallback ?? null) ?? undefined

  return {
    ...(fallback ?? {}),
    ...nested,
    sessionId,
    status,
    messages,
    // An explicit null is a server instruction to clear stale plan cards. Only
    // an omitted (or malformed) field inherits the previous partial response.
    plan: nested.plan === null
      ? null
      : isRecord(nested.plan)
        ? (nested.plan as CampaignCopilotPlan)
        : fallback?.plan ?? null,
    recommendations:
      nested.recommendations === null
        ? undefined
        : Array.isArray(nested.recommendations) || isRecord(nested.recommendations)
          ? (nested.recommendations as CampaignCopilotSession['recommendations'])
          : fallback?.recommendations,
    readiness:
      nested.readiness === null
        ? undefined
        : isRecord(nested.readiness)
          ? (nested.readiness as CampaignCopilotSession['readiness'])
          : fallback?.readiness,
    build: isRecord(nested.build)
      ? (nested.build as CampaignCopilotSession['build'])
      : nested.build === null
        ? null
        : fallback?.build,
    campaignId:
      typeof nested.campaignId === 'string'
        ? nested.campaignId
        : hasOwn(nested, 'campaignId')
          ? undefined
          : fallback?.campaignId,
    error:
      typeof nested.error === 'string'
        ? nested.error
        : hasOwn(nested, 'error')
          ? undefined
          : fallback?.error,
  }
}

function makePlanCards(plan?: CampaignCopilotPlan | null): PlanCardItem[] {
  if (!plan) return []
  const cards: PlanCardItem[] = []

  if (plan.campaignName) {
    cards.push({
      key: 'campaign',
      label: 'Campaign',
      value: plan.campaignName,
      icon: WandSparkles,
    })
  }

  if (plan.productName || plan.newProduct?.description) {
    const currency = plan.newProduct?.currency ?? 'INR'
    const price = plan.newProduct?.price
    cards.push({
      key: 'product',
      label: 'Product',
      value: plan.productName || 'New product',
      detail: [
        plan.productMode === 'new' ? 'Will be added to Meridian' : 'Existing product',
        typeof price === 'number' ? formatMoney(price, currency ?? 'INR') : '',
      ].filter(Boolean).join(' · '),
      icon: Package,
    })
  }

  if (plan.objective) {
    cards.push({
      key: 'objective',
      label: 'Goal',
      value: objectiveLabel(plan.objective),
      detail: [
        plan.optimizationGoal ? `Optimize for ${humanize(plan.optimizationGoal).toLowerCase()}` : '',
        plan.funnelStage ? `${humanize(plan.funnelStage)}-audience stage` : '',
      ].filter(Boolean).join(' · ') || undefined,
      icon: Target,
    })
  }

  const dailyBudget = plan.dailyBudget ?? plan.requestedDailyBudget
  if (typeof dailyBudget === 'number') {
    const changed =
      typeof plan.requestedDailyBudget === 'number' &&
      typeof plan.dailyBudget === 'number' &&
      plan.requestedDailyBudget !== plan.dailyBudget
    cards.push({
      key: 'budget',
      label: 'Daily budget',
      value: `${formatMoney(dailyBudget)}/day`,
      detail: [
        `${formatMoney(dailyBudget * 7)}/7 days`,
        changed
          ? `Safety-adjusted from ${formatMoney(plan.requestedDailyBudget as number)}/day`
          : 'No Meta ad spend until approval',
      ].join(' · '),
      icon: IndianRupee,
    })
  }

  const audience = plan.audienceName || plan.targetSegment || plan.audienceType
  if (audience) {
    cards.push({
      key: 'audience',
      label: 'Audience',
      value: humanize(audience),
      detail: [
        plan.audienceName && plan.targetSegment ? plan.targetSegment : '',
        plan.audienceType ? humanize(plan.audienceType) : '',
        plan.metaAudienceId ? `Audience ID ${plan.metaAudienceId}` : '',
      ].filter(Boolean).join(' · '),
      icon: UsersRound,
    })
  }

  if (plan.geoLocations?.length || plan.language) {
    cards.push({
      key: 'market',
      label: 'Market',
      value: plan.geoLocations?.length ? plan.geoLocations.join(', ') : 'Locations to be decided',
      detail: plan.language ? `${humanize(plan.language)} creative` : undefined,
      icon: MapPin,
    })
  }

  if (plan.landingUrl) {
    cards.push({
      key: 'landing',
      label: 'Landing page',
      value: plan.landingUrl,
      icon: Globe2,
    })
  }

  const effectivePageId = plan.pageId ?? plan.newProduct?.pageId
  if (effectivePageId) {
    cards.push({
      key: 'page',
      label: 'Facebook Page',
      value: effectivePageId,
      detail: 'Identity used for the ad',
      icon: FileCheck2,
    })
  }

  const tracking = plan.newProduct
  if (
    plan.conversionEvent ||
    plan.conversionValue != null ||
    tracking?.conversionEvent ||
    tracking?.conversionValue != null ||
    tracking?.pixelId ||
    tracking?.customConversionId
  ) {
    const currency = tracking?.currency ?? 'INR'
    const conversionEvent = plan.conversionEvent ?? tracking?.conversionEvent
    const conversionValue = plan.conversionValue ?? tracking?.conversionValue
    cards.push({
      key: 'tracking',
      label: 'Conversion tracking',
      value: conversionEvent
        ? humanize(conversionEvent)
        : 'Configured conversion',
      detail: [
        tracking?.pixelId ? `Pixel ${tracking.pixelId}` : '',
        tracking?.customConversionId
          ? `Custom conversion ${tracking.customConversionId}`
          : '',
        typeof conversionValue === 'number'
          ? `Value ${formatMoney(conversionValue, currency)}`
          : '',
      ].filter(Boolean).join(' · ') || undefined,
      icon: Target,
    })
  }

  if (
    plan.appPlatform ||
    plan.newProduct?.metaAppId ||
    plan.newProduct?.metaAppStoreUrl
  ) {
    cards.push({
      key: 'app',
      label: 'App delivery',
      value: plan.appPlatform ?? 'App platform',
      detail: [
        plan.newProduct?.metaAppId
          ? `Meta app ${plan.newProduct.metaAppId}`
          : '',
        plan.newProduct?.metaAppStoreUrl ?? '',
      ].filter(Boolean).join(' · ') || undefined,
      icon: Package,
    })
  }

  if (plan.creativeFormat || plan.angle || plan.keyMessage) {
    cards.push({
      key: 'creative',
      label: 'Creative direction',
      value: plan.creativeFormat ? humanize(plan.creativeFormat) : plan.angle || 'To be decided',
      detail: [plan.angle, plan.keyMessage].filter(Boolean).join(' · '),
      icon: ImageIcon,
    })
  }

  if (plan.accountId) {
    cards.push({
      key: 'account',
      label: 'Ad account',
      value: plan.accountId,
      icon: FileCheck2,
    })
  }

  return cards
}

function makeRecommendations(
  raw?: CampaignCopilotSession['recommendations'],
): RecommendationItem[] {
  if (!raw) return []

  if (Array.isArray(raw)) {
    return raw.map((item, index) => {
      if (typeof item === 'string') {
        return { key: `recommendation-${index}`, label: 'Recommendation', value: item }
      }
      const value = item.value ?? item.suggestion ?? item.recommendation
      return {
        key: item.field ?? `recommendation-${index}`,
        label: item.label ?? item.title ?? fieldLabel(item.field ?? 'Recommendation'),
        value: displayValue(value) || item.reason || item.rationale || 'Suggested by Meridian',
        reason: item.reason ?? item.rationale,
      }
    })
  }

  const recommendations = raw as CampaignCopilotRecommendations
  const items: RecommendationItem[] = []
  if (recommendations.budget?.dailyBudget != null) {
    const max = recommendations.budget.maxAllowed
    items.push({
      key: 'budget',
      label: 'Suggested budget',
      value: `${formatMoney(recommendations.budget.dailyBudget)}/day`,
      reason: [
        recommendations.budget.rationale,
        typeof max === 'number' ? `Safety limit ${formatMoney(max)}/day` : '',
      ].filter(Boolean).join(' · '),
    })
  }
  if (recommendations.audience) {
    const audience = recommendations.audience
    const value = audience.name || audience.targetSegment || audience.type
    if (value) {
      items.push({
        key: 'audience',
        label: 'Suggested audience',
        value: humanize(value),
        reason: audience.rationale ?? undefined,
      })
    }
  }
  if (recommendations.objective) {
    items.push({
      key: 'objective',
      label: 'Suggested goal',
      value: objectiveLabel(recommendations.objective),
    })
  }
  if (recommendations.creativeFormat) {
    items.push({
      key: 'creative',
      label: 'Suggested creative',
      value: humanize(recommendations.creativeFormat),
    })
  }
  return items
}

function getMissingFields(
  session: CampaignCopilotSession | null,
): Array<string | CampaignCopilotMissingField> {
  if (!session) return []
  if (session.readiness?.missingFields?.length) return session.readiness.missingFields
  return session.missingFields ?? []
}

function missingFieldText(item: string | CampaignCopilotMissingField): string {
  if (typeof item === 'string') return fieldLabel(item)
  return item.label ?? item.question ?? fieldLabel(item.field ?? 'Required detail')
}

function relativeUpdate(date?: string): string {
  if (!date) return 'just now'
  const time = new Date(date).getTime()
  if (!Number.isFinite(time)) return 'just now'
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000))
  if (seconds < 15) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function statusDetails(status?: string): { label: string; chip: string; pulse?: boolean } {
  switch (status) {
    case 'ready':
      return { label: 'Ready to prepare', chip: 'chip-good' }
    case 'build_queued':
      return { label: 'Build queued', chip: 'chip-accent', pulse: true }
    case 'building':
      return { label: 'Preparing campaign', chip: 'chip-accent', pulse: true }
    case 'pending_approval':
      return { label: 'Ready for approval', chip: 'chip-good' }
    case 'failed':
      return { label: 'Build needs attention', chip: 'chip-bad' }
    case 'cancelled':
      return { label: 'Conversation cancelled', chip: 'chip-neutral' }
    default:
      return { label: 'Planning together', chip: 'chip-info', pulse: true }
  }
}

const JOURNEY_STEPS = [
  {
    label: 'Share the goal',
    detail: 'Product and outcome',
  },
  {
    label: 'Shape the strategy',
    detail: 'Budget, audience and creative',
  },
  {
    label: 'Pass safety checks',
    detail: 'Tracking and spend controls',
  },
  {
    label: 'Prepare for approval',
    detail: 'You decide before launch',
  },
]

function JourneyRail({ stage }: { stage: number }) {
  return (
    <nav
      aria-label="Campaign creation progress"
      className="card overflow-hidden mb-5 animate-fade-up"
    >
      <ol
        className="grid grid-cols-2 lg:grid-cols-4 gap-px"
        style={{ background: 'var(--hairline-light)' }}
      >
        {JOURNEY_STEPS.map((step, index) => {
          const complete = index < stage
          const active = index === stage
          return (
            <li
              key={step.label}
              className="relative flex items-center gap-3 px-4 py-3.5 min-w-0"
              style={{
                background: active ? 'var(--accent-bg)' : 'var(--surface)',
              }}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all"
                style={{
                  background: complete
                    ? 'var(--good)'
                    : active
                      ? 'var(--accent)'
                      : 'var(--muted)',
                  color: complete || active ? '#fff' : 'var(--ink-3)',
                  boxShadow: active ? 'var(--glow-accent)' : undefined,
                }}
              >
                {complete ? <Check size={13} /> : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className="block text-xs font-semibold truncate"
                  style={{ color: active ? 'var(--accent-strong)' : 'var(--ink)' }}
                >
                  {step.label}
                </span>
                <span className="block text-[10.5px] truncate" style={{ color: 'var(--ink-3)' }}>
                  {step.detail}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function ChatMessage({ message }: { message: CampaignCopilotMessage }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="chip chip-neutral max-w-[90%] text-center">{message.content}</span>
      </div>
    )
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} animate-feed-in`}>
      {!isUser && (
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
        >
          <Bot size={15} style={{ color: 'var(--accent)' }} />
        </div>
      )}
      <div className={`max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words"
          style={
            isUser
              ? {
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: '14px 14px 4px 14px',
                  boxShadow: 'var(--shadow-soft)',
                }
              : {
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                  border: '1px solid var(--hairline)',
                  borderRadius: '14px 14px 14px 4px',
                  boxShadow: 'var(--shadow-soft)',
                }
          }
        >
          {message.content}
        </div>
        {message.createdAt && (
          <span className="text-[10px] mt-1 px-1" style={{ color: 'var(--ink-4)' }}>
            {relativeUpdate(message.createdAt)}
          </span>
        )}
      </div>
      {isUser && (
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}
        >
          <UserRound size={14} style={{ color: 'var(--ink-2)' }} />
        </div>
      )}
    </div>
  )
}

function BuildingProgress({ session }: { session: CampaignCopilotSession }) {
  const queued = session.status === 'build_queued'
  const steps = [
    { label: 'Brief confirmed', state: 'done' },
    { label: 'Build job queued', state: queued ? 'active' : 'done' },
    { label: 'Creative and campaign build', state: queued ? 'waiting' : 'active' },
    { label: 'Save for your approval', state: 'waiting' },
  ]

  return (
    <div
      className="mx-4 sm:mx-6 mb-4 rounded-xl p-4"
      style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Loader2 size={15} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--accent-strong)' }}>
            {queued ? 'Your campaign is in the build queue' : 'Meridian is preparing your campaign'}
          </p>
        </div>
        <span className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>
          Updates automatically
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-1.5 min-w-0">
            {step.state === 'done' ? (
              <CheckCircle2 size={13} className="shrink-0" style={{ color: 'var(--good)' }} />
            ) : step.state === 'active' ? (
              <Loader2 size={13} className="animate-spin shrink-0" style={{ color: 'var(--accent)' }} />
            ) : (
              <Circle size={12} className="shrink-0" style={{ color: 'var(--ink-4)' }} />
            )}
            <span
              className="text-[11px] truncate"
              style={{ color: step.state === 'waiting' ? 'var(--ink-3)' : 'var(--ink-2)' }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanCard({ item }: { item: PlanCardItem }) {
  const Icon = item.icon
  const primary = ['objective', 'budget', 'audience'].includes(item.key)
  return (
    <div
      className="rounded-xl p-3.5 transition-all"
      style={{
        background: primary ? 'var(--accent-bg)' : 'var(--paper)',
        border: `1px solid ${primary ? 'var(--accent-border)' : 'var(--hairline-light)'}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: 'var(--surface)',
            border: `1px solid ${primary ? 'var(--accent-border)' : 'var(--hairline)'}`,
          }}
        >
          <Icon size={14} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="min-w-0">
          <p className="micro-label">{item.label}</p>
          <p
            className={`text-sm font-semibold mt-0.5 ${item.key === 'landing' ? 'break-all' : 'break-words'}`}
            style={{ color: 'var(--ink)' }}
          >
            {item.value}
          </p>
          {item.detail && (
            <p className="text-[11px] leading-relaxed mt-1 break-words" style={{ color: 'var(--ink-3)' }}>
              {item.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CampaignCopilotPage({ params }: PageProps) {
  const { tenantId } = use(params)
  const storageKey = `campaign_copilot_session_${tenantId}`
  const [session, setSession] = useState<CampaignCopilotSession | null>(null)
  const [input, setInput] = useState('')
  const [restoring, setRestoring] = useState(true)
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  /** 'planner' builds a new campaign; 'queries' explains ones already running. */
  const [mode, setMode] = useState<'planner' | 'queries'>('planner')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const threadEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const submittingRef = useRef(false)
  const pendingTurnRef = useRef<{
    message: string
    clientMessageId: string
    sessionId: string | null
  } | null>(null)

  const activeSessionId = sessionIdOf(session)
  const status = session?.status ?? 'collecting'
  const isBuilding = status === 'build_queued' || status === 'building'
  const isComplete = status === 'pending_approval'
  const isTerminal = isComplete || status === 'cancelled'
  const detailsComplete = session?.readiness?.ready === true
  // Confirmation is a server-controlled state transition. A locally complete
  // looking plan is not enough: both server readiness and the durable session
  // status must agree before the button exists.
  const readyToConfirm = status === 'ready' && detailsComplete
  const readinessOutOfSync =
    (status === 'ready' && !detailsComplete) ||
    (status === 'collecting' && detailsComplete)
  const planCards = useMemo(() => makePlanCards(session?.plan), [session?.plan])
  const recommendations = useMemo(
    () => makeRecommendations(session?.recommendations),
    [session?.recommendations],
  )
  const missingFields = useMemo(() => getMissingFields(session), [session])
  const blockers = session?.readiness?.blockers ?? []
  const warnings = session?.readiness?.warnings ?? []
  const campaignId = session?.build?.campaignId ?? session?.campaignId
  const statusMeta = readinessOutOfSync
    ? {
        label: status === 'ready' ? 'Details need review' : 'Finalizing plan',
        chip: 'chip-warn',
      }
    : statusDetails(session?.status)
  const canChat = !sending && !confirming && !isBuilding && !isTerminal
  const journeyStage = isComplete
    ? JOURNEY_STEPS.length
    : isBuilding || readyToConfirm
      ? 3
      : detailsComplete || status === 'ready'
        ? 2
        : session?.messages.length
          ? 1
          : 0

  function remember(next: CampaignCopilotSession) {
    setSession(next)
    const id = sessionIdOf(next)
    if (id) storeSessionId(storageKey, id)
  }

  useEffect(() => {
    let cancelled = false
    const saved = readStoredSessionId(storageKey)
    if (!saved) {
      setRestoring(false)
      return
    }

    getCampaignCopilotSession(tenantId, saved)
      .then((payload) => {
        if (!cancelled) remember(normalizeSession(payload))
      })
      .catch((caught) => {
        if (!cancelled) {
          const message = caught instanceof Error ? caught.message : ''
          if (message.startsWith('404 ')) {
            forgetStoredSessionId(storageKey)
            setError('The previous conversation no longer exists. You can start a new one below.')
          } else {
            // Keep the durable session id on transient network/server errors;
            // removing it here would turn a temporary restore failure into a
            // permanently orphaned build from the browser's point of view.
            setError('The previous conversation could not be restored right now. Reload to retry, or start a new conversation below.')
          }
        }
      })
      .finally(() => {
        if (!cancelled) setRestoring(false)
      })

    return () => {
      cancelled = true
    }
    // `remember` only writes the response into state/localStorage. Depending on
    // it would restart the restore whenever a session update re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, tenantId])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [session?.messages.length, sending, status])

  useEffect(() => {
    if (!activeSessionId || !isBuilding) return
    let cancelled = false

    async function poll() {
      try {
        const payload = await getCampaignCopilotSession(tenantId, activeSessionId as string)
        if (cancelled) return
        setSession((current) => normalizeSession(payload, current))
        setPollError('')
      } catch {
        if (!cancelled) setPollError('Could not refresh build progress. Retrying automatically…')
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), 3_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeSessionId, isBuilding, tenantId])

  async function submitMessage(explicitMessage?: string) {
    const message = (explicitMessage ?? input).trim()
    if (!message || !canChat || submittingRef.current) return

    submittingRef.current = true
    setSending(true)
    setError('')
    setPollError('')
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const currentId = sessionIdOf(session)
    const pendingTurn = pendingTurnRef.current
    const clientMessageId =
      pendingTurn?.message === message && pendingTurn.sessionId === currentId
        ? pendingTurn.clientMessageId
        : createClientMessageId()
    pendingTurnRef.current = {
      message,
      clientMessageId,
      sessionId: currentId,
    }
    const previousSession = session
    const optimistic: CampaignCopilotSession = {
      ...(session ?? { status: 'collecting', messages: [] }),
      status: session?.status ?? 'collecting',
      messages: [
        ...(session?.messages ?? []),
        {
          id: `local-${Date.now()}`,
          role: 'user',
          content: message,
          createdAt: new Date().toISOString(),
        },
      ],
    }
    setSession(optimistic)

    try {
      const payload = currentId
        ? await sendCampaignCopilotMessage(
            tenantId,
            currentId,
            message,
            clientMessageId,
          )
        : await startCampaignCopilotSession(
            tenantId,
            message,
            clientMessageId,
          )
      remember(normalizeSession(payload, optimistic))
      pendingTurnRef.current = null
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Campaign Copilot could not reply. Please try again.')
      setSession(previousSession)
      setInput(message)
    } finally {
      submittingRef.current = false
      setSending(false)
    }
  }

  async function confirmPlan() {
    const id = sessionIdOf(session)
    if (!id || !readyToConfirm || confirming) return
    setConfirming(true)
    setError('')
    try {
      const payload = await confirmCampaignCopilotSession(tenantId, id)
      remember(normalizeSession(payload, session))
      setConfirmOpen(false)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : ''
      if (message.includes('409')) {
        try {
          const latest = await getCampaignCopilotSession(tenantId, id)
          remember(normalizeSession(latest, session))
        } catch {
          // Keep the plan already on screen; the next chat turn can refresh it.
        }
        setConfirmOpen(false)
        setError('The plan changed before confirmation. I refreshed it—please review the latest details before preparing.')
      } else {
        setError(message || 'The campaign build could not be started.')
      }
    } finally {
      setConfirming(false)
    }
  }

  function newConversation() {
    if (isBuilding && !window.confirm('This build will continue in the background. Start a new conversation anyway?')) {
      return
    }
    forgetStoredSessionId(storageKey)
    submittingRef.current = false
    pendingTurnRef.current = null
    setSession(null)
    setInput('')
    setError('')
    setPollError('')
    setConfirmOpen(false)
    textareaRef.current?.focus()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitMessage()
  }

  const placeholder = isBuilding
    ? 'Your campaign is being prepared…'
    : isComplete
      ? 'This campaign is ready for your approval'
      : status === 'failed'
        ? 'Ask Copilot to retry or describe what should change…'
        : detailsComplete
          ? 'Ask why, request a change, or prepare the campaign…'
          : 'Describe the product and outcome you want…'

  if (restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div
          className="card px-6 py-5 flex items-center gap-3 text-sm animate-fade-in"
          style={{ color: 'var(--ink-2)' }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
          >
            <Loader2 size={17} className="animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>Opening your campaign workspace</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
              Restoring the latest strategy and conversation…
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto">
        <header className="mb-5 flex items-start justify-between gap-5 flex-wrap animate-fade-up">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="micro-label">AI campaign workspace</span>
              <span className="chip chip-accent">
                <Sparkles size={10} /> Guided by Meridian
              </span>
            </div>
            <h1 className="page-title">
              {mode === 'planner'
                ? 'Turn a growth goal into a launch-ready campaign'
                : 'Ask anything about the ads you are already running'}
            </h1>
            <p className="page-subtitle max-w-3xl">
              {mode === 'planner'
                ? 'Start with one sentence. Meridian shapes the strategy, fills the gaps with you, and prepares everything for a safe human-approved launch.'
                : 'Questions about any campaign, running or paused. Answers come only from figures recorded in your ad account — and you can see exactly which campaign is being read.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Planner builds something new; Queries explains what already ran.
                They share this workspace but no state — switching never
                disturbs a plan in progress. */}
            <div
              role="tablist"
              aria-label="Copilot mode"
              className="flex items-center gap-0.5 rounded-lg p-0.5"
              style={{ background: 'var(--muted)' }}
            >
              {(
                [
                  ['planner', 'Plan a campaign'],
                  ['queries', 'Ask about ads'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className="rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all"
                  style={
                    mode === key
                      ? { background: 'var(--surface)', color: 'var(--accent-strong)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                      : { background: 'transparent', color: 'var(--ink-3)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === 'planner' && (
              <button type="button" onClick={newConversation} className="btn btn-ghost">
                <MessageSquarePlus size={15} />
                New conversation
              </button>
            )}
          </div>
        </header>

        {mode === 'queries' && <CampaignQueries tenantId={tenantId} />}

        {mode === 'planner' && (
          <>
        <JourneyRail stage={journeyStage} />

        {(error || pollError) && (
          <div
            className="mb-4 rounded-xl px-4 py-3 flex items-start gap-3"
            style={{
              background: error ? 'var(--bad-bg)' : 'var(--warn-bg)',
              border: `1px solid ${error ? 'var(--bad-border)' : 'var(--warn-border)'}`,
            }}
            role={error ? 'alert' : 'status'}
          >
            <AlertCircle
              size={16}
              className="shrink-0 mt-0.5"
              style={{ color: error ? 'var(--bad)' : 'var(--warn)' }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm" style={{ color: error ? 'var(--bad)' : 'var(--warn)' }}>
                {error || pollError}
              </p>
            </div>
            {isBuilding && pollError && (
              <button
                type="button"
                onClick={() => {
                  if (!activeSessionId) return
                  getCampaignCopilotSession(tenantId, activeSessionId)
                    .then((payload) => {
                      remember(normalizeSession(payload, session))
                      setPollError('')
                    })
                    .catch(() => {})
                }}
                className="text-xs font-semibold flex items-center gap-1"
                style={{ color: 'var(--warn)' }}
              >
                <RefreshCw size={12} /> Retry
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(370px,0.82fr)] gap-5 items-start">
          <section
            className="card overflow-hidden flex flex-col min-h-[650px] xl:h-[calc(100vh-260px)] xl:min-h-[650px] xl:max-h-[860px] animate-fade-up"
            aria-label="Campaign Copilot chat"
          >
            <div
              className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3"
              style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surface-warm)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--accent)', color: '#fff', boxShadow: 'var(--glow-accent)' }}
                >
                  <BrainCircuit size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Meridian Campaign Copilot</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                    Your strategy partner—not another complex Meta form
                  </p>
                </div>
              </div>
              <span className={`chip ${statusMeta.chip} shrink-0`}>
                {statusMeta.pulse && <span className="beacon" style={{ width: 5, height: 5 }} />}
                {statusMeta.label}
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5" style={{ background: 'var(--paper)' }}>
              {!session?.messages.length ? (
                <div className="h-full min-h-[430px] flex items-center justify-center">
                  <div className="max-w-2xl text-center animate-fade-up">
                    <div
                      className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                      style={{
                        background: 'var(--accent-bg)',
                        border: '1px solid var(--accent-border)',
                        boxShadow: 'var(--glow-accent)',
                      }}
                    >
                      <MessageCircleMore size={28} style={{ color: 'var(--accent)' }} />
                    </div>
                    <span className="chip chip-good mb-3">
                      <Check size={10} /> No Meta Ads expertise needed
                    </span>
                    <h2 className="font-display text-[24px]" style={{ color: 'var(--ink)' }}>
                      What do you want to grow?
                    </h2>
                    <p className="text-sm leading-relaxed mt-2 mx-auto max-w-md" style={{ color: 'var(--ink-3)' }}>
                      Share the product and outcome in your own words. Meridian will recommend the goal, budget, audience and creative direction—and explain every choice.
                    </p>
                    <div className="grid sm:grid-cols-3 gap-2.5 mt-6 text-left">
                      {STARTER_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void submitMessage(prompt)}
                          disabled={sending}
                          className="group text-left rounded-xl px-4 py-3.5 text-xs font-semibold transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
                          style={{
                            color: 'var(--ink)',
                            background: 'var(--surface)',
                            border: '1px solid var(--accent-border)',
                            boxShadow: 'var(--shadow-soft)',
                          }}
                        >
                          <span className="block leading-relaxed">{prompt}</span>
                          <span className="mt-2 flex items-center gap-1 font-medium" style={{ color: 'var(--accent)' }}>
                            Start here <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4" role="log" aria-live="polite" aria-relevant="additions">
                  {session.messages.map((message, index) => (
                    <ChatMessage key={message.id ?? `${message.role}-${index}`} message={message} />
                  ))}
                  {sending && (
                    <div className="flex gap-2.5 justify-start animate-feed-in" aria-live="polite">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
                      >
                        <Bot size={15} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div
                        className="px-4 py-3 rounded-xl flex items-center gap-1.5"
                        style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
                      >
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            className="w-1.5 h-1.5 rounded-full animate-pulse"
                            style={{ background: 'var(--accent)', animationDelay: `${dot * 140}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={threadEndRef} />
                </div>
              )}
            </div>

            {isBuilding && session && <BuildingProgress session={session} />}

            <form
              onSubmit={handleSubmit}
              className="p-3 sm:p-4"
              style={{ borderTop: '1px solid var(--hairline)', background: 'var(--surface)' }}
            >
              <div
                className="rounded-xl p-2 flex items-end gap-2 transition-shadow focus-within:ring-2"
                style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value)
                    event.currentTarget.style.height = 'auto'
                    event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 140)}px`
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      void submitMessage()
                    }
                  }}
                  disabled={!canChat}
                  rows={1}
                  maxLength={4000}
                  placeholder={placeholder}
                  aria-label="Message Campaign Copilot"
                  className="flex-1 resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed min-h-[40px] max-h-[140px] disabled:cursor-not-allowed"
                  style={{ color: 'var(--ink)', outline: 'none', boxShadow: 'none', border: 0 }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || !canChat}
                  aria-label="Send message"
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 mt-2 px-1">
                <p className="text-[10.5px]" style={{ color: 'var(--ink-4)' }}>
                  Enter to send · Shift + Enter for a new line
                </p>
                <p className="text-[10.5px]" style={{ color: 'var(--ink-4)' }}>
                  Preparing is safe · Meta launch always needs your approval
                </p>
              </div>
            </form>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Live campaign plan">
            <section className="card overflow-hidden animate-fade-up">
              <div
                className="px-4 py-3.5 flex items-center justify-between gap-3"
                style={{ background: 'var(--surface-warm)', borderBottom: '1px solid var(--hairline)' }}
              >
                <div className="flex items-center gap-2">
                  <FileCheck2 size={16} style={{ color: 'var(--accent)' }} />
                  <div>
                    <h2 className="section-title">Campaign blueprint</h2>
                    <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                      Strategy updates as you chat
                    </p>
                  </div>
                </div>
                {session && (
                  <span className="text-[10.5px]" style={{ color: 'var(--ink-4)' }}>
                    Updated {relativeUpdate(session.updatedAt)}
                  </span>
                )}
              </div>

              <div className="p-4 max-h-[calc(100vh-265px)] xl:min-h-[300px] overflow-y-auto">
                {session && !isBuilding && !isComplete && (
                  <div
                    className="rounded-xl px-3.5 py-3 mb-3 flex items-start gap-3"
                    style={{
                      background: detailsComplete ? 'var(--good-bg)' : 'var(--accent-bg)',
                      border: `1px solid ${detailsComplete ? 'var(--good-border)' : 'var(--accent-border)'}`,
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'var(--surface)' }}
                    >
                      {detailsComplete ? (
                        <ShieldCheck size={14} style={{ color: 'var(--good)' }} />
                      ) : (
                        <MessageCircleMore size={14} style={{ color: 'var(--accent)' }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                        {detailsComplete
                          ? 'The strategy has the required details'
                          : missingFields.length > 0
                            ? `${missingFields.length} decision${missingFields.length === 1 ? '' : 's'} left to make`
                            : 'Meridian is shaping your strategy'}
                      </p>
                      <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--ink-3)' }}>
                        {detailsComplete
                          ? 'Ask why, request any change, or continue to campaign preparation.'
                          : missingFields.length > 0
                            ? `Next: ${missingFields.slice(0, 2).map(missingFieldText).join(' and ')}${missingFields.length > 2 ? `, plus ${missingFields.length - 2} more` : ''}.`
                            : 'Keep chatting—only the information needed for a safe launch will be requested.'}
                      </p>
                    </div>
                  </div>
                )}

                {planCards.length === 0 ? (
                  <div className="py-10 text-center px-5">
                    <div
                      className="w-11 h-11 rounded-xl mx-auto flex items-center justify-center"
                      style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}
                    >
                      <FileCheck2 size={19} style={{ color: 'var(--ink-4)' }} />
                    </div>
                    <p className="text-sm font-semibold mt-3" style={{ color: 'var(--ink-2)' }}>
                      Your strategy will take shape here
                    </p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                      Goal, budget, audience, creative and tracking choices will update as you chat.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5">
                    {planCards.map((card) => <PlanCard key={card.key} item={card} />)}
                  </div>
                )}

                {session && (
                  <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--hairline-light)' }}>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <p className="micro-label">Launch readiness</p>
                      <span className={`chip ${detailsComplete ? 'chip-good' : 'chip-warn'}`}>
                        {detailsComplete ? <Check size={10} /> : <Clock3 size={10} />}
                        {detailsComplete
                          ? 'Complete'
                          : missingFields.length > 0
                            ? `${missingFields.length} needed`
                            : 'Needs review'}
                      </span>
                    </div>

                    {readinessOutOfSync && (
                      <div
                        className="flex items-start gap-2 rounded-lg px-3 py-2 mb-2"
                        style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
                      >
                        <AlertCircle size={12} className="shrink-0 mt-0.5" style={{ color: 'var(--warn)' }} />
                        <span className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                          {status === 'ready'
                            ? 'One final safety check needs to be refreshed. Ask Meridian to review the plan before preparing it.'
                            : 'The details are complete. Meridian is finishing the final validation before preparation.'}
                        </span>
                      </div>
                    )}

                    {missingFields.length > 0 ? (
                      <div className="space-y-1.5">
                        {missingFields.map((field, index) => (
                          <div
                            key={`${missingFieldText(field)}-${index}`}
                            className="flex items-center gap-2 rounded-lg px-3 py-2"
                            style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
                          >
                            <Circle size={10} className="shrink-0" style={{ color: 'var(--warn)' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
                              {missingFieldText(field)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{ background: detailsComplete ? 'var(--good-bg)' : 'var(--warn-bg)' }}
                      >
                        {detailsComplete ? (
                          <CheckCircle2 size={13} style={{ color: 'var(--good)' }} />
                        ) : (
                          <Clock3 size={13} style={{ color: 'var(--warn)' }} />
                        )}
                        <span
                          className="text-xs"
                          style={{ color: detailsComplete ? 'var(--good)' : 'var(--warn)' }}
                        >
                          {detailsComplete ? 'Required details collected' : 'I’ll list missing details as we plan'}
                        </span>
                      </div>
                    )}

                    {blockers.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        {blockers.map((blocker, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs" style={{ color: 'var(--bad)' }}>
                            <AlertCircle size={12} className="shrink-0 mt-0.5" />
                            <span>{typeof blocker === 'string' ? blocker : missingFieldText(blocker)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {recommendations.length > 0 && (
                  <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--hairline-light)' }}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                      <div>
                        <p className="micro-label">Meridian&apos;s strategy choices</p>
                        <p className="text-[10.5px]" style={{ color: 'var(--ink-4)' }}>
                          Recommendations you can question or change
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {recommendations.map((item) => (
                        <div
                          key={item.key}
                          className="rounded-xl px-3.5 py-3"
                          style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
                        >
                          <p className="text-[11px] font-semibold" style={{ color: 'var(--accent-strong)' }}>{item.label}</p>
                          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{item.value}</p>
                          {item.reason && (
                            <p className="text-[11px] leading-relaxed mt-1" style={{ color: 'var(--ink-3)' }}>{item.reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {warnings.map((warning, index) => (
                      <p key={index} className="text-[11px] flex items-start gap-1.5" style={{ color: 'var(--warn)' }}>
                        <AlertCircle size={11} className="shrink-0 mt-0.5" /> {warning}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {readyToConfirm && !isBuilding && !isComplete && (
                <div className="p-4" style={{ borderTop: '1px solid var(--hairline)', background: 'var(--surface-warm)' }}>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!activeSessionId}
                    className="btn btn-accent btn-lg w-full"
                  >
                    <WandSparkles size={16} />
                    Prepare campaign
                  </button>
                  <p className="text-[10.5px] text-center mt-2" style={{ color: 'var(--ink-3)' }}>
                    Builds the creative and campaign draft. Meta spend remains ₹0 until you approve.
                  </p>
                </div>
              )}
            </section>

            {isComplete && (
              <section
                className="rounded-xl p-4 animate-scale-in"
                style={{ background: 'var(--good-bg)', border: '1px solid var(--good-border)' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--surface)' }}
                  >
                    <ShieldCheck size={20} style={{ color: 'var(--good)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: 'var(--good)' }}>Campaign is ready for your decision</p>
                    <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--ink-2)' }}>
                      Meridian prepared the strategy and creative. It is saved for launch review, and no Meta ad spend has started.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Link href={`/dashboard/${tenantId}/approvals`} className="btn btn-accent">
                        Review &amp; decide <ArrowRight size={13} />
                      </Link>
                      {campaignId && (
                        <Link
                          href={`/dashboard/${tenantId}/campaigns/${campaignId}`}
                          className="btn btn-ghost"
                        >
                          Campaign details
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {status === 'failed' && (
              <section className="rounded-xl p-4" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}>
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--bad)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--bad)' }}>Campaign build did not finish</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                      Send a correction in the chat, or ask Copilot to retry. It will revalidate the plan and current safety limits before preparing it again.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </aside>
        </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Prepare this campaign?"
        description="Meridian will use the agreed plan to generate the creative package and save a campaign as pending approval. It will not launch on Meta or start ad spend yet."
        confirmLabel="Prepare campaign"
        cancelLabel="Keep editing"
        loading={confirming}
        onConfirm={() => void confirmPlan()}
        onCancel={() => !confirming && setConfirmOpen(false)}
      />
    </div>
  )
}
