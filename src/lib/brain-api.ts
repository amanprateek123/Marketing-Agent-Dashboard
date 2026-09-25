/**
 * The Brain console's only transport.
 *
 * Every component in `components/brain/` calls these functions and nothing
 * else. That is the whole point: the NestJS `foundry-bridge` does not exist
 * yet, so today each call resolves against `brain-fixtures.ts`. When the bridge
 * lands, set NEXT_PUBLIC_BRAIN_MOCK=false and the same functions hit the real
 * routes — no component changes, no prop changes, no type changes.
 *
 * The route shapes below are the contract the bridge has to satisfy. They
 * deliberately mirror `pipeline-bridge` in the marketing-agent repo, including
 * the cursor-paged events endpoint, because that pattern is already proven
 * against a long-running external agent system.
 *
 *   GET  /brain/:tenantId/state
 *   GET  /brain/:tenantId/agents
 *   GET  /brain/:tenantId/decisions
 *   GET  /brain/:tenantId/gates
 *   GET  /brain/:tenantId/pipeline
 *   GET  /brain/:tenantId/pipeline/runs?limit=<n>
 *   GET  /brain/:tenantId/pipeline/runs/:runId
 *   GET  /brain/:tenantId/pipeline/runs/:runId/creatives
 *   GET  /brain/:tenantId/experiments?view=testing|learned|dropped&product=<productKey>
 *   GET  /brain/:tenantId/experiments/summary
 *   GET  /brain/:tenantId/runs
 *   GET  /brain/:tenantId/runs/:runId
 *   GET  /brain/:tenantId/runs/:runId/events?after=<cursor>
 *   POST /brain/:tenantId/agents/:agentKey/runs
 *   POST /brain/:tenantId/runs/:runId/cancel
 *   POST /brain/:tenantId/gates/:gateId/decision
 *   GET   /brain/:tenantId/agents/:agentKey/triggers
 *   PATCH /brain/:tenantId/agents/:agentKey/triggers/:triggerId
 *   GET  /brain/:tenantId/conversation/:sessionId
 *   POST /brain/:tenantId/conversation/:sessionId/messages
 *
 * The Foundry run token is never sent from the browser. It is held by the
 * bridge, exactly as the creative pipeline's token is today.
 */

import { API_BASE } from './api'
import { clearBrainToken, getBrainToken } from './auth'
import {
  readAgents,
  readCampaignRun,
  readCampaignRunCreatives,
  readCampaignRuns,
  readConversation,
  readDecisions,
  readEvents,
  readExperiments,
  readExperimentSummary,
  readGates,
  readPipeline,
  readRun,
  readRuns,
  readAgentTriggers,
  readState,
  writeConversationMessage,
  writeAgentTriggerEnabled,
  writeGateDecision,
  writeRunCancel,
  writeRunStart,
} from './brain-fixtures'
import type {
  BrainAgent,
  BrainAgentKey,
  BrainCampaignCreative,
  BrainCampaignRun,
  BrainCampaignRunSummary,
  BrainConversation,
  BrainDecision,
  BrainEventPage,
  BrainExperiment,
  BrainExperimentSummary,
  BrainExperimentView,
  BrainGate,
  BrainGateDecisionBody,
  BrainGateDecisionResult,
  BrainPipelineRun,
  BrainRunDetail,
  BrainRunSummary,
  BrainState,
  BrainTrigger,
} from '@/types/brain'

/**
 * Fixtures are OPT-IN, and that is a deliberate reversal.
 *
 * This defaulted to mock — `(… ?? 'true') !== 'false'` — from when the bridge did not exist and a
 * fake console was the only console. The bridge exists now, and that default had become a landmine:
 * `NEXT_PUBLIC_*` is baked into the client bundle at BUILD time, the working `false` lived only in a
 * gitignored `.env.local`, and whoever deploys this will not know the flag exists. A clean deploy
 * would therefore ship a page serving `brain-fixtures.ts` — stateful, animated, plausible invented
 * gates and decisions — with nothing but one chip to say so.
 *
 * Failing closed is the point of the console. A page about what the Brain decided, quietly showing
 * decisions it never made, is worse than a page that errors: an unset variable now produces real
 * calls that fail loudly against a misconfigured bridge, which is visible and fixable.
 *
 * Set `NEXT_PUBLIC_BRAIN_MOCK=true` at build time to get the demo back.
 */
