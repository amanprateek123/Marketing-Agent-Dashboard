import type {
  Company,
  Campaign,
  PipelineRun,
  FullRunData,
  CampaignAction,
  AuditSnapshot,
  ShadowAction,
  UsageResponse,
  ActionOutcomesResponse,
  RegretSummary,
  PromptVersionEval,
  SignalAccuracy,
  IntelligenceDecision,
  IntelligenceDecisionStatus,
  CampaignBreakdowns,
  TimeseriesPoint,
  MetaAudienceOption,
  MetaInterestOption,
  CreateManualCampaignDto,
} from '@/types'

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

// ── System Intelligence (feedback-loop telemetry) ──────────────────────────
export const getActionOutcomes = (tenantId: string) =>
  apiFetch<ActionOutcomesResponse>(`/learning/${tenantId}/action-outcomes`)

export const getRegretSummary = (tenantId: string) =>
  apiFetch<RegretSummary>(`/learning/${tenantId}/regret-summary`)

export const getPromptVersionEvals = (tenantId: string) =>
  apiFetch<PromptVersionEval[]>(`/learning/${tenantId}/prompt-version-evals`)

export const getSignalAccuracy = (tenantId: string) =>
  apiFetch<SignalAccuracy>(`/pipeline/${tenantId}/signal-accuracy`)

// ── Companies ──────────────────────────────────────────────────────────────
export const getCompany = (tenantId: string) =>
  apiFetch<Company>(`/companies/${tenantId}`)

export const updateCompany = (tenantId: string, body: Partial<Company>) =>
  apiFetch<Company>(`/companies/${tenantId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const getUsage = (
  tenantId: string,
  params?: { from?: string; to?: string },
) => {
  const q = new URLSearchParams()
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  const qs = q.toString()
  return apiFetch<UsageResponse>(
    `/companies/${tenantId}/usage${qs ? `?${qs}` : ''}`,
  )
}

export const rollbackPrompts = (tenantId: string, version: number) =>
  apiFetch<{ ok: true; version: number }>(
    `/companies/${tenantId}/prompts/rollback/${version}`,
    { method: 'POST' },
  )

// ── Campaigns ──────────────────────────────────────────────────────────────
export const getCampaigns = (tenantId: string) =>
  apiFetch<Campaign[]>(`/campaigns/${tenantId}`)

export const getCampaign = (tenantId: string, campaignId: string) =>
  apiFetch<Campaign>(`/campaigns/${tenantId}/${campaignId}`)

/**
 * The rolling-7-day spend estimate that actually gates new campaign creation
 * (SafetyChecks.checkWeeklyBudget) — use this for any "weekly budget in use"
 * display so it matches what's enforced, rather than approximating it again.
 */
export const getWeeklySpend = (tenantId: string) =>
  apiFetch<{ weeklySpend: number }>(`/campaigns/${tenantId}/weekly-spend`)

/** Manual Create Campaign form — writes a pending_approval campaign, bypassing the AI review team. */
export const createManualCampaign = (tenantId: string, dto: CreateManualCampaignDto) =>
  apiFetch<{ success: true; campaignId: string; status: string }>(
    `/campaigns/${tenantId}/create-manual`,
    { method: 'POST', body: JSON.stringify(dto) },
  )

export const getMetaAudiences = (tenantId: string, productName?: string) =>
  apiFetch<MetaAudienceOption[]>(
    `/campaigns/${tenantId}/meta-audiences${productName ? `?productName=${encodeURIComponent(productName)}` : ''}`,
  )

export const searchMetaInterests = (tenantId: string, q: string) =>
  apiFetch<MetaInterestOption[]>(
    `/campaigns/${tenantId}/meta-interest-search?q=${encodeURIComponent(q)}`,
  )

export const approveCampaign = (
  tenantId: string,
  campaignId: string,
  accountId?: string,
) =>
  apiFetch<{ ok: true }>(`/campaigns/${tenantId}/${campaignId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ accountId }),
  })

