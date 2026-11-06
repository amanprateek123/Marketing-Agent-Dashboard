/** COPY of marketing-agent/src/performance-marketeer/analysis/pm-analysis.types.ts — keep in sync.
 *
 * Performance Marketeer analysis API — the contract between the backend
 * (marketing-agent, /api/v1/performance-marketeer/:tenantId/...) and the
 * dashboard (Marketing-Agent-Dashboard, src/types/performance-marketeer.ts is a
 * copy of this file). Change both together.
 *
 * Conventions
 * - All money in INR. Revenue = first-party net revenue (ex-GST, minus completed
 *   refunds). Spend = Meta spend (ex-GST). ROAS = revenue / spend.
 * - "firstParty*" = our own orders attributed to the entity (device-matched,
 *   last Meta click within 7 days) — a lower bound. "meta*" = Meta-reported.
 * - Dates are IST calendar days, YYYY-MM-DD, inclusive ranges.
 * - Every ratio is null when its denominator is 0. Every number that can be
 *   noisy carries a `confidence` derived from sample size.
 */

export type PmLevel = 'account' | 'campaign' | 'adset' | 'ad';
export type PmConfidence = 'low' | 'medium' | 'high';
export type PmVerdict = 'above_target' | 'near_target' | 'below_target' | 'not_enough_data';

/** Query parameters accepted by every analysis endpoint. */
export interface PmQuery {
  from: string;
  to: string;
  /** PmProduct id; omitted = all three covered products. */
  product?: string;
}

export interface PmMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  cpm: number | null;
  ctr: number | null; // link clicks / impressions
  cpc: number | null; // spend / link clicks
  /**
   * Average DAILY frequency: each ad-day's frequency weighted by its
   * impressions. Not period frequency (reach is not additive across days or
   * ads), so it understates how often one person saw the ads over the range.
   */
  frequency: number | null;

  metaPurchases: number;
  metaPurchaseValue: number;
  metaRoas: number | null;

  /** Website (pm_visitor_days) — visitors whose traffic came from these Meta ads. */
  siteVisitors: number;
  siteCtaClicks: number;
  sitePaymentsStarted: number;

  firstPartyOrders: number;
  firstPartyRevenue: number;
  firstPartyRoas: number | null;
  firstPartyCpa: number | null;
  newCustomerOrders: number;
  /** orders / link clicks */
  clickToOrderRate: number | null;
  /** orders / site visitors */
  visitToOrderRate: number | null;
  averageOrderValue: number | null;
}

export interface PmTargetCheck {
  targetRoas: number; // 1.0
  verdict: PmVerdict;
  confidence: PmConfidence;
  /** Why: e.g. "6 orders — too few to judge" */
  note: string;
}

// GET /summary?from&to&product
export interface PmSummaryResponse {
  query: PmQuery;
  previous: PmQuery; // same-length period immediately before
  current: PmMetrics;
  prior: PmMetrics;
  /** Relative change current vs prior per metric (null when prior is 0/null). */
  change: Partial<Record<keyof PmMetrics, number | null>>;
  target: PmTargetCheck;
  /** Product-level reality check, no attribution: all confirmed orders of the product(s) in range. */
  allOrders: { orders: number; revenue: number; webOrders: number; adminOrders: number };
  /** Share of confirmed web orders we could tie to any visit / to a Meta ad. */
  attributionCoverage: { linkedToVisit: number | null; linkedToMetaAd: number | null };
  dataFreshness: {
    metaThrough: string | null;
    ordersThrough: string | null;
    visitorsThrough: string | null;
    /**
     * Days in the query window with no data: meta = no Meta spend on any
     * selected product; orders = no order rows at all (any product, any
     * status); visitors = a selected product has no visitor rows. When meta
     * is non-empty the ROAS verdict is not_enough_data.
     */
    missingDays?: { meta: string[]; orders: string[]; visitors: string[] };
  };
}

