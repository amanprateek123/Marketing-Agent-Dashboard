'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  Loader2,
  XCircle,
  Circle,
  ArrowRight,
  AlertCircle,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDateTime, cn } from '@/lib/utils'
import type { PipelineRun } from '@/types'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

// ── Duration helper ────────────────────────────────────────────────────────────

function getDuration(start?: string, end?: string): string {
  if (!start) return ''
  const ms = new Date(end || Date.now()).getTime() - new Date(start).getTime()
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

// ── Phase dot logic ────────────────────────────────────────────────────────────

const PHASE_LABELS = ['Scouts', 'Intelligence', 'Creative', 'Campaign', 'Done']

function getActivePhaseIndex(status: string): number {
  const s = (status || '').toLowerCase()
  if (s === 'scouts_running') return 0
  if (s === 'intelligence_running' || s === 'idea_pool_running') return 1
  if (s === 'creative_running') return 2
  if (s === 'campaign_launching') return 3
  if (s === 'completed') return 5
  return -1
}

function getStatusBarColor(status: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'completed') return '#15803d'
  if (
    s === 'scouts_running' ||
    s === 'intelligence_running' ||
    s === 'idea_pool_running' ||
    s === 'creative_running' ||
    s === 'campaign_launching'
  )
    return '#0284c7'
  if (s === 'failed') return '#b91c1c'
  return '#d4d4d8'
}

// ── Mini phase stepper dots ────────────────────────────────────────────────────

