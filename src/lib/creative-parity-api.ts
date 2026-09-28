/**
 * Creative studio + research actions that used to live only behind Slack buttons.
 *
 * Every call goes through the backend's pipeline-bridge (workspace login), which forwards to the
 * creativebot route of the same shape. Those creativebot routes are being built in parallel, so a
 * 404 is an expected answer for now: it surfaces as `ParityError.notAvailable`, and the screens say
 * "not available yet" instead of "something broke".
 *
 * The learnings-proposals pair is the exception: it decides what the whole system believes, so it
 * uses the Brain token and the Brain's lock behaviour.
 */

import { API_BASE } from './api'
import { clearBrainToken, getBrainToken, getToken } from './auth'
import { BrainLockedError } from './brain-api'

/** What every action answers: `{ ok, run_id?, status, message }`. */
export interface ParityResult {
  ok?: boolean
  run_id?: number | null
  status?: string | null
  message?: string | null
}

export interface CampaignFields {
  headline?: string | null
  primary_text?: string | null
  description?: string | null
  cta?: string | null
}

export interface CampaignFieldsResult extends ParityResult {
  fields?: CampaignFields | null
  approved?: boolean | null
}

export interface ResearchSource {
  url: string
  title?: string | null
  note?: string | null
}

export interface ResearchSourcesResult extends ParityResult {
  sources?: ResearchSource[] | null
  confirmed?: boolean | null
  /** Set when earlier research for the same product exists and could be reused. */
  previous?: { when?: string | null; summary?: string | null } | null
}

export interface ResearchDirection {
  id: string | number
  title?: string | null
  summary?: string | null
  angle?: string | null
  /** The idea this direction stands for, when creativebot has filed it on the board. */
  idea_id?: string | number | null
  status?: string | null
  /** The run making ads from this direction — discarding the idea is addressed by THIS run. */
  used_by_run_id?: number | null
}

/** An idea in the research pool that did not make the cut. Addressed by `index` only. */
export interface ResearchConcept {
  index: number
  title?: string | null
  summary?: string | null
  score?: number | null
  expanded?: boolean | null
}

export interface ResearchDirectionsResult extends ParityResult {
  directions?: ResearchDirection[] | null
  concepts?: ResearchConcept[] | null
}

export interface LearnProposal {
  id: string | number
  text: string
  product?: string | null
  reason?: string | null
  evidence?: string | null
  created_at?: string | null
}

/** A refusal in plain words, with the status kept so a 404 can read as "not available yet". */
export class ParityError extends Error {
  readonly status: number
  /** The raw body, for the collapsed Details only — never shown as the message. */
  readonly raw: string

  constructor(status: number, message: string, raw: string) {
    super(message)
    this.name = 'ParityError'
    this.status = status
    this.raw = raw
  }

  get notAvailable(): boolean {
    return this.status === 404
  }
}

const NOT_AVAILABLE = 'This is not available yet — it is still being built.'

/** Turn a failed response into words a marketer can act on. */
export function plainRefusal(status: number, body: string): string {
  if (status === 404) return NOT_AVAILABLE
  let said = ''
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown }
    const m = Array.isArray(parsed.message) ? parsed.message.join(' ') : parsed.message
    said = typeof m === 'string' ? m : typeof parsed.error === 'string' ? parsed.error : ''
  } catch {
    said = ''
  }
  // Nest's own class-validator wording ("stage must be one of…") is not for people.
  if (said && !/must be|should not|is not a valid|Internal server error/i.test(said)) return said
  if (status === 409) return 'This cannot be done right now — the run has moved on. Refresh and try again.'
  if (status >= 500) return "We couldn't reach the creative service. Try again in a minute."
  return "That didn't work. Try again."
}

async function send<T>(path: string, init: RequestInit, token: string | null): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const body = await res.text()
  if (!res.ok) throw new ParityError(res.status, plainRefusal(res.status, body), body)
  if (!body) return null as T
  const parsed = JSON.parse(body) as T
  // creativebot's refusals carry { ok: false, message } — show that message, even on a 2xx.
  const refusal = parsed as { ok?: unknown; message?: unknown } | null
  if (refusal && refusal.ok === false) {
    const said = typeof refusal.message === 'string' && refusal.message.trim()
    throw new ParityError(422, said || "That didn't work. Try again.", body)
  }
  return parsed
}

