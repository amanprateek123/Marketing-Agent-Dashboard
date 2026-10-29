/**
 * In-browser stand-in for the Performance Marketeer analysis API, used when
 * NEXT_PUBLIC_PM_MOCK=true (the backend is being built in parallel).
 *
 * One deterministic daily model per ad (seeded by ad id + date) is generated
 * and every endpoint aggregates the same rows, so the summary, the entity
 * table, the trend and the report always agree with each other. Shapes follow
 * src/types/performance-marketeer.ts exactly. No component imports this file.
 */

import type {
  PmCampaignListItem,
  PmCampaignTarget,
  PmAgentAction,
  PmAgentCancelResult,
  PmAgentEnqueueRequest,
  PmAgentEnqueueResult,
  PmAgentQueue,
  PmAgentRollup,
  PmAgentRunStatus,
  PmAgentRun,
  PmBudgetResponse,
  PmBudgetRow,
  PmChangesResponse,
  PmConfidence,
  PmDecomposeResponse,
  PmEntitiesResponse,
  PmEntityRow,
  PmFatigueResponse,
  PmFatigueRow,
  PmFinding,
  PmFunnelResponse,
  PmGeoResponse,
  PmLesson,
  PmLessonProposal,
  PmLessonScorecard,
  PmLessonStatus,
  PmLessonType,
  PmLevel,
  PmOwnerRule,
  PmMetrics,
  PmQuery,
  PmReconcileResponse,
  PmReportResponse,
  PmSummaryResponse,
  PmTargetCheck,
  PmTrendPoint,
  PmTrendResponse,
} from '@/types/performance-marketeer'
import { addDays, daysBetween, istYesterday } from './performance-marketeer-dates'

// ── Dates (IST calendar days as plain YYYY-MM-DD) ──────────────────────────

function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d)
  return out
}