export const BRAIN_MOCK = process.env.NEXT_PUBLIC_BRAIN_MOCK === 'true'

/** Enough latency that loading and empty states are actually exercised in dev. */
function settle<T>(value: () => T, ms = 320): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(value())
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }, ms)
  })
}

/**
 * Thrown when the Brain refuses this browser: no Brain token, a Brain 401/403, or a server whose
 * Brain login is not set up (503). The token is already cleared by the time this is thrown, so the
 * page's gate swaps the console for the sign-in card on its own; the message is plain words.
 */
export class BrainLockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BrainLockedError'
  }
}

/**
 * `apiFetch` for the Brain: the same parsing, but it sends the Brain token (never the workspace
 * one), and a refusal locks the Brain instead of signing anyone out of the workspace.
 */
async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = getBrainToken()
  if (!token) throw new BrainLockedError('Sign in to the Brain to see this.')
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (res.status === 401 || res.status === 403) {
    clearBrainToken('expired')
    throw new BrainLockedError('Your Brain sign-in has ended. Sign in again to continue.')
  }
  const body = await res.text()
  if (res.status === 503 && /not configured/i.test(body)) {
    clearBrainToken('not_configured')
    throw new BrainLockedError("The Brain login hasn't been set up on the server yet.")
  }
  if (!res.ok) throw new Error(`${res.status} ${body}`)
  // A 200 with an empty body is Nest's `null` — GET /pipeline returns it when nothing is building.
  if (!body) return null as T
  return JSON.parse(body) as T
}

function base(tenantId: string): string {
  return `/brain/${encodeURIComponent(tenantId)}`
}

// ── Reads ──────────────────────────────────────────────────────────────────

export function getBrainState(tenantId: string): Promise<BrainState> {
  if (BRAIN_MOCK) return settle(readState)
  return apiFetch<BrainState>(`${base(tenantId)}/state`)
}

export function getBrainAgents(tenantId: string): Promise<BrainAgent[]> {
  if (BRAIN_MOCK) return settle(readAgents)
  return apiFetch<BrainAgent[]>(`${base(tenantId)}/agents`)
}

export function getBrainDecisions(tenantId: string): Promise<BrainDecision[]> {
  if (BRAIN_MOCK) return settle(readDecisions)
  return apiFetch<BrainDecision[]>(`${base(tenantId)}/decisions`)
}

export function getBrainGates(tenantId: string): Promise<BrainGate[]> {
  if (BRAIN_MOCK) return settle(readGates)
  return apiFetch<BrainGate[]>(`${base(tenantId)}/gates`)
}

/**
 * Null is a real answer: no campaign is being built right now. The tab draws an empty pipeline for
 * it rather than an error — "nothing is running" is the most common state a healthy day is in.
 */
export function getBrainPipeline(tenantId: string): Promise<BrainPipelineRun | null> {
  if (BRAIN_MOCK) return settle(readPipeline)
  return apiFetch<BrainPipelineRun | null>(`${base(tenantId)}/pipeline`)
}

/**
 * Every campaign run, newest first — the non-technical view.
 *
 * Separate from `getBrainPipeline` on purpose. That one answers "is anything in flight right
 * now"; these answer "what have we built, and what is actually going out". They are different
 * questions and a reader opens the page for the second one.
 */
export function getCampaignRuns(
  tenantId: string,
  limit = 25,
): Promise<BrainCampaignRunSummary[]> {
  if (BRAIN_MOCK) return settle(readCampaignRuns)
  return apiFetch<BrainCampaignRunSummary[]>(
    `${base(tenantId)}/pipeline/runs?limit=${limit}`,
  )
}

