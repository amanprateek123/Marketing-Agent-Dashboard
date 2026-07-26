/**
 * Mirrors the backend's DashboardOverview (src/dashboard/dashboard.types.ts).
 *
 * These are RENDER types, not calculation inputs. Every figure here has
 * already been derived server-side against the tenant's real contribution
 * margin. Deriving anything further in the browser reintroduces exactly the
 * bug this endpoint exists to kill — a page that computed its own unweighted
 * mean ROAS and displayed it next to a total-derived revenue figure that
 * implied a different number.
 */

export type AlertSeverity = 'critical' | 'warning' | 'info'

export type AlertKind =
  | 'meta_disconnected'
  | 'no_margin_configured'
  | 'budget_cap_misconfigured'
  | 'zero_conversion_spend'
  | 'portfolio_below_breakeven'
  | 'campaign_losing_badly'
  | 'learning_limited'
  | 'stale_metrics'
  | 'pending_approvals'
  | 'pending_actions'
  | 'objective_off_target'
  | 'pipeline_stalled'

export interface DashboardAlert {
  kind: AlertKind
  severity: AlertSeverity
  title: string
  detail: string
  amount?: number
  suggestedAction?: string
  href?: string
  campaignId?: string
  campaignName?: string
}

export type PerformanceVerdict =
  // Revenue objectives — judged against breakeven ROAS.
  | 'profitable'
  | 'marginal'
  | 'below_breakeven'
  | 'losing_badly'
  | 'no_conversions'
  // Non-revenue objectives — judged on their own primary KPI.
  | 'on_target'
  | 'acceptable'
  | 'underperforming'
  | 'failing'
  // Shared
  | 'attribution_pending'
  | 'no_spend'

export type Severity = 'good' | 'watch' | 'bad' | 'neutral'

export interface WindowMetrics {
  spend: number
  revenue: number
  roas: number
  conversions: number
  clicks: number
  impressions: number
  ctr: number
  cvr: number
  cpc: number
  cpm: number
  aov: number
  cac: number
  contributionProfit: number
  campaignCount: number
}

export interface PortfolioRollup extends WindowMetrics {
  isProfitable: boolean
  gapToBreakeven: number
  pctOfTarget: number
  spendBelowBreakeven: number
  pctSpendBelowBreakeven: number
  moneyAtRisk: number
  campaignsBelowBreakeven: number
  /** Spend across EVERY objective, including non-revenue ones. */
  totalSpendAllObjectives: number
  /** Spend on awareness / traffic / app / engagement objectives. */
  nonRevenueSpend: number
  nonRevenueCampaigns: number
  nonRevenueOffTarget: number
}

export interface TrendDelta {
  spendPct: number | null
  revenuePct: number | null
  roasPct: number | null
  contributionAbs: number
  direction: 'improving' | 'declining' | 'flat'
}

export interface CampaignFacets {
  /** Grouping key — collapses siblings. Never render this per-campaign. */
  product: string
  /** Per-campaign display label — keeps what distinguishes it from siblings. */
  label: string
  funnel: string
  funnelLabel: string
  budgetModel: string
  language: string | null
  optimizedFor: string | null
  isTest: boolean
  matched: string[]
}

export interface KpiReading {
  key: string
  label: string
  value: number
  display: string
  target: number | null
  targetDisplay: string | null
  direction: 'higher_better' | 'lower_better'
  status: 'good' | 'watch' | 'bad' | 'neutral'
}

export interface DashboardCampaignRow {
  id: string
  name: string
  displayName: string
  status: string
  statusLabel: string
  metaCampaignId?: string

  spend: number
  revenue: number
  roas: number
  conversions: number
  clicks: number
  impressions: number
  ctr: number
  cvr: number

  contributionProfit: number
  gapToBreakeven: number
  /** This campaign's OWN product economics — products can differ. */
  breakevenROAS: number
  targetROAS: number
  marginPct: number
  moneyAtRisk: number

  /** Raw Meta objective string, e.g. OUTCOME_AWARENESS. */
  objective: string
  objectiveKey: string
  objectiveLabel: string
  /** False for awareness/traffic/app/engagement — ROAS is not their yardstick. */
  isRevenueObjective: boolean
  /** The KPI this campaign is actually judged on, with its own target. */
  primaryKpi: KpiReading
  costPerResult: number | null
  costPerResultDisplay: string | null

  verdict: PerformanceVerdict
  verdictLabel: string
  severity: Severity
  isActionable: boolean
  nextAction: string | null

  facets: CampaignFacets

  launchedAt: string | null
  endedAt: string | null
  daysRunning: number | null
  ageHours: number | null

  budget: number
  spendCap: number
  capRisk: {
    dailyBudget: number
    plannedDays: number
    projectedSpend: number
    cap: number
    overrunBy: number
  } | null

  learningStage: string | null
  learningStageLabel: string | null

  dataAsOf: string | null
  dataAgeHours: number | null
  isStale: boolean
}

export interface FacetRollup {
  key: string
  label: string
  campaignCount: number
  spend: number
  revenue: number
  roas: number
  contributionProfit: number
  isProfitable: boolean
  spendShare: number
}

export interface DashboardInsight {
  id: string
  finding: string
  confidence: number
  dataPoints: number
  strength: 'strong' | 'moderate' | 'weak'
  category: string | null
  recommendation: string | null
  createdAt: string | null
}

export interface TenantActivity {
  meta: {
    connected: boolean
    accountId: string | null
    businessId: string | null
    accountCount: number
    pixelId: string | null
    pageId: string | null
  }
  pipeline: {
    lastRunAt: string | null
    lastRunStatus: string | null
    lastRunId: string | null
    runsInWindow: number
    runningNow: number
    failedInWindow: number
  }
  creatives: {
    total: number
    ready: number
    producing: number
    failed: number
    allRejected: number
  }
  queue: {
    pendingApprovalCampaigns: number
    pendingActions: number
    pendingDecisions: number
  }
  sync: {
    lastSyncAt: string | null
    stalestCampaignHours: number | null
    staleCampaignCount: number
  }
}

export interface DashboardEconomics {
  productName: string | null
  marginPct: number
  refundPct: number
  netMarginPct: number
  breakevenROAS: number
  targetROAS: number
  method: 'product-config' | 'generic-default'
  isEstimated: boolean
  /** True when products differ enough that one headline breakeven misleads. */
  hasMixedMargins: boolean
  byProduct: Array<{
    productName: string | null
    marginPct: number
    breakevenROAS: number
    targetROAS: number
  }>
  notes: string[]
}

export interface DashboardOverview {
  tenantId: string
  companyName: string | null
  industry: string | null
  generatedAt: string

  window: {
    days: number
    from: string
    to: string
    label: string
    metricsSource: 'timeseries' | 'campaign-lifetime'
  }

  economics: DashboardEconomics

  portfolio: PortfolioRollup
  lifetime: WindowMetrics & { isProfitable: boolean }
  previous: WindowMetrics | null
  trend: TrendDelta | null

  alerts: DashboardAlert[]
  campaigns: DashboardCampaignRow[]

  facets: {
    byProduct: FacetRollup[]
    byFunnel: FacetRollup[]
    byBudgetModel: FacetRollup[]
    byLanguage: FacetRollup[]
    byObjective: FacetRollup[]
  }

  insights: DashboardInsight[]
  activity: TenantActivity
}