// ── Seeded noise ───────────────────────────────────────────────────────────

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: string): () => number {
  let a = hash(seed)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Integer draw with mean `mean` (cheap Poisson stand-in, never negative). */
function countDraw(mean: number, r: () => number): number {
  const v = mean + (r() + r() + r() - 1.5) * Math.sqrt(Math.max(mean, 0.01)) * 1.2
  return Math.max(0, Math.round(v))
}

// ── The account model ──────────────────────────────────────────────────────

const PRODUCTS = {
  'nadi-report-premium': { label: 'Nadi Report Premium', net: 1525, metaValue: 1300 },
  'nadi-report': { label: 'Nadi Report', net: 847, metaValue: 999 },
  'golu-devta-arzi': { label: 'Golu Devta Arzi', net: 423, metaValue: 499 },
} as const
type ProductId = keyof typeof PRODUCTS

interface AdModel {
  id: string
  name: string
  adsetId: string
  campaignId: string
  accountId: string
  product: ProductId
  launched: string // YYYY-MM-DD
  paused?: string // stops spending from this day
  spend: number // base ₹/day
  cpm: number
  ctr: number
  c2o: number // link click → attributed order
  fatigueAfter: number // days live before frequency climbs and CTR decays
  creative: PmFatigueRow['creative']
}

interface AdsetModel {
  id: string
  name: string
  campaignId: string
  dailyBudget: number | null
  learningStage: string
}

interface CampaignModel {
  id: string
  name: string
  accountId: string
  product: ProductId
  budgetLevel: 'campaign' | 'adset'
  dailyBudget: number | null
  status: 'ACTIVE' | 'PAUSED'
  learningStage: string
}

const ACC_A = 'act_1029384756'
const ACC_B = 'act_5647382910'
const THUMB = (seed: string) => `https://picsum.photos/seed/${seed}/160/160`

const CAMPAIGNS: CampaignModel[] = [
  { id: '120210000000000101', name: 'NRP | Broad | Hindi | CBO', accountId: ACC_A, product: 'nadi-report-premium', budgetLevel: 'campaign', dailyBudget: 12000, status: 'ACTIVE', learningStage: 'SUCCESS' },
  { id: '120210000000000102', name: 'NRP | Interests – Astrology | ABO', accountId: ACC_A, product: 'nadi-report-premium', budgetLevel: 'adset', dailyBudget: null, status: 'ACTIVE', learningStage: 'SUCCESS' },
  { id: '120210000000000103', name: 'NRP | Retargeting 30d | ABO', accountId: ACC_A, product: 'nadi-report-premium', budgetLevel: 'adset', dailyBudget: null, status: 'ACTIVE', learningStage: 'SUCCESS' },
  { id: '120210000000000104', name: 'NRP | Advantage+ test | CBO', accountId: ACC_B, product: 'nadi-report-premium', budgetLevel: 'campaign', dailyBudget: 3000, status: 'ACTIVE', learningStage: 'LEARNING' },
  { id: '120210000000000105', name: 'Nadi Report | Broad | CBO', accountId: ACC_B, product: 'nadi-report', budgetLevel: 'campaign', dailyBudget: 4000, status: 'ACTIVE', learningStage: 'SUCCESS' },
  { id: '120210000000000106', name: 'Golu Devta Arzi | Uttarakhand | CBO', accountId: ACC_B, product: 'golu-devta-arzi', budgetLevel: 'campaign', dailyBudget: 2500, status: 'ACTIVE', learningStage: 'FAIL' },
]

const ADSETS: AdsetModel[] = [
  { id: '120211000000000201', name: 'Broad 25–55 · All India', campaignId: CAMPAIGNS[0].id, dailyBudget: null, learningStage: 'SUCCESS' },
  { id: '120211000000000202', name: 'Broad 35–60 · Hindi belt', campaignId: CAMPAIGNS[0].id, dailyBudget: null, learningStage: 'SUCCESS' },
  { id: '120211000000000203', name: 'Interest: Vedic astrology', campaignId: CAMPAIGNS[1].id, dailyBudget: 3500, learningStage: 'SUCCESS' },
  { id: '120211000000000204', name: 'Interest: Spirituality & temples', campaignId: CAMPAIGNS[1].id, dailyBudget: 2500, learningStage: 'LEARNING' },
  { id: '120211000000000205', name: 'Site visitors 30d', campaignId: CAMPAIGNS[2].id, dailyBudget: 1800, learningStage: 'SUCCESS' },
  { id: '120211000000000206', name: 'Video viewers 50% · 14d', campaignId: CAMPAIGNS[2].id, dailyBudget: 900, learningStage: 'SUCCESS' },
  { id: '120211000000000207', name: 'Advantage+ audience', campaignId: CAMPAIGNS[3].id, dailyBudget: null, learningStage: 'LEARNING' },
  { id: '120211000000000208', name: 'Broad 28–60 · All India', campaignId: CAMPAIGNS[4].id, dailyBudget: null, learningStage: 'SUCCESS' },
  { id: '120211000000000209', name: 'Uttarakhand + NCR', campaignId: CAMPAIGNS[5].id, dailyBudget: null, learningStage: 'FAIL' },
]

function ad(
  n: number,
  adsetIdx: number,
  name: string,
  p: Pick<AdModel, 'launched' | 'spend' | 'cpm' | 'ctr' | 'c2o' | 'fatigueAfter'> & { paused?: string },
  creative: { title: string; body: string },
): AdModel {
  const adset = ADSETS[adsetIdx]
  const campaign = CAMPAIGNS.find((c) => c.id === adset.campaignId)!
  const id = `1202120000000003${String(n).padStart(2, '0')}`
  return {
    id,
    name,
    adsetId: adset.id,
    campaignId: campaign.id,
    accountId: campaign.accountId,
    product: campaign.product,
    ...p,
    creative: { ...creative, thumbnailUrl: THUMB(`pm${n}`), linkUrl: `https://91astrology.com/${campaign.product}` },
  }
}

const ADS: AdModel[] = [
  ad(1, 0, 'Palm-leaf story · video 30s', { launched: '2026-08-20', spend: 4200, cpm: 128, ctr: 0.0142, c2o: 0.0128, fatigueAfter: 999 }, { title: 'आपकी नाड़ी पत्रिका तैयार है', body: 'Ancient palm-leaf readings, matched to your thumbprint. Get your Nadi Report Premium in 48 hours.' }),
  ad(2, 0, 'Astrologer face · static', { launched: '2026-09-02', spend: 3100, cpm: 121, ctr: 0.0118, c2o: 0.0105, fatigueAfter: 34 }, { title: 'Know what your Nadi leaf says', body: 'Our astrologers read your leaf and explain it in simple Hindi. ₹1,799 one-time.' }),
  ad(3, 1, 'Hindi testimonial · reel', { launched: '2026-07-28', spend: 2900, cpm: 109, ctr: 0.0161, c2o: 0.0094, fatigueAfter: 40 }, { title: '“Sab kuch sach nikla”', body: 'Real customers from Lucknow, Patna and Jaipur on their Nadi Report.' }),
  ad(4, 1, 'Carousel · what you get', { launched: '2026-10-05', spend: 1700, cpm: 117, ctr: 0.0109, c2o: 0.0112, fatigueAfter: 999 }, { title: '12 chapters of your life', body: 'Career, marriage, health and remedies — all in one Nadi Report Premium.' }),
  ad(5, 2, 'Kundli vs Nadi · static', { launched: '2026-08-11', spend: 2100, cpm: 146, ctr: 0.0101, c2o: 0.0082, fatigueAfter: 28 }, { title: 'Kundli tells you when. Nadi tells you why.', body: 'Go deeper than your birth chart with a personalised Nadi reading.' }),
  ad(6, 2, 'Pandit ji explainer · video', { launched: '2026-09-18', spend: 1400, cpm: 139, ctr: 0.0124, c2o: 0.0071, fatigueAfter: 999 }, { title: 'What is Nadi astrology?', body: 'A 45-second explainer from our senior astrologer.' }),
  ad(7, 3, 'Temple visuals · static', { launched: '2026-10-08', spend: 2300, cpm: 98, ctr: 0.0087, c2o: 0.0046, fatigueAfter: 999 }, { title: 'Your destiny was written long ago', body: 'Find your leaf. Read your story.' }),
  ad(8, 4, 'Retarget · “your report is waiting”', { launched: '2026-07-15', spend: 1500, cpm: 212, ctr: 0.0198, c2o: 0.0221, fatigueAfter: 30 }, { title: 'Your Nadi Report is one step away', body: 'You looked at your reading — finish your order today.' }),
  ad(9, 5, 'Retarget · offer reminder', { launched: '2026-09-25', spend: 800, cpm: 188, ctr: 0.0153, c2o: 0.0139, fatigueAfter: 999 }, { title: 'Still thinking about it?', body: 'Thousands of families trust 91Astrology. See what your Nadi leaf says.' }),
  ad(10, 6, 'Adv+ · mixed creative', { launched: '2026-10-17', spend: 2600, cpm: 92, ctr: 0.0131, c2o: 0.0068, fatigueAfter: 999 }, { title: 'आपका भविष्य, आपकी नाड़ी में', body: 'Personalised Nadi reading from expert astrologers.' }),
  ad(11, 7, 'Nadi Report · static', { launched: '2026-08-30', spend: 2400, cpm: 104, ctr: 0.0127, c2o: 0.0139, fatigueAfter: 45 }, { title: 'Nadi Report for ₹999', body: 'A short, clear reading of your Nadi leaf — delivered on WhatsApp.' }),
  ad(12, 7, 'Nadi Report · reel', { launched: '2026-10-01', spend: 1300, cpm: 96, ctr: 0.0151, c2o: 0.0118, fatigueAfter: 999 }, { title: 'Ek patta, poori kahani', body: 'See what the ancient sages wrote about you.' }),
  ad(13, 8, 'Golu Devta · temple bells', { launched: '2026-09-10', spend: 1500, cpm: 84, ctr: 0.0172, c2o: 0.0129, fatigueAfter: 25 }, { title: 'गोलू देवता के दरबार में अर्ज़ी', body: 'Submit your Arzi at the Chitai Golu Devta temple — we deliver it for you.' }),
  ad(14, 8, 'Golu Devta · old static', { launched: '2026-06-01', paused: '2026-10-19', spend: 900, cpm: 91, ctr: 0.0096, c2o: 0.0081, fatigueAfter: 20 }, { title: 'Golu Devta Arzi', body: 'Send your prayer to the god of justice.' }),
]

// ── Daily rows ─────────────────────────────────────────────────────────────

interface DayRow {
  date: string
  ad: AdModel
  spend: number
  impressions: number
  clicks: number
  linkClicks: number
  landingPageViews: number
  reach: number
  metaPurchases: number
  metaPurchaseValue: number
  siteVisitors: number
  siteCtaClicks: number
  sitePaymentsStarted: number
  firstPartyOrders: number
  firstPartyRevenue: number
  newCustomerOrders: number
}

const rowCache = new Map<string, DayRow | null>()

function dayRow(a: AdModel, date: string): DayRow | null {
  const key = `${a.id}|${date}`
  if (rowCache.has(key)) return rowCache.get(key)!
  let row: DayRow | null = null
  if (date >= a.launched && !(a.paused && date >= a.paused)) {
    const r = rng(key)
    const age = daysBetween(a.launched, date)
    const tired = Math.max(0, age - a.fatigueAfter)
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    const weekend = weekday === 0 || weekday === 6 ? 1.08 : 1
    const spend = Math.round(a.spend * (0.82 + r() * 0.36) * weekend)
    const cpm = a.cpm * (0.9 + r() * 0.2) * (1 + tired * 0.006)
    const impressions = Math.round((spend / cpm) * 1000)
    const ctr = a.ctr * (0.88 + r() * 0.24) * Math.max(0.55, 1 - tired * 0.012)
    const linkClicks = Math.round(impressions * ctr)
    const frequency = 1.15 + Math.min(age, 60) * 0.006 + tired * 0.035
    // 0.8 calibrates the account to ~20 attributed orders/day and ~0.9–1.0× first-party ROAS.
    const c2o = a.c2o * 0.8 * Math.max(0.6, 1 - tired * 0.008)
    const orders = countDraw(linkClicks * c2o, r)
    const p = PRODUCTS[a.product]
    const refunds = orders > 0 && r() < 0.04 ? 1 : 0
    const visitors = Math.round(linkClicks * (0.66 + r() * 0.1))
    row = {
      date,
      ad: a,
      spend,
      impressions,
      clicks: Math.round(linkClicks * (1.35 + r() * 0.2)),
      linkClicks,
      landingPageViews: Math.round(linkClicks * (0.74 + r() * 0.08)),
      reach: Math.round(impressions / frequency),
      // Meta sees roughly every order plus view-through; first-party catches ~60%.
      metaPurchases: countDraw(orders / 0.62 + 0.4, r),
      metaPurchaseValue: 0,
      siteVisitors: visitors,
      siteCtaClicks: Math.round(visitors * (0.21 + r() * 0.08)),
      sitePaymentsStarted: Math.max(orders, Math.round(visitors * (0.045 + r() * 0.02))),
      firstPartyOrders: orders,
      firstPartyRevenue: Math.max(0, (orders - refunds) * p.net),
      newCustomerOrders: Math.min(orders, Math.floor(orders * 0.74 + r())),
    }
    row.metaPurchaseValue = row.metaPurchases * p.metaValue
  }
  rowCache.set(key, row)
  return row
}

function rowsFor(q: PmQuery, filter?: (a: AdModel) => boolean, dates = eachDay(q.from, q.to)): DayRow[] {
  const ads = ADS.filter((a) => (!q.product || a.product === q.product) && (!filter || filter(a)))
  const out: DayRow[] = []
  for (const date of dates) for (const a of ads) {
    const r = dayRow(a, date)
    if (r) out.push(r)
  }
  return out
}

// ── Aggregation (same rules as the contract: ratio null when denominator 0) ─

const div = (n: number, d: number): number | null => (d > 0 ? n / d : null)

function aggregate(rows: DayRow[]): PmMetrics {
  const s = {
    spend: 0, impressions: 0, clicks: 0, linkClicks: 0, landingPageViews: 0, freqW: 0,
    metaPurchases: 0, metaPurchaseValue: 0, siteVisitors: 0, siteCtaClicks: 0, sitePaymentsStarted: 0,
    firstPartyOrders: 0, firstPartyRevenue: 0, newCustomerOrders: 0,
  }
  for (const r of rows) {
    s.spend += r.spend
    s.impressions += r.impressions
    s.clicks += r.clicks
    s.linkClicks += r.linkClicks
    s.landingPageViews += r.landingPageViews
    s.freqW += r.reach > 0 ? (r.impressions / r.reach) * r.impressions : 0
    s.metaPurchases += r.metaPurchases
    s.metaPurchaseValue += r.metaPurchaseValue
    s.siteVisitors += r.siteVisitors
    s.siteCtaClicks += r.siteCtaClicks
    s.sitePaymentsStarted += r.sitePaymentsStarted
    s.firstPartyOrders += r.firstPartyOrders
    s.firstPartyRevenue += r.firstPartyRevenue
    s.newCustomerOrders += r.newCustomerOrders
  }
  return {
    spend: s.spend,
    impressions: s.impressions,
    clicks: s.clicks,
    linkClicks: s.linkClicks,
    landingPageViews: s.landingPageViews,
    cpm: s.impressions > 0 ? (s.spend / s.impressions) * 1000 : null,
    ctr: div(s.linkClicks, s.impressions),
    cpc: div(s.spend, s.linkClicks),
    frequency: div(s.freqW, s.impressions),
    metaPurchases: s.metaPurchases,
    metaPurchaseValue: s.metaPurchaseValue,
    metaRoas: div(s.metaPurchaseValue, s.spend),
    siteVisitors: s.siteVisitors,
    siteCtaClicks: s.siteCtaClicks,
    sitePaymentsStarted: s.sitePaymentsStarted,
    firstPartyOrders: s.firstPartyOrders,
    firstPartyRevenue: s.firstPartyRevenue,
    firstPartyRoas: div(s.firstPartyRevenue, s.spend),
    firstPartyCpa: div(s.spend, s.firstPartyOrders),
    newCustomerOrders: s.newCustomerOrders,
    clickToOrderRate: div(s.firstPartyOrders, s.linkClicks),
    visitToOrderRate: div(s.firstPartyOrders, s.siteVisitors),
    averageOrderValue: div(s.firstPartyRevenue, s.firstPartyOrders),
  }
}

function confidenceFor(orders: number): PmConfidence {
  return orders < 10 ? 'low' : orders < 30 ? 'medium' : 'high'
}

function targetCheck(m: PmMetrics): PmTargetCheck {
  const targetRoas = 1.0
  const confidence = confidenceFor(m.firstPartyOrders)
  if (m.firstPartyOrders < 5 || m.firstPartyRoas == null) {
    return { targetRoas, verdict: 'not_enough_data', confidence: 'low', note: `${m.firstPartyOrders} orders — too few to judge` }
  }
  const roas = m.firstPartyRoas
  const verdict = roas >= 1.05 ? 'above_target' : roas >= 0.9 ? 'near_target' : 'below_target'
  const note =
    verdict === 'above_target'
      ? `${roas.toFixed(2)}× on ${m.firstPartyOrders} orders — above the 1.00× target`
      : verdict === 'near_target'
        ? `${roas.toFixed(2)}× on ${m.firstPartyOrders} orders — within 10% of target`
        : `${roas.toFixed(2)}× on ${m.firstPartyOrders} orders — below the 1.00× target`
  return { targetRoas, verdict, confidence, note }
}

function previousOf(q: PmQuery): PmQuery {
  const len = daysBetween(q.from, q.to) + 1
  return { ...q, from: addDays(q.from, -len), to: addDays(q.from, -1) }
}

function change(cur: PmMetrics, prior: PmMetrics): PmSummaryResponse['change'] {
  const out: PmSummaryResponse['change'] = {}
  for (const k of Object.keys(cur) as (keyof PmMetrics)[]) {
    const c = cur[k]
    const p = prior[k]
    out[k] = c == null || p == null || p === 0 ? null : c / p - 1
  }
  return out
}

/**
 * Fixture toggle for the "missing data" state: the Meta sync "failed" for the
 * day 24 days before yesterday, so only the Last 30 days view (or a custom
 * range covering it) shows the warning. 7/14-day views stay clean.
 */
export function fixtureMissingMetaDay(): string {
  return addDays(istYesterday(), -24)
}

function freshness(q: PmQuery): PmSummaryResponse['dataFreshness'] {
  const y = istYesterday()
  const to = q.to < y ? q.to : y
  const gap = fixtureMissingMetaDay()
  return {
    metaThrough: to,
    ordersThrough: to,
    visitorsThrough: addDays(to, q.to >= y ? -1 : 0),
    missingDays: { meta: q.from <= gap && gap <= q.to ? [gap] : [], orders: [], visitors: [] },
  }
}

function entityFilter(level: PmLevel, id?: string): ((a: AdModel) => boolean) | undefined {
  if (level === 'account' || !id) return undefined
  if (level === 'campaign') return (a) => a.campaignId === id
  if (level === 'adset') return (a) => a.adsetId === id
  return (a) => a.id === id
}


// ── Endpoints ──────────────────────────────────────────────────────────────

export function fixtureSummary(q: PmQuery): PmSummaryResponse {
  const previous = previousOf(q)
  const current = aggregate(rowsFor(q))
  const prior = aggregate(rowsFor(previous))
  const days = daysBetween(q.from, q.to) + 1
  // Attributed orders are ~60% of confirmed web orders; staff-entered ones are on top.
  const webOrders = Math.round(current.firstPartyOrders / 0.6)
  const adminOrders = Math.round(days * 0.6)
  const aov = current.averageOrderValue ?? 1400
  return {
    query: q,
    previous,
    current,
    prior,
    change: change(current, prior),
    target: targetCheck(current),
    allOrders: { orders: webOrders + adminOrders, revenue: Math.round((webOrders + adminOrders) * aov), webOrders, adminOrders },
    attributionCoverage: { linkedToVisit: webOrders ? 0.81 : null, linkedToMetaAd: div(current.firstPartyOrders, webOrders) },
    dataFreshness: freshness(q),
  }
}

export function fixtureEntities(q: PmQuery & { level: PmEntityRow['level']; parentId?: string }): PmEntitiesResponse {
  const rows: PmEntityRow[] = []
  const all = rowsFor(q)
  const days = (rs: DayRow[]) => new Set(rs.filter((r) => r.spend > 0).map((r) => r.date)).size

  if (q.level === 'campaign') {
    for (const c of CAMPAIGNS) {
      if (q.product && c.product !== q.product) continue
      const rs = all.filter((r) => r.ad.campaignId === c.id)
      const m = aggregate(rs)
      rows.push({
        level: 'campaign', id: c.id, name: c.name, campaignId: c.id, adsetId: '', accountId: c.accountId, product: c.product,
        status: c.status, effectiveStatus: c.status, budgetLevel: c.budgetLevel, dailyBudget: c.dailyBudget,
        metrics: m, target: targetCheck(m), activeDays: days(rs),
      })
    }
  } else if (q.level === 'adset') {
    for (const s of ADSETS) {
      if (q.parentId && s.campaignId !== q.parentId) continue
      const c = CAMPAIGNS.find((x) => x.id === s.campaignId)!
      if (q.product && c.product !== q.product) continue
      const rs = all.filter((r) => r.ad.adsetId === s.id)
      const m = aggregate(rs)
      rows.push({
        level: 'adset', id: s.id, name: s.name, campaignId: c.id, adsetId: s.id, accountId: c.accountId, product: c.product,
        status: 'ACTIVE', effectiveStatus: c.status === 'PAUSED' ? 'CAMPAIGN_PAUSED' : 'ACTIVE',
        budgetLevel: c.budgetLevel, dailyBudget: s.dailyBudget, metrics: m, target: targetCheck(m), activeDays: days(rs),
      })
    }
  } else {
    for (const a of ADS) {
      if (q.parentId && a.adsetId !== q.parentId) continue
      if (q.product && a.product !== q.product) continue
      const rs = all.filter((r) => r.ad.id === a.id)
      const m = aggregate(rs)
      const paused = !!a.paused && a.paused <= q.to
      const c = CAMPAIGNS.find((x) => x.id === a.campaignId)!
      rows.push({
        level: 'ad', id: a.id, name: a.name, campaignId: a.campaignId, adsetId: a.adsetId, accountId: a.accountId, product: a.product,
        status: paused ? 'PAUSED' : 'ACTIVE', effectiveStatus: paused ? 'PAUSED' : 'ACTIVE',
        budgetLevel: c.budgetLevel, dailyBudget: null, metrics: m, target: targetCheck(m), activeDays: days(rs),
      })
    }
  }
  rows.sort((a, b) => b.metrics.spend - a.metrics.spend)
  return { query: q, rows }
}

function trendPoints(q: PmQuery, filter?: (a: AdModel) => boolean, from = q.from): PmTrendPoint[] {
  return eachDay(from, q.to).map((date) => {
    const m = aggregate(rowsFor(q, filter, [date]))
    return {
      date, spend: m.spend, impressions: m.impressions, linkClicks: m.linkClicks, cpm: m.cpm, ctr: m.ctr,
      frequency: m.frequency, metaPurchases: m.metaPurchases, firstPartyOrders: m.firstPartyOrders,
      firstPartyRevenue: m.firstPartyRevenue, firstPartyRoas: m.firstPartyRoas, firstPartyCpa: m.firstPartyCpa,
      siteVisitors: m.siteVisitors,
    }
  })
}

export function fixtureTrend(q: PmQuery & { level?: PmLevel; id?: string }): PmTrendResponse {
  const level = q.level ?? 'account'
  const filter = entityFilter(level, q.id)
  const extended = trendPoints(q, filter, addDays(q.from, -6))
  const points = extended.slice(6)
  const rollingRoas7 = points.map((_, i) => {
    const win = extended.slice(i, i + 7)
    const spend = win.reduce((t, p) => t + p.spend, 0)
    return div(win.reduce((t, p) => t + p.firstPartyRevenue, 0), spend)
  })
  return { query: { ...q, level, id: q.id }, points, rollingRoas7 }
}

export function fixtureDecompose(q: PmQuery & { level?: PmLevel; id?: string }): PmDecomposeResponse {
  const level = q.level ?? 'account'
  const filter = entityFilter(level, q.id)
  const previous = previousOf(q)
  const cur = aggregate(rowsFor(q, filter))
  const pri = aggregate(rowsFor(previous, filter))
  const rel = (c: number | null, p: number | null) => (c == null || p == null || p === 0 ? null : c / p - 1)
  const ln = (c: number | null, p: number | null) => (c && p ? Math.log(c / p) : null)
  const terms = {
    cpm: ln(cur.cpm, pri.cpm),
    ctr: ln(cur.ctr, pri.ctr) == null ? null : -ln(cur.ctr, pri.ctr)!,
    clickToOrderRate: ln(cur.clickToOrderRate, pri.clickToOrderRate) == null ? null : -ln(cur.clickToOrderRate, pri.clickToOrderRate)!,
  }
  const total = ln(cur.firstPartyCpa, pri.firstPartyCpa)
  const contribution = (t: number | null) => (t == null || total == null || Math.abs(total) < 1e-6 ? null : t / total)
  const factors: PmDecomposeResponse['factors'] = [
    { name: 'cpm', current: cur.cpm, prior: pri.cpm, change: rel(cur.cpm, pri.cpm), contribution: contribution(terms.cpm) },
    { name: 'ctr', current: cur.ctr, prior: pri.ctr, change: rel(cur.ctr, pri.ctr), contribution: contribution(terms.ctr) },
    { name: 'clickToOrderRate', current: cur.clickToOrderRate, prior: pri.clickToOrderRate, change: rel(cur.clickToOrderRate, pri.clickToOrderRate), contribution: contribution(terms.clickToOrderRate) },
  ]
  const cpaChange = rel(cur.firstPartyCpa, pri.firstPartyCpa)
  const top = [...factors].filter((f) => f.contribution != null).sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))[0]
  const words: Record<string, string> = {
    cpm: 'ads getting more expensive to show (CPM)',
    ctr: 'fewer people clicking the ads (CTR)',
    clickToOrderRate: 'fewer clicks turning into orders on the site',
  }
  const confidence = confidenceFor(Math.min(cur.firstPartyOrders, pri.firstPartyOrders))
  let read: string
  if (cpaChange == null || !top) read = 'Not enough orders in one of the two periods to explain the CPA change.'
  else if (Math.abs(cpaChange) < 0.05) read = 'CPA is roughly flat versus the previous period; no single factor stands out.'
  else
    read = `CPA ${cpaChange > 0 ? 'rose' : 'fell'} ${Math.abs(cpaChange * 100).toFixed(0)}%. Most of the ${cpaChange > 0 ? 'rise' : 'fall'} came from ${cpaChange > 0 ? words[top.name] : words[top.name].replace('more expensive', 'cheaper').replace('fewer', 'more')}.`
  return {
    query: { ...q, level, id: q.id },
    previous,
    cpa: { current: cur.firstPartyCpa, prior: pri.firstPartyCpa, change: cpaChange },
    factors,
    read,
    confidence,
  }
}

