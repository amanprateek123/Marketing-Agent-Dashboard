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
  // App Promotion/Engagement — native-app counterpart to pixelId. Set together
  // with conversionEvent (read as an App Event name, e.g. "chat_success").
  // Mutually exclusive with pixelId/customConversionId in practice.
  metaAppId?: string
  metaAppStoreUrl?: string        // Default/fallback store URL — used when an ad set doesn't split by OS
  metaAppStoreUrlIos?: string     // App Store URL — used when an ad set's userOs targets iOS only
  metaAppStoreUrlAndroid?: string // Play Store URL — used when an ad set's userOs targets Android only
  pageId?: string                // Per-product Facebook Page override (blank = use company default) — which Page this product's ads post as
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
  /** True pre-edit source — every edit-image call re-applies all editInstructions here, never to a previous edit's output. */
  originalImageUrl?: string
  editInstructions?: string[]
  aspectRatio?: string
  resolution?: string
  /** Soft-delete, reversible — hidden from its Gallery sheet until restored. Never affects campaign launch. */
  rejected?: boolean
  /**
   * Set when this entry is a placement size the backend derived by canvas-
   * extending another asset (value = that asset's imageUrl) rather than a
   * separately generated creative. Present => render it as a size OF its
   * source, not as its own variant, and don't offer regenerate/edit/reject on
   * it — those act on the variant, which is keyed by variantIndex alone and
   * would resolve to the original anyway.
   */
  extendedFrom?: string
  /**
   * Set when this entry is an alternate size a human uploaded ready-made
   * alongside the creative (value = that creative's imageUrl) rather than one
   * the backend derived. Same display rule as `extendedFrom` — a size OF its
   * source, never the creative itself — but it's a real cut rather than a
   * canvas-extended one, so it's labelled differently.
   */
  uploadedSizeOf?: string
}

export interface CreativeVideo {
  videoUrl?: string
  videoThumbnailUrl?: string
  variantIndex?: number
  videoPrompt?: string
  aspectRatio?: string
  resolution?: string
  /** Which engine rendered this — undefined means 'heygen' (the original default). */
  provider?: 'heygen' | 'higgsfield'
  /** Higgsfield job_type when provider === 'higgsfield', e.g. 'seedance_2_0', 'kling3_0_turbo'. */
  providerModel?: string
  /** Soft-delete, reversible — hidden from its Gallery sheet until restored. Never affects campaign launch. */
  rejected?: boolean
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
  /** Additive to `video` — multiple pre-made sizes of the same video, each tagged with aspectRatio. */
  videos?: CreativeVideo[]
  videoPrompt?: string
  /** Scene-by-scene Higgsfield build (plan -> generate per-scene -> merge into `video`). Empty unless that manual workflow was used. */
  videoScenes?: Array<{
    sceneIndex: number
    prompt: string
    durationSeconds: number
    aspectRatio: string
    resolution: string
    videoUrl: string
    status: 'pending' | 'completed' | 'failed'
    providerModel: string
    error?: string
  }>
  /** Total duration the scene plan was built for. */
  videoTotalDurationSeconds?: number
  /** Cartesia-narrated COPY of video.videoUrl — original is never overwritten. Empty until a voiceover has been added. */
  videoWithVoiceoverUrl?: string
  /** Devanagari narration script last used to produce videoWithVoiceoverUrl. */
  voiceoverScript?: string
  /** Only populated for format='carousel' — images[] stays empty in that case. */
  carouselCards?: CarouselCard[]
  complianceNotes?: string
  debateRounds?: number
  debateLog?: Array<{ round: number; from: string; summary: string }>
  createdAt?: string
}

/** Which Meta surfaces an ad set can serve on. Undefined -> 'vertical', the long-standing default (backend: placement-presets.ts). */
export type PlacementPreset = 'vertical' | 'vertical_feed' | 'everywhere'

