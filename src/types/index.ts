export interface MetaConnection {
  accessToken?: string
  accountId?: string
  accountIds?: string[]
  pageId?: string
  pixelId?: string
}

export interface Product {
  name: string
  description?: string
  price?: number
  currency?: string
  active?: boolean
  landingUrl?: string
  languages?: string[]
  trendKeywords?: string[]
  differentiators?: string[]
  // Conversion tracking — mutually exclusive modes
  conversionEvent?: string       // Standard: 'Purchase'|'Lead'|etc. OR 'CustomEvent'
  customEventName?: string       // Only when conversionEvent === 'CustomEvent'
  customConversionId?: string    // Custom conversion from Meta Events Manager (takes priority)
  pixelId?: string               // Per-product pixel override (blank = use company default)
  conversionValue?: number
  // Decimal 0-1 (e.g. 0.97 = 97% margin after COGS/fulfilment/fees). Drives
  // breakeven ROAS = 1 / contributionMargin in the auditor's loss detection.
  // Falls back to vertical typical when unset.
  contributionMargin?: number
  // Percent of conversions that refund (0-95). When set, the whole decision
  // chain optimizes on NET revenue: effective value = value × (1 − rate/100).
  // Leave unset when refunds don't apply.
  refundRatePercent?: number
  // When true, ALL ad creative for this product omits price from copy,
  // headlines, and image overlays (premium positioning — lander handles price).
  hidePriceInCreative?: boolean
  category?: string
  // Active landing-page A/B test. controlUrl (A) vs variantUrl (B) — two ad sets,
  // same audience + creatives, URL is the only variable. Winner is report-only:
  // the audit loop fills `evaluation`/`winnerUrl`, the operator promotes manually.
  landingPageTest?: LandingPageTest
}

export interface LandingPageTestArm {
  url: string
  conversions: number
  spend: number
  cpa: number | null
  roas: number
}

export interface LandingPageTest {
  controlUrl?: string
  variantUrl?: string
  audienceType?: string
  metaAudienceId?: string
  status: 'running' | 'concluded'
  campaignId?: string
  startedAt?: string
  winnerUrl?: string
  concludedAt?: string
  evaluation?: {
    control: LandingPageTestArm
    variant: LandingPageTestArm
    leaderUrl: string | null
    marginPct: number
    decided: boolean
    evaluatedAt?: string
  }
}

export interface BudgetSettings {
  weeklyBudgetCap?: number
  maxBudgetPerCampaign?: number
  maxBudgetScalePercent?: number
  targetROAS?: number
  targetCPA?: number
  pauseIfROASBelow?: number
  pauseIfCTRBelow?: number
  pauseIfFrequencyAbove?: number
  scaleIfROASAbove?: number
}

export interface PipelineConfig {
  campaignStrategy?: 'conservative' | 'balanced' | 'experimental'
  pauseGracePeriodHours?: number
  scaleRequiresApproval?: boolean
  teamMode?: 'cli' | 'sequential'
}

// ── Canonical hook styles (shared BE/FE contract) ────────────────────────────
export const HOOK_STYLES = [
  'pain_point', 'bold_claim', 'price_shock', 'social_proof',
  'curiosity_gap', 'before_after', 'urgency',
  'meme_relatable', 'meme_punchline', 'meme_self_aware',
] as const
export type HookStyle = typeof HOOK_STYLES[number]

export type AudienceStage = 'cold' | 'warm' | 'hot'
export type CreativeFormat = 'mixed' | 'video' | 'image'

export interface PromptsHistoryEntry {
  version: number
  generatedAt: string
  learningVersion?: number
}

export interface WinningExemplar {
  hookLine: string
  hookStyle: HookStyle | string
  audienceSegment?: string
  /** Which product this exemplar won for (per-product attribution; older entries lack it) */
  product?: string
  ctr: number
  sampleSize: number
  extractedAt: string
}

/**
 * Audience score entry — backend migrated from flat numbers to
 * { roas, n, updatedAt } so scores carry sample size. Old documents may
 * still hold plain numbers; render code must handle both shapes.
 */
export interface AudienceScoreEntry {
  roas: number
  n: number
  updatedAt?: string
}

export interface HookSaturationCell {
  pct: number
  updatedAt: string
}

export interface CausalInsight {
  finding: string
  isolatedVariable: string
  controlledFor?: string[]
  rootCause: string
  confidence: number
  dataPoints: number
  /** Product the insight applies to (tenant-wide when unset) */
  productName?: string
}

