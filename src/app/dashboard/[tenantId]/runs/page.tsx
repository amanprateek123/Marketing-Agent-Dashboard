'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn, formatDateTime } from '@/lib/utils'
import type { PipelineRun } from '@/types'
import styles from './runs.module.css'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

type TabKey = 'all' | 'running' | 'completed' | 'failed'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All activity' },
  { key: 'running', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Needs attention' },
]

const PHASES = ['Discover', 'Analyze', 'Design', 'Create', 'Prepare', 'Complete']

function getDuration(start?: string, end?: string): string {
  if (!start) return '—'
  const milliseconds = Math.max(0, new Date(end || Date.now()).getTime() - new Date(start).getTime())
  const minutes = Math.floor(milliseconds / 60_000)
  const seconds = Math.floor((milliseconds % 60_000) / 1_000)
  if (minutes === 0) return `${seconds}s`
  if (minutes < 60) return `${minutes}m ${seconds}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function isRunningStatus(status: string) {
  const normalized = (status || '').toLowerCase()
  return normalized !== 'pending' && normalized !== 'completed' && normalized !== 'failed'
}

function getPhase(status: string): { label: string; index: number } {
  switch ((status || '').toLowerCase()) {
    case 'scouts_running':
    case 'research_running':
      return { label: 'Discovering growth signals', index: 0 }
    case 'intelligence_running':
      return { label: 'Analyzing opportunities', index: 1 }
    case 'idea_pool_running':
    case 'digest_running':
      return { label: 'Designing campaign ideas', index: 2 }
    case 'creative_running':
      return { label: 'Creating campaign assets', index: 3 }
    case 'campaign_launching':
      return { label: 'Preparing the campaign', index: 4 }
    case 'completed':
      return { label: 'Automation completed', index: 5 }
    case 'failed':
      return { label: 'Run needs attention', index: 5 }
    default:
      return { label: 'Queued for automation', index: -1 }
  }
}

function RunCard({ run, tenantId, index }: { run: PipelineRun; tenantId: string; index: number }) {
  const normalized = run.status?.toLowerCase()
  const running = isRunningStatus(run.status)
  const completed = normalized === 'completed'
  const failed = normalized === 'failed'
  const duration = getDuration(run.startedAt, completed || failed ? run.completedAt : undefined)
  const phase = getPhase(run.status)
  const iconBackground = completed ? 'var(--good-bg)' : failed ? 'var(--bad-bg)' : running ? 'var(--accent-bg)' : 'var(--muted)'
  const iconColor = completed ? 'var(--good)' : failed ? 'var(--bad)' : running ? 'var(--accent)' : 'var(--ink-3)'

  return (
    <Link
      href={`/dashboard/${tenantId}/runs/${run.runId}`}
      className={cn(styles.runCard, 'group animate-reveal-up')}
      style={{ animationDelay: `${Math.min(index, 5) * 40}ms` }}
      aria-label={`Open automation run ${run.runId}, ${phase.label}`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <span
            className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]', running && 'animate-pulse')}
            style={{ background: iconBackground, color: iconColor }}
            aria-hidden="true"
          >
            {completed ? <CheckCircle2 size={19} /> : failed ? <XCircle size={19} /> : running ? <Loader2 size={19} className="animate-spin" /> : <Clock size={19} />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>{phase.label}</h2>
              <StatusBadge status={run.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--ink-3)' }}>
              <span className="mono">Run {run.runId.slice(0, 10)}</span>
              {run.startedAt && <span>Started {formatDateTime(run.startedAt)}</span>}
            </div>
          </div>

          <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:bg-[var(--accent-bg)] sm:flex" style={{ color: 'var(--accent)' }} aria-hidden="true">
            <ArrowRight size={17} />
          </span>
        </div>

        <div className="mt-5" aria-label={`${PHASES[Math.max(phase.index, 0)]} phase`}>
          <div className={styles.phaseRail} aria-hidden="true">
            {PHASES.map((label, phaseIndex) => (
              <span
                key={label}
                className={cn(
                  styles.phaseSegment,
                  completed && styles.phaseSegmentComplete,
                  failed && phaseIndex <= phase.index && styles.phaseSegmentFailed,
                  !completed && !failed && phaseIndex <= phase.index && styles.phaseSegmentActive,
                )}
              />
            ))}
          </div>
          <div className="mt-2 hidden grid-cols-6 gap-2 text-[10px] font-medium sm:grid" style={{ color: 'var(--ink-3)' }} aria-hidden="true">
            {PHASES.map((label) => <span key={label}>{label}</span>)}
          </div>
        </div>

        {failed && (
          <div className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }}>
            <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Open this run to review the failed phase and available recovery steps.
          </div>
        )}
      </div>

      <div className={styles.auditGrid}>
        <div className={styles.auditCell}>
          <p className="micro-label">Elapsed time</p>
          <p className="mt-1 text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{duration}</p>
        </div>
        <div className={styles.auditCell}>
          <p className="micro-label">Ideas produced</p>
          <p className="mt-1 text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{run.briefsGenerated ?? '—'}</p>
        </div>
        <div className={styles.auditCell}>
          <p className="micro-label">Campaign record</p>
          <p className="mt-1 truncate text-sm font-bold" style={{ color: run.campaignId || run.metaCampaignId ? 'var(--good)' : 'var(--ink-3)' }}>
            {run.campaignId || run.metaCampaignId ? 'Created' : 'Not created'}
          </p>
        </div>
        <div className={styles.auditCell}>
          <p className="micro-label">AI configuration</p>
          <p className="mt-1 text-sm font-bold" style={{ color: 'var(--ink)' }}>{run.promptsVersion ? `Prompt v${run.promptsVersion}` : 'Recorded'}</p>
        </div>
      </div>
    </Link>
  )
}

function RunsLoading() {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">Loading automation history</span>
      {[0, 1, 2].map((item) => <div key={item} className={styles.skeleton} aria-hidden="true" />)}
    </div>
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
      const response = await fetch(`${API_BASE}/pipeline/${tenantId}/runs`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Request failed')
      setRuns(await response.json())
      setError(null)
    } catch {
      setError('We could not load the automation record. Check the connection and try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchRuns() }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = runs.length
  const running = runs.filter((run) => isRunningStatus(run.status)).length
  const completed = runs.filter((run) => run.status?.toLowerCase() === 'completed').length
  const failed = runs.filter((run) => run.status?.toLowerCase() === 'failed').length
  const terminal = completed + failed
  const successRate = terminal > 0 ? Math.round((completed / terminal) * 100) : null

  const filteredRuns = activeTab === 'all' ? runs
    : activeTab === 'running' ? runs.filter((run) => isRunningStatus(run.status))
      : activeTab === 'completed' ? runs.filter((run) => run.status?.toLowerCase() === 'completed')
        : runs.filter((run) => run.status?.toLowerCase() === 'failed')

  const tabCounts: Record<TabKey, number> = { all: total, running, completed, failed }

  const stats = [
    { label: 'All recorded runs', value: total, detail: 'Durable automation history', icon: History, color: 'var(--ink)' },
    { label: 'Working now', value: running, detail: running ? 'AI workflow in progress' : 'No active automation', icon: Activity, color: 'var(--accent)' },
    { label: 'Completion rate', value: successRate == null ? '—' : `${successRate}%`, detail: terminal ? `${terminal} finished runs` : 'Awaiting first outcome', icon: CheckCircle2, color: 'var(--good)' },
    { label: 'Needs attention', value: failed, detail: failed ? 'Open to review recovery' : 'No failed runs', icon: AlertCircle, color: failed ? 'var(--bad)' : 'var(--good)' },
  ]

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className={styles.hero}>
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold" style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-bg)', color: 'var(--accent-strong)' }}>
              <Sparkles size={13} aria-hidden="true" /> Control · Automation
            </div>
            <h1 className="page-title">Automation &amp; audit</h1>
            <p className="page-subtitle max-w-2xl">
              See what Meridian ran, where each workflow is now, and the evidence trail behind every completed campaign operation.
            </p>
          </div>
          <button onClick={() => fetchRuns(true)} disabled={refreshing} className="btn btn-ghost self-start sm:self-auto">
            <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh history'}
          </button>
        </div>

        <div className="mt-7 flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--good-border)', background: 'var(--good-bg)' }}>
          <ShieldCheck size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--good)' }} aria-hidden="true" />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--good)' }}>Traceable by design</p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--ink-2)' }}>
              Every run keeps its identifier, timing, outcome, campaign handoff, and AI configuration so operators can inspect—not guess—what happened.
            </p>
          </div>
        </div>
      </section>

      <section className={cn(styles.stats, 'mt-5')} aria-label="Automation summary">
        {stats.map(({ label, value, detail, icon: Icon, color }) => (
          <div className={styles.stat} key={label}>
            <div className="flex items-center justify-between gap-3">
              <p className="micro-label">{label}</p>
              <Icon size={15} style={{ color }} aria-hidden="true" />
            </div>
            <p className="display-num mt-3 text-[28px]" style={{ color }}>{value}</p>
            <p className="mt-1.5 truncate text-[11px]" style={{ color: 'var(--ink-3)' }}>{detail}</p>
          </div>
        ))}
      </section>

      <section className="mt-8" aria-labelledby="run-history-title">
        <div className="flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-end" style={{ borderColor: 'var(--hairline)' }}>
          <div>
            <h2 id="run-history-title" className="section-title">Run history</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--ink-3)' }}>Open any run for its phase-by-phase record and outputs.</p>
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-white p-1" style={{ borderColor: 'var(--hairline)' }} role="group" aria-label="Filter automation runs">
            {TABS.map((tab) => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  aria-pressed={active}
                  className="min-h-9 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors"
                  style={active ? { background: 'var(--accent-bg)', color: 'var(--accent-strong)' } : { color: 'var(--ink-3)' }}
                >
                  {tab.label} <span className="ml-1 tabular-nums">{tabCounts[tab.key]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center" style={{ background: 'var(--bad-bg)', borderColor: 'var(--bad-border)' }} role="alert">
            <div className="flex items-start gap-3 text-sm" style={{ color: 'var(--bad)' }}>
              <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
            </div>
            <button type="button" onClick={() => fetchRuns(true)} className="btn btn-ghost self-start">Try again</button>
          </div>
        )}

        <div className="mt-5">
          {loading ? (
            <RunsLoading />
          ) : filteredRuns.length === 0 ? (
            <div className="card px-5 py-16 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                <Activity size={22} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold" style={{ color: 'var(--ink)' }}>
                {activeTab === 'all' ? 'Your automation record starts here' : `No ${activeTab === 'running' ? 'in-progress' : activeTab} runs`}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: 'var(--ink-3)' }}>
                {activeTab === 'all'
                  ? 'Ask Campaign Copilot to prepare a growth campaign. Its automated workflow will appear here with a complete audit trail.'
                  : 'There is nothing in this view right now. Choose another filter to inspect the full history.'}
              </p>
              {activeTab === 'all' ? (
                <Link href={`/dashboard/${tenantId}/campaign-copilot`} className="btn btn-accent mt-5">
                  Start with Copilot <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ) : (
                <button type="button" onClick={() => setActiveTab('all')} className="btn btn-ghost mt-5">Show all activity</button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRuns.map((run, index) => (
                <RunCard key={run.runId} run={run} tenantId={tenantId} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