export const PLACEMENT_PRESET_OPTIONS: { value: PlacementPreset; label: string }[] = [
  { value: 'vertical', label: 'Vertical only (Stories & Reels)' },
  { value: 'vertical_feed', label: 'Vertical + Feed' },
  { value: 'everywhere', label: 'Everywhere (Facebook + Instagram)' },
]

export interface AdSetConfig {
  name: string
  budgetPercent: number
  audienceType: 'lookalike' | 'advantage_plus' | 'retarget' | 'interest' | 'custom'
  metaAudienceId?: string
  excludeAudienceIds?: string[]
  ageMin?: number
  ageMax?: number
  gender?: string
  geoLocations?: string[]
  /** Meta region keys — replace the country layer at launch. */
  geoStates?: string[]
  /** Meta city keys — replace the country layer at launch. */
  geoCities?: string[]
  /** Meta locale IDs (e.g. 81 = Marathi, 46 = Hindi) — see getMetaLocales() for the verified table. */
  locales?: number[]
  interests?: string[]
  optimizationGoal?: string
  creativeFormat?: 'video' | 'image' | 'both' | 'mixed' | 'carousel'
  placementPreset?: PlacementPreset
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

/**
 * A Meta geo-targeting location (state/region or city) from the live
 * adgeolocation search. `key` is the opaque Meta identifier that goes into
 * targeting.geo_locations.regions[].key / .cities[].key — never a name, and
 * never a hand-copied constant (the backend hardcoded region keys before this
 * search existed, with the same drift risk that bit the locale ID table).
 */
export interface MetaGeoOption {
  key: string
  name: string
  type: string
  /** Parent state on city results — disambiguates same-named cities. */
  region?: string
  countryCode?: string
}

/**
 * Live custom/lookalike audience from ONE specific ad account (not the
 * saved product.metaAudiences snapshot) — Custom Audiences are account-
 * scoped Meta objects, so this list always matches whichever account the
 * Create Campaign form is currently targeting.
 */
export interface MetaCustomAudience {
  id: string
  name: string
  type: 'custom' | 'lookalike'
  subtype?: string
  approxSizeLower?: number
  approxSizeUpper?: number
  deliveryStatus?: string
}

/* ─── Meta Ad Accounts (settings — account picker) ─── */

export interface MetaAdAccount {
  id: string // "act_123456"
  name: string
  status: 'active' | 'disabled' | 'unsettled' | 'pending_review' | 'in_grace_period' | 'pending_closure' | 'other'
  currency: string
  timezoneName: string
  currentlySynced: boolean
}

export interface MetaAdAccountsResponse {
  accounts: MetaAdAccount[]
  total: number
  active: number
}

export interface MetaBusiness {
  id: string
  name: string
}

/* ─── Meta Pages (settings — Page picker) ─── */
// Added after a prod incident (2026-07-29): company.meta.pageId was a
// hand-typed, unvalidated ID and silently pointed ads at the wrong Facebook
// Page. This lets the settings UI show real Page names instead of a bare ID.

export interface MetaPage {
  id: string
  name: string
  category?: string
  /** True = token can post ads as this Page right now (from /me/accounts). False = owned by the Business Manager but not yet granted to this token — will fail at launch until access is granted. */
  accessible: boolean
  /** True = authorized on THIS tenant's own ad account(s) right now (Meta's promote_pages allowlist) — the exact per-account gate Ads Manager enforces. A Page can be accessible above and still get rejected at launch if it isn't on this list. */
  promotable: boolean
  currentlySelected: boolean
}

export interface MetaPagesResponse {
  pages: MetaPage[]
  total: number
  accessible: number
  promotable: number
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
  /** ISO country codes. Dropped at launch whenever geoStates/geoCities are set. */
  geoLocations?: string[]
  /**
   * Meta region keys from searchMetaGeo(). These REPLACE the country layer at
   * launch — Meta rejects overlapping country + region targeting (subcode
   * 1487756), so the backend sends whichever is narrowest, never both.
   */
  geoStates?: string[]
  /** Meta city keys, same source and precedence as geoStates (25km radius applied at launch). */
  geoCities?: string[]
  /** Meta locale IDs (e.g. 81 = Marathi, 46 = Hindi) — filters delivery to users whose platform language matches. */
  locales?: number[]
  /** Device OS targeting — 'iOS'/'Android' to split an App Promotion/Engagement campaign into per-platform ad sets with independent budgets/reporting. Omit for no OS filter (ships to both). */
  userOs?: ('iOS' | 'Android')[]
  interests?: Array<{ id: string; name: string }>
  optimizationGoal?: string
  creativeFormat?: 'video' | 'image' | 'both' | 'mixed'
  placementPreset?: PlacementPreset
  /** Which copy-variant indices this ad set ships as ads. Omit/empty = all variants (default, unchanged behavior). Every variant must be covered by at least one ad set across the campaign. */
  ads?: number[]
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
    /**
     * Usually one image per variantIndex. Give the same variantIndex a
     * second (or third) entry tagged with a different aspectRatio to
     * supply a human creative team's pre-made sizes — launch() then routes
     * each size to the placement it was composed for (Stories/Reels vs.
     * Feed/everything else) instead of auto-cropping one image.
     */
    images?: Array<{ variantIndex: number; imageUrl: string; aspectRatio?: '9:16' | '1:1' | '4:5' | '16:9' }>
    video?: { variantIndex: number; videoUrl: string; videoThumbnailUrl?: string } | null
    /** Additive to `video` — multiple pre-made sizes of the same video. Set instead of `video`, not alongside it. */
    videos?: Array<{ variantIndex: number; videoUrl: string; videoThumbnailUrl?: string; aspectRatio?: '9:16' | '1:1' | '4:5' | '16:9' }>
  }
  /** Reuse an existing, already-produced creative from the creative library. */
  creativePackageId?: string
}

