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
