/**
 * Typed fetchers for the Performance Marketeer analysis API
 * (GET /api/v1/performance-marketeer/:tenantId/<endpoint>). Shapes are the
 * contract in src/types/performance-marketeer.ts.
 *
 * NEXT_PUBLIC_PM_MOCK=true (build-time) serves performance-marketeer-fixtures.ts
 * instead, so the page can be built and reviewed before the backend exists.
 * Unset = real calls, so a deploy never silently shows invented numbers.
 */

import { apiFetch } from './api'
import { PM_MAX_SPAN_DAYS, addDays, validDay } from './performance-marketeer-dates'
import type {
  PmAgentCancelResult,
  PmAgentEnqueueRequest,
  PmAgentEnqueueResult,
  PmAgentQueue,
  PmAgentRollup,
  PmAgentRun,
  PmCampaignListItem,
  PmCampaignTarget,
  PmLesson,
  PmLessonProposal,
  PmLessonScope,
  PmLessonScorecard,
  PmLessonStatus,
  PmLessonType,
  PmOwnerRule,
  PmBudgetResponse,
  PmChangesResponse,
  PmDecomposeResponse,
  PmEntitiesResponse,
  PmEntityRow,
  PmFatigueResponse,
  PmFunnelResponse,
  PmGeoResponse,
  PmAction,
  PmLevel,
  PmQuery,
  PmReconcileResponse,
  PmReportResponse,
  PmSummaryResponse,
  PmTrendResponse,
} from '@/types/performance-marketeer'

export const PM_MOCK = process.env.NEXT_PUBLIC_PM_MOCK === 'true'

export const PM_PRODUCTS = [
  { id: 'nadi-report-premium', label: 'Nadi Report Premium' },
  { id: 'nadi-report', label: 'Nadi Report' },
  { id: 'golu-devta-arzi', label: 'Golu Devta Arzi' },
] as const

export function productLabel(id: string | undefined): string {
  return PM_PRODUCTS.find((p) => p.id === id)?.label ?? (id || 'All products')
}

type Fixtures = typeof import('./performance-marketeer-fixtures')

/**
 * Fixtures are loaded with a dynamic import only in mock mode, so they stay in
 * their own chunk and never load in a real deploy. The delay exercises loading states.
 */
async function mock<T>(fn: (f: Fixtures) => T, ms = 280): Promise<T> {
  const f = await import('./performance-marketeer-fixtures')
  await new Promise((r) => setTimeout(r, ms))
  return fn(f)
}

async function get<T>(tenantId: string, endpoint: string, params: Record<string, string | undefined>): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
  const data = await apiFetch<T>(`/performance-marketeer/${encodeURIComponent(tenantId)}/${endpoint}?${qs}`)
  // apiFetch turns an empty 200 into null; every PM endpoint must return an object.
  if (data == null) throw new Error(`The ${endpoint} endpoint returned an empty response`)
  return data
}

export const getPmSummary = (t: string, q: PmQuery) =>
  PM_MOCK ? mock((f) => f.fixtureSummary(q)) : get<PmSummaryResponse>(t, 'summary', { ...q })

export const getPmEntities = (t: string, q: PmQuery & { level: PmEntityRow['level']; parentId?: string }) =>
  PM_MOCK ? mock((f) => f.fixtureEntities(q)) : get<PmEntitiesResponse>(t, 'entities', { ...q })

export const getPmTrend = (t: string, q: PmQuery & { level?: PmLevel; id?: string }) =>
  PM_MOCK ? mock((f) => f.fixtureTrend(q)) : get<PmTrendResponse>(t, 'trend', { ...q })

export const getPmDecompose = (t: string, q: PmQuery & { level?: PmLevel; id?: string }) =>
  PM_MOCK ? mock((f) => f.fixtureDecompose(q)) : get<PmDecomposeResponse>(t, 'decompose', { ...q })

export const getPmFunnel = (t: string, q: PmQuery & { channel?: string; adId?: string }) =>
  PM_MOCK ? mock((f) => f.fixtureFunnel(q)) : get<PmFunnelResponse>(t, 'funnel', { ...q })

export const getPmFatigue = (t: string, q: PmQuery) =>
  PM_MOCK ? mock((f) => f.fixtureFatigue(q)) : get<PmFatigueResponse>(t, 'fatigue', { ...q })

export const getPmGeo = (t: string, q: PmQuery) =>
  PM_MOCK ? mock((f) => f.fixtureGeo(q)) : get<PmGeoResponse>(t, 'geo', { ...q })

export const getPmBudget = (t: string, q: PmQuery) =>
  PM_MOCK ? mock((f) => f.fixtureBudget(q)) : get<PmBudgetResponse>(t, 'budget', { ...q })

export const getPmReconcile = (t: string, q: PmQuery) =>
  PM_MOCK ? mock((f) => f.fixtureReconcile(q)) : get<PmReconcileResponse>(t, 'reconcile', { ...q })

