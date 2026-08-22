/**
 * Campaign Copilot is deliberately typed a little more loosely than the rest
 * of the dashboard. The chat API evolves by adding richer plan and
 * recommendation fields, while the durable contract is the conversation,
 * status, readiness and resulting campaign id.
 */
export type CampaignCopilotStatus =
  | 'collecting'
  | 'ready'
  | 'build_queued'
  | 'building'
  | 'pending_approval'
  | 'failed'
  | 'cancelled'
  | string

export interface CampaignCopilotMessage {
  id?: string
  _id?: string
  role: 'user' | 'assistant' | 'system' | string
  content: string
  createdAt?: string
}

export interface CampaignCopilotMissingField {
  field?: string
  label?: string
  question?: string
  reason?: string
  required?: boolean
  [key: string]: unknown
}

export interface CampaignCopilotRecommendation {
  field?: string
  label?: string
  title?: string
  value?: unknown
  suggestion?: unknown
  recommendation?: unknown
  reason?: string
  rationale?: string
  confidence?: number
  [key: string]: unknown
}

export interface CampaignCopilotReadiness {
  ready: boolean
  missingFields?: string[]
  blockers?: Array<string | CampaignCopilotMissingField>
  warnings?: string[]
  [key: string]: unknown
}

export interface CampaignCopilotPlan {
  campaignName?: string | null
  productMode?: 'existing' | 'new' | null
  productName?: string | null
  landingUrl?: string | null
  newProduct?: {
    description?: string | null
    price?: number | null
    currency?: string | null
    conversionEvent?: string | null
    conversionValue?: number | null
    pixelId?: string | null
    customConversionId?: string | null
    pageId?: string | null
    metaAppId?: string | null
    metaAppStoreUrl?: string | null
    [key: string]: unknown
  } | null
  objective?: string | null
  /** Delivery choice within the campaign objective, e.g. reach vs impressions. */
  optimizationGoal?: string | null
  /** Server-resolved launch identity and conversion settings. */
  pageId?: string | null
  conversionEvent?: string | null
  conversionValue?: number | null
  dailyBudget?: number | null
  requestedDailyBudget?: number | null
  accountId?: string | null
  funnelStage?: 'cold' | 'warm' | 'hot' | null
  audienceType?: string | null
  audienceName?: string | null
  metaAudienceId?: string | null
  targetSegment?: string | null
  geoLocations?: string[]
  language?: string | null
  creativeFormat?: string | null
  appPlatform?: 'iOS' | 'Android' | null
  angle?: string | null
  keyMessage?: string | null
  [key: string]: unknown
}

export interface CampaignCopilotRecommendations {
  budget?: {
    dailyBudget?: number | null
    maxAllowed?: number | null
    rationale?: string | null
    [key: string]: unknown
  } | null
  audience?: {
    type?: string | null
    name?: string | null
    metaAudienceId?: string | null
    targetSegment?: string | null
    funnelStage?: string | null
    rationale?: string | null
    [key: string]: unknown
  } | null
  accountId?: string | null
  objective?: string | null
  creativeFormat?: string | null
  [key: string]: unknown
}

export interface CampaignCopilotBuild {
  jobId?: string | null
  startedAt?: string | null
  completedAt?: string | null
  campaignId?: string | null
  creativeBriefId?: string | null
  creativePackageId?: string | null
  error?: string | null
  [key: string]: unknown
}

export interface CampaignCopilotProgress {
  stage?: string
  message?: string
  percent?: number
  completedSteps?: string[]
  [key: string]: unknown
}

export interface CampaignCopilotSession {
  _id?: string
  id?: string
  sessionId?: string
  tenantId?: string
  status: CampaignCopilotStatus
  messages: CampaignCopilotMessage[]
  plan?: CampaignCopilotPlan | null
  recommendations?:
    | CampaignCopilotRecommendations
    | Array<string | CampaignCopilotRecommendation>
  missingFields?: Array<string | CampaignCopilotMissingField>
  readiness?: CampaignCopilotReadiness
  progress?: string | CampaignCopilotProgress
  build?: CampaignCopilotBuild | null
  campaignId?: string
  error?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

/** Some deployments wrap the session while others return it directly. */
export type CampaignCopilotSessionResponse =
  | CampaignCopilotSession
  | {
      session?: CampaignCopilotSession
      data?: CampaignCopilotSession
      reply?: string
      assistantMessage?: string
      [key: string]: unknown
    }
