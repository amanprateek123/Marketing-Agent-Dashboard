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
  learnings?: {
    updatedAt?: string
    creative?: {
      winningHooks?: string[]
      losingHooks?: string[]
      winningFormats?: string[]
      losingFormats?: string[]
    }
    campaign?: {
      audienceScores?: Record<string, number>
      budgetInsights?: string[]
      timingInsights?: string[]
    }
  }
}

export interface PipelineRun {
  runId: string
  tenantId: string
  status: 'pending' | 'scouts_running' | 'intelligence_running' | 'idea_pool_running' | 'creative_running' | 'campaign_launching' | 'completed' | 'failed'
  phase?: string
  startedAt?: string
  completedAt?: string
  selectedBriefId?: string
  briefsGenerated?: number
  campaignId?: string
  metaCampaignId?: string
  error?: string
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
  type: 'pause_ad' | 'pause_adset' | 'scale_adset' | 'replace_creative' | 'add_creative' | 'add_adset' | string
  targetId: string
  targetName: string
  reason: string | Record<string, unknown>
  priority?: string | number
  metrics: Record<string, unknown> & {
    fatiguedHook?: string
    replacementHook?: string
    newHook?: string
    audienceType?: string
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
  }>
  verdict: {
    verdict: 'no_action' | 'watch' | 'act'
    urgency?: 'immediate' | '48h' | '7d' | null
    contextInsight?: string
    recommendedActions?: Array<string | { type: string; targetId?: string; targetName?: string; reason?: string; priority?: string }>
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