export const getPmChanges = (t: string, q: { from: string; to: string; objectId?: string }) =>
  PM_MOCK ? mock((f) => f.fixtureChanges(q)) : get<PmChangesResponse>(t, 'changes', { ...q })

export const getPmReport = (t: string, date?: string, product?: string) =>
  PM_MOCK ? mock((f) => f.fixtureReport(date, product)) : get<PmReportResponse>(t, 'report', { date, product })

// ── Step 3 AI analyst (runs come from the nightly pipeline or the admin queue below) ──

export const getPmAgentDates = (t: string) =>
  PM_MOCK ? mock((f) => f.fixtureAgentDates()) : get<string[]>(t, 'agent/dates', {})

export const getPmAgentRollup = (t: string, date?: string) =>
  PM_MOCK ? mock((f) => f.fixtureAgentRollup(date)) : get<PmAgentRollup>(t, 'agent/runs', { date })

export const getPmAgentRun = (t: string, campaignId: string, date: string) =>
  PM_MOCK ? mock((f) => f.fixtureAgentRun(campaignId, date)) : get<PmAgentRun>(t, `agent/runs/${encodeURIComponent(campaignId)}`, { date })

export const savePmAgentNote = (t: string, campaignId: string, date: string, note: string) =>
  PM_MOCK
    ? mock((f) => f.fixtureAgentNote(campaignId, date, note))
    : apiFetch<{ campaignId: string; date: string; userNote: string }>(
        `/performance-marketeer/${encodeURIComponent(t)}/agent/runs/${encodeURIComponent(campaignId)}/note`,
        { method: 'POST', body: JSON.stringify({ date, note }) },
      )

/** Most campaigns one POST /agent/queue accepts. */
export const PM_QUEUE_MAX = 20

export const enqueuePmAgent = (t: string, body: PmAgentEnqueueRequest) =>
  PM_MOCK
    ? mock((f) => f.fixtureEnqueue(body))
    : apiFetch<PmAgentEnqueueResult>(`/performance-marketeer/${encodeURIComponent(t)}/agent/queue`, { method: 'POST', body: JSON.stringify(body) })

export const getPmAgentQueue = (t: string, date: string) =>
  PM_MOCK ? mock((f) => f.fixtureQueue(date)) : get<PmAgentQueue>(t, 'agent/queue', { date })

export const cancelPmAgentQueued = (t: string, campaignId: string, date: string) =>
  PM_MOCK
    ? mock((f) => f.fixtureCancelQueued(campaignId, date))
    : apiFetch<PmAgentCancelResult>(`/performance-marketeer/${encodeURIComponent(t)}/agent/queue/${encodeURIComponent(campaignId)}/cancel`, { method: 'POST', body: JSON.stringify({ date }) })

// ── Lifetime purchase targets (any logged-in user; the AI analyst plans towards them) ──

export const getPmCampaignList = (t: string) =>
  PM_MOCK ? mock((f) => f.fixtureCampaignList()) : get<PmCampaignListItem[]>(t, 'agent/campaigns', {})

export const getPmTargets = (t: string) =>
  PM_MOCK ? mock((f) => f.fixtureTargets()) : get<PmCampaignTarget[]>(t, 'agent/targets', {})

/** null removes the target. */
export const setPmTarget = (t: string, campaignId: string, targetPurchases: number | null) =>
  PM_MOCK
    ? mock((f) => f.fixtureSetTarget(campaignId, targetPurchases))
    : apiFetch<PmCampaignTarget>(`/performance-marketeer/${encodeURIComponent(t)}/agent/targets/${encodeURIComponent(campaignId)}`, { method: 'PUT', body: JSON.stringify({ targetPurchases }) })

// ── Lessons (the weekly curator proposes; you approve, edit, retire) ──