export interface PmEntityRow {
  level: Exclude<PmLevel, 'account'>;
  id: string;
  name: string;
  campaignId: string;
  adsetId: string;
  accountId: string;
  product: string;
  status: string;
  effectiveStatus: string;
  budgetLevel: '' | 'campaign' | 'adset';
  dailyBudget: number | null;
  metrics: PmMetrics;
  target: PmTargetCheck;
  /** Days with spend in range. */
  activeDays: number;
}

// GET /entities?from&to&product&level=campaign|adset|ad&parentId=
export interface PmEntitiesResponse {
  query: PmQuery & { level: PmEntityRow['level']; parentId?: string };
  rows: PmEntityRow[];
}

export interface PmTrendPoint {
  date: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  cpm: number | null;
  ctr: number | null;
  frequency: number | null; // average daily frequency (see PmMetrics)
  metaPurchases: number;
  firstPartyOrders: number;
  firstPartyRevenue: number;
  firstPartyRoas: number | null;
  firstPartyCpa: number | null;
  siteVisitors: number;
}

// GET /trend?from&to&product&level&id   (level/id omitted = all)
export interface PmTrendResponse {
  query: PmQuery & { level: PmLevel; id?: string };
  points: PmTrendPoint[];
  /** 7-day rolling first-party ROAS, aligned with points. */
  rollingRoas7: (number | null)[];
}

/**
 * GET /decompose?product&level&id&from&to  (compares from..to with the
 * same-length period before). CPA = CPM / (1000 × CTR × click→order rate).
 * Each factor's contribution is its share of the log-change in CPA, so they
 * add up to the total — this separates "ads got expensive" from "site
 * converts worse".
 */
export interface PmDecomposeResponse {
  query: PmQuery & { level: PmLevel; id?: string };
  previous: PmQuery;
  cpa: { current: number | null; prior: number | null; change: number | null };
  factors: {
    name: 'cpm' | 'ctr' | 'clickToOrderRate';
    current: number | null;
    prior: number | null;
    change: number | null;
    /** Share of the CPA change explained by this factor (sums to ~1). */
    contribution: number | null;
  }[];
  /** Plain-language read, e.g. "Most of the CPA rise came from fewer clicks turning into orders." */
  read: string;
  confidence: PmConfidence;
}

export interface PmBand {
  band: string;
  visitors: number;
  orders: number;
  conversion: number | null;
}

// GET /funnel?from&to&product&channel=meta_ad|google_ads|…&adId=
export interface PmFunnelResponse {
  query: PmQuery & { channel?: string; adId?: string };
  steps: { key: string; label: string; visitors: number; rateFromPrevious: number | null; rateFromStart: number | null }[];
  scroll: PmBand[]; // <25%, 25–49, 50–74, 75–99, 100
  timeOnPage: PmBand[]; // <10s, 10–30s, 30–60s, 1–3m, 3m+
  byChannel: { channel: string; visitors: number; orders: number; conversion: number | null; deepScrollShare: number | null }[];
  byDevice: { device: string; visitors: number; orders: number; conversion: number | null }[];
  byLocale: { locale: string; visitors: number; orders: number; conversion: number | null }[];
  /** Correlation, not causation — always shown with the bands. */
  caveat: string;
}

// GET /fatigue?from&to&product
export interface PmFatigueRow {
  adId: string;
  adName: string;
  campaignName: string;
  product: string;
  daysLive: number;
  spend: number;
  /** Average daily frequency over the ad's first / last 7 active days. */
  frequencyFirst7: number | null;
  frequencyLast7: number | null;
  ctrFirst7: number | null;
  ctrLast7: number | null;
  cpaFirst7: number | null;
  cpaLast7: number | null;
  /** 'fatigued' needs rising frequency AND falling CTR or rising CPA, sustained. */
  status: 'healthy' | 'watch' | 'fatigued' | 'not_enough_data';
  reasons: string[];
  creative: { title?: string; body?: string; thumbnailUrl?: string; linkUrl?: string } | null;
}
export interface PmFatigueResponse {
  query: PmQuery;
  rows: PmFatigueRow[];
}

