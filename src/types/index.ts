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
  category?: string
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

export interface ShadowAction {
  proposedAction: string | { type?: string; targetName?: string; reason?: string; [k: string]: unknown }
  blockedReason: string | { reason?: string; [k: string]: unknown }
  regretLabel: 'correct_block' | 'missed_signal' | 'inconclusive'
  age?: string
  proposedAt?: string
  evaluatedAt?: string
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
}

export interface CreativeVideo {
  videoUrl?: string
  videoThumbnailUrl?: string
  variantIndex?: number
  videoPrompt?: string
}

export interface CreativePackage {
  status?: string
  copyVariants?: CopyVariant[]
  selectedCopyIndex?: number
  copySelectionReason?: string
  imagePrompt?: string
  images?: CreativeImage[]
  video?: CreativeVideo
  videoPrompt?: string
  complianceNotes?: string
  debateRounds?: number
  debateLog?: Array<{ round: number; from: string; summary: string }>
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
  spend?: number
  impressions?: number
  clicks?: number
  ctr?: number
  cpc?: number
  ctrBaseline?: number
  replacementHistory?: ReplacementHistoryEntry[]
  metrics?: {
    spend?: number
    ctr?: number
    conversions?: number
  }
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
  clicks?: number
  conversions?: number
  ctr?: number
  cpa?: number
  frequency?: number
  ads?: CampaignAd[]
  addedByAudit?: boolean
  metrics?: {
    spend?: number
    ctr?: number
    roas?: number
    conversions?: number
    frequency?: number
    cpa?: number
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
  source?: 'agent' | 'manual'
  syncedAt?: string
  metaAccountId?: string
  lastAuditedAt?: string
  budget?: number
  objective?: string
  metaCampaignId?: string
  briefId?: string
  creativePackageId?: string
  runId?: string
  launchedAt?: string
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