async function send<T>(t: string, path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return apiFetch<T>(`/performance-marketeer/${encodeURIComponent(t)}/lessons/${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
const seg = encodeURIComponent

export const getPmLessons = (t: string, f: { status?: PmLessonStatus; type?: PmLessonType } = {}) =>
  PM_MOCK ? mock((x) => x.fixtureLessons(f)) : get<PmLesson[]>(t, 'lessons', { ...f })

export const getPmLessonProposals = (t: string, status = 'pending') =>
  PM_MOCK ? mock((x) => x.fixtureLessonProposals(status)) : get<PmLessonProposal[]>(t, 'lessons/proposals', { status })

/** 200 with status 'invalid' when the server's re-check fails; nothing is applied then. */
export type PmApproveResult = { proposalId: string; status: 'approved' | 'invalid' | 'rejected'; lessonId?: string; problems?: string[] }

export const approvePmLessonProposal = (t: string, id: string, note?: string) =>
  PM_MOCK ? mock((x) => x.fixtureDecideProposal(id, 'approved', note)) : send<PmApproveResult>(t, `proposals/${seg(id)}/approve`, 'POST', { note })

export const rejectPmLessonProposal = (t: string, id: string, note: string) =>
  PM_MOCK ? mock((x) => x.fixtureDecideProposal(id, 'rejected', note)) : send<unknown>(t, `proposals/${seg(id)}/reject`, 'POST', { note })

export const editPmLesson = (t: string, id: string, patch: { statement?: string; because?: string; scope?: PmLessonScope }) =>
  PM_MOCK ? mock((x) => x.fixtureEditLesson(id, patch)) : send<unknown>(t, seg(id), 'PATCH', patch)

export const retirePmLesson = (t: string, id: string, note: string) =>
  PM_MOCK ? mock((x) => x.fixtureEditLesson(id, { status: 'retired' })) : send<unknown>(t, `${seg(id)}/retire`, 'POST', { note })

export const getPmOwnerRules = (t: string) =>
  PM_MOCK ? mock((x) => x.fixtureOwnerRules()) : get<PmOwnerRule[]>(t, 'lessons/owner-rules', {})

export type PmOwnerRuleInput = Omit<PmOwnerRule, 'ruleId' | 'check'> & { check: PmOwnerRule['check'] | null }

export const createPmOwnerRule = (t: string, r: PmOwnerRuleInput) =>
  PM_MOCK ? mock((x) => x.fixtureSaveOwnerRule(null, r)) : send<unknown>(t, 'owner-rules', 'POST', { ...r, check: r.check ?? undefined })

export const updatePmOwnerRule = (t: string, id: string, r: PmOwnerRuleInput) =>
  PM_MOCK ? mock((x) => x.fixtureSaveOwnerRule(id, r)) : send<unknown>(t, `owner-rules/${seg(id)}`, 'PATCH', r)

export const deletePmOwnerRule = (t: string, id: string) =>
  PM_MOCK ? mock((x) => x.fixtureDeleteOwnerRule(id)) : send<unknown>(t, `owner-rules/${seg(id)}`, 'DELETE')

export const getPmLessonScorecard = (t: string, weeks = 8) =>
  PM_MOCK ? mock((x) => x.fixtureLessonScorecard(weeks)) : get<PmLessonScorecard>(t, 'lessons/scorecard', { weeks: String(weeks) })

export { addDays, istYesterday, istToday } from './performance-marketeer-dates'

// ── Page view state (shared by the server page and the client shell) ──

export const PM_ACTIONS = [
  'hold', 'investigate', 'test', 'scale', 'reduce_budget', 'pause', 'change_targeting', 'refresh_creative', 'fix_funnel', 'fix_tracking',
] as const satisfies readonly PmAction[]

export const PM_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'report', label: 'Daily Report' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'creatives', label: 'Creatives' },
  { id: 'budget', label: 'Budget & Geo' },
  { id: 'checks', label: 'Data Checks' },
  { id: 'agent', label: 'AI Analyst' },
  { id: 'lessons', label: 'Lessons' },
] as const
export type PmTab = (typeof PM_TABS)[number]['id']

/** Everything the page shows is described by this, and mirrored into the URL. */
export interface PmView {
  tab: PmTab
  from: string
  to: string
  product: string
  campaign: string
  adset: string
  sel: string // "<level>.<id>" — the entity open in the side panel
  channel: string
  ad: string
  action: string // Daily report: show only findings with this PmAction
  day: string // AI analyst: run date ('' = latest)
  run: string // AI analyst: campaign id whose run is open in the panel
  lesson: string // Lessons: lesson id open in the panel
}

const ID = /^[\w.-]{1,64}$/

/** URL search params → a valid view. Anything malformed or out of bounds falls back to defaults. */
export function parsePmView(get: (key: string) => string | null | undefined, yesterday: string): PmView {
  const one = (k: string) => get(k) ?? ''
  const id = (k: string) => (ID.test(one(k)) ? one(k) : '')
  const to = validDay(one('to'), yesterday) ?? yesterday
  let from = validDay(one('from'), yesterday) ?? addDays(to, -6)
  if (from > to) from = to
  if (from < addDays(to, -(PM_MAX_SPAN_DAYS - 1))) from = addDays(to, -(PM_MAX_SPAN_DAYS - 1))
  return {
    tab: PM_TABS.some((t) => t.id === one('tab')) ? (one('tab') as PmTab) : 'overview',
    from,
    to,
    product: PM_PRODUCTS.some((p) => p.id === one('product')) ? one('product') : '',
    campaign: id('campaign'),
    adset: id('campaign') ? id('adset') : '',
    sel: id('sel'),
    channel: id('channel'),
    ad: id('ad'),
    action: (PM_ACTIONS as readonly string[]).includes(one('action')) ? one('action') : '',
    day: /^\d{4}-\d{2}-\d{2}$/.test(one('day')) ? one('day') : '',
    run: id('run'),
    lesson: id('lesson'),
  }
}