// GET /geo?from&to&product
export interface PmGeoRow {
  state: string;
  /** Meta (region breakdown): spend + link clicks. Meta gives no purchases by region. */
  spend: number;
  linkClicks: number;
  /** First-party: visitors from Meta ads in this state, and their orders. */
  siteVisitors: number;
  firstPartyOrders: number;
  firstPartyRevenue: number;
  roasEstimate: number | null;
  visitToOrderRate: number | null;
  confidence: PmConfidence;
}
export interface PmGeoResponse {
  query: PmQuery;
  rows: PmGeoRow[];
  caveat: string;
}

// GET /budget?from&to&product
export interface PmBudgetRow {
  level: 'campaign' | 'adset';
  id: string;
  name: string;
  budgetLevel: '' | 'campaign' | 'adset';
  dailyBudget: number | null;
  learningStage: string;
  spend: number;
  firstPartyRoas: number | null;
  /**
   * Observed marginal ROAS: slope of daily revenue on daily spend over the
   * range (descriptive, not causal). null if < 7 days with spend.
   */
  marginalRoas: number | null;
  frequencyTrend: number | null; // change in average daily frequency, first half vs second half
  /** Change in avg daily reach (summed over ads), first half vs second half; null when different ads ran in the two halves. */
  reachTrend: number | null;
  signal: 'room_to_scale' | 'saturating' | 'hold' | 'reduce' | 'not_enough_data';
  reasons: string[];
}
export interface PmBudgetResponse {
  query: PmQuery;
  rows: PmBudgetRow[];
  caveat: string;
}

// GET /reconcile?from&to&product
export interface PmReconcileRow {
  campaignId: string;
  campaignName: string;
  product: string;
  metaPurchases: number;
  metaPurchaseValue: number;
  firstPartyOrders: number;
  firstPartyRevenue: number;
  /** firstPartyOrders / metaPurchases */
  matchRatio: number | null;
}
export interface PmReconcileResponse {
  query: PmQuery;
  rows: PmReconcileRow[];
  totals: { metaPurchases: number; firstPartyOrders: number; allConfirmedOrders: number };
  notes: string[];
}

// GET /changes?from&to&objectId=
export interface PmChangeRow {
  eventTime: string;
  accountId: string;
  objectType: string;
  objectId: string;
  objectName: string;
  eventType: string;
  translatedEventType: string;
  actorName: string;
  extraData: string;
}
export interface PmChangesResponse {
  query: { from: string; to: string; objectId?: string };
  rows: PmChangeRow[];
  /** Present and true when more than 500 changes matched; the newest 500 are returned. */
  truncated?: boolean;
}

/**
 * GET /report?date=YYYY-MM-DD&product=  (date default: yesterday; product
 * omitted = all three). The plain daily report (checkpoint 2) — rule-based
 * findings composed from the endpoints above, no LLM. Each finding states
 * entity, evidence, window, source and the proposed action. With `product`,
 * kpis/findings cover that product only and byProduct has just that product.
 */
/** Requirements UC-11 actions, plus fix_tracking for data-quality findings. */
export type PmAction =
  | 'hold'
  | 'investigate'
  | 'test'
  | 'scale'
  | 'reduce_budget'
  | 'pause'
  | 'change_targeting'
  | 'refresh_creative'
  | 'fix_funnel'
  | 'fix_tracking';
export interface PmFinding {
  severity: 'critical' | 'warning' | 'info' | 'positive';
  area: 'roas' | 'trend' | 'funnel' | 'fatigue' | 'budget' | 'geo' | 'tracking' | 'change';
  entity: { level: PmLevel; id?: string; name: string };
  title: string;
  evidence: string; // numbers + window + source, in plain words
  confidence: PmConfidence;
  action: PmAction;
}
export interface PmReportResponse {
  date: string;
  window: { last7: PmQuery; prior7: PmQuery; last30: PmQuery };
  headline: string;
  kpis: { last7: PmMetrics; prior7: PmMetrics; target: PmTargetCheck };
  byProduct: { product: string; label: string; last7: PmMetrics; prior7: PmMetrics; target: PmTargetCheck }[];
  findings: PmFinding[];
  generatedAt: string;
}

