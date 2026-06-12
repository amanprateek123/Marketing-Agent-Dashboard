'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  Activity, RefreshCw, CheckCircle2, Loader2,
  XCircle, ArrowRight, AlertCircle, Clock,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDateTime, cn } from '@/lib/utils'
import type { PipelineRun } from '@/types'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

function getDuration(start?: string, end?: string): string {
  if (!start) return ''
  const ms = new Date(end || Date.now()).getTime() - new Date(start).getTime()
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

function isRunningStatus(status: string) {
  const s = (status || '').toLowerCase()
  return s === 'scouts_running' || s === 'intelligence_running' || s === 'idea_pool_running' || s === 'creative_running' || s === 'campaign_launching'
}

function getPhaseLabel(status: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'scouts_running') return 'Scouting'
  if (s === 'intelligence_running') return 'Analyzing'
  if (s === 'idea_pool_running') return 'Ideating'
  if (s === 'creative_running') return 'Creating'
  if (s === 'campaign_launching') return 'Launching'
  if (s === 'completed') return 'Complete'
  if (s === 'failed') return 'Failed'
  return 'Pending'
}

/* ── Run card ─────────────────────────────────────────── */

function RunCard({ run, tenantId, index }: { run: PipelineRun; tenantId: string; index: number }) {
  const running = isRunningStatus(run.status)
  const completed = run.status?.toLowerCase() === 'completed'
  const failed = run.status?.toLowerCase() === 'failed'
  const duration = getDuration(run.startedAt, completed || failed ? run.completedAt : undefined)

  return (
    <Link
      href={`/dashboard/${tenantId}/runs/${run.runId}`}
      className="group block card card-hover overflow-hidden animate-reveal-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-5 flex items-center gap-5">
        {/* Phase indicator */}
        <div
          className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', running && 'animate-pulse')}
          style={{
            background: completed ? 'var(--good-bg)' : failed ? 'var(--bad-bg)' : running ? 'var(--accent-bg)' : 'var(--muted)',
          }}
        >
          {completed ? <CheckCircle2 size={18} style={{ color: 'var(--good)' }} />
           : failed ? <XCircle size={18} style={{ color: 'var(--bad)' }} />
           : running ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
           : <Clock size={18} style={{ color: 'var(--ink-3)' }} />}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
              {getPhaseLabel(run.status)}
            </span>
            <StatusBadge status={run.status} />
          </div>
          <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--ink-3)' }}>
            <code className="mono">{run.runId.slice(0, 10)}</code>
            {run.startedAt && (
              <>
                <span style={{ color: 'var(--ink-4)' }}>&middot;</span>
                <span className="mono">{formatDateTime(run.startedAt)}</span>
              </>
            )}
          </div>
        </div>

        {/* Duration */}
        {duration && (
          <div className="text-right shrink-0 hidden sm:block">
            <p className="micro-label mb-0.5">
              Duration
            </p>
            <p className="text-lg font-semibold mono tabular-nums" style={{ color: 'var(--ink)' }}>
              {duration}
            </p>
          </div>
        )}

        {/* Arrow */}
        <ArrowRight
          size={16}
          className="shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
          style={{ color: 'var(--accent)' }}
        />
      </div>
    </Link>
  )
}

/* ── Tab filter ───────────────────────────────────────── */

type TabKey = 'all' | 'running' | 'completed' | 'failed'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'running',   label: 'Running' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed',    label: 'Failed' },
]

/* ── Page ─────────────────────────────────────────────── */

export default function RunsPage({ params }: PageProps) {
  const { tenantId } = use(params)
  const [runs, setRuns]           = useState<PipelineRun[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('all')

  async function fetchRuns(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch(`http://localhost:8082/api/v1/pipeline/${tenantId}/runs`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRuns(await res.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchRuns() }, [tenantId]) // eslint-disable-line

  const total     = runs.length
  const running   = runs.filter(r => isRunningStatus(r.status)).length
  const completed = runs.filter(r => r.status?.toLowerCase() === 'completed').length
  const failed    = runs.filter(r => r.status?.toLowerCase() === 'failed').length

  const filteredRuns = activeTab === 'all' ? runs
    : activeTab === 'running'   ? runs.filter(r => isRunningStatus(r.status))
    : activeTab === 'completed' ? runs.filter(r => r.status?.toLowerCase() === 'completed')
    : runs.filter(r => r.status?.toLowerCase() === 'failed')

  const tabCounts: Record<TabKey, number> = { all: total, running, completed, failed }

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto stagger">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <p className="micro-label mb-2">Pipeline activity</p>
          <h1 className="page-title">Pipeline Runs</h1>
          <p className="page-subtitle">
            {total} run{total !== 1 ? 's' : ''} total
            {running > 0 && <span style={{ color: 'var(--accent)' }}> &middot; {running} active</span>}
          </p>
        </div>
        <button
          onClick={() => fetchRuns(true)}
          disabled={refreshing}
          className="btn btn-ghost"
        >
          <RefreshCw size={13} className={cn(refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="card px-2 py-5 mb-8 grid grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total',     value: total,     color: 'var(--ink)' },
          { label: 'Running',   value: running,   color: 'var(--accent)' },
          { label: 'Completed', value: completed, color: 'var(--good)' },
          { label: 'Failed',    value: failed,    color: 'var(--bad)' },
        ].map((s, i) => (
          <div
            key={s.label}
            className="px-6 py-1"
            style={i > 0 ? { borderLeft: '1px solid var(--hairline-light)' } : undefined}
          >
            <p className="micro-label mb-2">{s.label}</p>
            <p className="display-num text-[30px]" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar — underline style */}
      <div className="flex items-center gap-1 border-b mb-6" style={{ borderColor: 'var(--hairline)' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          const count = tabCounts[tab.key]
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative px-4 py-3 text-[13px] font-medium transition-colors"
              style={{ color: isActive ? 'var(--ink)' : 'var(--ink-3)' }}
            >
              {tab.label}
              {count > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold mono tabular-nums" style={{ color: isActive ? 'var(--accent)' : 'var(--ink-4)' }}>
                  {count}
                </span>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: 'var(--accent)' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div>
        {error && (
          <div className="flex items-center gap-3 rounded-xl p-4 mb-6 text-sm font-medium animate-scale-in"
            style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-24">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="text-sm" style={{ color: 'var(--ink-2)' }}>Loading runs&hellip;</p>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="card py-20 text-center">
            <Activity size={28} className="mx-auto mb-3" style={{ color: 'var(--ink-4)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
              {activeTab === 'all' ? 'No pipeline runs yet' : `No ${activeTab} runs`}
            </p>
            <p className="text-xs mt-1.5" style={{ color: 'var(--ink-3)' }}>
              {activeTab === 'all' ? 'Trigger a run from the Overview page to get started' : 'Try a different filter'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredRuns.map((run, idx) => (
              <RunCard key={run.runId} run={run} tenantId={tenantId} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