export interface AdSetPerformance {
  adSetId: string
  name: string
  audienceType: string
  hookStyles: string[]
  formats: string[]
  spend: number
  conversions: number
  ctr: number
  cpa: number
  roas: number
  capturedAtDay: number
}

// ── Intelligence shadow decisions (16-engine cascade output) ────────────────
export type IntelligenceDecisionStatus =
  | 'shadow_review'
  | 'approved'
  | 'rejected'
  | 'expired'

export interface IntelligenceDecisionEvidenceStep {
  step: string
  source: string
}

export interface IntelligenceDecision {
  _id: string
  tenantId: string
  campaignId: string
  metaCampaignId?: string
  cycleId: string
  actionId: string
  actionType: string
  targetType: string
  targetId: string
  parameters: Record<string, unknown>
  expectedProfitDeltaINR7d: number
  reasoning: string
  evidenceChain: IntelligenceDecisionEvidenceStep[]
  risk: 'low' | 'medium' | 'high'
  score: number
  gatedBy: string[]
  requiresHumanApproval: boolean
  evidenceSnapshot?: {
    kind: string
    reasoning: string
    metrics: Record<string, number>
  }
  reviewWindowExpiresAt: string
  status: IntelligenceDecisionStatus
  shadowModeOnly: boolean
  reviewedBy?: string
  reviewedAt?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
}

export interface ShadowAction {
  proposedAction: string | { type?: string; targetName?: string; reason?: string; [k: string]: unknown }
  blockedReason: string | { reason?: string; [k: string]: unknown }
  regretLabel: 'correct_block' | 'missed_signal' | 'inconclusive'
  age?: string
  proposedAt?: string
  evaluatedAt?: string
}

// ── System Intelligence (feedback-loop telemetry) ───────────────────────────

export interface ExecutedActionRecord {
  _id?: string
  campaignId: string
  metaCampaignId: string
  action: { type: string; targetId: string; targetName?: string; reason?: string; priority?: string }
  trigger: 'auto_applied' | 'grace_expired' | 'human_approved'
  context?: { ageDays?: number; productName?: string; audienceType?: string }
  executedAt: string
  metricsAtT?: { spend: number; conversions: number; cpa: number; roas: number }
  metricsAtT72h?: { spend: number; conversions: number; cpa: number; roas: number } | null
  outcomeLabel: 'improved' | 'worsened' | 'neutral' | 'inconclusive' | null
  status: 'pending' | 'evaluated_24h' | 'final'
}

export interface ActionOutcomesResponse {
  trackRecord: {
    total: number
    byActionType: Array<{
      actionType: string
      total: number
      improved: number
      worsened: number
      neutral: number
      inconclusive: number
      worsenedRatePct: number
    }>
    recentWorsened: Array<{
      actionType: string
      targetName: string
      ageDays: number | null
      audienceType: string | null
      cpaAtT: number
      cpaAtT72h: number
      executedAt: string
    }>
  }
  recent: ExecutedActionRecord[]
}

export interface RegretSummary {
  total: number
  byActionAndReason: Array<{
    actionType: string
    blockedReason: string
    total: number
    correct: number
    missed: number
    inconclusive: number
    regretRatePct: number
  }>
}

export interface PromptVersionEval {
  newerVersion: number
  olderVersion: number
  newer: { campaigns: number; totalSpend: number; totalConversions: number; weightedROAS: number; cpa: number }
  older: { campaigns: number; totalSpend: number; totalConversions: number; weightedROAS: number; cpa: number }
  verdict: 'improved' | 'regressed' | 'neutral' | 'inconclusive'
  detail: string
  createdAt?: string
}

export interface SignalAccuracy {
  briefsWithOutcomes: number
  bySource: Array<{ source: string; launched: number; converted: number; avgROAS: number }>
  byPlatform: Array<{ platform: string; launched: number; converted: number; avgROAS: number }>
}

export type CampaignActionType =
  | 'pause_ad'
  | 'pause_adset'
  | 'replace_creative'
  | 'add_creative'
  | 'add_adset'
  | 'scale_adset'
  | 'shift_budget_between_adsets'
  | 'reduce_total_budget'
  | 'narrow_placement'
  | 'dayparting'
  | 'refresh_audience'