const CHANNEL_MIX = [
  { channel: 'meta_ad', share: 1, conv: 1, deep: 0.31 },
  { channel: 'organic_search', share: 0.42, conv: 1.9, deep: 0.46 },
  { channel: 'direct', share: 0.28, conv: 2.4, deep: 0.52 },
  { channel: 'whatsapp', share: 0.17, conv: 2.9, deep: 0.49 },
  { channel: 'google_ads', share: 0.12, conv: 1.4, deep: 0.38 },
  { channel: 'instagram_organic', share: 0.09, conv: 0.8, deep: 0.27 },
]

export function fixtureFunnel(q: PmQuery & { channel?: string; adId?: string }): PmFunnelResponse {
  const meta = aggregate(rowsFor(q, q.adId ? (a) => a.id === q.adId : undefined))
  const mix = q.adId ? CHANNEL_MIX.slice(0, 1) : q.channel ? CHANNEL_MIX.filter((c) => c.channel === q.channel) : CHANNEL_MIX
  const byChannel = mix.map((c) => {
    const visitors = Math.round(meta.siteVisitors * c.share)
    const orders = c.channel === 'meta_ad' ? meta.firstPartyOrders : Math.round(meta.siteVisitors * c.share * (meta.visitToOrderRate ?? 0.01) * c.conv)
    return { channel: c.channel, visitors, orders, conversion: div(orders, visitors), deepScrollShare: visitors ? c.deep : null }
  })
  const visitors = byChannel.reduce((t, c) => t + c.visitors, 0)
  const orders = byChannel.reduce((t, c) => t + c.orders, 0)
  const ratio = visitors ? meta.siteVisitors / visitors : 1
  const stepCounts: [string, string, number][] = [
    ['landed', 'Landed on the product page', visitors],
    ['viewed_details', 'Scrolled to the report details', Math.round(visitors * 0.58)],
    ['viewed_price', 'Saw the price', Math.round(visitors * 0.37)],
    ['cta_click', 'Clicked “Get my report”', Math.round(meta.siteCtaClicks / ratio)],
    ['payment_started', 'Started payment', Math.round(meta.sitePaymentsStarted / ratio)],
    ['paid', 'Paid (confirmed order)', orders],
  ]
  const steps = stepCounts.map(([key, label, v], i) => ({
    key, label, visitors: v,
    rateFromPrevious: i === 0 ? null : div(v, stepCounts[i - 1][2]),
    rateFromStart: div(v, visitors),
  }))
  const band = (labels: string[], shares: number[], convs: number[]) =>
    labels.map((b, i) => {
      const v = Math.round(visitors * shares[i])
      const o = Math.round(orders * convs[i])
      return { band: b, visitors: v, orders: o, conversion: div(o, v) }
    })
  const split = <T extends string>(key: T, rows: [string, number, number][]) =>
    rows.map(([name, share, conv]) => {
      const v = Math.round(visitors * share)
      const o = Math.round(orders * conv)
      return { [key]: name, visitors: v, orders: o, conversion: div(o, v) } as { visitors: number; orders: number; conversion: number | null } & Record<T, string>
    })
  return {
    query: q,
    steps,
    scroll: band(['<25%', '25–49%', '50–74%', '75–99%', '100%'], [0.41, 0.22, 0.15, 0.13, 0.09], [0.02, 0.07, 0.16, 0.33, 0.42]),
    timeOnPage: band(['<10s', '10–30s', '30–60s', '1–3m', '3m+'], [0.33, 0.24, 0.17, 0.17, 0.09], [0.0, 0.04, 0.11, 0.39, 0.46]),
    byChannel,
    byDevice: split('device', [['Mobile · Android', 0.71, 0.66], ['Mobile · iOS', 0.17, 0.22], ['Desktop', 0.1, 0.11], ['Tablet', 0.02, 0.01]]),
    byLocale: split('locale', [['hi', 0.58, 0.55], ['en', 0.36, 0.4], ['other', 0.06, 0.05]]),
    caveat:
      'Scroll depth and time on page show who was already interested — they are correlations, not proof that longer or deeper visits cause purchases.',
  }
}

