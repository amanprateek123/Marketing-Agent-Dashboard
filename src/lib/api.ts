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
  MetaAdAccountsResponse,
  MetaBusiness,
  MetaCustomAudience,
  CreateManualCampaignDto,
  UpdateManualCampaignConfigDto,
  CreativePackage,
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

/** Discovers ad accounts visible to the tenant's stored Meta access token. Active-only unless `all`. */
export const getMetaAccounts = (tenantId: string, all = false) =>
  apiFetch<MetaAdAccountsResponse>(
    `/companies/${tenantId}/meta-accounts${all ? '?all=true' : ''}`,
  )

/**
 * Sets which ad accounts CampaignSyncService pulls from (company.meta.accountIds)
 * and kicks off a background sync. Omit accountIds to auto-select every
 * currently-active Meta account.
 */
export const syncMetaAccounts = (tenantId: string, accountIds?: string[]) =>
  apiFetch<{ success: boolean; status: string; accountIds: string[]; message: string }>(
    `/companies/${tenantId}/meta-accounts/sync`,
    { method: 'POST', body: JSON.stringify({ accountIds }) },
  )

/** Business Managers the tenant's access token belongs to — for scoping the ad-account picker to one portfolio. */
export const getMetaBusinesses = (tenantId: string) =>
  apiFetch<{ businesses: MetaBusiness[] }>(`/companies/${tenantId}/meta-businesses`)

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

/** Edits a still-pending campaign's name/budget/objective/ad sets in place — the alternative to delete+recreate. */
export const updateManualCampaignConfig = (
  tenantId: string,
  campaignId: string,
  dto: UpdateManualCampaignConfigDto,
) =>
  apiFetch<{ success: true; campaignId: string; campaignConfig: Campaign['campaignConfig'] }>(
    `/campaigns/${tenantId}/${campaignId}/config`,
    { method: 'PATCH', body: JSON.stringify(dto) },
  )

export const getMetaAudiences = (tenantId: string, productName?: string) =>
  apiFetch<MetaAudienceOption[]>(
    `/campaigns/${tenantId}/meta-audiences${productName ? `?productName=${encodeURIComponent(productName)}` : ''}`,
  )

/** Live custom + lookalike audiences for ONE ad account, fetched from Meta directly (not the saved per-product snapshot above). */
export const getMetaAccountAudiences = (tenantId: string, accountId: string) =>
  apiFetch<MetaCustomAudience[]>(
    `/campaigns/${tenantId}/meta-account-audiences?accountId=${encodeURIComponent(accountId)}`,
  )

export const searchMetaInterests = (tenantId: string, q: string) =>
  apiFetch<MetaInterestOption[]>(
    `/campaigns/${tenantId}/meta-interest-search?q=${encodeURIComponent(q)}`,
  )

/** Verified Meta locale IDs for language targeting — only entries confirmed against Meta's live adlocale search, never guessed. */
export const getMetaLocales = (tenantId: string) =>
  apiFetch<{ name: string; id: number }[]>(`/campaigns/${tenantId}/meta-locales`)

// ── Creative library ─────────────────────────────────────────────────────
export const getCreativeLanguages = () =>
  apiFetch<string[]>('/creative/languages')

export interface CreativeFormatOption {
  value: string
  label: string
  hint: string
  group: 'image' | 'carousel' | 'native' | 'video'
  skipVideo: boolean
}

export const getCreativeFormats = () =>
  apiFetch<CreativeFormatOption[]>('/creative/formats')

export const listCreativePackages = (
  tenantId: string,
  filters?: { productName?: string; targetLanguage?: string; status?: string; briefId?: string },
) => {
  const q = new URLSearchParams()
  if (filters?.productName) q.set('productName', filters.productName)
  if (filters?.targetLanguage) q.set('targetLanguage', filters.targetLanguage)
  if (filters?.status) q.set('status', filters.status)
  if (filters?.briefId) q.set('briefId', filters.briefId)
  const qs = q.toString()
  return apiFetch<CreativePackage[]>(`/creative/${tenantId}/packages${qs ? `?${qs}` : ''}`)
}

/** Shared aspect-ratio set — same 4 options for both images and video. */
export type CreativeAspectRatio = '9:16' | '16:9' | '1:1' | '4:5'
export type CreativeImageResolution = '1K' | '2K' | '4K'
export type CreativeVideoResolution = '720p' | '1080p' | '4k'