/**
 * Edit a still-pending campaign's structure/targeting/budget — everything
 * optional, unset fields keep their current value. Only valid while status
 * is pending_approval with no metaCampaignId yet. Creative content itself
 * (copy text, image/video) is edited via updateCreativePackage instead.
 */
export interface UpdateManualCampaignConfigDto {
  name?: string
  /**
   * Reassign the campaign to a different product. Re-resolves conversion
   * event/value from it and rewrites campaign.productName — which is what
   * launch reads for the landing URL, pixel and custom conversion. Also the
   * repair path for older campaigns that have no product recorded.
   */
  productName?: string
  accountId?: string
  campaignType?: 'advantage_plus' | 'custom'
  budget?: number
  objective?: string
  adSets?: ManualAdSetInput[]
}

/* ── Pre-launch review ─────────────────────────────────────────────────────
   GET /campaigns/:tenantId/:campaignId/review — the resolved truth about what
   approving will actually do: which product the ads point at, the exact
   destination URL, the pixel and conversion event they'll optimize toward, the
   ₹/day each ad set gets, and `blockers` (what will make Approve fail).
   Values here are RESOLVED, not stored — the destination is the same string
   launch sends to Meta, not a field copied off the campaign document. */

export interface LaunchReviewIssue {
  /** Stable machine code — drives the plain-English headline in the UI. */
  code: string
  message: string
  /** Where to go to fix it, when there's an obvious place. */
  fix?: string
}

export interface LaunchReviewProduct {
  name: string
  /** 'campaign' = recorded explicitly on the campaign. Anything else was inferred. */
  resolvedVia: 'campaign' | 'brief' | 'sole_active'
  landingUrl: string
  price: number | null
  currency: string
  conversionValueGross: number
  conversionValueNet: number
  refundRatePercent: number
  contributionMargin: number | null
  breakevenROAS: number | null
  conversionTracking:
    | { type: 'custom_conversion'; id: string }
    | { type: 'custom_event'; name: string }
    | { type: 'standard_event'; event: string }
    | { type: 'app_event'; event: string; applicationId: string }
  pixelId: string
  pixelSource: 'product' | 'company_default'
  /** Set when conversionTracking.type === 'app_event' — same value as conversionTracking.applicationId. */
  applicationId: string | null
  appStoreUrl: string | null
  metaOptimizationGoal: string | null
  languages: string[]
}