// Primary leak class the audit agent diagnoses for each campaign. Mirrors
// LeakDiagnosis in the backend (audit-agent.service.ts). Drives the
// LeakDiagnosisBadge color + tooltip.
export type LeakDiagnosis =
  | 'creative_leak'
  | 'audience_lp_leak'
  | 'creative_diversity_leak'
  | 'auction_leak'
  | 'chronic_unprofitable'
  | 'data_gap'
  | 'fragmentation'
  | 'none'

export interface UsageResponse {
  totalUSD: number
  callCount: number
  byDay: Array<{ date: string; costUSD: number; agentBreakdown: Record<string, number> }>
  byAgent: Array<{ agentType: string; callCount: number; totalUSD: number; avgUSD: number }>
  byRun: Array<{ runId: string; startedAt: string; totalUSD: number; callCount: number }>
}

export interface Company {
  _id?: string
  tenantId: string
  name: string
  industry?: string
  tone?: string
  targetAudience?: string
  meta?: MetaConnection
  products?: Product[]
  competitors?: string[]
  pipelineConfig?: PipelineConfig
  budgetSettings?: BudgetSettings
  // Budget fields may also appear at top level (API returns them flattened)
  weeklyBudgetCap?: number
  maxBudgetPerCampaign?: number
  maxBudgetScalePercent?: number
  targetROAS?: number
  targetCPA?: number
  pauseIfROASBelow?: number
  pauseIfCTRBelow?: number
  pauseIfFrequencyAbove?: number
  scaleIfROASAbove?: number
  delivery?: { slackWebhook?: string }
  promptsHistory?: PromptsHistoryEntry[]
  learnings?: {
    updatedAt?: string
    creative?: {
      winningHooks?: string[]
      losingHooks?: string[]
      winningFormats?: string[]
      losingFormats?: string[]
      winningExemplars?: WinningExemplar[]
      audienceHookSaturation?: Record<string, Record<string, HookSaturationCell>>
    }
    campaign?: {
      audienceScores?: Record<string, number | AudienceScoreEntry>
      /** Per-product audience ROAS — what the audit priors and targeting guards actually consume */
      audienceScoresByProduct?: Record<string, Record<string, AudienceScoreEntry>>
      /** Stable Meta-import baseline (merged into agent scores at Day-30) */
      importedAudienceScoresByProduct?: Record<string, Record<string, AudienceScoreEntry>>
      budgetInsights?: string[]
      timingInsights?: string[]
    }
    causalInsights?: CausalInsight[]
  }
}

export interface PipelineRun {
  runId: string
  tenantId: string
  status: 'pending' | 'scouts_running' | 'intelligence_running' | 'research_running' | 'idea_pool_running' | 'digest_running' | 'creative_running' | 'campaign_launching' | 'completed' | 'failed'
  phase?: string
  startedAt?: string
  completedAt?: string
  selectedBriefId?: string
  briefsGenerated?: number
  campaignId?: string
  metaCampaignId?: string
  error?: string
  promptsVersion?: number
}

export interface ScoutOutput {
  platform: 'instagram' | 'reddit' | 'twitter' | 'youtube'
  data: {
    trending_topics: Array<{
      topic: string
      angle?: string
      engagementProof?: { metric: string; value: number; source: string }
      recency?: 'high' | 'medium'
      signalScore?: number
      score?: number  // legacy
    }>
    viral_trends: Array<{
      trend: string
      brand_tie_in?: string
      signalScore?: number
      source?: string
    }>
    format_insights: string[]
    hook_examples: string[]
    raw_summary?: string
  }
}

export interface AdLibrary {
  competitorAds: Array<{
    competitor: string
    hook: string
    angle?: string
    format?: string
    cta?: string
    estimatedDaysRunning?: number
    score?: number
    source?: string
  }>
  gaps: Array<{
    gap: string
    opportunity: string
    urgency: 'high' | 'medium' | 'low'
    score?: number
  }>
  dominantFormat?: string
  rawSummary?: string
}

export interface CoordinatorSignal {
  topic: string
  platforms: string[]
  compositeScore: number
  rationale: string
}

