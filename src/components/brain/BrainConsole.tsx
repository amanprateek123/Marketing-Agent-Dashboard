'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BrainCircuit, RefreshCw, WifiOff } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import {
  BRAIN_MOCK,
  getBrainAgents,
  getBrainDecisions,
  getBrainGates,
  getBrainPipeline,
  getBrainRuns,
  getBrainState,
} from '@/lib/brain-api'
import type {
  BrainAgent,
  BrainDecision,
  BrainGate,
  BrainPipelineRun,
  BrainRunSummary,
  BrainState,
  BrainTabKey,
} from '@/types/brain'
import { BrainTabs } from './BrainTabs'
import { PulseTab } from './PulseTab'
import { DecisionsTab } from './DecisionsTab'
import { PipelineTab } from './PipelineTab'
import { ApprovalsTab } from './ApprovalsTab'
import { AgentsTab } from './AgentsTab'
import { ConversationTab } from './ConversationTab'
import { BrainError, BrainSkeleton } from './shared'

interface Snapshot {
  state: BrainState
  agents: BrainAgent[]
  decisions: BrainDecision[]
  gates: BrainGate[]
  /** Null when nothing is being built — a normal day, not an error. */
  pipeline: BrainPipelineRun | null
  runs: BrainRunSummary[]
}

interface BrainConsoleProps {
  tenantId: string
  initialTab: BrainTabKey
}

export function BrainConsole({ tenantId, initialTab }: BrainConsoleProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [tab, setTab] = useState<BrainTabKey>(initialTab)
  const [data, setData] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const [state, agents, decisions, gates, pipeline, runs] = await Promise.all([
          getBrainState(tenantId),
          getBrainAgents(tenantId),
          getBrainDecisions(tenantId),
          getBrainGates(tenantId),
          getBrainPipeline(tenantId),
          getBrainRuns(tenantId),
        ])
        setData({ state, agents, decisions, gates, pipeline, runs })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The Brain bridge did not respond.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [tenantId],
  )

  useEffect(() => {
    void load('initial')
  }, [load])

  /**
   * Tabs are local state synced to the URL rather than links, so the URL stays
   * shareable without remounting the console — a run being polled on Agents has
   * to survive a detour to Approvals and back.
   */
  const changeTab = useCallback(
    (next: BrainTabKey) => {
      setTab(next)
      const query = next === 'pulse' ? '' : `?tab=${next}`
      router.replace(`${pathname}${query}`, { scroll: false })
    },
    [pathname, router],
  )

  if (loading && !data) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="skeleton h-9 w-72" />
        <div className="skeleton mt-3 h-4 w-96" />
        <div className="skeleton mt-6 h-[88px] w-full rounded-2xl" />
        <div className="mt-6">
          <BrainSkeleton rows={3} />
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <BrainError message={error ?? 'No data was returned.'} onRetry={() => void load('initial')} />
      </main>
    )
  }

  const { state, agents, decisions, gates, pipeline, runs } = data

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="chip chip-accent">
              <BrainCircuit size={12} aria-hidden="true" /> Brain
            </span>
            {state.connected ? (
              <span className="chip chip-good">
                <span className="beacon" aria-hidden="true" /> Foundry connected
              </span>
            ) : (
              <span className="chip chip-bad">
                <WifiOff size={11} aria-hidden="true" /> Foundry unreachable
              </span>
            )}
            {BRAIN_MOCK && (
              <span
                className="chip"
                style={{
                  background: 'transparent',
                  color: 'var(--warn)',
                  border: '1px dashed var(--warn-border)',
                }}
                title="NEXT_PUBLIC_BRAIN_MOCK is on — this console is running against a local stand-in, not Foundry."
              >
                Sample data — bridge not connected
              </span>
            )}
          </div>

          <h1 className="page-title">The marketing head, and everything it runs</h1>
          <p className="page-subtitle">
            Your Foundry marketing agents in one place — what the Brain decided, what the pipeline
            is building, what needs you, and what you can run yourself. Read{' '}
            {formatRelativeTime(state.generatedAt)}.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-ghost shrink-0"
          onClick={() => void load('refresh')}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} aria-hidden="true" />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <BrainTabs
        active={tab}
        onChange={changeTab}
        badges={{ approvals: gates.length }}
      />

      <div
        id={`brain-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`brain-tab-${tab}`}
        tabIndex={-1}
        className="animate-fade-up mt-6"
      >
        {tab === 'pulse' && <PulseTab state={state} onGoToTab={changeTab} />}
        {tab === 'decisions' && <DecisionsTab decisions={decisions} />}
        {tab === 'pipeline' && <PipelineTab pipeline={pipeline} onGoToTab={changeTab} />}
        {tab === 'approvals' && (
          <ApprovalsTab tenantId={tenantId} gates={gates} onDecided={() => void load('refresh')} />
        )}
        {tab === 'agents' && (
          <AgentsTab
            tenantId={tenantId}
            agents={agents}
            runs={runs}
            onRunFinished={() => void load('refresh')}
          />
        )}
        {tab === 'conversation' && <ConversationTab tenantId={tenantId} />}
      </div>
    </main>
  )
}