export function fixtureFatigue(q: PmQuery): PmFatigueResponse {
  const rows: PmFatigueRow[] = []
  for (const a of ADS) {
    if (q.product && a.product !== q.product) continue
    const live = rowsFor(q, (x) => x.id === a.id)
    if (!live.length) continue
    const firstWeek = rowsFor({ ...q, from: a.launched, to: addDays(a.launched, 6) }, (x) => x.id === a.id)
    const lastWeek = rowsFor({ ...q, from: addDays(q.to, -6), to: q.to }, (x) => x.id === a.id)
    const f = aggregate(firstWeek)
    const l = aggregate(lastWeek)
    const daysLive = daysBetween(a.launched, a.paused && a.paused <= q.to ? addDays(a.paused, -1) : q.to) + 1
    const reasons: string[] = []
    let status: PmFatigueRow['status'] = 'healthy'
    const freqUp = f.frequency && l.frequency ? l.frequency / f.frequency - 1 : null
    const ctrDown = f.ctr && l.ctr ? l.ctr / f.ctr - 1 : null
    const cpaUp = f.firstPartyCpa && l.firstPartyCpa ? l.firstPartyCpa / f.firstPartyCpa - 1 : null
    if (daysLive < 14 || l.firstPartyOrders + f.firstPartyOrders < 6) {
      status = 'not_enough_data'
      reasons.push(daysLive < 14 ? `Live for ${daysLive} days — needs at least 14 to compare weeks` : 'Too few orders to compare first and last week')
    } else {
      if (freqUp != null && freqUp > 0.25) reasons.push(`Frequency up ${(freqUp * 100).toFixed(0)}% since launch week (${f.frequency!.toFixed(1)} → ${l.frequency!.toFixed(1)})`)
      if (ctrDown != null && ctrDown < -0.15) reasons.push(`Link CTR down ${Math.abs(ctrDown * 100).toFixed(0)}% since launch week`)
      if (cpaUp != null && cpaUp > 0.25) reasons.push(`First-party CPA up ${(cpaUp * 100).toFixed(0)}% since launch week`)
      const rising = freqUp != null && freqUp > 0.25
      const worse = (ctrDown != null && ctrDown < -0.15) || (cpaUp != null && cpaUp > 0.25)
      status = rising && worse ? 'fatigued' : rising || worse ? 'watch' : 'healthy'
      if (status === 'healthy') reasons.push('Frequency, CTR and CPA are steady versus launch week')
    }
    rows.push({
      adId: a.id, adName: a.name, campaignName: CAMPAIGNS.find((c) => c.id === a.campaignId)!.name, product: a.product,
      daysLive, spend: aggregate(live).spend,
      frequencyFirst7: f.frequency, frequencyLast7: l.frequency, ctrFirst7: f.ctr, ctrLast7: l.ctr,
      cpaFirst7: f.firstPartyCpa, cpaLast7: l.firstPartyCpa, status, reasons, creative: a.creative,
    })
  }
  const order = { fatigued: 0, watch: 1, healthy: 2, not_enough_data: 3 }
  rows.sort((x, y) => order[x.status] - order[y.status] || y.spend - x.spend)
  return { query: q, rows }
}

const STATES: [string, number, number][] = [
  ['Uttar Pradesh', 0.19, 1.08], ['Maharashtra', 0.12, 0.92], ['Bihar', 0.1, 1.15], ['Rajasthan', 0.08, 1.02],
  ['Madhya Pradesh', 0.08, 0.97], ['Delhi', 0.07, 1.21], ['Gujarat', 0.06, 0.74], ['Uttarakhand', 0.05, 1.34],
  ['Haryana', 0.05, 1.05], ['Karnataka', 0.04, 0.61], ['West Bengal', 0.04, 0.68], ['Jharkhand', 0.03, 1.1],
  ['Tamil Nadu', 0.02, 0.38], ['Kerala', 0.01, 0.0],
]

export function fixtureGeo(q: PmQuery): PmGeoResponse {
  const m = aggregate(rowsFor(q))
  const rows = STATES.map(([state, share, conv]) => {
    const spend = Math.round(m.spend * share)
    const siteVisitors = Math.round(m.siteVisitors * share * (0.9 + conv * 0.1))
    const firstPartyOrders = Math.round(m.firstPartyOrders * share * conv)
    const firstPartyRevenue = Math.round(firstPartyOrders * (m.averageOrderValue ?? 1400))
    return {
      state, spend, linkClicks: Math.round(m.linkClicks * share), siteVisitors, firstPartyOrders, firstPartyRevenue,
      roasEstimate: div(firstPartyRevenue, spend), visitToOrderRate: div(firstPartyOrders, siteVisitors),
      confidence: confidenceFor(firstPartyOrders),
    }
  })
  return {
    query: q,
    rows,
    caveat:
      'Spend is Meta’s region breakdown; orders come from where our site saw the visitor. The two geographies do not always match, and most ad sets target all of India, so budget cannot be moved to a state without changing targeting.',
  }
}

function slope(xs: number[], ys: number[]): number | null {
  if (xs.length < 7) return null
  const mx = xs.reduce((t, x) => t + x, 0) / xs.length
  const my = ys.reduce((t, y) => t + y, 0) / ys.length
  let num = 0
  let den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  return den > 0 ? num / den : null
}

export function fixtureBudget(q: PmQuery): PmBudgetResponse {
  const units: { level: 'campaign' | 'adset'; id: string; name: string; budgetLevel: '' | 'campaign' | 'adset'; dailyBudget: number | null; learningStage: string; filter: (a: AdModel) => boolean }[] = []
  for (const c of CAMPAIGNS) {
    if (q.product && c.product !== q.product) continue
    if (c.budgetLevel === 'campaign') units.push({ level: 'campaign', id: c.id, name: c.name, budgetLevel: 'campaign', dailyBudget: c.dailyBudget, learningStage: c.learningStage, filter: (a) => a.campaignId === c.id })
    else for (const s of ADSETS.filter((x) => x.campaignId === c.id)) units.push({ level: 'adset', id: s.id, name: `${c.name} › ${s.name}`, budgetLevel: 'adset', dailyBudget: s.dailyBudget, learningStage: s.learningStage, filter: (a) => a.adsetId === s.id })
  }
  const rows: PmBudgetRow[] = units.map((u) => {
    const pts = trendPoints(q, u.filter).filter((p) => p.spend > 0)
    const m = aggregate(rowsFor(q, u.filter))
    const half = Math.floor(pts.length / 2)
    const avg = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => x != null)
      return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null
    }
    const f1 = avg(pts.slice(0, half).map((p) => p.frequency))
    const f2 = avg(pts.slice(half).map((p) => p.frequency))
    const r1 = avg(pts.slice(0, half).map((p) => (p.frequency ? p.impressions / p.frequency : null)))
    const r2 = avg(pts.slice(half).map((p) => (p.frequency ? p.impressions / p.frequency : null)))
    const frequencyTrend = f1 && f2 ? f2 / f1 - 1 : null
    const reachTrend = r1 && r2 ? r2 / r1 - 1 : null
    const marginalRoas = slope(pts.map((p) => p.spend), pts.map((p) => p.firstPartyRevenue))
    const reasons: string[] = []
    let signal: PmBudgetRow['signal']
    const roas = m.firstPartyRoas
    if (pts.length < 7 || m.firstPartyOrders < 10 || u.learningStage === 'LEARNING') {
      signal = 'not_enough_data'
      reasons.push(u.learningStage === 'LEARNING' ? 'Still in Meta’s learning phase — changing budget now resets it' : `${m.firstPartyOrders} orders over ${pts.length} spend days — too little to judge`)
    } else if (roas != null && roas < 0.75) {
      signal = 'reduce'
      reasons.push(`First-party ROAS ${roas.toFixed(2)}× is well under the 1.00× target`)
      if (marginalRoas != null) reasons.push(`Extra spend on busier days returned about ₹${marginalRoas.toFixed(2)} per ₹1`)
    } else if (frequencyTrend != null && frequencyTrend > 0.12 && (reachTrend ?? 0) < 0.03) {
      signal = 'saturating'
      reasons.push(`Frequency up ${(frequencyTrend * 100).toFixed(0)}% while daily reach is flat — the audience is being re-shown the same ads`)
    } else if (roas != null && roas >= 1.05 && (marginalRoas ?? 0) >= 0.9) {
      signal = 'room_to_scale'
      reasons.push(`First-party ROAS ${roas.toFixed(2)}× on ${m.firstPartyOrders} orders`)
      reasons.push(`Busier days held up: about ₹${(marginalRoas ?? 0).toFixed(2)} back per extra ₹1`)
      reasons.push('Test +15–20% for 7 days; stop if 7-day ROAS drops under 0.95×')
    } else {
      signal = 'hold'
      reasons.push(roas != null ? `ROAS ${roas.toFixed(2)}× is near target — no clear case to move budget` : 'No clear case to move budget')
    }
    if (u.budgetLevel === 'campaign') reasons.push('Budget is set on the campaign (CBO) — Meta splits it across ad sets')
    return {
      level: u.level, id: u.id, name: u.name, budgetLevel: u.budgetLevel, dailyBudget: u.dailyBudget, learningStage: u.learningStage,
      spend: m.spend, firstPartyRoas: roas, marginalRoas, frequencyTrend, reachTrend, signal, reasons,
    }
  })
  return {
    query: q,
    rows,
    caveat:
      'Marginal ROAS is how revenue moved with spend day to day in this range — descriptive, not causal. Scale in steps of 15–20% and re-check after 7 days; bigger jumps can restart Meta’s learning phase.',
  }
}