export const generateProductCreative = (
  tenantId: string,
  body: {
    product: string
    targetLanguage?: string
    targetSegment?: string
    angle?: string
    topic?: string
    platform?: string
    format?: string
    audience?: string
    hook?: string
    keyMessage?: string
    conversionBridge?: string
    audienceStage?: 'cold' | 'warm' | 'hot'
    carouselPattern?: 'auto' | 'sequential' | 'tier_reveal' | 'story_arc' | 'differentiator_stack' | 'qa' | 'catalog_grid'
    aspectRatio?: CreativeAspectRatio
    imageResolution?: CreativeImageResolution
    videoAspectRatio?: CreativeAspectRatio
    videoResolution?: CreativeVideoResolution
  },
) =>
  apiFetch<{ status: string; briefId: string; product: string }>(
    `/creative/${tenantId}/product-creative`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export const getCreativePackage = (tenantId: string, packageId: string) =>
  apiFetch<CreativePackage>(`/creative/${tenantId}/packages/${packageId}`)

/** Re-hosts an externally-generated video/image (e.g. from Higgsfield) into our own S3 bucket, returning a permanent URL to paste into imageUrl/videoUrl below. */
export const rehostCreativeMedia = (tenantId: string, sourceUrl: string, mediaType: 'video' | 'image' = 'video') =>
  apiFetch<{ url: string }>(
    `/creative/${tenantId}/rehost-media`,
    { method: 'POST', body: JSON.stringify({ sourceUrl, mediaType }) },
  )

export const updateCreativePackage = (
  tenantId: string,
  packageId: string,
  body: {
    variantIndex?: number
    imageUrl?: string
    /** Which size imageUrl is — tags multiple sizes onto the same variantIndex instead of overwriting. */
    aspectRatio?: CreativeAspectRatio
    videoUrl?: string
    selectedCopyIndex?: number
    copy?: { headline?: string; primaryText?: string; cta?: string; hookStyle?: string }
  },
) =>
  apiFetch<{ status: string; creativePackageId: string }>(
    `/creative/${tenantId}/packages/${packageId}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )

export interface ImageGenOverrides { aspectRatio?: CreativeAspectRatio; resolution?: CreativeImageResolution }
export interface VideoGenOverrides { aspectRatio?: CreativeAspectRatio; resolution?: CreativeVideoResolution }

export const regenerateCreativeImage = (tenantId: string, packageId: string, variantIndex?: number, overrides?: ImageGenOverrides) =>
  apiFetch<{ status: string }>(
    `/creative/${tenantId}/packages/${packageId}/regenerate-image`,
    { method: 'POST', body: JSON.stringify({ variantIndex, ...overrides }) },
  )

export const rewriteCreativeImagePrompt = (tenantId: string, packageId: string, variantIndex?: number, overrides?: ImageGenOverrides) =>
  apiFetch<{ status: string }>(
    `/creative/${tenantId}/packages/${packageId}/regenerate-image-prompt`,
    { method: 'POST', body: JSON.stringify({ variantIndex, ...overrides }) },
  )

export const editCreativeImage = (tenantId: string, packageId: string, instruction: string, variantIndex?: number, overrides?: ImageGenOverrides) =>
  apiFetch<{ status: string }>(
    `/creative/${tenantId}/packages/${packageId}/edit-image`,
    { method: 'POST', body: JSON.stringify({ variantIndex, instruction, ...overrides }) },
  )

export const regenerateCreativeVideo = (tenantId: string, packageId: string, overrides?: VideoGenOverrides) =>
  apiFetch<{ status: string }>(
    `/creative/${tenantId}/packages/${packageId}/regenerate-video`,
    { method: 'POST', body: JSON.stringify({ ...overrides }) },
  )

export const rewriteCreativeVideoPrompt = (tenantId: string, packageId: string, overrides?: VideoGenOverrides) =>
  apiFetch<{ status: string }>(
    `/creative/${tenantId}/packages/${packageId}/regenerate-video-prompt`,
    { method: 'POST', body: JSON.stringify({ ...overrides }) },
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

/** Hard-deletes a pending_approval campaign that never launched to Meta (no metaCampaignId). Launched campaigns can't be deleted this way — use reject/pause instead. */
export const deleteCampaign = (tenantId: string, campaignId: string) =>
  apiFetch<{ success: true; message: string }>(`/campaigns/${tenantId}/${campaignId}`, {
    method: 'DELETE',
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
