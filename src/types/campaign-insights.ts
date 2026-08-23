/** Mirrors the backend `campaign-insights.types.ts` contract. */

export type InsightsResolutionMethod =
  | 'explicit_selection'
  | 'name_match'
  | 'only_candidate'
  | 'unresolved'

export interface InsightsAdSnapshot {
  id: string
  name: string
  status: string
  format: string | null
  hookStyle: string | null
  spend: number
  roas: number | null
  ctr: number | null
  cvr: number | null
  conversions: number
  impressions: number
  frequency: number | null
  holdRate: number | null
  creativeTitle: string | null
  creativeCta: string | null
  thumbnailUrl: string | null
}

export interface InsightsAdSetSnapshot {
  id: string
  name: string
  status: string
  optimizationGoal: string | null
  audienceType: string | null
  dailyBudget: number | null
  spend: number
  roas: number | null
  ctr: number | null
  cvr: number | null
  conversions: number
  impressions: number
  frequency: number | null
  ads: InsightsAdSnapshot[]
}

export interface InsightsCampaignSnapshot {
  campaignId: string
  metaCampaignId: string | null
  name: string
  status: string
  source: string
  objective: string | null
  productName: string | null
  dailyBudget: number | null
  spend: number
  revenue: number | null
  roas: number | null
  ctr: number | null
  cvr: number | null
  conversions: number
  impressions: number
  frequency: number | null
  breakevenRoas: number | null
  marginPct: number | null
  dataAsOf: string | null
  launchedAt: string | null
  adSets: InsightsAdSetSnapshot[]
}

export interface InsightsResolvedContext {
  resolvedBy: InsightsResolutionMethod
  resolutionNote: string
  campaign: InsightsCampaignSnapshot | null
  coverage: { adSetsRead: number; adsRead: number }
  caveats: string[]
  alternatives: Array<{ campaignId: string; name: string; status: string }>
}

export interface InsightsAskResult {
  answer: string
  context: InsightsResolvedContext
  model: string | null
  answered: boolean
}

export interface InsightsCampaignOption {
  campaignId: string
  name: string
  status: string
  source: string
  objective: string | null
  spend: number
}