export function fixtureReconcile(q: PmQuery): PmReconcileResponse {
  const all = rowsFor(q)
  const rows = CAMPAIGNS.filter((c) => !q.product || c.product === q.product).map((c) => {
    const m = aggregate(all.filter((r) => r.ad.campaignId === c.id))
    return {
      campaignId: c.id, campaignName: c.name, product: c.product,
      metaPurchases: m.metaPurchases, metaPurchaseValue: m.metaPurchaseValue,
      firstPartyOrders: m.firstPartyOrders, firstPartyRevenue: m.firstPartyRevenue,
      matchRatio: div(m.firstPartyOrders, m.metaPurchases),
    }
  })
  const s = fixtureSummary(q)
  return {
    query: q,
    rows,
    totals: { metaPurchases: s.current.metaPurchases, firstPartyOrders: s.current.firstPartyOrders, allConfirmedOrders: s.allOrders.orders },
    notes: [
      'Meta counts purchases it attributes with 7-day click + 1-day view; first-party counts only confirmed, paid orders tied to a Meta ad click on the same device within 7 days.',
      'device_id rotates daily, so first-party attribution is a lower bound — a match ratio of 55–70% is normal here.',
      'Meta gets a flat ₹1,300 purchase value for Nadi Report Premium, so Meta-reported ROAS is not revenue.',
    ],
  }
}

export function fixtureChanges(q: { from: string; to: string; objectId?: string }): PmChangesResponse {
  const ev = (daysAgo: number, hour: string, objectType: string, objectId: string, objectName: string, eventType: string, translated: string, actor: string, extra: string) => ({
    eventTime: `${addDays(q.to, -daysAgo)}T${hour}:00+05:30`, accountId: objectId.endsWith('104') || objectId.endsWith('105') || objectId.endsWith('106') ? ACC_B : ACC_A,
    objectType, objectId, objectName, eventType, translatedEventType: translated, actorName: actor, extraData: extra,
  })
  const rows = [
    ev(0, '11:42', 'CAMPAIGN', CAMPAIGNS[0].id, CAMPAIGNS[0].name, 'update_campaign_budget', 'Campaign budget updated', 'Ritika S.', 'Daily budget ₹10,000 → ₹12,000'),
    ev(1, '18:05', 'AD', ADS[13].id, ADS[13].name, 'update_ad_run_status', 'Ad paused', 'Ankit M.', 'Status ACTIVE → PAUSED'),
    ev(2, '10:20', 'AD_SET', ADSETS[3].id, ADSETS[3].name, 'update_ad_set_targeting', 'Ad set targeting updated', 'Ritika S.', 'Added interest: Temples'),
    ev(4, '15:55', 'CAMPAIGN', CAMPAIGNS[3].id, CAMPAIGNS[3].name, 'create_campaign_group', 'Campaign created', 'Ankit M.', 'Advantage+ audience, ₹3,000/day'),
    ev(5, '09:12', 'AD', ADS[3].id, ADS[3].name, 'create_ad', 'Ad created', 'Ritika S.', 'Carousel · 5 cards'),
    ev(6, '13:31', 'AD_SET', ADSETS[4].id, ADSETS[4].name, 'update_ad_set_budget', 'Ad set budget updated', 'Ritika S.', 'Daily budget ₹1,500 → ₹1,800'),
    ev(9, '12:00', 'CAMPAIGN', CAMPAIGNS[5].id, CAMPAIGNS[5].name, 'update_campaign_budget', 'Campaign budget updated', 'Ankit M.', 'Daily budget ₹3,500 → ₹2,500'),
  ].filter((r) => r.eventTime.slice(0, 10) >= q.from && (!q.objectId || r.objectId === q.objectId || ADS.some((a) => a.id === r.objectId && (a.adsetId === q.objectId || a.campaignId === q.objectId)) || ADSETS.some((s) => s.id === r.objectId && s.campaignId === q.objectId)))
  return { query: q, rows }
}

export function fixtureReport(date?: string, product?: string): PmReportResponse {
  const d = date ?? istYesterday()
  const pq = product ? { product } : {}
  const last7: PmQuery = { from: addDays(d, -6), to: d, ...pq }
  const prior7: PmQuery = { from: addDays(d, -13), to: addDays(d, -7), ...pq }
  const last30: PmQuery = { from: addDays(d, -29), to: d, ...pq }
  const k7 = aggregate(rowsFor(last7))
  const p7 = aggregate(rowsFor(prior7))
  const target = targetCheck(k7)
  const byProduct = (Object.keys(PRODUCTS) as ProductId[]).filter((p) => !product || p === product).map((p) => {
    const m = aggregate(rowsFor({ ...last7, product: p }))
    const m0 = aggregate(rowsFor({ ...prior7, product: p }))
    return { product: p, label: PRODUCTS[p].label, last7: m, prior7: m0, target: targetCheck(m) }
  })

  const findings: PmFinding[] = []
  const camps = fixtureEntities({ ...last7, level: 'campaign' }).rows
  for (const c of camps) {
    const r = c.metrics.firstPartyRoas
    if (c.target.verdict === 'below_target' && r != null)
      findings.push({ severity: r < 0.7 ? 'critical' : 'warning', area: 'roas', entity: { level: 'campaign', id: c.id, name: c.name }, title: `Returning ₹${r.toFixed(2)} per ₹1 — below target`, evidence: `${formatRs(c.metrics.spend)} spent, ${c.metrics.firstPartyOrders} first-party orders, ${formatRs(c.metrics.firstPartyRevenue)} net revenue, last 7 days (${last7.from} to ${last7.to}). First-party, device-matched, 7-day click.`, confidence: c.target.confidence, action: r < 0.7 ? 'reduce_budget' : 'investigate' })
    else if (c.target.verdict === 'above_target' && r != null)
      findings.push({ severity: 'positive', area: 'roas', entity: { level: 'campaign', id: c.id, name: c.name }, title: `Returning ₹${r.toFixed(2)} per ₹1 — above target`, evidence: `${c.metrics.firstPartyOrders} first-party orders on ${formatRs(c.metrics.spend)} spend, last 7 days. First-party CPA ${formatRs(c.metrics.firstPartyCpa ?? 0)}.`, confidence: c.target.confidence, action: 'hold' })
    else if (c.target.verdict === 'not_enough_data')
      findings.push({ severity: 'info', area: 'roas', entity: { level: 'campaign', id: c.id, name: c.name }, title: 'Too early to judge', evidence: `${c.target.note}; ${formatRs(c.metrics.spend)} spent in the last 7 days. Hold and collect more data.`, confidence: 'low', action: 'hold' })
  }
  for (const f of fixtureFatigue(last7).rows.filter((x) => x.status === 'fatigued' && x.spend >= 12000))
    findings.push({ severity: 'warning', area: 'fatigue', entity: { level: 'ad', id: f.adId, name: f.adName }, title: 'Creative looks tired — prepare a refresh', evidence: `${f.reasons.join('; ')}. Launch week vs last 7 days, Meta delivery + first-party orders.`, confidence: f.spend > 10000 ? 'medium' : 'low', action: 'refresh_creative' })
  for (const b of fixtureBudget(last30).rows.filter((x) => x.signal === 'room_to_scale'))
    findings.push({ severity: 'positive', area: 'budget', entity: { level: b.level, id: b.id, name: b.name }, title: 'Candidate for a controlled budget test', evidence: `${b.reasons.join('. ')}. Last 30 days.`, confidence: 'medium', action: 'test' })
  for (const b of fixtureBudget(last30).rows.filter((x) => x.signal === 'saturating'))
    findings.push({ severity: 'warning', area: 'budget', entity: { level: b.level, id: b.id, name: b.name }, title: 'Audience is saturating — widen targeting before adding budget', evidence: `${b.reasons.join('. ')}. Last 30 days, Meta delivery.`, confidence: 'medium', action: 'change_targeting' })
  const funnel = fixtureFunnel({ ...last7, channel: 'meta_ad' })
  const pay = funnel.steps.find((s) => s.key === 'paid')
  if (pay?.rateFromPrevious != null && pay.rateFromPrevious < 0.4)
    findings.push({ severity: 'warning', area: 'funnel', entity: { level: 'account', name: 'Checkout' }, title: `Only ${pct(pay.rateFromPrevious)} of started payments finish`, evidence: `${funnel.steps.find((s) => s.key === 'payment_started')?.visitors ?? 0} Meta visitors started payment and ${pay.visitors} paid, last 7 days (website + first-party orders). Check payment errors and the checkout page before touching ads.`, confidence: 'medium', action: 'fix_funnel' })
  const recon = fixtureReconcile(last7)
  const match = div(recon.totals.firstPartyOrders, recon.totals.metaPurchases) ?? 1
  findings.push({ severity: match < 0.55 ? 'warning' : 'info', area: 'tracking', entity: { level: 'account', name: 'All accounts' }, title: `First-party matched ${pct(div(recon.totals.firstPartyOrders, recon.totals.metaPurchases))} of Meta-reported purchases`, evidence: `Meta reported ${recon.totals.metaPurchases} purchases; we tied ${recon.totals.firstPartyOrders} confirmed orders to a Meta click out of ${recon.totals.allConfirmedOrders} confirmed orders overall, last 7 days. Normal range is 55–70%.`, confidence: 'high', action: match < 0.55 ? 'fix_tracking' : 'hold' })
  findings.push({ severity: 'info', area: 'change', entity: { level: 'campaign', id: CAMPAIGNS[0].id, name: CAMPAIGNS[0].name }, title: 'Budget raised yesterday — judge it after 3–4 days', evidence: 'Daily budget ₹10,000 → ₹12,000 (Meta activity log). One day of data is not enough to read the effect.', confidence: 'high', action: 'hold' })
  const sevOrder = { critical: 0, warning: 1, positive: 2, info: 3 }
  findings.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity])

  const roas = k7.firstPartyRoas
  const prev = p7.firstPartyRoas
  const headline =
    roas == null
      ? 'Not enough orders in the last 7 days to judge return.'
      : `Last 7 days returned ₹${roas.toFixed(2)} per ₹1 of Meta spend (first-party), ${prev != null ? `${roas >= prev ? 'up' : 'down'} from ₹${prev.toFixed(2)} the week before` : 'no prior week to compare'} — ${roas >= 1 ? 'at or above' : 'below'} the 1.00× target.`

  return { date: d, window: { last7, prior7, last30 }, headline, kpis: { last7: k7, prior7: p7, target }, byProduct, findings, generatedAt: `${addDays(d, 1)}T07:30:00+05:30` }
}