// ── Step 3 AI analyst (NOT part of pm-analysis.types.ts) ────────────────────
// Mirrors marketing-agent/src/performance-marketeer/agent/pm-agent.types.ts
// (Action, PmJournalEntry), schemas/pm-agent-run.schema.ts and the shapes
// returned by agent/pm-agent.controller.ts. Change them together.

export type PmAgentConfidence = 0.2 | 0.5 | 0.8;
export type PmAgentRunStatus = 'queued' | 'running' | 'done' | 'failed';

export interface PmAgentAction {
  id: string; // A1, A2… stable across rounds
  type: 'creative' | 'budget' | 'geo' | 'audience' | 'placement' | 'landing_funnel' | 'tracking' | 'festival_prep' | 'pause' | 'hold';
  title: string;
  /** Plain-words summary for the owner; older runs don't have it. */
  plain?: string;
  causeIds: string[];
  entityLevel: 'campaign' | 'adset' | 'ad' | 'site';
  entityId: string;
  entityName: string;
  change: { field: string; from: string | number | null; to: string | number | null };
  expectedEffect: { metric: string; low: number; high: number; evidence: string[] };
  impactRupeesPerDay: number;
  confidence: PmAgentConfidence;
  resetsLearning: boolean;
  judgeOn: string; // YYYY-MM-DD
  stopCondition: string;
  risk?: string;
  /** Reviewer's notes, "verifier (change): …". */
  notes?: string[];
  creativeBrief?: string;
  verdict: 'approve' | 'change' | 'unresolved';
  rank: number;
  /** Optional flags, shown when the pipeline sets them. */
  disputed?: boolean;
  checksFailed?: string[];
  /** "check: message" per failed check, from the code checks. */
  checkMessages?: string[];
}

export type PmJournalStatus = 'taken' | 'partly' | 'not_taken' | 'outside_change';
export interface PmJournalEntry {
  date: string;
  actionId?: string;
  title: string;
  status: PmJournalStatus;
  matched: string[];
  resetsLearning: boolean;
  read: 'too_soon' | 'early' | 'settled';
  resultSoFar: string;
  judgeAgainOn?: string;
  userNote?: string;
}

export interface PmAgentRunSummary {
  campaignId: string;
  campaignName: string;
  product: string;
  status: PmAgentRunStatus;
  step: string;
  error: string;
  investigateRounds: number;
  planRounds: number;
  impactRupeesPerDay: number;
  actionCount: number;
  unresolvedCount: number;
  costUsd: number;
  startedAt: string | null;
  finishedAt: string | null;
}

/** GET /agent/runs?date= — date is null when there are no runs at all. */
export interface PmAgentRollup {
  date: string | null;
  runs: PmAgentRunSummary[];
  /** All campaigns' actions, ranked by ₹ impact × confidence. */
  actions: (PmAgentAction & { campaignId: string; campaignName: string })[];
}

/** GET /agent/runs/:campaignId?date= */
export interface PmAgentRun {
  tenantId: string;
  date: string;
  campaignId: string;
  campaignName: string;
  accountId: string;
  product: string;
  status: PmAgentRunStatus;
  step: string;
  error: string;
  investigateRounds: number;
  planRounds: number;
  unresolved: string[];
  actions: PmAgentAction[];
  /** Final causes (C1…) the actions point to. */
  causes?: { id: string; title: string; confidence: PmAgentConfidence; verdict: string }[];
  impactRupeesPerDay: number;
  /** File name → final text (00-brief.md … 05-actions.md, evidence.jsonl). */
  files: Record<string, string>;
  journal: PmJournalEntry[];
  userNote: string;
  costUsd: number;
  startedAt: string | null;
  finishedAt: string | null;
}

// ── Admin-triggered analysis queue (agent/queue) ──────────────────────────
// Mirrors marketing-agent's agent queue controller. Change them together.