export interface IntelligenceBrief {
  briefId: string
  topic: string
  angle?: string
  product?: string
  platform?: string
  format?: string
  audience?: string
  hook?: string
  keyMessage?: string
  conversionBridge?: string
  suggestedBudget?: number
  finalScore?: number
  urgencyScore?: number
  selected?: boolean
  sourcePlatforms?: string[]
  ideaSource?: 'scout_signal' | 'viral_trend' | 'competitor_gap' | 'market_insight' | 'meta_ads_gap'
  /** The specific coordinator signals that inspired this brief (signal→outcome traceability) */
  sourceSignals?: Array<{ topic: string; platforms: string[]; compositeScore: number }>
  day7Performance?: null | Record<string, unknown>
  audienceStage?: AudienceStage
  explorationArm?: boolean
  adSetPerformance?: AdSetPerformance[]
}

export interface CreativeBrief {
  briefId: string
  topic: string
  angle?: string
  platform?: string
  format?: string
  audience?: string
  hook?: string
  keyMessage?: string
  conversionBridge?: string
  suggestedBudget?: number
  finalScore?: number
  selectionReason?: string
  debateRounds?: number
  debateLog?: Array<{ round: number; from: string; summary: string }>
  debateRationale?: string
}

export interface CopyVariant {
  primaryText: string
  headline?: string
  cta?: string
  hookStyle?: string
}

export interface CreativeImage {
  variantIndex?: number
  imagePrompt?: string
  imageUrl?: string
  editInstructions?: string[]
}

export interface CreativeVideo {
  videoUrl?: string
  videoThumbnailUrl?: string
  variantIndex?: number
  videoPrompt?: string
}

/** One slide of a carousel-format creative — a "grid/story" sequence of 3-10 cards. */
export interface CarouselCard {
  slotIndex: number
  headline: string
  description?: string
  imagePrompt?: string
  imageUrl?: string
  imageHash?: string
  cardLink?: string
}

export interface CreativePackage {
  _id?: string
  tenantId?: string
  runId?: string
  briefId?: string
  /** Which product this was generated for — set for library creatives, empty for older/one-off packages. */
  productName?: string
  /** Canonical language the copy/creative was generated in (e.g. "hinglish", "marathi"). */
  targetLanguage?: string
  status?: string
  copyVariants?: CopyVariant[]
  selectedCopyIndex?: number
  copySelectionReason?: string
  imagePrompt?: string
  images?: CreativeImage[]
  video?: CreativeVideo
  videoPrompt?: string
  /** Only populated for format='carousel' — images[] stays empty in that case. */
  carouselCards?: CarouselCard[]
  complianceNotes?: string
  debateRounds?: number
  debateLog?: Array<{ round: number; from: string; summary: string }>
  createdAt?: string
}

export interface AdSetConfig {
  name: string
  budgetPercent: number
  audienceType: 'lookalike' | 'advantage_plus' | 'retarget' | 'interest' | 'custom'
  metaAudienceId?: string
  ageMin?: number
  ageMax?: number
  geoLocations?: string[]
  optimizationGoal?: string
  ads?: number[]
}

export interface ReplacementHistoryEntry {
  oldHook: string
  newHook: string
  replacedAt: string
  reason: string
}

export interface CampaignAd {
  id?: string
  name?: string
  hookStyle?: string
  format?: string
  status?: string
  effectiveStatus?: string
  creativeId?: string
  creativeName?: string
  // Creative attributes — parsed from Meta's object_story_spec / asset_feed_spec,
  // not inferred from the ad name. Empty on dynamic-creative ads (Meta mixes
  // variants at delivery time — see isDynamicCreative).
  creativeBody?: string
  creativeTitle?: string
  creativeCta?: string
  creativeLinkUrl?: string
  creativeVideoId?: string
  creativeImageHash?: string
  thumbnailUrl?: string
  isDynamicCreative?: boolean
  spend?: number
  impressions?: number
  reach?: number
  frequency?: number
  clicks?: number
  conversions?: number
  revenue?: number
  roas?: number
  ctr?: number
  cpc?: number
  cpm?: number
  cpa?: number
  aov?: number
  cvr?: number
  addToCart?: number
  initiateCheckout?: number
  landingPageView?: number
  // Link clicks vs all clicks (which includes non-link engagement)
  inlineLinkClicks?: number
  outboundClicks?: number
  linkCtr?: number
  // Hook rate (3-sec plays / impressions) and hold rate (thruplay / 3-sec plays)
  video3s?: number
  thruplay?: number
  hookRate?: number
  holdRate?: number
  videoP25?: number
  videoP50?: number
  videoP75?: number
  videoP100?: number
  videoP25Pct?: number
  videoP50Pct?: number
  videoP75Pct?: number
  videoP100Pct?: number
  qualityRanking?: string
  engagementRanking?: string
  conversionRanking?: string
  ctrBaseline?: number
  replacementHistory?: ReplacementHistoryEntry[]
  dateStart?: string
  dateStop?: string
  // Trailing 7-day window — separate from the lifetime fields above, used for
  // fatigue/recency reads.
  last7d?: {
    spend?: number
    impressions?: number
    clicks?: number
    ctr?: number
    conversions?: number
    revenue?: number
    cpa?: number
  }
  metrics?: {
    spend?: number
    ctr?: number
    conversions?: number
    roas?: number
    cpa?: number
    cpc?: number
    cpm?: number
    revenue?: number
  }
}

