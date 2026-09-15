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
 *
 * The Foundry run token is never sent from the browser. It is held by the
 * bridge, exactly as the creative pipeline's token is today.
 */

import { apiFetch } from './api'
import {
  readAgents,
  readDecisions,
  readEvents,
  readGates,
  readPipeline,
  readRun,
  readRuns,
  readState,
  writeGateDecision,
  writeRunCancel,
  writeRunStart,
} from './brain-fixtures'
import type {
  BrainAgent,
  BrainAgentKey,
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
 * Mock is the default because the bridge is not built. Flipping this to
 * "false" is the entire cutover — nothing else in the console knows.
 */
export const BRAIN_MOCK = (process.env.NEXT_PUBLIC_BRAIN_MOCK ?? 'true') !== 'false'

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

export function getBrainPipeline(tenantId: string): Promise<BrainPipelineRun> {
  if (BRAIN_MOCK) return settle(readPipeline)
  return apiFetch<BrainPipelineRun>(`${base(tenantId)}/pipeline`)
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