export function getCampaignRun(
  tenantId: string,
  runId: string,
): Promise<BrainCampaignRun> {
  if (BRAIN_MOCK) return settle(() => readCampaignRun(runId))
  return apiFetch<BrainCampaignRun>(
    `${base(tenantId)}/pipeline/runs/${encodeURIComponent(runId)}`,
  )
}

/** The ads this run settled on. Only finalised ones — half-made rows are not an answer. */
export function getCampaignRunCreatives(
  tenantId: string,
  runId: string,
): Promise<BrainCampaignCreative[]> {
  if (BRAIN_MOCK) return settle(() => readCampaignRunCreatives(runId))
  return apiFetch<BrainCampaignCreative[]>(
    `${base(tenantId)}/pipeline/runs/${encodeURIComponent(runId)}/creatives`,
  )
}

/**
 * The Brain's experiments on one shelf — testing now, learned, or tried and dropped — already in
 * plain words. `product` is a `productKey` from the summary; omit it for every product.
 */
export function getExperiments(
  tenantId: string,
  view: BrainExperimentView,
  product?: string | null,
): Promise<BrainExperiment[]> {
  if (BRAIN_MOCK) return settle(() => readExperiments(view, product))
  const query = new URLSearchParams({ view })
  if (product) query.set('product', product)
  return apiFetch<BrainExperiment[]>(`${base(tenantId)}/experiments?${query.toString()}`)
}

/** How many experiments sit on each shelf, overall and per product. */
export function getExperimentSummary(tenantId: string): Promise<BrainExperimentSummary> {
  if (BRAIN_MOCK) return settle(readExperimentSummary)
  return apiFetch<BrainExperimentSummary>(`${base(tenantId)}/experiments/summary`)
}

export function getBrainRuns(tenantId: string): Promise<BrainRunSummary[]> {
  if (BRAIN_MOCK) return settle(readRuns)
  return apiFetch<BrainRunSummary[]>(`${base(tenantId)}/runs`)
}

export function getBrainRun(tenantId: string, runId: string): Promise<BrainRunDetail> {
  if (BRAIN_MOCK) {
    return settle(() => {
      const run = readRun(runId)
      if (!run) throw new Error(`Run ${runId} not found`)
      return run
    }, 120)
  }
  return apiFetch<BrainRunDetail>(`${base(tenantId)}/runs/${runId}`)
}

/**
 * Cursor-paged, like pipeline-bridge: pass back the `cursor` from the previous
 * response so each poll returns only what is new. Polling a finished run is
 * cheap and returns `done: true`.
 */
export function getBrainRunEvents(
  tenantId: string,
  runId: string,
  after: number,
): Promise<BrainEventPage> {
  if (BRAIN_MOCK) return settle(() => readEvents(runId, after), 120)
  return apiFetch<BrainEventPage>(`${base(tenantId)}/runs/${runId}/events?after=${after}`)
}

// ── Writes ─────────────────────────────────────────────────────────────────

/**
 * Starts an on-demand agent. Returns as soon as Foundry accepts the run — the
 * work is not done inline, so the caller polls `getBrainRun` and
 * `getBrainRunEvents` from there.
 *
 * Agents whose `invocation` is not `on_demand` are refused here rather than in
 * the UI, so a stale render can never start something the Brain owns.
 */