export interface LaunchReviewAdSet {
  name: string
  budgetPercent: number
  /** ₹/day this ad set actually gets — budget × its share, already computed. */
  dailyBudget: number
  audienceType: string
  customAudience: { id: string; name: string } | null
  excludedAudiences: Array<{ id: string; name: string } | null>
  ageMin: number | null
  ageMax: number | null
  gender: string
  geoLocations: string[]
  /** Meta region keys that will ship (suppressing the country layer). */
  geoStates: string[]
  /** Meta city keys that will ship (suppressing the country layer). */
  geoCities: string[]
  /** Which geo layer Meta actually receives — the narrowest one that's set. */
  effectiveGeoLayer: 'countries' | 'regions' | 'cities'
  locales: number[]
  /** Device OS targeting — 'iOS'/'Android' when this ad set splits an App Promotion/Engagement campaign by platform. */
  userOs: ('iOS' | 'Android')[]
  interestIds: string[]
  optimizationGoal: string
  creativeFormat: string
  copyVariantIndices: number[]
  /** The exact page traffic lands on. UTM params are appended per ad at launch. */
  destinationUrl: string
}

export interface CampaignLaunchReview {
  ready: boolean
  blockers: LaunchReviewIssue[]
  warnings: LaunchReviewIssue[]
  campaign: {
    id: string
    name: string
    /** The name Meta will actually create — not always the stored name. */
    metaCampaignName: string
    status: string
    source: string
    objective: string
    dailyBudget: number
    projectedWeeklySpend: number
    spendCap: number
    stopTime: string | null
    intendedAccountId: string
    allowedAccountIds: string[]
    isLandingPageTest: boolean
    briefId: string | null
    creativePackageId: string | null
    createdAt: string | null
    reviewNotes: string
  }
  product: LaunchReviewProduct | null
  adSets: LaunchReviewAdSet[]
  creative: {
    packageId: string | null
    status: string | null
    copyVariants: Array<{
      index: number
      hookStyle: string
      primaryText: string
      headline: string
      description: string
      cta: string
    }>
    images: Array<{
      variantIndex: number
      aspectRatio: string | null
      imageUrl: string
      rejected: boolean
    }>
    videos: Array<{ variantIndex: number; aspectRatio: string | null; videoUrl: string }>
    carouselCards: Array<{
      index: number
      headline: string
      description: string
      imageUrl: string
      link: string
    }>
  }
  budgetContext: {
    weeklyAlreadyCommitted: number
    weeklyCap: number
    weeklyRemaining: number | null
    maxBudgetPerCampaign: number
  }
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
  /**
   * Which product this campaign sells — recorded when it was created. The
   * landing URL, pixel and conversion event all come from this product at
   * launch. Empty on campaigns created before the field existed; launch then
   * falls back to the brief, and refuses to launch if that's ambiguous too.
   */
  productName?: string
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
  pageSwapStatus?: PageSwapStatus | null
}

/** Progress of an in-place Page swap on a live campaign — same campaign/ad sets/ad IDs, only each ad's creative Page identity changes. Runs in the background; poll the campaign for live progress. */
export interface PageSwapStatus {
  status: 'running' | 'complete' | 'failed'
  targetPageId: string
  total: number
  swapped: number
  failed: number
  startedAt: string
  completedAt?: string
  results: Array<{
    adSetId: string
    adId: string
    status: 'swapped' | 'failed'
    newCreativeId?: string
    error?: string
  }>
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

// ── Tenant overview (dashboard home) ───────────────────────────────────────
export * from './overview'

// ── Custom brief: the external creative pipeline ───────────────────────────
export * from './pipeline'