export const rejectCampaign = (
  tenantId: string,
  campaignId: string,
  reason: string,
) =>
  apiFetch<{ ok: true }>(`/campaigns/${tenantId}/${campaignId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

export const updateCampaignBudget = (
  tenantId: string,
  campaignId: string,
  budget: number,
) =>
  apiFetch<Campaign>(`/campaigns/${tenantId}/${campaignId}/budget`, {
    method: 'PATCH',
    body: JSON.stringify({ budget }),
  })

export const getPendingActions = (tenantId: string, campaignId: string) =>
  apiFetch<CampaignAction[]>(
    `/campaigns/${tenantId}/${campaignId}/pending-actions`,
  )

export const getAuditSnapshots = (tenantId: string, campaignId: string) =>
  apiFetch<AuditSnapshot[]>(
    `/campaigns/${tenantId}/${campaignId}/audit-snapshots`,
  )

export const getShadowActions = (tenantId: string, campaignId: string) =>
  apiFetch<ShadowAction[]>(
    `/campaigns/${tenantId}/${campaignId}/shadow-actions`,
  )

/** Segment performance: age×gender, region, placement, hourly, day-of-week, per-asset. */
export const getCampaignBreakdowns = (tenantId: string, campaignId: string) =>
  apiFetch<CampaignBreakdowns>(
    `/campaigns/${tenantId}/${campaignId}/breakdowns`,
  )

/** Daily series for trend charts. Defaults to the campaign-level rollup. */
export const getCampaignTimeseries = (tenantId: string, campaignId: string) =>
  apiFetch<TimeseriesPoint[]>(
    `/campaigns/${tenantId}/${campaignId}/timeseries`,
  )

/**
 * Pulls fresh campaign/adset/ad data + lifetime metrics from Meta for every
 * active campaign under this tenant. There's no single-campaign sync endpoint
 * — Meta sync is always tenant-wide, so this is what both the campaigns list
 * "Refresh" button and a single campaign page's "Refresh" button call.
 * Fire-and-forget on the backend: resolves as soon as the sync is queued,
 * not when it finishes — poll getCampaigns/getCampaign afterwards to see it land.
 */
export const syncCampaigns = (tenantId: string) =>
  apiFetch<{ success: boolean; status: string; message: string }>(
    `/campaigns/${tenantId}/sync`,
    { method: 'POST' },
  )

// ── Pipeline ───────────────────────────────────────────────────────────────
export const getRuns = (tenantId: string) =>
  apiFetch<PipelineRun[]>(`/pipeline/${tenantId}/runs`)

export const getFullRun = (tenantId: string, runId: string) =>
  apiFetch<FullRunData>(`/pipeline/${tenantId}/runs/${runId}/full`)

export const triggerPipeline = (tenantId: string) =>
  apiFetch<{ runId?: string }>(`/pipeline/${tenantId}/trigger`, {
    method: 'POST',
  })

// ── Landing-page A/B test ────────────────────────────────────────────────────
// Start a test: generates one creative set, then a pending_approval campaign
// with two URL-split ad sets (control vs variant). Approve it like any campaign.
export const startLandingPageTest = (
  tenantId: string,
  body: {
    product: string
    controlUrl?: string
    variantUrl: string
    budget: number
    audienceType?: string
    metaAudienceId?: string
  },
) =>
  apiFetch<{ status: string; briefId: string; control: string; variant: string; message: string }>(
    `/creative/${tenantId}/landing-page-test`,
    { method: 'POST', body: JSON.stringify(body) },
  )

// Promote the winning page: sets the product's live landingUrl and clears the test.
export const promoteLandingPage = (tenantId: string, product: string, url: string) =>
  apiFetch<{ ok: true; product: string; landingUrl: string }>(
    `/companies/${tenantId}/promote-landing-page`,
    { method: 'POST', body: JSON.stringify({ product, url }) },
  )

// Stop tracking a test (clears the record; does NOT pause the Meta campaign).
export const cancelLandingPageTest = (tenantId: string, product: string) =>
  apiFetch<{ ok: true; product: string }>(
    `/companies/${tenantId}/cancel-landing-page-test`,
    { method: 'POST', body: JSON.stringify({ product }) },
  )

// ── Intelligence pipeline (the 16 engines) ────────────────────────────────
export interface IntelligenceSnapshotDoc {
  _id?: string
  tenantId: string
  campaignId: string
  metaCampaignId: string
  snapshotId: string
  cycleId?: string
  schemaVersion: string
  collectedAt: string | Date
  metaWindowStart: string | Date
  metaWindowEnd: string | Date
  metrics: {
    campaignLevel: Record<string, number>
    adSetLevel: Record<string, Record<string, number>>
    adLevel: Record<string, Record<string, number>>
  }
  meta?: {
    learningStage?: string
    deliveryStatus?: string
    accountId?: string
  }
  missingFields: string[]
  freshnessSec?: number
}

export const getSnapshotHistory = (
  tenantId: string,
  campaignId: string,
  limit = 30,
) =>
  apiFetch<IntelligenceSnapshotDoc[]>(
    `/intelligence/${tenantId}/snapshots/${campaignId}?limit=${limit}`,
  )

export const getSnapshot = (tenantId: string, snapshotId: string) =>
  apiFetch<IntelligenceSnapshotDoc>(
    `/intelligence/${tenantId}/snapshot/${snapshotId}`,
  )

export const runSnapshotNow = (
  tenantId: string,
  body: { campaignId: string; metaCampaignId: string; products?: unknown[] },
) =>
  apiFetch<{ snapshotId: string; confidence: number }>(
    `/intelligence/${tenantId}/snapshot`,
    { method: 'POST', body: JSON.stringify(body) },
  )

// ── Intelligence proposed decisions (shadow mode) ─────────────────────────
export interface DecisionsSummary {
  counts: {
    shadow_review: number
    approved: number
    rejected: number
    expired: number
  }
  latestCycleId: string | null
  latestCycleAt: string | null
}

export const getIntelligenceDecisions = (
  tenantId: string,
  opts?: { status?: IntelligenceDecisionStatus; sinceHours?: number; limit?: number },
) => {
  const q = new URLSearchParams()
  if (opts?.status) q.set('status', opts.status)
  if (opts?.sinceHours) q.set('sinceHours', String(opts.sinceHours))
  if (opts?.limit) q.set('limit', String(opts.limit))
  const qs = q.toString()
  return apiFetch<{ decisions: IntelligenceDecision[]; count: number }>(
    `/intelligence/${tenantId}/decisions${qs ? `?${qs}` : ''}`,
  )
}

export const getIntelligenceDecisionsSummary = (tenantId: string) =>
  apiFetch<DecisionsSummary>(`/intelligence/${tenantId}/decisions/summary`)

export const approveIntelligenceDecision = (
  tenantId: string,
  decisionId: string,
  body?: { reviewer?: string; notes?: string },
) =>
  apiFetch<{ ok: true; message: string; decision: IntelligenceDecision }>(
    `/intelligence/${tenantId}/decisions/${decisionId}/approve`,
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  )

export const rejectIntelligenceDecision = (
  tenantId: string,
  decisionId: string,
  body: { reason: string; reviewer?: string },
) =>
  apiFetch<{ ok: true; message: string; decision: IntelligenceDecision }>(
    `/intelligence/${tenantId}/decisions/${decisionId}/reject`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export const primeIntelligence = (
  tenantId: string,
  body?: { skipSync?: boolean; maxCampaigns?: number },
) =>
  apiFetch<{
    message: string
    totalDecisions: number
    results: Array<{ name: string; status: string; decisionsWritten: number }>
  }>(`/intelligence/${tenantId}/prime`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
