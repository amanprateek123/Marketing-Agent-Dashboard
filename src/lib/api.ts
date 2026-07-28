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
  MetaGeoOption,
  MetaAdAccountsResponse,
  MetaBusiness,
  MetaCustomAudience,
  CreateManualCampaignDto,
  UpdateManualCampaignConfigDto,
  CreativePackage,
  DashboardOverview,
  CampaignLaunchReview,
} from '@/types'

import { getToken } from './auth'

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  // Belt-and-suspenders: the global fetch interceptor (lib/auth-fetch.ts)
  // already attaches this for every API_BASE call, including this one —
  // set explicitly too since apiFetch is the "proper" shared entry point.
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
 * Pre-launch review — what approving this campaign will ACTUALLY do.
 *
 * Everything here is resolved server-side rather than read off the campaign
 * document: the product the ads point at, the exact destination URL, the pixel
 * and conversion event they'll optimize toward, the ₹/day per ad set, and
 * `blockers` — the things that will make /approve fail. Gate Approve on `ready`.
 */
export const getCampaignReview = (tenantId: string, campaignId: string) =>
  apiFetch<CampaignLaunchReview>(`/campaigns/${tenantId}/${campaignId}/review`)

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

/**
 * Live Meta geo search for states/regions and cities. Returns opaque Meta
 * `key` values — the only thing ad-set targeting accepts — so a picked
 * location can never drift the way a hardcoded region constant can.
 * `country` narrows results (e.g. 'IN'); omit to search worldwide.
 */
export const searchMetaGeo = (
  tenantId: string,
  q: string,
  type: 'region' | 'city',
  country?: string,
) =>
  apiFetch<MetaGeoOption[]>(
    `/campaigns/${tenantId}/meta-geo-search?q=${encodeURIComponent(q)}&type=${type}` +
      (country ? `&country=${encodeURIComponent(country)}` : ''),
  )

/**
 * Reverse of searchMetaGeo — turns saved geo keys back into display names, so
 * a campaign reopened for edit shows "Maharashtra" instead of the stored
 * "1735". Returns a flat { key: name } map; the backend returns {} rather
 * than erroring if Meta's lookup fails, so callers can render raw keys.
 */
