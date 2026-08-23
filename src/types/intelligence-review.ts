export const INTELLIGENCE_REVIEW_SCHEMA_VERSION =
  'intelligence_review_v1' as const

export type IntelligenceReviewModel = string

export type IntelligenceReviewObjectiveKey =
  | 'sales'
  | 'leads'
  | 'awareness'
  | 'traffic'
  | 'engagement'
  | 'video_views'
  | 'app_installs'
  | 'messages'
  | 'catalog_sales'
  | 'retargeting'

export type IntelligenceReviewCampaignActionType =
  | 'pause_ad'
  | 'pause_adset'
  | 'scale_adset'
  | 'replace_creative'
  | 'add_creative'
  | 'add_adset'
  | 'shift_budget_between_adsets'
  | 'reduce_total_budget'
  | 'narrow_placement'
  | 'dayparting'

export type IntelligenceReviewVerdict = 'support' | 'hold' | 'reject'

export interface IntelligenceReviewActionSnapshot {
  actionId: string
  type: IntelligenceReviewCampaignActionType
  targetType: 'campaign' | 'adset' | 'ad'
  targetId: string
  parameters: Record<string, unknown>
  expectedImpact: {
    metric: string
    deltaPct: number
    confidence: number
    basis?: 'modeled' | 'observed_gap' | 'not_estimated'
    currentValue?: number
    siblingBaselineValue?: number
    observedGapPct?: number
  }
  expectedProfitDeltaINR7d: number
  risk: 'low' | 'medium' | 'high'
  implementationCost: number
  score: number
  gatedBy: string[]
  requiresHumanApproval: boolean
}

export interface IntelligenceReviewValidationCheck {
  metric: string
  check: string
  evidenceRefs: string[]
}

/**
 * Mirrors the backend `IntelligenceReviewResult` response. Keep this contract
 * narrow: OpenAI explains or challenges a deterministic recommendation but
 * cannot mutate its action, target, parameters, modeled impact, or gates.
 */
export interface IntelligenceReviewResult {
  verdict: IntelligenceReviewVerdict
  goal: {
    objective: IntelligenceReviewObjectiveKey
    primaryKPI: string
    optimizationGoal: string | null
    optimizationMetric: string | null
  }
  headline: string
  summary: string
  observedFacts: Array<{
    evidenceRef: string
    statement: string
  }>
  hypotheses: Array<{
    statement: string
    confidence: number
    evidenceRefs: string[]
    counterevidenceRefs: string[]
  }>
  unknowns: Array<{
    question: string
    whyItMatters: string
  }>
  recommendation: {
    action: IntelligenceReviewActionSnapshot
    interpretation: string
  }
  validationPlan: {
    after24h: IntelligenceReviewValidationCheck[]
    after72h: IntelligenceReviewValidationCheck[]
  }
  model: IntelligenceReviewModel
  generatedAt: string
  inputHash: string
  source: 'openai' | 'fallback'
  validation: {
    valid: boolean
    issues: string[]
  }
}

export type IntelligenceReviewEvidenceValue =
  | string
  | number
  | boolean
  | null

export type IntelligenceReviewEvidenceKind =
  | 'observed'
  | 'derived'
  | 'policy'
  | 'model_output'

export type IntelligenceReviewEvidenceSource =
  | 'snapshot'
  | 'objective'
  | 'lifecycle'
  | 'trend'
  | 'revenue'
  | 'signal'
  | 'diagnosis'
  | 'business'
  | 'portfolio'
  | 'forecast'
  | 'confidence'
  | 'memory'
  | 'recommendation'

export type IntelligenceReviewEvidenceStep =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13

export interface IntelligenceReviewEvidenceFact {
  ref: string
  step: IntelligenceReviewEvidenceStep
  source: IntelligenceReviewEvidenceSource
  kind: IntelligenceReviewEvidenceKind
  statement: string
  value: IntelligenceReviewEvidenceValue
  unit?: string
  targetType?: 'campaign' | 'adset' | 'ad'
  targetId?: string
}

export type IntelligenceReviewHierarchyLevel =
  | 'campaign'
  | 'adset'
  | 'ad'
  | 'creative'

export interface IntelligenceReviewHierarchyMetric {
  key: string
  label: string
  value: number | null
  unit: string
  status: 'available' | 'unavailable' | 'unsupported'
  evidenceRef?: string
}

export interface IntelligenceReviewHierarchyNode {
  level: IntelligenceReviewHierarchyLevel
  id: string
  parentId?: string
  name: string
  role: 'action_target' | 'context' | 'comparison'
  resolution: 'exact' | 'unresolved'
  status?: string
  optimizationGoal?: string
  format?: string
  metrics: IntelligenceReviewHierarchyMetric[]
  evidenceRefs: string[]
  creative?: {
    id?: string
    title?: string
    body?: string
    cta?: string
    thumbnailUrl?: string
    source: 'meta'
    galleryResolution: 'unresolved'
  }
}

export interface IntelligenceReviewDeterministicUnknown {
  code: string
  statement: string
  effect:
    | 'reduces_confidence'
    | 'blocks_diagnosis'
    | 'blocks_recommendation'
    | 'blocks_execution'
    | 'blocks_validation'
}

export interface IntelligenceReviewBaseline {
  metric: string
  value: number | null
  unit: string
  evidenceRef?: string
  capturedAt: string
}

/**
 * Optional deterministic context for the review UI. It is intentionally
 * separate from the OpenAI result so observed hierarchy, missing data, and
 * baseline measurements cannot be authored or rewritten by the model.
 */
export interface IntelligenceReviewEvidenceBundle {
  packet: {
    schemaVersion: typeof INTELLIGENCE_REVIEW_SCHEMA_VERSION
    cycleId: string
    tenantId: string
    campaignId: string
    goal: {
      objective: IntelligenceReviewObjectiveKey
      primaryKPI: string
      supportingKPIs: string[]
      optimizationGoal: string | null
      optimizationMetric: string | null
    }
    facts: IntelligenceReviewEvidenceFact[]
    unknowns: IntelligenceReviewDeterministicUnknown[]
  }
  hierarchy: {
    nodes: IntelligenceReviewHierarchyNode[]
    coverage: {
      adSetsIncluded: number
      adSetsTotal: number
      adsIncluded: number
      adsTotal: number
      truncated: boolean
    }
  }
  unknowns: IntelligenceReviewDeterministicUnknown[]
  baseline: IntelligenceReviewBaseline
}