/** Full structured targeting — everything beyond the flattened summary strings. */
export interface TargetingDetail {
  ageMin?: number | null
  ageMax?: number | null
  genders?: string
  geo?: {
    countries?: string[]
    regions?: Array<{ id?: string; name?: string; key?: string }>
    cities?: Array<{ key?: string; name?: string; radius?: number | null; distanceUnit?: string }>
    locationTypes?: string[]
    excludedCountries?: string[]
    excludedRegions?: Array<{ id?: string; name?: string }>
    excludedCities?: Array<{ id?: string; name?: string }>
  }
  interests?: Array<{ id?: string; name?: string }>
  behaviors?: Array<{ id?: string; name?: string }>
  flexibleSpec?: unknown[]
  exclusions?: unknown
  customAudiences?: Array<{ id?: string; name?: string }>
  excludedCustomAudiences?: Array<{ id?: string; name?: string }>
  locales?: number[]
  devicePlatforms?: string[]
  publisherPlatforms?: string[]
  facebookPositions?: string[]
  instagramPositions?: string[]
  audienceNetworkPositions?: string[]
  messengerPositions?: string[]
  advantageAudience?: boolean
  targetingOptimization?: string
  brandSafety?: string[]
}

export interface CampaignAdSet {
  id?: string
  metaAdSetId?: string
  name?: string
  audienceType?: string
  status?: string
  dailyBudget?: number
  lifetimeBudget?: number
  optimizationGoal?: string
  spend?: number
  impressions?: number
  reach?: number
  clicks?: number
  conversions?: number
  revenue?: number
  roas?: number
  ctr?: number
  cpc?: number
  cpm?: number
  cpa?: number
  aov?: number
  cvr?: number
  frequency?: number
  // Funnel
  addToCart?: number
  initiateCheckout?: number
  landingPageView?: number
  // Video
  videoP25?: number
  videoP50?: number
  videoP75?: number
  videoP100?: number
  videoP25Pct?: number
  videoP50Pct?: number
  videoP75Pct?: number
  videoP100Pct?: number
  // Rankings
  qualityRanking?: string
  engagementRanking?: string
  conversionRanking?: string
  // Delivery
  learningStage?: string
  effectiveStatus?: string
  // Bidding / delivery config
  bidAmount?: number
  bidStrategy?: string
  billingEvent?: string
  attributionSpec?: unknown
  promotedObject?: unknown
  startTime?: string
  endTime?: string
  // Targeting — flattened summary strings (fast to render in tables) …
  age?: string
  gender?: string
  placement?: string
  audienceSize?: number
  interests?: string[]
  geo?: string
  // … plus the full structured version (custom audiences, regions/cities,
  // exclusions, Advantage+ audience flag).
  targetingDetail?: TargetingDetail
  // Time
  dateStart?: string
  dateStop?: string
  ads?: CampaignAd[]
  addedByAudit?: boolean
  metrics?: {
    spend?: number
    ctr?: number
    roas?: number
    conversions?: number
    frequency?: number
    cpa?: number
    cpc?: number
    cpm?: number
    reach?: number
    revenue?: number
  }
}

