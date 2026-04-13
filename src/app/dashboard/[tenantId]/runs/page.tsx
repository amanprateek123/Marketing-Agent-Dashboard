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
      className="group block rounded-2xl overflow-hidden transition-all duration-300 animate-reveal-up hover:shadow-lg"
      style={{
        animationDelay: `${index * 50}ms`,
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(26,26,26,0.04), 0 1px 2px rgba(26,26,26,0.02)',
        textDecoration: 'none',
      }}
    >
      <div className="p-5 flex items-center gap-5">
        {/* Phase indicator */}
        <div
          className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', running && 'animate-pulse')}
          style={{
            background: completed ? '#ecfdf5' : failed ? '#fef2f2' : running ? '#eef2ff' : '#f3f4f6',
          }}
        >
          {completed ? <CheckCircle2 size={18} style={{ color: '#059669' }} />
           : failed ? <XCircle size={18} style={{ color: '#dc2626' }} />
           : running ? <Loader2 size={18} className="animate-spin" style={{ color: '#4f46e5' }} />
           : <Clock size={18} style={{ color: '#9ca3af' }} />}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-[13px] font-semibold" style={{ color: '#111827' }}>
              {getPhaseLabel(run.status)}
            </span>
            <StatusBadge status={run.status} />
          </div>
          <div className="flex items-center gap-3 text-[12px]" style={{ color: '#9ca3af' }}>
            <code className="font-mono">{run.runId.slice(0, 10)}</code>
            {run.startedAt && (
              <>
                <span style={{ color: '#d1d5db' }}>&middot;</span>
                <span>{formatDateTime(run.startedAt)}</span>
              </>
            )}
          </div>
        </div>

        {/* Duration */}
        {duration && (
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#d1d5db' }}>
              Duration
            </p>
            <p className="text-lg font-bold font-mono tabular-nums" style={{ color: '#111827' }}>
              {duration}
            </p>
          </div>
        )}

        {/* Arrow */}
        <ArrowRight
          size={16}
          className="shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
          style={{ color: '#4f46e5' }}
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
    <div className="min-h-screen" style={{ background: '#f8f9fb' }}>
      {/* Header */}
      <div className="px-8 pt-8 pb-0 max-w-5xl mx-auto animate-fade-up">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>
              Pipeline Runs
            </h1>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
              {total} run{total !== 1 ? 's' : ''} total
              {running > 0 && <span style={{ color: '#4f46e5' }}> &middot; {running} active</span>}
            </p>
          </div>
          <button
            onClick={() => fetchRuns(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all disabled:opacity-50"
            style={{ background: '#ffffff', color: '#4b5563', boxShadow: '0 1px 3px rgba(26,26,26,0.06)' }}
          >
            <RefreshCw size={13} className={cn(refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-px rounded-2xl overflow-hidden mb-8" style={{ background: '#e5e7eb' }}>
          {[
            { label: 'Total',     value: total,     color: '#111827' },
            { label: 'Running',   value: running,   color: '#4f46e5' },
            { label: 'Completed', value: completed, color: '#059669' },
            { label: 'Failed',    value: failed,    color: '#dc2626' },
          ].map(s => (
            <div key={s.label} className="bg-white py-5 px-4 text-center">
              <p className="text-3xl font-black font-mono tabular-nums" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color: '#d1d5db' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tab bar — underline style */}
        <div className="flex items-center gap-1 border-b" style={{ borderColor: '#e5e7eb' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key
            const count = tabCounts[tab.key]
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="relative px-4 py-3 text-[13px] font-medium transition-colors"
                style={{ color: isActive ? '#111827' : '#9ca3af' }}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] font-semibold tabular-nums" style={{ color: isActive ? '#4f46e5' : '#d1d5db' }}>
                    {count}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: '#4f46e5' }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 max-w-5xl mx-auto">
        {error && (
          <div className="flex items-center gap-3 rounded-2xl p-4 mb-6 text-sm font-medium animate-scale-in"
            style={{ background: '#fef2f2', color: '#dc2626' }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-24">
            <Loader2 size={24} className="animate-spin" style={{ color: '#4f46e5' }} />
            <p className="text-sm" style={{ color: '#9ca3af' }}>Loading runs&hellip;</p>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="rounded-2xl py-20 text-center" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(26,26,26,0.04)' }}>
            <Activity size={28} className="mx-auto mb-3" style={{ color: '#d1d5db' }} />
            <p className="text-sm font-semibold" style={{ color: '#4b5563' }}>
              {activeTab === 'all' ? 'No pipeline runs yet' : `No ${activeTab} runs`}
            </p>
            <p className="text-xs mt-1.5" style={{ color: '#d1d5db' }}>
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
