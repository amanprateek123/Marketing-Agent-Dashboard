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
 *   GET  /brain/:tenantId/runs
 *   GET  /brain/:tenantId/runs/:runId
 *   GET  /brain/:tenantId/runs/:runId/events?after=<cursor>
 *   POST /brain/:tenantId/agents/:agentKey/runs
 *   POST /brain/:tenantId/runs/:runId/cancel
 *   POST /brain/:tenantId/gates/:gateId/decision
 *   GET  /brain/:tenantId/conversation/:sessionId
 *   POST /brain/:tenantId/conversation/:sessionId/messages
 *
 * The Foundry run token is never sent from the browser. It is held by the
 * bridge, exactly as the creative pipeline's token is today.
 */

import { apiFetch } from './api'
import {
  readAgents,
  readConversation,
  readDecisions,
  readEvents,
  readGates,
  readPipeline,
  readRun,
  readRuns,
  readState,
  writeConversationMessage,
  writeGateDecision,
  writeRunCancel,
  writeRunStart,
} from './brain-fixtures'
import type {
  BrainAgent,
  BrainAgentKey,
  BrainConversation,
  BrainDecision,
  BrainEventPage,
  BrainGate,
  BrainGateDecisionBody,
  BrainPipelineRun,
  BrainRunDetail,
  BrainRunSummary,
  BrainState,
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
 */
export function decideBrainGate(
  tenantId: string,
  gateId: string,
  body: BrainGateDecisionBody,
): Promise<{ ok: true }> {
  if (BRAIN_MOCK) return settle(() => writeGateDecision(gateId, body), 520)
  return apiFetch<{ ok: true }>(`${base(tenantId)}/gates/${gateId}/decision`, {
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
 */
export function sendBrainMessage(
  tenantId: string,
  sessionId: string,
  message: string,
  mode?: string,
): Promise<{ runId: string; sessionId: string }> {
  if (BRAIN_MOCK) return settle(() => writeConversationMessage(sessionId, message), 600)
  return apiFetch<{ runId: string; sessionId: string }>(
    `${base(tenantId)}/conversation/${encodeURIComponent(sessionId)}/messages`,
    { method: 'POST', body: JSON.stringify({ message, ...(mode ? { mode } : {}) }) },
  )
}