function PhaseDots({ status }: { status: string }) {
  const activeIdx = getActivePhaseIndex(status)
  const isFailed = (status || '').toLowerCase() === 'failed'

  return (
    <div className="flex items-center gap-1">
      {PHASE_LABELS.map((label, idx) => {
        const done = activeIdx > idx || activeIdx === 5
        const active = activeIdx === idx && !isFailed
        const failedHere = isFailed && activeIdx === idx

        return (
          <div key={label} className="flex items-center gap-1">
            <div
              title={label}
              className={cn('rounded-full transition-all', active && 'animate-pulse')}
              style={{
                width: 7,
                height: 7,
                background: failedHere
                  ? '#b91c1c'
                  : done
                  ? '#15803d'
                  : active
                  ? '#0284c7'
                  : '#d4d4d8',
              }}
            />
            {idx < PHASE_LABELS.length - 1 && (
              <div
                style={{
                  width: 10,
                  height: 1,
                  background: done && activeIdx !== 5 ? '#d4d4d8' : done ? '#15803d' : '#e4e4e7',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  bg,
  border,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  bg: string
  border: string
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: '#71717a' }}>
          {label}
        </span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: bg, border: `1px solid ${border}` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: '#18181b' }}>
        {value}
      </p>
    </div>
  )
}

// ── Run row card ───────────────────────────────────────────────────────────────

function RunRowCard({
  run,
  tenantId,
}: {
  run: PipelineRun
  tenantId: string
}) {
  const statusColor = getStatusBarColor(run.status)
  const s = (run.status || '').toLowerCase()
  const isRunning =
    s === 'scouts_running' ||
    s === 'intelligence_running' ||
    s === 'idea_pool_running' ||
    s === 'creative_running' ||
    s === 'campaign_launching'

  let durationLabel = ''
  if (s === 'completed' && run.startedAt) {
    durationLabel = `Completed in ${getDuration(run.startedAt, run.completedAt)}`
  } else if (isRunning && run.startedAt) {
    durationLabel = `Running for ${getDuration(run.startedAt)}`
  } else if (s === 'failed' && run.startedAt) {
    durationLabel = `Failed after ${getDuration(run.startedAt, run.completedAt)}`
  }

  return (
    <Link
      href={`/dashboard/${tenantId}/runs/${run.runId}`}
      className="group flex items-stretch rounded-xl overflow-hidden transition-all"
      style={{
        background: '#ffffff',
        border: '1px solid #e4e4e7',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
        ;(e.currentTarget as HTMLElement).style.borderColor = '#0284c7'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
        ;(e.currentTarget as HTMLElement).style.borderColor = '#e4e4e7'
      }}
    >
      {/* Colored status bar */}
      <div
        style={{
          width: 4,
          minHeight: '100%',
          background: statusColor,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <div className="flex items-center gap-4 px-4 py-3.5 flex-1 min-w-0 flex-wrap">
        {/* Run ID */}
        <div className="min-w-[100px]">
          <p className="text-xs text-zinc-400 mb-0.5">Run ID</p>
          <code className="text-xs font-mono" style={{ color: '#18181b' }}>
            {run.runId.slice(0, 8)}…
          </code>
        </div>

        {/* Status badge */}
        <div className="min-w-[120px]">
          <StatusBadge status={run.status} />
        </div>

        {/* Phase dots */}
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: '#a1a1aa' }}>
            Progress
          </p>
          <PhaseDots status={run.status} />
        </div>

        {/* Time info */}
        <div className="flex-1 min-w-[140px]">
          {run.startedAt && (
            <p className="text-xs" style={{ color: '#a1a1aa' }}>
              Started: <span style={{ color: '#52525b' }}>{formatDateTime(run.startedAt)}</span>
            </p>
          )}
          {durationLabel && (
            <p className="text-xs mt-0.5" style={{ color: statusColor }}>
              {durationLabel}
            </p>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div
        className="flex items-center px-4 transition-transform group-hover:translate-x-0.5"
        style={{ color: '#a1a1aa' }}
      >
        <ArrowRight size={15} />
      </div>
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'running' | 'completed' | 'failed'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
]

function isRunning(status: string) {
  const s = (status || '').toLowerCase()
  return (
    s === 'scouts_running' ||
    s === 'intelligence_running' ||
    s === 'idea_pool_running' ||
    s === 'creative_running' ||
    s === 'campaign_launching'
  )
}

export default function RunsPage({ params }: PageProps) {
  const { tenantId } = use(params)

  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('all')

  async function fetchRuns(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch(`http://localhost:8082/api/v1/pipeline/${tenantId}/runs`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: PipelineRun[] = await res.json()
      setRuns(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRuns()
  }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stats
  const total = runs.length
  const running = runs.filter((r) => isRunning(r.status)).length
  const completed = runs.filter((r) => r.status?.toLowerCase() === 'completed').length
  const failed = runs.filter((r) => r.status?.toLowerCase() === 'failed').length

  // Filtered by tab
  const filteredRuns =
    activeTab === 'all'
      ? runs
      : activeTab === 'running'
      ? runs.filter((r) => isRunning(r.status))
      : activeTab === 'completed'
      ? runs.filter((r) => r.status?.toLowerCase() === 'completed')
      : runs.filter((r) => r.status?.toLowerCase() === 'failed')

  const tabCounts: Record<TabKey, number> = { all: total, running, completed, failed }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Activity size={18} style={{ color: '#0284c7' }} />
            <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181b' }}>
              Pipeline Runs
            </h1>
          </div>
          <p className="text-sm" style={{ color: '#71717a' }}>
            Monitor AI pipeline execution and phase progress
          </p>
        </div>

        <button
          onClick={() => fetchRuns(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
          style={{
            background: '#ffffff',
            border: '1px solid #e4e4e7',
            color: '#52525b',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.borderColor = '#0284c7'
            ;(e.currentTarget as HTMLElement).style.color = '#0284c7'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.borderColor = '#e4e4e7'
            ;(e.currentTarget as HTMLElement).style.color = '#52525b'
          }}
        >
          <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl p-4 mb-6 flex items-center gap-3 text-sm"
          style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
        >
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Runs"
          value={total}
          icon={<Activity size={14} />}
          color="#0284c7"
          bg="#e0f2fe"
          border="#bae6fd"
        />
        <StatCard
          label="Running"
          value={running}
          icon={<Loader2 size={14} className={cn(running > 0 && 'animate-spin')} />}
          color="#1d4ed8"
          bg="#dbeafe"
          border="#bfdbfe"
        />
        <StatCard
          label="Completed"
          value={completed}
          icon={<CheckCircle2 size={14} />}
          color="#15803d"
          bg="#dcfce7"
          border="#bbf7d0"
        />
        <StatCard
          label="Failed"
          value={failed}
          icon={<XCircle size={14} />}
          color="#b91c1c"
          bg="#fee2e2"
          border="#fecaca"
        />
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl mb-4"
        style={{ background: '#f4f4f5', border: '1px solid #e4e4e7' }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center"
              style={{
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? '#18181b' : '#71717a',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                border: isActive ? '1px solid #e4e4e7' : '1px solid transparent',
              }}
            >
              {tab.label}
              <span
                className="rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[20px] text-center"
                style={{
                  background: isActive
                    ? tab.key === 'running'
                      ? '#dbeafe'
                      : tab.key === 'completed'
                      ? '#dcfce7'
                      : tab.key === 'failed'
                      ? '#fee2e2'
                      : '#e4e4e7'
                    : '#e4e4e7',
                  color: isActive
                    ? tab.key === 'running'
                      ? '#1d4ed8'
                      : tab.key === 'completed'
                      ? '#15803d'
                      : tab.key === 'failed'
                      ? '#b91c1c'
                      : '#52525b'
                    : '#71717a',
                }}
              >
                {tabCounts[tab.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Runs list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin" style={{ color: '#0284c7' }} />
            <p className="text-sm" style={{ color: '#71717a' }}>
              Loading runs…
            </p>
          </div>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div
          className="rounded-xl py-14 text-center"
          style={{ background: '#ffffff', border: '1px solid #e4e4e7' }}
        >
          <Activity size={28} className="mx-auto mb-3" style={{ color: '#d4d4d8' }} />
          <p className="text-sm font-medium" style={{ color: '#a1a1aa' }}>
            {activeTab === 'all' ? 'No pipeline runs yet' : `No ${activeTab} runs`}
          </p>
          <p className="text-xs mt-1" style={{ color: '#d4d4d8' }}>
            {activeTab === 'all'
              ? 'Trigger a pipeline run from the dashboard to get started'
              : `Switch to "All" to see all runs`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredRuns.map((run) => (
            <RunRowCard key={run.runId} run={run} tenantId={tenantId} />
          ))}
        </div>
      )}
    </div>
  )
}