function formatRs(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function pct(x: number | null): string {
  return x == null ? '—' : `${Math.round(x * 100)}%`
}


// ── Step 3 AI analyst runs (agent/*) ───────────────────────────────────────

const AGENT_CAMPAIGNS = [
  { campaignId: '120211000000000001', campaignName: 'Nadi Premium · Hindi · Broad', product: 'nadi-report-premium' },
  { campaignId: '120211000000000002', campaignName: 'Golu Devta Arzi · Uttarakhand', product: 'golu-devta-arzi' },
  { campaignId: '120211000000000003', campaignName: 'Nadi Report · English · Lookalike', product: 'nadi-report' },
] as const

/** Run dates: today (IST) and the 4 days before; the newest has one run still going. */
export function fixtureAgentDates(): string[] {
  const today = addDays(istYesterday(), 1)
  return [0, 1, 2, 3, 4].map((n) => addDays(today, -n))
}

const agentNotes = new Map<string, string>()

function agentAction(date: string, i: number, over: Partial<PmAgentAction>): PmAgentAction {
  return {
    id: `A${i}`,
    type: 'budget',
    title: '',
    causeIds: ['C1'],
    entityLevel: 'adset',
    entityId: `12022${i}000000000`,
    entityName: 'Hindi 25-44 · Advantage+',
    change: { field: 'daily_budget', from: 10000, to: 8000 },
    expectedEffect: { metric: 'CPA', low: -15, high: -5, evidence: ['ev-12'] },
    impactRupeesPerDay: 0,
    confidence: 0.5,
    resetsLearning: false,
    judgeOn: addDays(date, 3),
    stopCondition: 'CPA above ₹1,300 for 2 days in a row',
    verdict: 'approve',
    rank: i,
    ...over,
  }
}

export function fixtureAgentRun(campaignId: string, date: string): PmAgentRun {
  const dates = fixtureAgentDates()
  const known = AGENT_CAMPAIGNS.findIndex((c) => c.campaignId === campaignId)
  const qi = queueItems(date).find((x) => x.campaignId === campaignId)
  if ((known < 0 && !qi) || !dates.includes(date)) throw new Error('404 No run for this campaign and date')
  const c = known >= 0 ? AGENT_CAMPAIGNS[known] : { campaignId, campaignName: qi!.campaignName, product: qi!.product }
  // Campaigns queued from the Overview tab borrow one of the three canned plans.
  const idx = known >= 0 ? known : hash(campaignId) % 3
  const latest = date === dates[0]
  const status = qi ? qi.status : !latest && idx === 1 && date === dates[1] ? 'failed' : 'done'
  const actions: PmAgentAction[] =
    status !== 'done'
      ? []
      : idx === 0
        ? [
            agentAction(date, 1, { title: 'Cut budget on the tired Hindi ad set', impactRupeesPerDay: 4200, confidence: 0.8 }),
            agentAction(date, 2, {
              type: 'creative',
              title: 'Pause “Premium v3” and launch a Diwali hook',
              entityLevel: 'ad',
              entityName: 'Nadi Premium Hindi v3',
              change: { field: 'status', from: 'ACTIVE', to: 'PAUSED' },
              impactRupeesPerDay: 3100,
              confidence: 0.5,
              resetsLearning: true,
              judgeOn: addDays(date, 7),
              creativeBrief: 'Open on a diya + palm-leaf shot in the first 2 s; Hindi VO “Aapki naadi mein kya likha hai?”; price card at 4 s.',
              disputed: true,
            }),
            agentAction(date, 3, {
              type: 'geo',
              title: 'Exclude Tamil Nadu and Kerala (no orders in 14 days)',
              entityName: 'Hindi 25-44 · Advantage+',
              change: { field: 'geo_exclusions', from: null, to: 'IN-TN, IN-KL' },
              impactRupeesPerDay: 900,
              confidence: 0.2,
              verdict: 'unresolved',
              checksFailed: ['Spend share number did not match a tool result (ev-31)'],
            }),
          ]
        : idx === 1
          ? [agentAction(date, 1, { type: 'hold', title: 'Hold — budget change on 25 Oct is still settling', change: { field: 'none', from: null, to: null }, impactRupeesPerDay: 0, confidence: 0.8, entityLevel: 'campaign', entityName: c.campaignName })]
          : [agentAction(date, 1, { type: 'landing_funnel', title: 'Fix the payment page drop on mobile', entityLevel: 'site', entityName: 'nadi-report checkout', change: { field: 'checkout', from: 'UPI intent off', to: 'UPI intent on' }, impactRupeesPerDay: 2600, confidence: 0.5 })]
  const md = (title: string, body: string) => `---\nphase: ${title}  campaign: ${c.campaignId}  round: 1\n---\n# ${title}\n\n${body}\n`
  const files: Record<string, string> =
    status === 'done'
      ? {
          '00-brief.md': md('brief', `## Last 7 days\n- Spend ₹70,400 · first-party ROAS 0.62× · CPA ₹1,180\n- Frequency 3.8 on the Hindi ad set (was 2.1)`),
          '00-journal.md': md('journal', '## 2026-10-25 · A1 cut budget 20% — TAKEN\nDay 2 (early): CPA 1,120 → 980'),
          '01-investigate.v1.md': md('investigate', '## C1 Creative fatigue — 0.8\nEvidence: frequency 3.8 (ev-12), CTR −31% (ev-13).\n\n## C2 CPM shock — 0.5'),
          '02-verify.v1.md': md('verify', 'verdict: send_back · blockers: 1\n\n## Issue I1 · blocker · on C3 “Tracking broken”\nUTM coverage 98% (ev-31).'),
          '01-investigate.v2.md': md('investigate', 'C3 dropped (accepted I1).'),
          '02-verify.v2.md': md('verify', 'verdict: pass'),
          '03-plan.v1.md': md('plan', 'pathToTarget: possible\n\n' + actions.map((a) => `- ${a.id} ${a.title}`).join('\n')),
          '04-plan-verify.v1.md': md('plan_verify', 'verdict: pass · A3 unresolved (number check)'),
          '05-actions.md': md('actions', actions.map((a) => `## ${a.id} · ${a.title}\n${a.entityName}: ${a.change.from ?? '—'} → ${a.change.to ?? '—'} · ₹${a.impactRupeesPerDay}/day`).join('\n\n')),
        }
      : { '00-brief.md': md('brief', '## Last 7 days\n- Spend ₹22,100 · first-party ROAS 1.08×') }
  return {
    tenantId: '91astrology',
    date,
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    accountId: 'act_000000',
    product: c.product,
    status,
    step: qi ? qi.step : status === 'failed' ? 'plan v1' : '',
    error: qi ? qi.error : status === 'failed' ? 'Phase plan v1 hit its budget cap ($4.00)' : '',
    investigateRounds: status === 'running' ? 2 : idx === 0 ? 2 : 1,
    planRounds: status === 'done' ? 1 : 0,
    unresolved: idx === 0 && status === 'done' ? ['I4 (minor) — A3 spend-share number not re-derived'] : [],
    actions,
    impactRupeesPerDay: actions.reduce((s, a) => s + a.impactRupeesPerDay, 0),
    files,
    journal:
      idx === 0
        ? [
            { date: addDays(date, -2), actionId: 'A1', title: 'Cut ad set “Hindi 25-44” budget 20%', status: 'taken', matched: ['Meta log 14:02, 10,000 → 8,000'], resetsLearning: false, read: 'early', resultSoFar: 'CPA 1,120 → 980, ROAS 0.61 → 0.74', judgeAgainOn: addDays(date, 5) },
            { date: addDays(date, -2), actionId: 'A2', title: 'Pause ad “Premium v3”', status: 'not_taken', matched: [], resetsLearning: true, read: 'too_soon', resultSoFar: '—', userNote: 'Waiting for the Diwali creative' },
            { date: addDays(date, -8), actionId: 'A1', title: 'Raise Lookalike 1% budget 15%', status: 'partly', matched: ['Meta log, 6,000 → 6,500'], resetsLearning: false, read: 'settled', resultSoFar: 'ROAS flat at 0.9×' },
            { date: addDays(date, -1), title: 'New ad “Diwali v1” created by a teammate', status: 'outside_change', matched: ['Meta log 18:40'], resetsLearning: true, read: 'too_soon', resultSoFar: 'Learning reset', judgeAgainOn: addDays(date, 6) },
          ]
        : [],
    userNote: agentNotes.get(`${campaignId}|${date}`) ?? '',
    costUsd: qi ? qi.costUsd : status === 'done' ? 3.42 + idx : 1.1,
    startedAt: qi ? qi.startedAt : `${date}T01:10:00+05:30`,
    finishedAt: qi ? qi.finishedAt : `${date}T01:52:00+05:30`,
  }
}

export function fixtureAgentRollup(date?: string): PmAgentRollup {
  const d = date ?? fixtureAgentDates()[0]
  if (!fixtureAgentDates().includes(d)) return { date: d, runs: [], actions: [] }
  const ids = new Set<string>([...AGENT_CAMPAIGNS.map((c) => c.campaignId), ...queueItems(d).map((x) => x.campaignId)])
  const runs = [...ids].map((id) => fixtureAgentRun(id, d))
  return {
    date: d,
    runs: runs
      .map((r) => ({
        campaignId: r.campaignId, campaignName: r.campaignName, product: r.product, status: r.status, step: r.step, error: r.error,
        investigateRounds: r.investigateRounds, planRounds: r.planRounds, impactRupeesPerDay: r.impactRupeesPerDay,
        actionCount: r.actions.length, unresolvedCount: r.unresolved.length, costUsd: r.costUsd, startedAt: r.startedAt, finishedAt: r.finishedAt,
      }))
      .sort((a, b) => b.impactRupeesPerDay - a.impactRupeesPerDay),
    actions: runs
      .flatMap((r) => r.actions.map((a) => ({ ...a, campaignId: r.campaignId, campaignName: r.campaignName })))
      .sort((a, b) => b.impactRupeesPerDay * b.confidence - a.impactRupeesPerDay * a.confidence || a.rank - b.rank),
  }
}

export function fixtureAgentNote(campaignId: string, date: string, note: string) {
  agentNotes.set(`${campaignId}|${date}`, note.trim())
  return { campaignId, date, userNote: note.trim() }
}

// ── Admin queue (agent/queue) — each poll advances the running item one phase ──

const QUEUE_STEPS = ['brief', 'investigate v1', 'verify v1', 'investigate v2', 'verify v2', 'plan v1', 'plan check v1', 'actions']
const QUEUE_CAP_USD = 40
interface MockQueueItem {
  campaignId: string
  campaignName: string
  product: string
  date: string
  status: PmAgentRunStatus
  step: string
  stepIdx: number
  error: string
  queuedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  heartbeatAt: string | null
  costUsd: number
}
const queueState = new Map<string, MockQueueItem[]>()
const isoNow = () => new Date().toISOString()

/** Today starts with the nightly runs: two done, the third mid-way through verify v2. */
function queueItems(date: string): MockQueueItem[] {
  let items = queueState.get(date)
  if (!items) {
    const today = addDays(istYesterday(), 1)
    items =
      date !== today
        ? []
        : AGENT_CAMPAIGNS.map((c, i) => ({
            ...c,
            date,
            status: i < 2 ? ('done' as const) : ('running' as const),
            step: i < 2 ? '' : 'verify v2',
            stepIdx: i < 2 ? QUEUE_STEPS.length : 4,
            error: '',
            queuedAt: `${date}T01:00:00+05:30`,
            startedAt: i < 2 ? `${date}T01:10:00+05:30` : new Date(Date.now() - 6 * 60_000).toISOString(),
            finishedAt: i < 2 ? `${date}T01:52:00+05:30` : null,
            heartbeatAt: isoNow(),
            costUsd: i < 2 ? 3.42 + i : 1.1,
          }))
    queueState.set(date, items)
  }
  return items
}

let lastAdvance = 0

/** One phase per poll; calls closer than 5 s (StrictMode double effects, the confirm dialog) don't count. */
function advanceQueue(date: string) {
  if (Date.now() - lastAdvance < 5000) return
  lastAdvance = Date.now()
  const items = queueItems(date)
  const running = items.find((x) => x.status === 'running')
  if (running) {
    running.stepIdx++
    running.heartbeatAt = isoNow()
    running.costUsd = Math.round((running.costUsd + 0.45) * 100) / 100
    if (running.stepIdx >= QUEUE_STEPS.length) Object.assign(running, { status: 'done', step: '', finishedAt: isoNow() })
    else running.step = QUEUE_STEPS[running.stepIdx]
  } else {
    const next = items.find((x) => x.status === 'queued')
    if (next) Object.assign(next, { status: 'running', step: QUEUE_STEPS[0], stepIdx: 0, startedAt: isoNow(), heartbeatAt: isoNow() })
  }
}

export function fixtureQueue(date: string): PmAgentQueue {
  advanceQueue(date)
  const items = queueItems(date)
  const queued = items.filter((x) => x.status === 'queued')
  return {
    date,
    worker: true,
    capUsd: QUEUE_CAP_USD,
    spentUsd: Math.round(items.reduce((s, x) => s + x.costUsd, 0) * 100) / 100,
    queued: queued.map((x, i) => ({ campaignId: x.campaignId, campaignName: x.campaignName, date: x.date, step: x.step, position: i + 1, queuedAt: x.queuedAt, queuedBy: 'admin@91astrology.com' })),
    running: items
      .filter((x) => x.status === 'running')
      .map((x) => ({ campaignId: x.campaignId, campaignName: x.campaignName, date: x.date, step: x.step, startedAt: x.startedAt, heartbeatAt: x.heartbeatAt, costUsd: x.costUsd })),
    finished: items
      .filter((x): x is MockQueueItem & { status: 'done' | 'failed' } => x.status === 'done' || x.status === 'failed')
      .map((x) => ({ campaignId: x.campaignId, campaignName: x.campaignName, date: x.date, step: x.step, status: x.status, error: x.error, costUsd: x.costUsd, finishedAt: x.finishedAt, actionCount: fixtureAgentRun(x.campaignId, x.date).actions.length })),
  }
}

export function fixtureEnqueue(body: PmAgentEnqueueRequest): PmAgentEnqueueResult {
  const date = body.date ?? addDays(istYesterday(), 1)
  if (!body.campaignIds.length || body.campaignIds.length > 20) throw new Error('400 {"message":"campaignIds must have 1–20 entries"}')
  const items = queueItems(date)
  const out: PmAgentEnqueueResult = { queued: [], skipped: [] }
  for (const id of body.campaignIds) {
    const known = CAMPAIGNS.find((c) => c.id === id) ?? AGENT_CAMPAIGNS.map((c) => ({ id: c.campaignId, name: c.campaignName, product: c.product })).find((c) => c.id === id)
    const have = items.find((x) => x.campaignId === id)
    if (!known) out.skipped.push({ campaignId: id, reason: 'campaign not found' })
    else if (have && (have.status === 'queued' || have.status === 'running')) out.skipped.push({ campaignId: id, reason: `already ${have.status}` })
    else if (have && !body.rerun) out.skipped.push({ campaignId: id, reason: `already analysed for ${date} — pass rerun` })
    else {
      const item: MockQueueItem = { campaignId: id, campaignName: known.name, product: known.product, date, status: 'queued', step: '', stepIdx: 0, error: '', queuedAt: isoNow(), startedAt: null, finishedAt: null, heartbeatAt: null, costUsd: 0 }
      if (have) Object.assign(have, item)
      else items.push(item)
      out.queued.push(id)
    }
  }
  return out
}

export function fixtureCancelQueued(campaignId: string, date: string): PmAgentCancelResult {
  const items = queueItems(date)
  const it = items.find((x) => x.campaignId === campaignId)
  if (!it) throw new Error('404 {"message":"Nothing queued for this campaign and date"}')
  if (it.status !== 'queued') throw new Error(`409 {"message":"This analysis is ${it.status === 'running' ? 'already running' : 'already finished'} and can’t be cancelled"}`)
  items.splice(items.indexOf(it), 1)
  return { campaignId, date, cancelled: 'deleted' }
}

// ── Purchase targets (agent/targets) ──

const targets = new Map<string, PmCampaignTarget>()

export function fixtureCampaignList(): PmCampaignListItem[] {
  return [
    ...AGENT_CAMPAIGNS.map((c, i) => ({
      id: c.campaignId,
      name: c.campaignName,
      accountId: '6995951240481576',
      effectiveStatus: 'ACTIVE',
      createdTime: `2026-0${7 + i}-12T06:00:00Z`,
      product: c.product,
      dailyBudget: 5000 * (i + 1),
    })),
    ...Array.from({ length: 30 }, (_, i) => ({
      id: `1202110000000001${String(i).padStart(2, '0')}`,
      name: `Old test campaign ${i + 1}`,
      accountId: '549390260260950',
      effectiveStatus: 'PAUSED',
      createdTime: `2026-05-${String((i % 28) + 1).padStart(2, '0')}T06:00:00Z`,
      product: 'other',
      dailyBudget: null,
    })),
  ]
}

export function fixtureTargets(): PmCampaignTarget[] {
  return [...targets.values()].filter((x) => x.targetPurchases != null)
}

export function fixtureSetTarget(campaignId: string, targetPurchases: number | null): PmCampaignTarget {
  const t = { campaignId, targetPurchases, updatedBy: 'you', updatedAt: new Date().toISOString() }
  targets.set(campaignId, t)
  return t
}

// ── Lessons (lessons/*) — mutable in-memory state so approve/edit/retire work ──

const C1 = AGENT_CAMPAIGNS[0].campaignId
const C2 = AGENT_CAMPAIGNS[1].campaignId
const C3 = AGENT_CAMPAIGNS[2].campaignId
const lday = (n: number) => addDays(istYesterday(), -n)

const lessonsState: PmLesson[] = [
  {
    lessonId: 'L-1', type: 'action_effect', status: 'active', version: 2, confidence: 0.8, uses: 9, hits: 7,
    statement: 'When an ABO Nadi Premium prospecting ad set has 7-day ROAS ≥ 1.1, a +20% budget step kept ROAS within −10%.',
    because: 'Curator’s reading: the audience was not saturated (frequency/day < 1.4).',
    scope: { product: 'nadi-report-premium', structure: 'ABO', audience: 'prospecting', roas7d: '>=1.1' },
    cases: [
      { ref: `D-${lday(40)}-${C1}-A1`, supports: true, campaignId: C1, at: lday(40) },
      { ref: `D-${lday(33)}-${C3}-A2`, supports: true, campaignId: C3, at: lday(33) },
      { ref: `D-${lday(26)}-${C1}-A1`, supports: true, campaignId: C1, at: lday(26) },
      { ref: `D-${lday(19)}-${C1}-A3`, supports: false, campaignId: C1, at: lday(19) },
      { ref: `D-${lday(12)}-${C3}-A1`, supports: true, campaignId: C3, at: lday(12) },
    ],
    approvedAt: `${lday(30)}T05:10:00Z`, reviewBy: lday(-60), createdAt: `${lday(38)}T04:00:00Z`,
    events: [
      { at: `${lday(38)}T04:00:00Z`, kind: 'created', note: 'Curator ADD as candidate', version: 1 },
      { at: `${lday(30)}T05:10:00Z`, kind: 'approved', note: 'Promoted after 3 clean cases', version: 1 },
      { at: `${lday(12)}T04:00:00Z`, kind: 'edited', note: 'Scope narrowed to prospecting', version: 2 },
    ],
  },
  {
    lessonId: 'L-2', type: 'diagnosis_pattern', status: 'review', version: 1, confidence: 0.5, uses: 8, hits: 4,
    statement: 'CTR −30% with frequency/day < 1.3 was not creative fatigue; check the placement mix first.',
    scope: { symptoms: 'ctr_drop', phase: 'investigate' },
    cases: [
      { ref: `DC-${lday(35)}-${C2}-C1`, supports: true, campaignId: C2, at: lday(35) },
      { ref: `DC-${lday(21)}-${C1}-C2`, supports: true, campaignId: C1, at: lday(21) },
      { ref: `DC-${lday(9)}-${C2}-C1`, supports: false, campaignId: C2, at: lday(9) },
      { ref: `DC-${lday(4)}-${C1}-C1`, supports: false, campaignId: C1, at: lday(4) },
    ],
    approvedAt: `${lday(28)}T05:00:00Z`, reviewBy: lday(-14), createdAt: `${lday(34)}T04:00:00Z`,
  },
  {
    lessonId: 'L-3', type: 'season_effect', status: 'candidate', version: 1, confidence: 0.2, uses: 0, hits: 0,
    statement: 'Pitru Paksha 2026: Nadi orders −35% and CPM +12% against the 4 weeks before.',
    scope: { season: 'pitru-paksha', product: 'nadi-report|nadi-report-premium' },
    cases: [{ ref: 'cev-2026-W39-1', supports: true, campaignId: C1, at: lday(30) }],
    createdAt: `${lday(6)}T04:00:00Z`,
  },
  {
    lessonId: 'L-4', type: 'analyst_habit', status: 'retired', version: 1, confidence: 0.2, uses: 7, hits: 3,
    statement: 'The analyst over-blames tracking; check first-party coverage before citing a pixel gap.',
    scope: { phase: 'investigate', category: 'tracking' },
    cases: [{ ref: `DC-${lday(50)}-${C3}-C2`, supports: true, campaignId: C3, at: lday(50) }],
    createdAt: `${lday(70)}T04:00:00Z`,
  },
]

const proposalsState: PmLessonProposal[] = [
  {
    proposalId: 'P-2026-W43-1', week: '2026-W43', op: 'PROMOTE', lessonId: 'L-5', status: 'pending',
    why: '3 clean supporting cases across 2 campaigns, support share 100%.',
    lesson: {
      lessonId: 'L-5', type: 'creative_pattern', statement: 'Hindi testimonial video hooks beat static images for Nadi Premium: hook rate 31% vs 18%.',
      scope: { product: 'nadi-report-premium', phase: 'plan' }, confidence: 0.5,
    },
    cases: [
      { ref: 'cev-2026-W41-2', supports: true, campaignId: C1, at: lday(16) },
      { ref: 'cev-2026-W42-1', supports: true, campaignId: C3, at: lday(10) },
      { ref: 'cev-2026-W43-4', supports: true, campaignId: C1, at: lday(3) },
    ],
    validation: { ok: true, problems: [] },
  },
  {
    proposalId: 'P-2026-W43-2', week: '2026-W43', op: 'RETIRE', lessonId: 'L-2', status: 'pending',
    why: '2 contradictions in a row; share 50% over the last 8 graded uses.',
    lesson: lessonsState[1],
    cases: lessonsState[1].cases.slice(2),
    validation: { ok: true, problems: [] },
  },
  {
    proposalId: 'P-2026-W43-3', week: '2026-W43', op: 'MERGE', lessonId: 'L-1', mergeIds: ['L-1', 'L-6'], status: 'pending',
    why: 'L-6 says the same thing for CBO; one lesson with a wider scope.',
    lesson: { ...lessonsState[0], scope: { product: 'nadi-report-premium', structure: 'ABO|CBO', roas7d: '>=1.1' } },
    validation: { ok: false, problems: ['Case D-2026-09-30-out-1a2b3c4d is contaminated (other_edit) and cannot count.'] },
  },
]

let ownerRulesState: PmOwnerRule[] = [
  { ruleId: 'R-1', text: 'Never pause an ad before day 3.', active: true, check: { kind: 'no_pause_before_days', days: 3 } },
  { ruleId: 'R-2', text: 'Never raise Golu Devta budget during Kharmas.', active: true, check: { kind: 'no_budget_increase_in_season', season: 'kharmas', product: 'golu-devta-arzi' } },
  { ruleId: 'R-3', text: 'Prefer Hindi creatives for Tier 2/3 states.', active: true },
]

const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function fixtureLessons(f: { status?: PmLessonStatus; type?: PmLessonType }): PmLesson[] {
  return copy(lessonsState.filter((l) => (!f.status || l.status === f.status) && (!f.type || l.type === f.type)))
}

export function fixtureLessonProposals(status: string): PmLessonProposal[] {
  return copy(proposalsState.filter((p) => !status || p.status === status))
}

export function fixtureDecideProposal(id: string, status: 'approved' | 'rejected', note?: string) {
  const p = proposalsState.find((x) => x.proposalId === id)
  if (!p || p.status !== 'pending') throw new Error('404 No pending proposal with this id')
  if (status === 'approved' && !p.validation.ok) throw new Error('400 This proposal failed validation and cannot be approved')
  Object.assign(p, { status, decidedAt: new Date().toISOString(), decidedNote: note })
  if (status === 'approved') {
    const l = lessonsState.find((x) => x.lessonId === p.lessonId)
    if (p.op === 'RETIRE' && l) l.status = 'retired'
    if (p.op === 'PROMOTE' && p.lesson && !l)
      lessonsState.push({ status: 'active', version: 1, uses: 0, hits: 0, cases: p.cases ?? [], confidence: 0.5, ...p.lesson } as PmLesson)
  }
  return { proposalId: p.proposalId, status, lessonId: p.lessonId }
}

export function fixtureEditLesson(id: string, patch: Partial<PmLesson>) {
  const l = lessonsState.find((x) => x.lessonId === id)
  if (!l) throw new Error('404 No lesson with this id')
  Object.assign(l, patch, { version: l.version + 1 })
  ;(l.events ??= []).push({ at: new Date().toISOString(), kind: patch.status === 'retired' ? 'retired' : 'edited', version: l.version })
  return copy(l)
}

export function fixtureOwnerRules(): PmOwnerRule[] {
  return copy(ownerRulesState)
}

export function fixtureSaveOwnerRule(id: string | null, r: Omit<PmOwnerRule, 'ruleId' | 'check'> & { check: PmOwnerRule['check'] | null }) {
  const rule: PmOwnerRule = { ruleId: id ?? `R-${ownerRulesState.length + 1}`, text: r.text, active: r.active, ...(r.check ? { check: r.check } : {}) }
  ownerRulesState = id ? ownerRulesState.map((x) => (x.ruleId === id ? rule : x)) : [...ownerRulesState, rule]
  return copy(rule)
}

export function fixtureDeleteOwnerRule(id: string) {
  ownerRulesState = ownerRulesState.filter((x) => x.ruleId !== id)
  return { ok: true }
}

export function fixtureLessonScorecard(weeks: number): PmLessonScorecard {
  const share = (a: number, b: number) => (b ? Math.round((a / b) * 100) / 100 : null)
  const at = (n: number, worked: number) => ({ n, worked, rate: share(worked, n) ?? 0 })
  return {
    from: lday(7 * weeks),
    to: lday(-1),
    weeks: Array.from({ length: weeks }, (_, i): PmLessonScorecard['weeks'][number] => {
      const g = i < 2 ? 0 : 6 + ((i * 5) % 9)
      const inside = Math.round(g * (0.45 + i * 0.03))
      return {
        week: `2026-W${i + 36}`,
        byActionType: g ? { budget: at(Math.ceil(g / 2), Math.ceil(g / 3)), creative: at(Math.floor(g / 3), Math.floor(g / 5)), pause: at(2, i % 2 ? 2 : 1) } : {},
        calibration: { n: g, inside, share: share(inside, g) },
        acceptance: { recommended: 10 + i, taken: 5 + i, share: share(5 + i, 10 + i) },
        diagnosis: { n: g ? 4 : 0, held: g ? 3 : 0, accuracy: g ? 0.75 : null },
        realisedRupees: g ? 4000 + i * 1800 : 0,
      }
    }),
    lessons: lessonsState.filter((l) => l.status === 'active' || l.status === 'review').map((l) => ({ lessonId: l.lessonId, type: l.type, status: l.status, uses: l.uses, hits: l.hits, hitRate: share(l.hits, l.uses) })),
    notes: 'Sample data.',
  }
}