export interface PmQueuedItem {
  campaignId: string;
  campaignName: string;
  date: string;
  /** '' normally; 'waiting: daily budget reached' when the day's cap is hit. */
  step: string;
  position: number;
  queuedAt: string | null;
  queuedBy: string;
}

export interface PmRunningItem {
  campaignId: string;
  campaignName: string;
  date: string;
  /** Current phase, e.g. "verify v2". */
  step: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  costUsd: number;
}

export interface PmFinishedItem {
  campaignId: string;
  campaignName: string;
  date: string;
  step: string;
  status: 'done' | 'failed';
  error: string;
  costUsd: number;
  finishedAt: string | null;
  actionCount: number;
}

/** GET /agent/queue?date= — queued/running span all dates; finished is only `date`. */
/** Owner's lifetime purchase target for a campaign (first-party orders since launch). */
export interface PmCampaignTarget {
  campaignId: string
  targetPurchases: number | null
  targetRoas: number | null
  /** The ROAS and purchases are wanted within this many days from targetStart. */
  targetDays: number | null
  targetStart: string | null
  /** Rupees per day. Not tied to the period. */
  maxDailyBudget: number | null
  updatedBy: string
  updatedAt: string | null
}

/** GET agent/campaigns — every campaign to pick from, data loaded or not (list comes from Meta). */
export interface PmCampaignListItem {
  id: string
  name: string
  accountId: string
  effectiveStatus: string
  createdTime: string | null
  product: string
  dailyBudget: number | null
  /** Latest finished AI run (YYYY-MM-DD), for the report link; older backends omit it. */
  lastRunDate?: string | null
}

export interface PmAgentQueue {
  date: string;
  /** false = this server doesn't process the queue. */
  worker: boolean;
  capUsd: number;
  spentUsd: number;
  queued: PmQueuedItem[];
  running: PmRunningItem[];
  finished: PmFinishedItem[];
}

/** POST /agent/queue body: campaignIds 1–20 (digits); date defaults to today (IST) on the server. */
export interface PmAgentEnqueueRequest {
  campaignIds: string[];
  date?: string;
  rerun?: boolean;
}

/** Skip reasons: 'campaign not found', 'already queued', 'already running', 'already analysed for <date> — pass rerun', 'state changed, try again'. */
export interface PmAgentEnqueueResult {
  queued: string[];
  skipped: { campaignId: string; reason: string }[];
}

/** POST /agent/queue/:campaignId/cancel — 409 if running/finished, 404 if none. */
export interface PmAgentCancelResult {
  campaignId: string;
  date: string;
  cancelled: 'deleted' | 'marked_failed';
}

// ── Lessons (agent/lessons/lessons.types.ts + pm-lessons.controller.ts) ─────
// Mirrors marketing-agent/src/performance-marketeer/agent/lessons/lessons.types.ts
// (PmLesson, PmLessonProposal, PmOwnerRule). Change them together.

export type PmLessonType = 'action_effect' | 'diagnosis_pattern' | 'creative_pattern' | 'season_effect' | 'segment_fact' | 'analyst_habit';
export type PmLessonStatus = 'candidate' | 'active' | 'review' | 'retired';
export type PmLessonScope = Record<string, string>;

export interface PmLessonCase {
  ref: string; // D-…, DC-…, cev-…
  supports: boolean;
  campaignId: string;
  at: string; // YYYY-MM-DD
}

export interface PmLessonEvent {
  at: string; // ISO
  kind: string; // created, approved, edited, retired, used…
  note?: string;
  version?: number;
}

export interface PmLesson {
  lessonId: string;
  type: PmLessonType;
  statement: string;
  because?: string;
  scope: PmLessonScope;
  status: PmLessonStatus;
  cases: PmLessonCase[];
  confidence: 0.2 | 0.5 | 0.8;
  uses: number;
  hits: number;
  version: number;
  approvedAt?: string;
  reviewBy?: string;
  createdAt?: string;
  /** Audit trail (pm_lesson_events), when the API includes it. */
  events?: PmLessonEvent[];
}

