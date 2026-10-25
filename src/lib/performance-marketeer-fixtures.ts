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
  PmLevel,
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

