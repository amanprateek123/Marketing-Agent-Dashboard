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
import { Details, type DetailsItem } from '@/components/plain/Details'
import {
  errorDetail,
  formatInr,
  formatRelative,
  humanise,
  plainStatus,
  toneChip,
} from '@/lib/plain-language'
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
  /** Internal Meta ids behind this card — shown only inside a collapsed Details block. */
  refs?: DetailsItem[]
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

const FIELD_LABELS: Record<string, string> = {
  productName: 'Product',
  product: 'Product',
  productMode: 'Existing or new product',
  landingUrl: 'Landing page',
  pageId: 'Facebook Page',
  accountId: 'Meta ad account',
  objective: 'Campaign goal',
  optimizationGoal: 'What Meta should aim for',
  dailyBudget: 'Daily budget',
  budget: 'Daily budget',
  audienceType: 'Type of audience',
  audienceName: 'Audience',
  targetSegment: 'Target customer',
  geoLocations: 'Locations',
  language: 'Language',
  creativeFormat: 'Ad style',
  conversionEvent: 'What counts as a result',
  conversionValue: 'Value of each result',
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

/**
 * A code ('lookalike_1pct', 'coldAudience') becomes plain words; free text a person or the
 * assistant wrote ('Nadi Astrology buyers') is shown as written, keeping its capitals.
 */
function humanize(value: string): string {
  return /\s/.test(value.trim()) ? value : humanise(value)
}

function fieldLabel(value: string): string {
  return FIELD_LABELS[value] ?? humanize(value)
}

function objectiveLabel(value?: string | null): string {
  if (!value) return ''
  return plainStatus('objective', value).label
}

/** A Meta goal / conversion event code in plain words ('OFFSITE_CONVERSIONS' → 'Sales on your website'). */
function metaGoalLabel(value: string): string {
  return plainStatus('metaGoal', value).label
}

/** Rupees in en-IN ('₹1,42,000'); any other currency keeps its own symbol. */
function formatMoney(value: number, currency = 'INR'): string {
  if (!currency || currency.toUpperCase() === 'INR') return formatInr(value)
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return formatInr(value)
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
        plan.productMode === 'new' ? 'New product — will be added to your list' : 'One of your products',
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
        plan.optimizationGoal ? `Meta aims for: ${metaGoalLabel(plan.optimizationGoal).toLowerCase()}` : '',
        plan.funnelStage ? `${humanize(plan.funnelStage)} audience` : '',
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
      value: formatInr(dailyBudget, { perDay: true }),
      detail: [
        `${formatInr(dailyBudget * 7)} over 7 days`,
        changed
          ? `Lowered to stay within your spending limit (you asked for ${formatInr(plan.requestedDailyBudget as number, { perDay: true })})`
          : 'Nothing is spent until you approve',
      ].join(' · '),
      icon: IndianRupee,
    })
  }

  const audience = plan.audienceName || plan.targetSegment || plan.audienceType
  if (audience) {
    cards.push({
      key: 'audience',
      label: 'Audience',
      value: audience === plan.audienceType ? plainStatus('audienceKind', audience).label : humanize(audience),
      detail: [
        plan.audienceName && plan.targetSegment ? plan.targetSegment : '',
        plan.audienceType ? plainStatus('audienceKind', plan.audienceType).label : '',
      ].filter(Boolean).join(' · '),
      refs: plan.metaAudienceId ? [{ label: 'Meta audience', value: plan.metaAudienceId }] : undefined,
      icon: UsersRound,
    })
  }

  if (plan.geoLocations?.length || plan.language) {
    cards.push({
      key: 'market',
      label: 'Market',
      value: plan.geoLocations?.length ? plan.geoLocations.join(', ') : 'Locations to be decided',
      detail: plan.language ? `Ads in ${humanize(plan.language)}` : undefined,
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
      value: 'Page chosen',
      detail: 'The ads will appear as posts from this Page',
      refs: [{ label: 'Facebook Page', value: effectivePageId }],
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
      label: 'What counts as a result',
      value: conversionEvent
        ? metaGoalLabel(conversionEvent)
        : 'Set up',
      detail: [
        tracking?.pixelId ? 'Tracked on your website' : '',
        typeof conversionValue === 'number'
          ? `Each one is worth ${formatMoney(conversionValue, currency)}`
          : '',
      ].filter(Boolean).join(' · ') || undefined,
      refs: [
        ...(tracking?.pixelId ? [{ label: 'Meta Pixel', value: tracking.pixelId }] : []),
        ...(tracking?.customConversionId
          ? [{ label: 'Custom conversion', value: tracking.customConversionId }]
          : []),
      ],
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
      label: 'App',
      value: plan.appPlatform ? plainStatus('appPlatform', plan.appPlatform).label : 'App to be confirmed',
      detail: plan.newProduct?.metaAppStoreUrl || undefined,
      refs: plan.newProduct?.metaAppId
        ? [{ label: 'Meta app', value: plan.newProduct.metaAppId }]
        : undefined,
      icon: Package,
    })
  }

  if (plan.creativeFormat || plan.angle || plan.keyMessage) {
    cards.push({
      key: 'creative',
      label: 'Ad style',
      value: plan.creativeFormat ? humanize(plan.creativeFormat) : plan.angle || 'To be decided',
      detail: [plan.angle, plan.keyMessage].filter(Boolean).join(' · '),
      icon: ImageIcon,
    })
  }

  if (plan.accountId) {
    cards.push({
      key: 'account',
      label: 'Ad account',
      value: 'Ad account chosen',
      detail: 'The Meta account the ads will be billed to',
      refs: [{ label: 'Meta ad account', value: plan.accountId }],
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
        value: displayValue(value) || item.reason || item.rationale || 'Suggested by the assistant',
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
      value: formatInr(recommendations.budget.dailyBudget, { perDay: true }),
      reason: [
        recommendations.budget.rationale,
        typeof max === 'number' ? `Your spending limit is ${formatInr(max, { perDay: true })}` : '',
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
        value: value === audience.type ? plainStatus('audienceKind', value).label : humanize(value),
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
      label: 'Suggested ad style',
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
  const text = formatRelative(date)
  return text === '—' ? 'just now' : text
}

/** The session status in the shared vocabulary (copilotSession); an unknown one reads as planning. */
function statusDetails(status?: string): {
  label: string
  meaning: string
  chip: string
  pulse?: boolean
} {
  const known = ['ready', 'build_queued', 'building', 'pending_approval', 'failed', 'cancelled']
  const code = status && known.includes(status) ? status : 'collecting'
  const plain = plainStatus('copilotSession', code)
  return {
    label: plain.label,
    meaning: plain.meaning,
    chip: toneChip(plain.tone),
    pulse: code === 'collecting' || code === 'build_queued' || code === 'building',
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
    label: 'Check it is safe',
    detail: 'Tracking and spending limits',
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
        <span className="chip chip-neutral max-w-[90%] whitespace-normal break-words text-center">{message.content}</span>
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
      <div className={`min-w-0 max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
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
    { label: 'Plan agreed', state: 'done' },
    { label: 'Waiting to start', state: queued ? 'active' : 'done' },
    { label: 'Making the ads and campaign', state: queued ? 'waiting' : 'active' },
    { label: 'Saved for your approval', state: 'waiting' },
  ]

  return (
    <div
      className="mx-4 sm:mx-6 mb-4 rounded-xl p-4"
      style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Loader2 size={15} className="animate-spin shrink-0" style={{ color: 'var(--accent)' }} />
          <p className="min-w-0 text-sm font-semibold" style={{ color: 'var(--accent-strong)' }}>
            {queued ? 'Your campaign is waiting its turn to be made' : 'Your campaign is being made'}
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
              title={step.label}
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
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: 'var(--surface)',
            border: `1px solid ${primary ? 'var(--accent-border)' : 'var(--hairline)'}`,
          }}
        >
          <Icon size={14} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="min-w-0 flex-1">
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
          {item.refs && item.refs.length > 0 && (
            <Details className="mt-2" items={item.refs} />
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
  /** The raw message behind `error`, for the collapsed Details only. */
  const [errorRaw, setErrorRaw] = useState('')
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
        label: status === 'ready' ? 'Details need a check' : 'Finishing the plan',
        meaning: status === 'ready'
          ? 'One last check needs redoing before the campaign can be prepared.'
          : 'All details are in; the assistant is doing a final check.',
        chip: 'chip-warn',
        pulse: false,
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
            setError("We couldn't reopen your last conversation. Reload the page to try again, or start a new one below.")
            setErrorRaw(message)
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
        if (!cancelled) setPollError("We couldn't check on your campaign just now. Trying again automatically…")
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
    setErrorRaw('')
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
      setError("The assistant couldn't reply. Try again.")
      setErrorRaw(errorDetail(caught))
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
    setErrorRaw('')
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
        setError('The plan changed while you were confirming. We have loaded the latest version — please check it before preparing.')
      } else {
        setError("We couldn't start making the campaign. Try again.")
        setErrorRaw(message)
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
    setErrorRaw('')
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
        ? 'Ask the assistant to try again, or say what should change…'
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
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>Opening your campaign planner</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
              Loading your last plan and conversation…
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
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="micro-label">Campaign assistant</span>
              <span className="chip chip-accent">
                <Sparkles size={10} /> You approve before anything goes live
              </span>
            </div>
            <h1 className="page-title break-words">
              {mode === 'planner'
                ? 'Plan a new campaign by chatting'
                : 'Ask about the ads you are already running'}
            </h1>
            <p className="page-subtitle max-w-3xl">
              {mode === 'planner'
                ? 'Say what you want to sell and what you want from it. The assistant suggests a goal, budget, audience and ad style, asks for anything missing, and gets the campaign ready. Nothing goes live or spends money until you approve.'
                : 'Ask about any campaign, running or paused. Answers use only the figures in your ad account, and show which campaign they came from.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Planner builds something new; Queries explains what already ran.
                They share this workspace but no state — switching never
                disturbs a plan in progress. */}
            <div
              role="tablist"
              aria-label="What do you want to do"
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
              <p className="text-sm break-words" style={{ color: error ? 'var(--bad)' : 'var(--warn)' }}>
                {error || pollError}
              </p>
              {error && errorRaw && (
                <Details className="mt-2" items={[{ label: 'Error', value: errorRaw }]} />
              )}
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
            aria-label="Chat with the campaign assistant"
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
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>Campaign assistant</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }} title="Plan a campaign in plain words — no Meta forms to fill in">
                    Plan a campaign in plain words — no Meta forms to fill in
                  </p>
                </div>
              </div>
              <span className={`chip ${statusMeta.chip} shrink-0`} title={statusMeta.meaning || undefined}>
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
                      Tell us the product and what you want from it, in your own words. The assistant will suggest the goal, budget, audience and ad style — and explain each choice.
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
                  aria-label="Message the campaign assistant"
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
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mt-2 px-1">
                <p className="text-[10.5px]" style={{ color: 'var(--ink-4)' }}>
                  Enter to send · Shift + Enter for a new line
                </p>
                <p className="text-[10.5px]" style={{ color: 'var(--ink-4)' }}>
                  Preparing costs nothing · going live always needs your approval
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
                <div className="flex min-w-0 items-center gap-2">
                  <FileCheck2 size={16} className="shrink-0" style={{ color: 'var(--accent)' }} />
                  <div className="min-w-0">
                    <h2 className="section-title">Your campaign plan</h2>
                    <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                      Updates as you chat
                    </p>
                  </div>
                </div>
                {session && (
                  <span className="text-[10.5px] shrink-0" style={{ color: 'var(--ink-4)' }}>
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
                          ? 'The plan has everything it needs'
                          : missingFields.length > 0
                            ? `${missingFields.length} decision${missingFields.length === 1 ? '' : 's'} left to make`
                            : 'The assistant is putting your plan together'}
                      </p>
                      <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--ink-3)' }}>
                        {detailsComplete
                          ? 'Ask why, ask for any change, or go ahead and prepare the campaign.'
                          : missingFields.length > 0
                            ? `Next: ${missingFields.slice(0, 2).map(missingFieldText).join(' and ')}${missingFields.length > 2 ? `, plus ${missingFields.length - 2} more` : ''}.`
                            : 'Keep chatting — you will only be asked for what is needed to launch safely.'}
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
                      Your plan will appear here
                    </p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                      The goal, budget, audience, ad style and how results are counted fill in as you chat.
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
                      <p className="micro-label">Ready to launch?</p>
                      <span className={`chip ${detailsComplete ? 'chip-good' : 'chip-warn'}`}>
                        {detailsComplete ? <Check size={10} /> : <Clock3 size={10} />}
                        {detailsComplete
                          ? 'Complete'
                          : missingFields.length > 0
                            ? `${missingFields.length} still needed`
                            : 'Needs a check'}
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
                            ? 'One last safety check needs redoing. Ask the assistant to review the plan before preparing it.'
                            : 'All the details are in. The assistant is doing a final check before preparing.'}
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
                            <span className="min-w-0 break-words text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
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
                          {detailsComplete ? 'All the details are in' : 'Anything missing will be listed here as you plan'}
                        </span>
                      </div>
                    )}

                    {blockers.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        {blockers.map((blocker, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs" style={{ color: 'var(--bad)' }}>
                            <AlertCircle size={12} className="shrink-0 mt-0.5" />
                            <span className="min-w-0 break-words">{typeof blocker === 'string' ? blocker : missingFieldText(blocker)}</span>
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
                        <p className="micro-label">What the assistant suggests</p>
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
                          <p className="text-sm font-semibold mt-0.5 break-words" style={{ color: 'var(--ink)' }}>{item.value}</p>
                          {item.reason && (
                            <p className="text-[11px] leading-relaxed mt-1 break-words" style={{ color: 'var(--ink-3)' }}>{item.reason}</p>
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
                        <AlertCircle size={11} className="shrink-0 mt-0.5" /> <span className="min-w-0 break-words">{warning}</span>
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
                    Makes the ads and a draft campaign. Nothing is spent until you approve.
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
                      The plan and ads are ready and saved for you to review. Nothing has been spent yet.
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
                          See the campaign
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
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--bad)' }}>We couldn&apos;t finish making this campaign</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                      Tell the assistant what to change, or ask it to try again. It re-checks the plan and your spending limits before starting over.
                    </p>
                    {session?.error && (
                      <Details className="mt-2" items={[{ label: 'Error', value: session.error }]} />
                    )}
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
        description="The assistant will make the ads from the agreed plan and save the campaign for your approval. It will not go live on Meta or spend any money yet."
        confirmLabel="Prepare campaign"
        cancelLabel="Keep editing"
        loading={confirming}
        onConfirm={() => void confirmPlan()}
        onCancel={() => !confirming && setConfirmOpen(false)}
      />
    </div>
  )
}