export interface PmLessonProposal {
  proposalId: string;
  week: string;
  op: 'ADD' | 'EDIT' | 'ATTACH' | 'MERGE' | 'RETIRE' | 'PROMOTE';
  lesson?: Partial<PmLesson>;
  lessonId?: string;
  mergeIds?: string[];
  cases?: PmLessonCase[];
  why: string;
  validation: { ok: boolean; problems: string[] };
  status: 'pending' | 'applied' | 'approved' | 'rejected' | 'invalid';
  decidedAt?: string;
  decidedNote?: string;
}

export type PmOwnerRuleCheck =
  | { kind: 'no_pause_before_days'; days: number }
  | { kind: 'max_budget_step'; step: number }
  | { kind: 'no_budget_increase_in_season'; season: string; product?: string }
  | { kind: 'no_action_type'; type: string; product?: string };

export interface PmOwnerRule {
  ruleId: string;
  text: string;
  active: boolean;
  check?: PmOwnerRuleCheck;
}

/** GET /lessons/scorecard?weeks= — one row per ISO week that has decisions or checks, oldest first. Shares 0–1, null when nothing to grade. */
export interface PmLessonScorecardWeek {
  week: string; // 2026-W44
  /** Action type → clean settled outcomes of taken/outside changes, and how many worked. */
  byActionType: Record<string, { n: number; worked: number; rate: number }>;
  calibration: { n: number; inside: number; share: number | null };
  acceptance: { recommended: number; taken: number; share: number | null };
  diagnosis: { n: number; held: number; accuracy: number | null };
  realisedRupees: number;
}
export interface PmLessonScorecard {
  from: string;
  to: string;
  weeks: PmLessonScorecardWeek[];
  lessons: { lessonId: string; type: PmLessonType; status: PmLessonStatus; uses: number; hits: number; hitRate: number | null }[];
  notes: string;
}

// ── Launch Planner ───────────────────────────────────────────────────────
// Mirrors marketing-agent agent/launch/launch.types.ts and the shapes from
// agent/launch/launch.controller.ts. Change them together.

export type PmLaunchLabel = 'fact' | 'assumption' | 'hypothesis' | 'unknown'
export interface PmLaunchFinding { text: string; label: PmLaunchLabel; source: string }

export interface PmLaunchProduct { name: string; price: number; landingUrl: string; hasConversion: boolean }

export interface PmLaunchInput {
  productName: string
  creativeUrls: string[]
  dailySpend: number
  desiredRoas: number
  roasType: 'meta' | 'first_party'
  launchDate: string
  maxCpa?: number
  note?: string
}

export interface PmLaunchCreative {
  file: string
  designId: string
  summary: string
  hook: string
  language: string
  angle: string
  firstLook?: { viewer: string; noticesFirst: string; thinks: string; reaction: 'stops_and_taps' | 'stops_only' | 'scrolls_past'; why: string }
  finalStatus: 'ready' | 'needs_fixes' | 'excluded'
  verdict?: string
  strengths: string[]
  changes?: { where: string; problem: string; whatViewerDoes: string; fix: string }[]
  tests?: string[]
  promise?: { adPromises: string; pageDelivers: 'yes' | 'no' | 'unclear'; note: string }
  policyRisk: 'low' | 'review' | 'block'
  resizeAdvice: string[]
  claimsToVerify: string[]
  /** Plans saved before the viewer-first review. */
  weaknesses?: string[]
}

export interface PmLaunchCreativeCall {
  designId: string
  call: 'run' | 'fix' | 'replace'
  why: string
  replacements: { topic: string; hook: string; format: string; forWho: string; why: string }[]
}

export interface PmLaunchAdSet {
  name: string
  budgetPercent: number
  audienceType: string
  excludeAudienceIds: string[]
  ageMin: number
  ageMax: number
  gender: string
  geoLocations: string[]
  geoStates: string[]
  geoCities: string[]
  locales: number[]
  interests: { id: string; name: string }[]
  placementPreset: 'vertical' | 'vertical_feed' | 'everywhere'
  designIds: string[]
  reason: string
  label: PmLaunchLabel
}