export function startBrainAgentRun(
  tenantId: string,
  agentKey: BrainAgentKey,
  input: Record<string, string>,
): Promise<{ runId: string }> {
  if (BRAIN_MOCK) return settle(() => writeRunStart(agentKey, input), 420)
  return apiFetch<{ runId: string }>(`${base(tenantId)}/agents/${agentKey}/runs`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function cancelBrainRun(tenantId: string, runId: string): Promise<{ ok: true }> {
  if (BRAIN_MOCK) {
    return settle(() => {
      writeRunCancel(runId)
      return { ok: true as const }
    }, 200)
  }
  return apiFetch<{ ok: true }>(`${base(tenantId)}/runs/${runId}/cancel`, { method: 'POST' })
}

/**
 * Answers a human-in-the-loop gate — the same gates that live in Slack today.
 * One endpoint for approve / reject / revise so the two surfaces can never
 * drift apart on what a decision means.
 *
 * The answer says what an approved AMOUNT did: which run contracts the brain rescaled
 * (`budgetRescale`), or why it rescaled none (`budgetRescaleSkipped`).
 */
export function decideBrainGate(
  tenantId: string,
  gateId: string,
  body: BrainGateDecisionBody,
): Promise<BrainGateDecisionResult> {
  if (BRAIN_MOCK) return settle(() => writeGateDecision(gateId, body), 520)
  return apiFetch<BrainGateDecisionResult>(`${base(tenantId)}/gates/${gateId}/decision`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ── Conversation ───────────────────────────────────────────────────────────

/**
 * The thread so far, oldest first.
 *
 * The session id is the console's to choose and to KEEP. It is a durable thread, not a request:
 * the same id tomorrow continues the same conversation, which is the whole reason the brain has a
 * `conversation_turns` table rather than a questions queue. `brain-session.ts` holds the id.
 */
export function getBrainConversation(
  tenantId: string,
  sessionId: string,
  limit = 20,
): Promise<BrainConversation> {
  if (BRAIN_MOCK) return settle(() => readConversation(sessionId, limit))
  return apiFetch<BrainConversation>(
    `${base(tenantId)}/conversation/${encodeURIComponent(sessionId)}?limit=${limit}`,
  )
}

/**
 * Say something, and get back the run that will answer it.
 *
 * The reply is NOT in this response and cannot be: a Brain review reads the account, the learnings
 * and the wiki before it says anything, which takes minutes. The turn is recorded immediately, the
 * run id comes back, and the answer arrives in the thread when the Brain commits it — so the caller
 * polls the conversation rather than holding a request open across a real piece of work.
 *
 * `correlationId` is minted by the bridge and passed to the run; Brain v2 2.11.0+ writes it as the
 * `runId` of the answering turn, so the caller matches the answer on it. It is optional here because
 * an older bridge does not return one — fall back to `runId` then.
 */
export function sendBrainMessage(
  tenantId: string,
  sessionId: string,
  message: string,
  mode?: string,
): Promise<{ runId: string; correlationId?: string; sessionId: string }> {
  if (BRAIN_MOCK) return settle(() => writeConversationMessage(sessionId, message), 600)
  return apiFetch<{ runId: string; correlationId?: string; sessionId: string }>(
    `${base(tenantId)}/conversation/${encodeURIComponent(sessionId)}/messages`,
    { method: 'POST', body: JSON.stringify({ message, ...(mode ? { mode } : {}) }) },
  )
}

// ── Schedules ──────────────────────────────────────────────────────────────

/**
 * What starts this agent, and whether it is on.
 *
 * Worth surfacing because a paused schedule is invisible until something does not happen — four
 * stage agents read as broken for six days when they had simply been replaced by a sweeper.
 */
export function getAgentTriggers(
  tenantId: string,
  agentKey: BrainAgentKey,
): Promise<BrainTrigger[]> {
  if (BRAIN_MOCK) return settle(() => readAgentTriggers(agentKey))
  return apiFetch<BrainTrigger[]>(`${base(tenantId)}/agents/${agentKey}/triggers`)
}

/**
 * Pause or resume one trigger. The only schedule mutation this console can make — the backend's
 * transport is allowlisted to two Foundry verbs, so a reschedule is not merely hidden here, it is
 * unreachable.
 */
export function setAgentTriggerEnabled(
  tenantId: string,
  agentKey: BrainAgentKey,
  trigger: string,
  enabled: boolean,
): Promise<BrainTrigger | null> {
  if (BRAIN_MOCK) return settle(() => writeAgentTriggerEnabled(agentKey, trigger, enabled), 300)
  return apiFetch<BrainTrigger | null>(
    `${base(tenantId)}/agents/${agentKey}/triggers/${encodeURIComponent(trigger)}`,
    { method: 'PATCH', body: JSON.stringify({ enabled }) },
  )
}