function call<T = ParityResult>(path: string, method = 'POST', body?: unknown): Promise<T> {
  return send<T>(
    path,
    { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
    getToken(),
  )
}

const bridge = (tenantId: string) => `/pipeline-bridge/${encodeURIComponent(tenantId)}`
const runPath = (tenantId: string, runId: number | string, suffix: string) =>
  `${bridge(tenantId)}/runs/${encodeURIComponent(String(runId))}/${suffix}`
const researchPath = (tenantId: string, researchId: number | string, suffix: string) =>
  `${bridge(tenantId)}/research/${encodeURIComponent(String(researchId))}/${suffix}`

// ── Run controls ────────────────────────────────────────────────────────────

export const cancelRun = (t: string, runId: number | string) => call(runPath(t, runId, 'cancel'))
export const retryRun = (t: string, runId: number | string, step?: 'preview' | 'full') =>
  call(runPath(t, runId, 'retry'), 'POST', step ? { step } : undefined)
export const runAnyway = (t: string, runId: number | string) => call(runPath(t, runId, 'run-anyway'))
/**
 * The models Slack's "Switch model" menu offered — creativebot accepts only these (it refuses
 * anything else and names the list). Kept here because /v1/options lists a different set.
 */
export const OVERRIDE_MODELS: { label: string; model: string; quality: string }[] = [
  { label: 'GPT — best quality', model: 'gpt-image-2', quality: 'high' },
  { label: 'GPT — faster', model: 'gpt-image-2', quality: 'medium' },
  { label: 'Riverflow', model: 'sourceful/riverflow-v2.5-fast', quality: 'high' },
]

export const setRunModel = (t: string, runId: number | string, model: string, quality?: string) =>
  call(runPath(t, runId, 'model'), 'POST', { model, ...(quality ? { quality } : {}) })
export const approveRunStage = (t: string, runId: number | string, stage: 'preview' | 'full') =>
  call(runPath(t, runId, 'approve'), 'POST', { stage })
export const setRunLogo = (t: string, runId: number | string, include: boolean, disclaimer?: string) =>
  call(runPath(t, runId, 'logo'), 'POST', { include, ...(disclaimer ? { disclaimer } : {}) })
export const setRunBadge = (t: string, runId: number | string, uploadId: string) =>
  call(runPath(t, runId, 'badge'), 'POST', { upload_id: uploadId })
// ── The questions a run stops to ask (were Slack buttons) ─────────────────

/** `awaiting_language`: one language, or several to split the run. */
export const setRunLanguage = (t: string, runId: number | string, languages: string[]) =>
  call(runPath(t, runId, 'language'), 'POST', languages.length > 1 ? { languages } : { language: languages[0] })

export type ImageKind = 'overlay' | 'product' | 'imitate' | 'imitate_text'
export const setRunImageKind = (t: string, runId: number | string, kind: ImageKind, text?: string) =>
  call(runPath(t, runId, 'image-kind'), 'POST', { kind, ...(text ? { text } : {}) })

/** `awaiting_offering`: which product — a slug from the pipeline's options. */
export const setRunOffering = (t: string, runId: number | string, offering: string) =>
  call(runPath(t, runId, 'offering'), 'POST', { offering })

/** The small print. Astro answers it with the product (same gate); automotive with the logo. */
export const setRunDisclaimer = (t: string, runId: number | string, choice: string) =>
  call(runPath(t, runId, 'disclaimer'), 'POST', { choice })

/** Addressed by the RUN showing the idea (as Slack's Delete idea button was), not an idea id. */
export const discardIdea = (t: string, runId: number | string, reason: string) =>
  call(`${bridge(t)}/ideas/${encodeURIComponent(String(runId))}/discard`, 'POST', { reason })

// ── Ad copy ─────────────────────────────────────────────────────────────────

export const generateAdCopy = (t: string, runId: number | string) =>
  call<CampaignFieldsResult>(runPath(t, runId, 'campaign-fields'))
export const saveAdCopy = (t: string, runId: number | string, fields: CampaignFields) =>
  call<CampaignFieldsResult>(runPath(t, runId, 'campaign-fields'), 'PUT', fields)
export const approveAdCopy = (t: string, runId: number | string) =>
  call<CampaignFieldsResult>(runPath(t, runId, 'campaign-fields/approve'))

// ── Research ────────────────────────────────────────────────────────────────

export const getResearchSources = (t: string, researchId: number | string) =>
  call<ResearchSourcesResult>(researchPath(t, researchId, 'sources'), 'GET')
export const confirmResearchSources = (
  t: string,
  researchId: number | string,
  confirm: boolean,
  urls?: string[],
) =>
  call(researchPath(t, researchId, 'sources'), 'POST', {
    confirm,
    ...(urls && urls.length ? { urls } : {}),
  })
export const chooseResearchRerun = (t: string, researchId: number | string, choice: 'reuse' | 'rerun') =>
  call(researchPath(t, researchId, 'rerun'), 'POST', { choice })
export const getResearchDirections = (t: string, researchId: number | string) =>
  call<ResearchDirectionsResult>(researchPath(t, researchId, 'directions'), 'GET')
export const buildDirection = (t: string, researchId: number | string, d: string | number) =>
  call(researchPath(t, researchId, `directions/${encodeURIComponent(String(d))}/build`))
/** Develop a pool idea further — by the concept's `index` (culled concepts have no id). */
export const expandConcept = (t: string, researchId: number | string, index: number) =>
  call(researchPath(t, researchId, `directions/${index}/expand`))
export const startResearchFromPdf = (t: string, uploadId: string, product: string) =>
  call(`${bridge(t)}/research/pdf`, 'POST', { upload_id: uploadId, product })

// ── Learnings proposals (Brain login only) ──────────────────────────────────

async function brainCall<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getBrainToken()
  if (!token) throw new BrainLockedError('Sign in to the Brain to see this.')
  try {
    return await send<T>(
      path,
      { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
      token,
    )
  } catch (e) {
    if (e instanceof ParityError && (e.status === 401 || e.status === 403)) {
      clearBrainToken('expired')
      throw new BrainLockedError('Your Brain sign-in has ended. Sign in again to continue.')
    }
    throw e
  }
}

export const getLearnProposals = (t: string) =>
  brainCall<{ proposals?: LearnProposal[] | null } | LearnProposal[] | null>(
    `${bridge(t)}/learn/proposals`,
  ).then(res => (Array.isArray(res) ? res : (res?.proposals ?? [])))

export const decideLearnProposal = (
  t: string,
  id: string | number,
  decision: 'approve' | 'reject' | 'edit',
  text?: string,
) =>
  brainCall<ParityResult>(`${bridge(t)}/learn/proposals/${encodeURIComponent(String(id))}`, 'POST', {
    decision,
    ...(text ? { text } : {}),
  })