export interface PmLaunchSummary {
  _id: string
  input: PmLaunchInput
  status: 'queued' | 'running' | 'done' | 'failed'
  step: string
  error: string
  costUsd: number
  createStatus: '' | 'creating' | 'paused' | 'failed'
  metaCampaignId: string
  readiness: { ready: boolean; blocks: string[]; warnings: string[] } | null
  createdAt: string
}

export interface PmLaunchPlan extends PmLaunchSummary {
  createError: string
  creatives: { url: string; file: string; width: number; height: number; ratio: string }[]
  economics: {
    price: number
    netPrice: number
    roasType: 'meta' | 'first_party'
    desiredRoas: number
    allowedCpaMeta: number
    allowedCpaFirstParty: number
    allowedCpa: number
    dailySpend: number
    ordersPerWeekAtTarget: number
    learningBenchmark: number
    scenarios: { costPerOrder: number; ordersPerWeek: number; metaRoas: number; firstPartyRoas: number; meetsTarget: boolean }[]
  } | null
  tracking: { conversionId: string; accountId: string; blocks: string[]; warnings: string[]; facts: string[] } | null
  review: {
    creatives: PmLaunchCreative[]
    missingAngles: string[]
    landing: {
      summary: string
      mainButton: string
      directPurchase: 'yes' | 'no' | 'unknown'
      path: { step: string; status: 'ok' | 'warning' | 'problem' | 'unknown'; note: string }[]
      whatWorks: string[]
      issues: string[]
      claimsToVerify: string[]
    }
  } | null
  research: {
    audience: { name: string; situation: string; whyTheyBuy: string; ageRange: string; languages: string; messageIdea: string; label: PmLaunchLabel; source: string }[]
    reach: { targeting: string; low: number; high: number; source: string }[]
    locations: { place: string; decision: 'include' | 'exclude' | 'test_later' | 'no_preference'; reason: string; label: PmLaunchLabel; source: string }[]
    dates: { date: string; event: string; effect: 'higher_demand' | 'lower_demand' | 'higher_costs' | 'neutral'; whatToDo: string; label: PmLaunchLabel; source: string }[]
    competitors: { brand: string; angle: string; offer: string; format: string; runningFor: string; takeaway: string; label: PmLaunchLabel; source: string }[]
    patterns: PmLaunchFinding[]
    socialPlaybook?: { pattern: string; seenAt: string; howToUse: string; label: PmLaunchLabel; source: string }[]
    gaps: string[]
  } | null
  plan: {
    targetVerdict: 'realistic' | 'unrealistic' | 'unknown'
    targetNote: string
    campaignName: string
    campaignType: 'advantage_plus' | 'custom'
    adSets: PmLaunchAdSet[]
    copy: { designId: string; primaryText: string; headline: string; cta: string }[]
    analysis: {
      headline: string
      summary: string
      whySetup: { title: string; detail: string; label: PmLaunchLabel; source: string }[]
      creativeTakeaway: string
      competitorTakeaway: string
      creativeCalls?: PmLaunchCreativeCall[]
      todo: { priority: 'must' | 'should' | 'nice'; action: string; why: string }[]
      risks: { risk: string; impact: 'high' | 'medium' | 'low'; response: string }[]
      newCreativeIdeas: { angle: string; hook: string; format: string; why: string }[]
    }
    decisions: (PmLaunchFinding & { topic: string })[]
    unknowns: string[]
    reviewPlan: { beforeLive: string[]; day1: string[]; day3: string[]; day7: string[]; rules: string[] }
    sources: string[]
  } | null
  approved: { metaStatus?: { campaign: string; adSets: { total: number; paused: number }; ads: { total: number; paused: number } } } | null
}

export type PmLaunchChecklist = Record<'testPurchase' | 'deduplicated' | 'mobilePath' | 'claimsVerified', boolean>

// ── Campaign report (agent/runs/:campaignId/report) ─────────────────────────
// Mirrors marketing-agent agent/report/pm-report.service.ts. Change them together.