export interface CampaignAction {
  actionId: string
  type: CampaignActionType | string
  targetId: string
  targetName: string
  reason: string | Record<string, unknown>
  priority?: string | number
  urgency?: 'high' | 'medium' | 'low'
  source?: 'auto' | 'human'
  metrics: Record<string, unknown> & {
    fatiguedHook?: string
    replacementHook?: string
    newHook?: string
    audienceType?: string
    forcedHookStyles?: string[]
    avoidHookStyles?: string[]
    donorAdSetId?: string
    recipientAdSetId?: string
    shiftPercent?: number
    oldDailyBudget?: number
    newDailyBudget?: number
    droppedPlacements?: string[]
    activeHours?: number[]
    newAudience?: Record<string, unknown>
    oldBudgetPercent?: number
    newBudgetPercent?: number
  }
  recommendedAt?: string
  executeAt?: string
  status: 'pending' | 'executed' | 'overridden'
  replacementStatus?: 'queued' | 'producing' | 'complete' | 'failed'
  addedByAudit?: boolean
}

export type PendingAction = CampaignAction

/** One segment's performance within a breakdown (age×gender, region, placement, …). */
export interface BreakdownRow {
  keys: Record<string, string>
  spend: number
  impressions: number
  reach?: number
  clicks: number
  ctr: number
  conversions: number
  revenue: number
  cpa: number
  roas: number
}

/** GET /campaigns/:tenantId/:campaignId/breakdowns response — keyed by breakdown type. */
export type CampaignBreakdowns = Partial<Record<
  'age_gender' | 'region' | 'country' | 'placement' | 'hourly' | 'dow' | 'asset_body' | 'asset_title' | 'asset_video',
  { rows: BreakdownRow[]; fetchedAt: string; window: string }
>>

/** One day's row from GET /campaigns/:tenantId/:campaignId/timeseries. */
export interface TimeseriesPoint {
  date: string
  spend: number
  impressions: number
  reach?: number
  frequency?: number
  clicks: number
  ctr: number
  cpc?: number
  cpm?: number
  conversions: number
  revenue: number
  addToCart?: number
  initiateCheckout?: number
  landingPageView?: number
  video3s?: number
  thruplay?: number
  entityId?: string
  adsetId?: string
}

/* ─── Manual Create Campaign ─── */

export interface MetaAudienceOption {
  id: string
  name: string
  type: 'custom' | 'lookalike'
  lookalikePercent?: number
  productName?: string
}

export interface MetaInterestOption {
  id: string
  name: string
  audienceSize: number
}

export interface ManualAdSetInput {
  name: string
  budgetPercent: number
  audienceType: 'advantage_plus' | 'lookalike' | 'retarget' | 'custom' | 'interest'
  metaAudienceId?: string
  excludeAudienceIds?: string[]
  ageMin?: number
  ageMax?: number
  gender?: 'male' | 'female' | 'all'
  geoLocations?: string[]
  interests?: Array<{ id: string; name: string }>
  optimizationGoal?: string
  creativeFormat?: 'video' | 'image' | 'both' | 'mixed'
}

export interface ManualCopyVariant {
  primaryText: string
  headline: string
  cta: string
  hookStyle?: string
}

export interface CreateManualCampaignDto {
  name: string
  productName?: string
  campaignType: 'advantage_plus' | 'custom'
  budget: number
  objective?: string
  adSets: ManualAdSetInput[]
  /** Exactly one of creative / creativePackageId must be set. */
  creative?: {
    copyVariants: ManualCopyVariant[]
    images?: Array<{ variantIndex: number; imageUrl: string }>
    video?: { variantIndex: number; videoUrl: string; videoThumbnailUrl?: string } | null
  }
  /** Reuse an existing, already-produced creative from the creative library. */
  creativePackageId?: string
}