export const resolveMetaGeo = (
  tenantId: string,
  regions: string[],
  cities: string[],
) =>
  apiFetch<Record<string, string>>(
    `/campaigns/${tenantId}/meta-geo-resolve?regions=${encodeURIComponent(regions.join(','))}` +
      `&cities=${encodeURIComponent(cities.join(','))}`,
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
/** '480p' is Higgsfield-only — Heygen's API doesn't support it. Never offer it in a Heygen-selected UI path. */
export type CreativeVideoResolution = '480p' | '720p' | '1080p' | '4k'

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
    /** Forces every copy variant (and its matching image prompt) to this one hookStyle instead of letting the Creative Team auto-pick one per variant. Ignored when hookStyles[] is also set. */
    forcedHookStyle?: string
    /** Explicit per-variant hookStyle plan — its length becomes the variant count, and variant i is locked to hookStyles[i]. Overrides forcedHookStyle when both are set. */
    hookStyles?: string[]
    /** Which engine renders the video — defaults to 'heygen' when omitted. */
    videoProvider?: 'heygen' | 'higgsfield'
    /** Higgsfield model job_type (e.g. 'seedance_2_0') — only used when videoProvider === 'higgsfield'. */
    higgsfieldJobType?: string
  },
) =>
  apiFetch<{ status: string; briefId: string; product: string }>(
    `/creative/${tenantId}/product-creative`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export interface HookStyleOption {
  value: string
  description: string
}

export interface HookStyleGroups {
  dr: HookStyleOption[]
  meme: HookStyleOption[]
  screenshot: HookStyleOption[]
  poll: HookStyleOption[]
}

/** Every hookStyle the pipeline supports, grouped by which format they apply to — lets a picker force a specific hookStyle instead of auto-pick. */
export const getHookStyles = () =>
  apiFetch<HookStyleGroups>('/creative/hook-styles')

export const getCreativePackage = (tenantId: string, packageId: string) =>
  apiFetch<CreativePackage>(`/creative/${tenantId}/packages/${packageId}`)

/** Re-hosts an externally-generated video/image (e.g. from Higgsfield) into our own S3 bucket, returning a permanent URL to paste into imageUrl/videoUrl below. */
export const rehostCreativeMedia = (tenantId: string, sourceUrl: string, mediaType: 'video' | 'image' = 'video') =>
  apiFetch<{ url: string }>(
    `/creative/${tenantId}/rehost-media`,
    { method: 'POST', body: JSON.stringify({ sourceUrl, mediaType }) },
  )

/**
 * Uploads a local file (picked or dropped in the browser) straight to this
 * tenant's S3 bucket, returning a permanent URL — the file-based counterpart
 * to rehostCreativeMedia above. Bypasses apiFetch: multipart/form-data needs
 * the browser to set its own Content-Type boundary, which apiFetch's fixed
 * 'application/json' header would clobber. The global auth-fetch interceptor
 * (lib/auth-fetch.ts) still attaches the bearer token since this hits API_BASE.
 */
export async function uploadCreativeFile(tenantId: string, file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/creative/${tenantId}/upload-file`, {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

/**
 * Registers an already-made creative (a single image or video you already
 * have) as a real library entry — rehosts sourceUrl onto our own S3, creates
 * a new CreativePackage, and auto-populates the Gallery, same as an
 * AI-generated package. Unlike pasting a URL when launching a manual
 * campaign, this one shows up in the Creatives library and Gallery.
 */
export interface UploadCreativeItem {
  productName?: string
  targetLanguage?: string
  topic?: string
  /** When set, lands directly in this existing Gallery sheet instead of the resolved topic's "Unsorted" sheet — takes priority over `topic`. */
  sheetId?: string
  copy: { headline: string; primaryText: string; cta: string }
  assetType: 'image' | 'video'
  sourceUrl: string
  aspectRatio?: string
  resolution?: string
  /**
   * Ready-made alternate sizes of the SAME image — your own 1:1/9:16 cuts of
   * one ad, filed under one creative so launch serves the right size per
   * placement instead of letting Meta centre-crop it. Image-only: a package
   * holds a single video, so extra video sizes are rejected. A size that
   * fails to upload doesn't fail the creative — it comes back in `sizeErrors`.
   */
  sizes?: { sourceUrl: string; aspectRatio?: string; resolution?: string }[]
}

export const uploadCreative = (tenantId: string, body: UploadCreativeItem) =>
  apiFetch<{ status: string; packageId: string }>(
    `/creative/${tenantId}/packages/upload`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export interface UploadCreativeResult {
  status: 'completed' | 'failed'
  packageId?: string
  error?: string
  sourceUrl: string
  /** Extra sizes that failed to upload. The row still succeeded — the creative and its remaining sizes are filed — so this is a warning, not a failure. */
  sizeErrors?: { sourceUrl: string; error: string }[]
}

/** Bulk version of uploadCreative — files several already-made creatives into the library (and Gallery) in one request. One bad URL doesn't block the rest of the batch; check each result's `status`. */
export const uploadCreativeBulk = (tenantId: string, items: UploadCreativeItem[]) =>
  apiFetch<UploadCreativeResult[]>(
    `/creative/${tenantId}/packages/upload-bulk`,
    { method: 'POST', body: JSON.stringify({ items }) },
  )

/** Soft-delete, reversible, per-asset — see the backend schema comment on ImageCreative.rejected for the full rationale. */
export const rejectAsset = (tenantId: string, packageId: string, assetType: 'image' | 'video', variantIndex: number) =>
  apiFetch<{ packageId: string; assetType: string; variantIndex: number; rejected: boolean }>(
    `/creative/${tenantId}/packages/${packageId}/reject-asset`,
    { method: 'POST', body: JSON.stringify({ assetType, variantIndex }) },
  )

export const restoreAsset = (tenantId: string, packageId: string, assetType: 'image' | 'video', variantIndex: number) =>
  apiFetch<{ packageId: string; assetType: string; variantIndex: number; rejected: boolean }>(
    `/creative/${tenantId}/packages/${packageId}/restore-asset`,
    { method: 'POST', body: JSON.stringify({ assetType, variantIndex }) },
  )

export interface RejectedAssetItem {
  packageId: string
  assetType: 'image' | 'video'
  variantIndex: number
  assetUrl: string
  productName?: string
}

/** Every rejected image/video across all packages for this tenant — powers the "Rejected" tab on the creative library page. */
export const getRejectedAssets = (tenantId: string) =>
  apiFetch<RejectedAssetItem[]>(`/creative/${tenantId}/rejected-assets`)

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

/**
 * Fill in a variant's missing placement sizes by canvas-extending its existing
 * image — no crop, no model call, no spend. Meta centre-crops a single asset to
 * fit each placement, which on a headline-top/CTA-bottom creative cuts both;
 * shipping an asset already at the target ratio leaves nothing to crop.
 *
 * Unlike every other creative call here this is SYNCHRONOUS — it does the work
 * (~0.5s per size, local CPU) and returns the finished images[], so callers
 * reload on resolve rather than polling. Sizes already present are skipped, so
 * `added: 0` means "nothing was missing", not a failure.
 *
 * Omit `variantIndex` for every variant in the package; omit `ratios` for all four.
 */
export const generateCreativeSizes = (
  tenantId: string,
  packageId: string,
  variantIndex?: number,
  ratios?: CreativeAspectRatio[],
) =>
  apiFetch<{
    status: string
    creativePackageId: string
    added: number
    images: Array<{ variantIndex: number; aspectRatio: string | null; imageUrl: string; extendedFrom: string | null }>
  }>(
    `/creative/${tenantId}/packages/${packageId}/generate-sizes`,
    { method: 'POST', body: JSON.stringify({ variantIndex, ratios }) },
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

/** One accepted param on a Higgsfield model — drives the dynamic generation form (enum -> dropdown, integer -> number input, etc). */
export interface HiggsfieldModelParam {
  name: string
  type: string
  default: unknown
  required: boolean
  enum?: string[]
}

export interface HiggsfieldModelSummary {
  display_name: string
  job_type: string
  type: string
}

export interface HiggsfieldModelSpec extends HiggsfieldModelSummary {
  params: HiggsfieldModelParam[]
}

/** Live catalog of Higgsfield video models (Seedance, Kling, Veo, Wan, Hailuo, ...) — not hardcoded, so new models show up without a redeploy. */
export const getHiggsfieldModels = () =>
  apiFetch<HiggsfieldModelSummary[]>('/creative/higgsfield/models')

/** Full accepted-params schema for one model — call after the user picks a model, to render its real fields. */
export const getHiggsfieldModel = (jobType: string) =>
  apiFetch<HiggsfieldModelSpec>(`/creative/higgsfield/models/${jobType}`)

/** Dry-run credit estimate — no job created, safe to call on every param change. */
export const estimateHiggsfieldCost = (jobType: string, params: Record<string, unknown>) =>
  apiFetch<{ credits: number }>('/creative/higgsfield/cost', {
    method: 'POST',
    body: JSON.stringify({ jobType, params }),
  })

export interface VideoSceneChunk {
  sceneIndex: number
  prompt: string
  durationSeconds: number
  aspectRatio: string
  resolution: string
  videoUrl: string
  status: 'pending' | 'completed' | 'failed'
  provider: 'higgsfield'
  providerModel: string
  higgsfieldJobId?: string | null
  error?: string
}

/**
 * Plans a scene-by-scene Higgsfield video build — splits totalDurationSeconds
 * into N scenes at jobType's verified minimum chunk size (only
 * 'seedance_2_0'/'seedance_2_0_mini' are supported) and writes N distinct,
 * no-text-overlay cinematic prompts forming a hook->development->payoff arc.
 * Synchronous (LLM-only, nothing generated yet) — review/edit before spending.
 */
export const planHiggsfieldScenes = (
  tenantId: string,
  packageId: string,
  body: { topic: string; jobType: string; totalDurationSeconds: number; aspectRatio?: string; resolution?: string },
) =>
  apiFetch<{ videoScenes: VideoSceneChunk[] }>(
    `/creative/${tenantId}/packages/${packageId}/higgsfield-scenes/plan`,
    { method: 'POST', body: JSON.stringify(body) },
  )

/** Generates every pending/failed scene, sequentially. Fire-and-forget — poll GET packages/:id and watch videoScenes[].status. */
export const generateHiggsfieldScenes = (tenantId: string, packageId: string) =>
  apiFetch<{ status: string; sceneCount: number }>(
    `/creative/${tenantId}/packages/${packageId}/higgsfield-scenes/generate`,
    { method: 'POST' },
  )

/** Regenerates one scene in place — the point of chunking is not having to redo the whole video for one bad clip. */
export const regenerateHiggsfieldScene = (tenantId: string, packageId: string, sceneIndex: number, prompt?: string) =>
  apiFetch<{ status: string; sceneIndex: number }>(
    `/creative/${tenantId}/packages/${packageId}/higgsfield-scenes/${sceneIndex}/regenerate`,
    { method: 'POST', body: JSON.stringify({ prompt }) },
  )

/** Merges every completed scene into one final video via ffmpeg and sets it as the package's video. Requires all scenes completed first. */
export const mergeHiggsfieldScenes = (tenantId: string, packageId: string) =>
  apiFetch<{ status: string }>(
    `/creative/${tenantId}/packages/${packageId}/higgsfield-scenes/merge`,
    { method: 'POST' },
  )

/**
 * Adds a Cartesia-narrated Hindi/English voiceover to a COPY of the
 * package's video (the original video.videoUrl is never overwritten).
 * Pass `script` to skip LLM generation and use it verbatim. keepBackgroundAudio
 * (default true) ducks the video's own generated ambient audio under the
 * narration instead of discarding it. Fire-and-forget — poll GET packages/:id
 * and watch videoWithVoiceoverUrl populate. Does not call Higgsfield's
 * generation API.
 */
export const addHiggsfieldVoiceover = (tenantId: string, packageId: string, script?: string, keepBackgroundAudio?: boolean) =>
  apiFetch<{ status: string; script: string }>(
    `/creative/${tenantId}/packages/${packageId}/higgsfield-scenes/add-voiceover`,
    { method: 'POST', body: JSON.stringify({ script, keepBackgroundAudio }) },
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

// ── Gallery (Topic -> Sheet -> Asset organization for creatives) ────────────
// A GalleryAsset is a movable pointer at one image variant / the video /
// one carousel card inside a CreativePackage — never the asset data itself.
// New creatives auto-populate into a Topic (matching what they were
// generated under) and its default "Unsorted" sheet; moving an asset to a
// different sheet (even a different topic) never touches the source package.

export interface GalleryTopicSummary {
  _id: string
  name: string
  sheetCount: number
  assetCount: number
}

export interface GallerySheetSummary {
  _id: string
  name: string
  /** Assets that actually render — matches the grid, not the raw pointer count. */
  assetCount: number
  /**
   * Pointers that exist but resolve to nothing, almost always because the
   * asset was rejected (reversible) or its source package was deleted. Shown
   * so a missing creative reads as "hidden, here's why" rather than a bug.
   */
  hiddenCount?: number
}

export interface GallerySheetWithTopic {
  sheetId: string
  sheetName: string
  topicId: string
  topicName: string
}

export interface GalleryAssetItem {
  _id: string
  assetType: 'image' | 'video' | 'carousel_card'
  variantIndex: number
  sourcePackageId: string
  assetUrl: string
  aspectRatio?: string
  resolution?: string
}

export type GalleryAssetLocations = Record<string, { topicId: string; topicName: string; sheetId: string; sheetName: string; rejected: boolean }>

export const listGalleryTopics = (tenantId: string) =>
  apiFetch<GalleryTopicSummary[]>(`/gallery/${tenantId}/topics`)

export const createGalleryTopic = (tenantId: string, name: string) =>
  apiFetch<{ _id: string; name: string }>(`/gallery/${tenantId}/topics`, {
    method: 'POST', body: JSON.stringify({ name }),
  })

export const renameGalleryTopic = (tenantId: string, topicId: string, name: string) =>
  apiFetch<{ _id: string; name: string }>(`/gallery/${tenantId}/topics/${topicId}`, {
    method: 'PATCH', body: JSON.stringify({ name }),
  })

export const listGallerySheets = (tenantId: string, topicId: string) =>
  apiFetch<GallerySheetSummary[]>(`/gallery/${tenantId}/topics/${topicId}/sheets`)

export const createGallerySheet = (tenantId: string, topicId: string, name: string) =>
  apiFetch<{ _id: string; name: string }>(`/gallery/${tenantId}/topics/${topicId}/sheets`, {
    method: 'POST', body: JSON.stringify({ name }),
  })

export const renameGallerySheet = (tenantId: string, sheetId: string, name: string) =>
  apiFetch<{ _id: string; name: string }>(`/gallery/${tenantId}/sheets/${sheetId}`, {
    method: 'PATCH', body: JSON.stringify({ name }),
  })

/** Every Topic/Sheet pair for the tenant — powers the "move to" destination picker. */
export const listAllGallerySheets = (tenantId: string) =>
  apiFetch<GallerySheetWithTopic[]>(`/gallery/${tenantId}/sheets`)

export const listGalleryAssets = (tenantId: string, sheetId: string) =>
  apiFetch<GalleryAssetItem[]>(`/gallery/${tenantId}/sheets/${sheetId}/assets`)

export const moveGalleryAsset = (tenantId: string, assetId: string, sheetId: string) =>
  apiFetch<{ _id: string; sheetId: string }>(`/gallery/${tenantId}/assets/${assetId}`, {
    method: 'PATCH', body: JSON.stringify({ sheetId }),
  })

/** Bulk version of moveGalleryAsset — move any number of selected assets to one destination sheet in one call. */
export const moveGalleryAssets = (tenantId: string, assetIds: string[], sheetId: string) =>
  apiFetch<{ movedCount: number; sheetId: string }>(`/gallery/${tenantId}/assets/move`, {
    method: 'PATCH', body: JSON.stringify({ assetIds, sheetId }),
  })

/** Powers the "in gallery: Topic / Sheet" line on the package detail page. */
export const getPackageAssetLocations = (tenantId: string, packageId: string) =>
  apiFetch<GalleryAssetLocations>(`/gallery/${tenantId}/packages/${packageId}/asset-locations`)

/** Removes the GalleryAsset pointer only — the source creative is untouched, still fully intact in the Creatives library. */
export const removeGalleryAssets = (tenantId: string, assetIds: string[]) =>
  apiFetch<{ removedCount: number }>(`/gallery/${tenantId}/assets/remove`, {
    method: 'POST', body: JSON.stringify({ assetIds }),
  })

/** Bulk-reject (soft-delete, reversible) by gallery-asset-id — hides them from this sheet until restored from the Rejected tab. */
export const rejectGalleryAssets = (tenantId: string, assetIds: string[]) =>
  apiFetch<{ rejectedCount: number }>(`/gallery/${tenantId}/assets/reject`, {
    method: 'POST', body: JSON.stringify({ assetIds }),
  })

/** Cascade-deletes a sheet's asset pointers, then the sheet. Source creatives are never touched. */
export const deleteGallerySheet = (tenantId: string, sheetId: string) =>
  apiFetch<{ _id: string }>(`/gallery/${tenantId}/sheets/${sheetId}`, { method: 'DELETE' })

/** Cascade-deletes every sheet in a topic (and their asset pointers), then the topic. */
export const deleteGalleryTopic = (tenantId: string, topicId: string) =>
  apiFetch<{ _id: string }>(`/gallery/${tenantId}/topics/${topicId}`, { method: 'DELETE' })

export interface AddExistingAssetItem {
  packageId: string
  assetType: 'image' | 'video' | 'carousel_card'
  variantIndex: number
}

/**
 * Files existing creatives (picked from the whole Creatives library, not
 * just already-tracked GalleryAssets) directly into a sheet — powers the
 * Gallery's "Add creative" bottom-sheet picker. Packages that predate the
 * Gallery feature (or never got auto-populated) get a brand new pointer;
 * ones already tracked elsewhere get moved here instead of duplicated.
 */
export const addExistingCreativesToSheet = (tenantId: string, sheetId: string, items: AddExistingAssetItem[]) =>
  apiFetch<{ addedCount: number; movedCount: number }>(`/gallery/${tenantId}/sheets/${sheetId}/assets/add`, {
    method: 'POST', body: JSON.stringify({ items }),
  })

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

/**
 * One step of the 16-engine cascade, rendered in plain English by the backend.
 * `logs` is the engine's own recorded output, so the summary above it can be
 * checked rather than taken on trust.
 */
export interface DecisionTraceStep {
  step: number
  engine: string
  /** "Step 7 → Why it is happening" — pre-formatted by the backend. */
  label: string
  title: string
  question: string
  headline: string
  details: string[]
  logs: string[]
  meta?: {
    engineConfidence?: number
    computedAt?: string
    ms?: number
    deterministic?: boolean
    degraded?: string
    evidenceCount?: number
  }
  status: 'ok' | 'no_data'
  /** This step materially shaped the decision, rather than merely having run. */
  decisive: boolean
}

export interface DecisionTrace {
  decisionId: string
  cycleId: string
  campaignName: string
  actionType: string
  status: string
  stepsWithData: number
  totalSteps: number
  steps: DecisionTraceStep[]
}

/** Read-only: replays what the cycle already recorded, never re-runs an engine. */
export const getDecisionTrace = (tenantId: string, decisionId: string) =>
  apiFetch<DecisionTrace>(`/intelligence/${tenantId}/decisions/${decisionId}/trace`)

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

// ── Intelligence cycles — the "why did nothing happen" trail ─────────────
// Every cascade cycle writes one of these, whether or not it proposed a
// decision — `summary.narrative` is the diagnosis engine's plain-English
// read on the campaign for that run.
export interface IntelligenceCycle {
  cycleId: string
  campaignId: string
  campaignName?: string
  metaCampaignId?: string
  status: 'pending' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  summary?: {
    narrative: string
    leakDiagnosis: string
    rootCauses: Array<{ hypothesis: string; confidence: number; suggestedFocus: string }>
    decisionsProposed: number
  }
}

export const getIntelligenceCycles = (
  tenantId: string,
  opts?: { campaignId?: string; limit?: number },
) => {
  const q = new URLSearchParams()
  if (opts?.campaignId) q.set('campaignId', opts.campaignId)
  if (opts?.limit) q.set('limit', String(opts.limit))
  const qs = q.toString()
  return apiFetch<{ cycles: IntelligenceCycle[]; count: number }>(
    `/intelligence/${tenantId}/cycles${qs ? `?${qs}` : ''}`,
  )
}

// ── Tenant overview ────────────────────────────────────────────────────────
/**
 * The whole dashboard home page in one call. Every figure arrives
 * pre-computed against the tenant's contribution margin — see
 * types/overview.ts for why nothing here should be recalculated client-side.
 */
export const getDashboardOverview = (tenantId: string, windowDays = 30) =>
  apiFetch<DashboardOverview>(
    `/dashboard/${tenantId}/overview?windowDays=${windowDays}`,
  )