export interface PmReportNumbers {
  spend: number
  impressions: number
  linkClicks: number
  landingPageViews: number
  ctrPct: number | null
  cpm: number | null
  cpc: number | null
  metaPurchases: number
  metaPurchaseValue: number
  metaRoas: number | null
  costPerPurchase: number | null
  siteVisitors: number
  firstPartyOrders: number
  firstPartyRevenue: number
  firstPartyRoas: number | null
}

export type PmCreativeTag = 'scale' | 'keep' | 'cut' | 'too_early'

export interface PmReportCreative {
  id: string
  name: string
  status: string
  thumbnailUrl: string | null
  format: string | null
  title: string
  body: string
  cta: string
  spend: number
  spendSharePct: number | null
  impressions: number
  ctrPct: number | null
  cpm: number | null
  metaPurchases: number
  costPerPurchase: number | null
  metaRoas: number | null
  firstPartyOrders: number
  verdict: { tag: PmCreativeTag; reason: string }
}

export interface PmCreativeIdea {
  title: string
  angle: string
  hook: string
  format: string
  language: string
  primaryText: string
  headline: string
  cta: string
  basedOn: string
  why: string
}

export interface PmReportBreakdownRow {
  key: string
  spend: number
  spendSharePct: number | null
  impressions: number
  cpm: number | null
  ctrPct: number | null
  metaPurchases: number
  metaRoas: number | null
}

export interface PmReportBreakdown {
  rows: PmReportBreakdownRow[]
  missingDays: string[]
  daysWithData: number
}

export interface PmReportCause {
  id: string
  title: string
  category: string
  confidence: PmAgentConfidence
  impactRupeesPerDay: number
  verdict: 'confirmed' | 'weakened' | 'rejected' | 'added' | 'unverified'
  /** The investigator's section for this cause (markdown bullets). */
  narrative: string
}

export interface PmReportGoal {
  source: string
  basis?: 'app' | 'untracked' | null
  maxDailyBudget: number | null
  currentDailyBudget: number | null
  daysLeft: number | null
  targetPurchases: number | null
  targetRoas: number | null
  targetDays?: number
  start?: string
  end?: string
  purchases?: number
  remaining?: number
  purchasesPerDayNeeded?: number | null
  spendPerDayNeeded?: number | null
  periodRoas?: number | null
  dataTo?: string
}

export interface PmCampaignReport {
  run: { campaignId: string; campaignName: string; date: string; status: PmAgentRunStatus; finishedAt: string | null; costUsd: number; product: string }
  window: { from: string; to: string }
  launched: string | null
  settings: { objective: string | null; status: string | null; budgetLevel: string | null; dailyBudget: number | null; currentDailyBudget: number | null }
  basis: 'app' | 'untracked' | null
  goal: PmReportGoal | null
  last7: PmReportNumbers | null
  sinceLaunch: (PmReportNumbers & { from: string; to: string }) | null
  account: { ctrPct: number | null; cpm: number | null; cpc: number | null }
  verdict: string
  planSummary: string
  pathToTarget: 'likely' | 'possible' | 'unlikely' | null
  funnel: {
    meta: { impressions: number; linkClicks: number; landingPageViews: number; metaPurchases: number }
    site: { step: string; campaign: number; campaignPctOfPrev: number | null; allMetaPctOfPrev: number | null }[]
    payments: { campaign: PmReportPeople; allWebOrders: PmReportPeople } | null
  }
  causes: PmReportCause[]
  creatives: PmReportCreative[]
  creativeIdeas: PmCreativeIdea[]
  breakdowns: { ageGender: PmReportBreakdown | null; placement: PmReportBreakdown | null; region: PmReportBreakdown | null }
  trend: { date: string; spend: number; cpm: number | null; ctrPct: number | null; metaPurchases: number; firstPartyOrders: number }[]
  actions: PmAgentAction[]
  ruledOut: string[]
  dataGaps: string[]
  unresolved: string[]
}

export interface PmReportPeople {
  people: number
  paid: number
  didNotPay: number
  paidPct: number | null
  retriedThenPaid: number
}
