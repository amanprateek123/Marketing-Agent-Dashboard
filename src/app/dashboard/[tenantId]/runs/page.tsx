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

function getStatusColor(status: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'completed') return '#16a34a'
  if (s.includes('running') || s === 'campaign_launching') return '#0ea5e9'
  if (s === 'failed') return '#dc2626'
  return '#94a3b8'
}

function PhaseDots({ status }: { status: string }) {
  const activeIdx = getActivePhaseIndex(status)
  const isFailed = (status || '').toLowerCase() === 'failed'

  return (
    <div className="flex items-center gap-1">
      {PHASE_LABELS.map((label, idx) => {
        const done = activeIdx > idx || activeIdx === 5
        const active = activeIdx === idx && !isFailed
        return (
          <div key={label} className="flex items-center gap-1">
            <div
              title={label}
              className={cn('rounded-full transition-all', active && 'animate-pulse')}
              style={{
                width: 6, height: 6,
                background: isFailed ? '#dc2626' : done ? '#16a34a' : active ? '#0ea5e9' : '#e2e8f0',
              }}
            />
            {idx < PHASE_LABELS.length - 1 && (
              <div style={{ width: 10, height: 1, background: done ? '#16a34a' : '#e2e8f0' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function isRunningStatus(status: string) {
  const s = (status || '').toLowerCase()
  return s === 'scouts_running' || s === 'intelligence_running' || s === 'idea_pool_running' || s === 'creative_running' || s === 'campaign_launching'
}

function RunRowCard({ run, tenantId }: { run: PipelineRun; tenantId: string }) {
  const statusColor = getStatusColor(run.status)
  const running = isRunningStatus(run.status)
  const completed = run.status?.toLowerCase() === 'completed'
  const failed = run.status?.toLowerCase() === 'failed'
  const duration = completed
    ? `Done in ${getDuration(run.startedAt, run.completedAt)}`
    : running
    ? `Running · ${getDuration(run.startedAt)}`
    : failed
    ? `Failed · ${getDuration(run.startedAt, run.completedAt)}`
    : ''

  return (
    <Link
      href={`/dashboard/${tenantId}/runs/${run.runId}`}
      className="group flex items-center rounded-xl overflow-hidden transition-all hover:shadow-md"
      style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)', textDecoration: 'none' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0ea5e9' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0' }}
    >
      {/* Left accent bar */}
      <div style={{ width: 4, alignSelf: 'stretch', minHeight: 60, background: statusColor, flexShrink: 0 }} />

      <div className="flex items-center gap-6 px-5 py-4 flex-1 min-w-0 flex-wrap">
        {/* Run ID */}
        <div className="min-w-[120px]">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Run ID</p>
          <code className="text-xs font-mono font-semibold" style={{ color: '#0ea5e9' }}>
            {run.runId.slice(0, 12)}…
          </code>
        </div>

        {/* Status */}
        <div className="min-w-[130px]">
          <StatusBadge status={run.status} />
        </div>

        {/* Phase progress */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#94a3b8' }}>Progress</p>
          <PhaseDots status={run.status} />
        </div>

        {/* Time */}
        <div className="flex-1 min-w-[160px]">
          {run.startedAt && (
            <p className="text-xs" style={{ color: '#94a3b8' }}>
              Started <span style={{ color: '#475569' }}>{formatDateTime(run.startedAt)}</span>
            </p>
          )}
          {duration && (
            <p className="text-xs mt-0.5 font-medium" style={{ color: statusColor }}>{duration}</p>
          )}
        </div>
      </div>

      <div className="pr-4 flex items-center" style={{ color: '#cbd5e1' }}>
        <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  )
}

type TabKey = 'all' | 'running' | 'completed' | 'failed'
const TABS: { key: TabKey; label: string; color: string; bg: string }[] = [
  { key: 'all',       label: 'All',       color: '#475569', bg: '#f1f5f9' },
  { key: 'running',   label: 'Running',   color: '#2563eb', bg: '#dbeafe' },
  { key: 'completed', label: 'Completed', color: '#16a34a', bg: '#dcfce7' },
  { key: 'failed',    label: 'Failed',    color: '#dc2626', bg: '#fee2e2' },
]

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
    <div className="min-h-screen" style={{ background: '#f0f2f5' }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 px-7 py-4 flex items-center justify-between gap-4"
        style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 0 rgba(15,23,42,0.04)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#e0f2fe', border: '1px solid #bae6fd' }}>
            <Activity size={17} style={{ color: '#0ea5e9' }} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold" style={{ color: '#0f172a' }}>Pipeline Runs</h1>
            <p className="text-xs" style={{ color: '#94a3b8' }}>Monitor AI pipeline execution</p>
          </div>
        </div>
        <button
          onClick={() => fetchRuns(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60 hover:border-sky-400 hover:text-sky-600"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569' }}
        >
          <RefreshCw size={13} className={cn(refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="px-7 py-7 max-w-5xl mx-auto animate-fade-up">
        {error && (
          <div className="flex items-center gap-3 rounded-xl p-4 mb-6 text-sm" style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626' }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 stagger">
          {[
            { label: 'Total Runs',   value: total,     icon: <Activity size={16} />,                         color: '#0ea5e9', bg: '#e0f2fe' },
            { label: 'Running',      value: running,   icon: <Loader2 size={16} className={cn(running > 0 && 'animate-spin')} />, color: '#2563eb', bg: '#dbeafe' },
            { label: 'Completed',    value: completed, icon: <CheckCircle2 size={16} />,                      color: '#16a34a', bg: '#dcfce7' },
            { label: 'Failed',       value: failed,    icon: <XCircle size={16} />,                           color: '#dc2626', bg: '#fee2e2' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 animate-fade-up" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{s.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              </div>
              <p className="text-3xl font-bold tabular-nums" style={{ color: '#0f172a' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl mb-5"
          style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-4 py-2 rounded-[9px] text-sm font-medium transition-all flex-1 justify-center"
                style={
                  isActive
                    ? { background: '#fff', color: '#0f172a', boxShadow: '0 1px 4px rgba(15,23,42,0.08)', border: '1px solid #e2e8f0' }
                    : { color: '#64748b', border: '1px solid transparent' }
                }
              >
                {tab.label}
                <span
                  className="rounded-full px-1.5 py-0.5 text-xs font-bold min-w-[20px] text-center"
                  style={{ background: isActive ? tab.bg : '#e2e8f0', color: isActive ? tab.color : '#94a3b8' }}
                >
                  {tabCounts[tab.key]}
                </span>
              </button>
            )
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Loader2 size={28} className="animate-spin" style={{ color: '#0ea5e9' }} />
            <p className="text-sm" style={{ color: '#94a3b8' }}>Loading runs…</p>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="rounded-xl py-16 text-center" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <Clock size={32} className="mx-auto mb-3" style={{ color: '#e2e8f0' }} />
            <p className="text-sm font-semibold" style={{ color: '#64748b' }}>
              {activeTab === 'all' ? 'No pipeline runs yet' : `No ${activeTab} runs`}
            </p>
            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
              {activeTab === 'all' ? 'Trigger a run from the Overview page' : 'Try another filter'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredRuns.map(run => (
              <RunRowCard key={run.runId} run={run} tenantId={tenantId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