export interface AuditSnapshot {
  auditedAt: string
  metrics: {
    spend?: number
    ctr?: number
    roas?: number
    conversions?: number
  }
  adSets?: Array<{
    id?: string
    name?: string
    metrics?: {
      spend?: number
      ctr?: number
      roas?: number
      conversions?: number
      frequency?: number
      cpa?: number
    }
    thompsonAllocation?: number
  }>
  ads?: Array<{
    id?: string
    name?: string
    hookStyle?: string
    metrics?: {
      spend?: number
      impressions?: number
      ctr?: number
      conversions?: number
    }
    didFatigue?: Array<{
      day: number
      observed: number
      counterfactual: number
    }>
  }>
  verdict: {
    verdict: 'no_action' | 'watch' | 'act'
    urgency?: 'immediate' | '48h' | '7d' | null
    contextInsight?: string
    // Primary leak the agent diagnosed (see LEAK DIAGNOSIS FRAMEWORK in the
    // auditor prompt). Synthetic skips (cooldown / parser failure) leave it null;
    // all-green skips set it to 'none'.
    leakDiagnosis?: LeakDiagnosis | null
    recommendedActions?: Array<string | { type: string; targetId?: string; targetName?: string; reason?: string; priority?: string }>
  }
  // Margin-aware breakeven ROAS resolved on this audit pass. Source tells you
  // whether the value came from the active product, the vertical default, or the
  // 0.50 fallback — useful for confirming the tenant has configured the right
  // contributionMargin.
  breakeven?: {
    margin: number
    breakevenROAS: number
    source: 'product' | 'vertical' | 'default'
  }
  // Full AuditSignalPacket — persisted post 2026-05-19 so all-green and cooldown
  // skips are forensically diagnosable. Loose-typed because the packet shape is
  // owned by the backend; UI consumes specific sub-paths defensively.
  signals?: Record<string, unknown>
  bayesian?: {
    shrunkenROAS?: number
    lowerROAS?: number
    breakeven?: number
    confidenceLevel?: number
  }
  powerCalc?: {
    reachedFloor: boolean
    minDays?: number
    daysObserved?: number
  }
}

export interface Campaign {
  _id: string
  status: 'pending_approval' | 'active' | 'paused' | 'completed' | 'failed'
  source?: 'agent' | 'human' | 'manual'
  syncedAt?: string
  metaAccountId?: string
  lastAuditedAt?: string
  budget?: number
  objective?: string
  // Structure — which budget levers exist on this campaign.
  // 'abo' = adset budgets (shift_budget_between_adsets works); 'cbo' = campaign
  // owns the budget; 'asc' = Advantage+ Shopping (campaign budget + creative only).
  budgetModel?: 'abo' | 'cbo' | 'asc' | ''
  bidStrategy?: string
  buyingType?: string
  smartPromotionType?: string
  specialAdCategories?: string[]
  spendCap?: number
  stopTime?: string
  metaCampaignId?: string
  briefId?: string
  creativePackageId?: string
  runId?: string
  launchedAt?: string
  pausedAt?: string
  pauseReason?: string
  approvedAt?: string
  reviewNotes?: string
  reviewAdjustments?: {
    budgetAdjusted: boolean
    originalBudget: number
    recommendedBudget: number
  }
  reviewDebateLog?: Array<{ round: number; from: string; summary: string }>
  campaignConfig?: {
    budget?: number
    objective?: string
    conversionEvent?: string
    conversionValue?: number
    adSets?: AdSetConfig[]
    scaleRules?: string
    pauseRules?: string
  }
  name?: string
  adSets?: CampaignAdSet[]
  metaAdSets?: CampaignAdSet[]
  pendingActions?: PendingAction[]
  spend?: number
  impressions?: number
  clicks?: number
  conversions?: number
  roas?: number
  ctr?: number
  cpc?: number
  topic?: string
  promptsVersion?: number
  creativeFormat?: CreativeFormat
  weeklyBudgetConsumed?: number
  creativePackage?: CreativePackage
}

export interface FullRunData {
  run: PipelineRun
  scouts?: ScoutOutput[]
  adLibrary?: AdLibrary | null
  coordinator?: {
    content: string
    topSignals: CoordinatorSignal[]
  }
  research?: Array<{
    type: 'competitor' | 'market'
    content?: string  // raw text, for debugging only
    structured?: {
      insights: Array<{
        insight: string
        implication: string
        urgency: 'high' | 'medium' | 'low'
        score: number
        source?: string
      }>
      rawSummary?: string
    }
  }>
  briefs?: IntelligenceBrief[]
  creativeBrief?: CreativeBrief
  creativePackage?: CreativePackage
  campaign?: Campaign
  digests?: Array<{
    type: 'signals' | 'idea' | 'cta'
    content: string
    delivered: boolean
    deliveredAt?: string
    briefId?: string
    ideaIndex?: number
    recommended?: boolean
  }>
}

export interface CaseStudy {
  _id?: string
  tenantId: string
  campaignName: string
  product: string
  dateRange?: string
  durationDays?: number
  totalSpend?: number
  totalConversions?: number
  context?: string
  whatWorked?: {
    hooks?: string[]
    audiences?: string[]
    formats?: string[]
    bestCPA?: number
    bestROAS?: number
  }
  whatFailed?: {
    hooks?: string[]
    audiences?: string[]
    reason?: string
  }
  lesson?: string
}
