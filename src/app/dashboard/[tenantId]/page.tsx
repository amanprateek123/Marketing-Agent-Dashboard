'use client'

import { useState, useEffect, use, useMemo } from 'react'
import Link from 'next/link'
import {
  Megaphone, Wifi, WifiOff, ArrowRight, Play,
  Loader2, CheckCircle, Activity, AlertTriangle,
  Settings, ChevronRight, Inbox, Zap, Rocket, Radio,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/lib/utils'
import { getActionOutcomes } from '@/lib/api'
import type { Company, Campaign, PipelineRun, ExecutedActionRecord } from '@/types'
import { useRouter } from 'next/navigation'

const API_BASE = 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

/* One unified event stream synthesized from runs + launches + optimizer
   actions — the "what has my agent been doing" answer at a glance. */
interface FeedItem {
  t: number
  time: string
  kind: 'run' | 'launch' | 'action'
  label: string
  detail: string
  href?: string
  chip?: { text: string; cls: string }
}

const KIND_META: Record<FeedItem['kind'], { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>; color: string }> = {
  run:    { icon: Activity, color: 'var(--accent-strong)' },
  launch: { icon: Rocket,   color: 'var(--good)' },
  action: { icon: Zap,      color: 'var(--warn)' },
}

export default function DashboardPage({ params }: PageProps) {
  const { tenantId } = use(params)
  const router = useRouter()

  const [company, setCompany]     = useState<Company | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [runs, setRuns]           = useState<PipelineRun[]>([])
  const [actions, setActions]     = useState<ExecutedActionRecord[]>([])
  const [companyError, setCompanyError]     = useState<string | null>(null)
  const [campaignsError, setCampaignsError] = useState<string | null>(null)
  const [triggerState, setTriggerState]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [triggerMessage, setTriggerMessage] = useState('')

  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await fetch(`${API_BASE}/companies/${tenantId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setCompany(await res.json())
      } catch (err) {
        setCompanyError(err instanceof Error ? err.message : 'Failed to load company')
      }
      try {
        const res = await fetch(`${API_BASE}/campaigns/${tenantId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setCampaigns(await res.json())
      } catch (err) {
        setCampaignsError(err instanceof Error ? err.message : 'Failed to load campaigns')
      }
      try {
        const res = await fetch(`${API_BASE}/pipeline/${tenantId}/runs`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setRuns(await res.json())
      } catch { /* non-critical */ }
      try {
        const out = await getActionOutcomes(tenantId)
        setActions(out.recent ?? [])
      } catch { /* non-critical — feed degrades to runs+launches */ }
    }
    fetchAll()
  }, [tenantId])

  async function handleTrigger() {
    setTriggerState('loading')
    setTriggerMessage('')
    try {
      const res = await fetch(`${API_BASE}/pipeline/${tenantId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTriggerState('success')
      const newRunId: string | undefined = data?.runId
      setTriggerMessage(newRunId ? 'Run started' : 'Pipeline triggered!')
      if (newRunId) setTimeout(() => router.push(`/dashboard/${tenantId}/runs/${newRunId}`), 900)
      else setTimeout(() => setTriggerState('idle'), 5000)
    } catch (err) {
      setTriggerState('error')
      setTriggerMessage(err instanceof Error ? err.message : 'Failed')
      setTimeout(() => setTriggerState('idle'), 4000)
    }
  }

  const totalSpend      = campaigns.reduce((s, c) => s + (c.spend || 0), 0)
  const allRoas         = campaigns.filter(c => c.roas && c.roas > 0).map(c => c.roas as number)
  const avgRoas         = allRoas.length ? allRoas.reduce((a, b) => a + b, 0) / allRoas.length : 0
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length
  const pendingList     = campaigns.filter(c => c.status === 'pending_approval')
  const metaConnected   = !!(company?.meta?.accessToken)

  const recentCampaigns = [...campaigns]
    .sort((a, b) => new Date(b.launchedAt || 0).getTime() - new Date(a.launchedAt || 0).getTime())
    .slice(0, 7)

  /* The machine's most confident recent learning, in its own voice */
  const topInsight = useMemo(() => {
    const insights = company?.learnings?.causalInsights ?? []
    return [...insights].sort((a, b) => (b.confidence * Math.log(1 + b.dataPoints)) - (a.confidence * Math.log(1 + a.dataPoints)))[0] ?? null
  }, [company])

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = []
    for (const r of runs.slice(0, 10)) {
      const t = new Date(r.startedAt ?? 0).getTime()
      if (!t) continue
      items.push({
        t, time: formatRelativeTime(r.startedAt!),
        kind: 'run',
        label: 'pipeline',
        detail: `${r.runId.slice(0, 8)} · ${r.status.replace(/_/g, ' ')}`,
        href: `/dashboard/${tenantId}/runs/${r.runId}`,
        chip: r.status === 'failed' ? { text: 'FAILED', cls: 'chip-bad' }
            : r.status === 'completed' ? { text: 'DONE', cls: 'chip-good' }
            : { text: 'LIVE', cls: 'chip-accent' },
      })
    }
    for (const c of campaigns) {
      const t = new Date(c.launchedAt ?? 0).getTime()
      if (!t) continue
      items.push({
        t, time: formatRelativeTime(c.launchedAt!),
        kind: 'launch',
        label: 'launch',
        detail: c.name || c.topic || 'campaign',
        href: `/dashboard/${tenantId}/campaigns/${c._id}`,
        chip: { text: (c.status ?? '').replace(/_/g, ' ').toUpperCase().slice(0, 12), cls: c.status === 'active' ? 'chip-good' : 'chip-neutral' },
      })
    }
    for (const a of actions) {
      const t = new Date(a.executedAt ?? 0).getTime()
      if (!t) continue
      items.push({
        t, time: formatRelativeTime(a.executedAt),
        kind: 'action',
        label: a.action.type.replace(/_/g, ' '),
        detail: a.action.targetName ?? a.action.targetId,
        href: `/dashboard/${tenantId}/campaigns/${a.campaignId}`,
        chip: a.status === 'final' && a.outcomeLabel
          ? { text: a.outcomeLabel.toUpperCase(), cls: a.outcomeLabel === 'improved' ? 'chip-good' : a.outcomeLabel === 'worsened' ? 'chip-bad' : 'chip-neutral' }
          : { text: '+72H PENDING', cls: 'chip-accent' },
      })
    }
    return items.sort((a, b) => b.t - a.t).slice(0, 14)
  }, [runs, campaigns, actions, tenantId])

  const kpis = [
    { label: 'Total spend', value: formatCurrency(totalSpend), tone: 'var(--ink)', sub: `${campaigns.length} campaigns all-time` },
    { label: 'Avg ROAS', value: avgRoas > 0 ? `${avgRoas.toFixed(2)}×` : '—',
      tone: avgRoas >= 1.5 ? 'var(--good)' : avgRoas >= 1 ? 'var(--warn)' : avgRoas > 0 ? 'var(--bad)' : 'var(--ink-4)',
      sub: `${allRoas.length} measured` },
    { label: 'Active', value: String(activeCampaigns), tone: 'var(--accent-strong)', sub: 'spending now' },
    { label: 'Queue', value: String(pendingList.length), tone: pendingList.length > 0 ? 'var(--warn)' : 'var(--ink-4)', sub: 'awaiting approval' },
  ]

  return (
    <div className="min-h-screen">
      {/* ── Status bar ───────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: 'rgba(12,10,9,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--hairline)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="beacon" />
          <div className="min-w-0">
            <p className="mono text-[13px] font-semibold tracking-wide truncate" style={{ color: 'var(--ink)' }}>
              {(company?.name || tenantId).toUpperCase()}
            </p>
            <p className="mono text-[9.5px] tracking-widest" style={{ color: 'var(--ink-3)' }}>
              {company?.industry?.toUpperCase() ?? 'WORKSPACE'}{company?.pipelineConfig?.campaignStrategy ? ` · ${company.pipelineConfig.campaignStrategy.toUpperCase()}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <span className={metaConnected ? 'chip chip-good' : 'chip chip-bad'}>
            {metaConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
            META {metaConnected ? 'LINKED' : 'OFFLINE'}
          </span>
          <button
            onClick={handleTrigger}
            disabled={triggerState === 'loading'}
            className={
              triggerState === 'success' ? 'btn chip-good border'
              : triggerState === 'error' ? 'btn btn-danger'
              : 'btn btn-accent'
            }
          >
            {triggerState === 'loading' ? <Loader2 size={13} className="animate-spin" />
             : triggerState === 'success' ? <CheckCircle size={13} />
             : <Play size={12} fill="currentColor" />}
            {triggerState === 'loading' ? 'Starting…'
              : triggerState === 'success' ? 'Started'
              : triggerState === 'error' ? 'Retry'
              : 'Run Pipeline'}
          </button>
          {triggerMessage && (
            <span className="mono text-[11px] hidden sm:inline" style={{ color: triggerState === 'success' ? 'var(--good)' : 'var(--bad)' }}>
              {triggerMessage}
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto stagger">

        {/* ── Alerts ─────────────────────────────────────────────────── */}
        {companyError && (
          <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm mb-5"
            style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}>
            <AlertTriangle size={14} className="shrink-0" /> {companyError}
          </div>
        )}
        {company && !metaConnected && (
          <div className="card flex items-center justify-between gap-4 px-5 py-3.5 flex-wrap mb-5"
            style={{ borderColor: 'var(--warn-border)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle size={15} style={{ color: 'var(--warn)' }} className="shrink-0" />
              <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                <span className="font-semibold" style={{ color: 'var(--warn)' }}>Meta not connected.</span> Pipeline runs can&apos;t launch campaigns.
              </p>
            </div>
            <Link href={`/dashboard/${tenantId}/settings`} className="btn btn-ghost shrink-0">
              <Settings size={12} /> Config
            </Link>
          </div>
        )}

        {/* ── KPI strip ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {kpis.map((k) => (
            <div key={k.label} className="card px-5 py-4">
              <p className="micro-label mb-2.5">{k.label}</p>
              <p className="display-num text-[30px]" style={{ color: k.tone }}>{k.value}</p>
              <p className="mono text-[10px] mt-2" style={{ color: 'var(--ink-4)' }}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Main grid: feed + right rail ───────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start mb-5">

          {/* LIVE FEED — the agent's activity stream */}
          <div className="xl:col-span-2 card overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Radio size={13} style={{ color: 'var(--accent-strong)' }} />
              <h2 className="section-title">Live Feed</h2>
              <span className="mono text-[10px] ml-auto" style={{ color: 'var(--ink-4)' }}>
                runs · launches · optimizer actions
              </span>
            </div>

            {feed.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No activity yet — run the pipeline to wake the agent.</p>
              </div>
            ) : (
              <div>
                {feed.map((item, i) => {
                  const Meta = KIND_META[item.kind]
                  const Icon = Meta.icon
                  const inner = (
                    <div
                      className="flex items-center gap-3 px-5 py-2.5 animate-feed-in transition-colors"
                      style={{ borderTop: i > 0 ? '1px solid var(--hairline-light)' : 'none', animationDelay: `${Math.min(i * 30, 300)}ms` }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="mono text-[10px] w-16 shrink-0 tabular-nums" style={{ color: 'var(--ink-4)' }}>
                        {item.time}
                      </span>
                      <Icon size={12} style={{ color: Meta.color }} className="shrink-0" />
                      <span className="mono text-[11px] w-28 shrink-0 truncate" style={{ color: Meta.color }}>
                        {item.label}
                      </span>
                      <span className="text-[12.5px] flex-1 min-w-0 truncate" style={{ color: 'var(--ink-2)' }} title={item.detail}>
                        {item.detail}
                      </span>
                      {item.chip && <span className={`chip ${item.chip.cls} shrink-0`}>{item.chip.text}</span>}
                    </div>
                  )
                  return item.href
                    ? <Link key={`${item.kind}-${item.t}-${i}`} href={item.href} className="block">{inner}</Link>
                    : <div key={`${item.kind}-${item.t}-${i}`}>{inner}</div>
                })}
              </div>
            )}
          </div>

          {/* Right rail */}
          <div className="flex flex-col gap-4">

            {/* Approval queue */}
            <div className="card overflow-hidden" style={pendingList.length > 0 ? { borderColor: 'var(--warn-border)' } : undefined}>
              <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Inbox size={13} style={{ color: pendingList.length > 0 ? 'var(--warn)' : 'var(--ink-3)' }} />
                <h2 className="section-title">Approval Queue</h2>
                <span className="mono text-[11px] ml-auto font-bold" style={{ color: pendingList.length > 0 ? 'var(--warn)' : 'var(--ink-4)' }}>
                  {pendingList.length}
                </span>
              </div>
              {pendingList.length === 0 ? (
                <p className="px-4 py-5 text-xs" style={{ color: 'var(--ink-4)' }}>Queue clear — nothing waiting on you.</p>
              ) : (
                <div>
                  {pendingList.slice(0, 4).map((c, i) => (
                    <Link key={c._id} href={`/dashboard/${tenantId}/approvals`}
                      className="flex items-center gap-2.5 px-4 py-2.5 transition-colors"
                      style={{ borderTop: i > 0 ? '1px solid var(--hairline-light)' : 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="text-[12px] flex-1 min-w-0 truncate" style={{ color: 'var(--ink-2)' }}>
                        {c.name || c.topic || 'Untitled'}
                      </span>
                      <span className="mono text-[10px] shrink-0" style={{ color: 'var(--ink-4)' }}>
                        {c.budget ? formatCurrency(c.budget) : ''}
                      </span>
                      <ArrowRight size={11} style={{ color: 'var(--warn)' }} className="shrink-0" />
                    </Link>
                  ))}
                  <Link href={`/dashboard/${tenantId}/approvals`}
                    className="block px-4 py-2.5 text-center mono text-[10.5px] font-semibold tracking-wider transition-opacity hover:opacity-75"
                    style={{ borderTop: '1px solid var(--hairline-light)', color: 'var(--warn)' }}>
                    REVIEW QUEUE →
                  </Link>
                </div>
              )}
            </div>

            {/* The machine's voice — top causal learning as a pull-quote */}
            {topInsight && (
              <div className="card px-5 py-4" style={{ background: 'var(--surface-warm)' }}>
                <p className="micro-label mb-3">Latest conviction</p>
                <p className="insight-quote">&ldquo;{topInsight.finding}&rdquo;</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="chip chip-accent">{(topInsight.confidence * 100).toFixed(0)}% CONF</span>
                  <span className="mono text-[10px]" style={{ color: 'var(--ink-4)' }}>n={topInsight.dataPoints}</span>
                  <Link href={`/dashboard/${tenantId}/learnings`}
                    className="mono text-[10px] ml-auto transition-opacity hover:opacity-75"
                    style={{ color: 'var(--accent-strong)' }}>
                    ALL LEARNINGS →
                  </Link>
                </div>
              </div>
            )}

            {/* Intelligence shortcut */}
            <Link href={`/dashboard/${tenantId}/intelligence`}
              className="card card-hover px-5 py-3.5 flex items-center gap-3">
              <Zap size={14} style={{ color: 'var(--accent-strong)' }} />
              <div className="flex-1">
                <p className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>System Intelligence</p>
                <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Action outcomes · regret · signal accuracy</p>
              </div>
              <ChevronRight size={13} style={{ color: 'var(--ink-4)' }} />
            </Link>
          </div>
        </div>

        {/* ── Campaign board ─────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <div className="flex items-center gap-2.5">
              <Megaphone size={13} style={{ color: 'var(--ink-3)' }} />
              <h2 className="section-title">Campaign Board</h2>
            </div>
            <Link href={`/dashboard/${tenantId}/campaigns`}
              className="mono text-[10.5px] font-semibold tracking-wider transition-opacity hover:opacity-75"
              style={{ color: 'var(--accent-strong)' }}>
              ALL CAMPAIGNS →
            </Link>
          </div>

          {campaignsError ? (
            <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--bad)' }}>{campaignsError}</div>
          ) : recentCampaigns.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No campaigns yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '38%' }}>Campaign</th>
                    <th>Status</th>
                    <th className="num">Budget</th>
                    <th className="num">Spend</th>
                    <th className="num">ROAS</th>
                    <th className="num">Launched</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCampaigns.map((campaign, idx) => (
                    <tr key={campaign._id || idx}>
                      <td style={{ maxWidth: 0 }}>
                        <Link href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                          className="block text-[12.5px] font-semibold truncate transition-opacity hover:opacity-75"
                          style={{ color: 'var(--ink)' }}
                          title={campaign.name || campaign.topic || 'Untitled'}>
                          {campaign.name || campaign.topic || 'Untitled'}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap"><StatusBadge status={campaign.status} /></td>
                      <td className="num whitespace-nowrap mono text-[11.5px]">
                        {campaign.budget ? formatCurrency(campaign.budget) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </td>
                      <td className="num whitespace-nowrap mono text-[11.5px]">
                        {campaign.spend ? formatCurrency(campaign.spend) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </td>
                      <td className="num whitespace-nowrap">
                        {campaign.roas != null ? (
                          <span className="mono text-[11.5px] font-bold" style={{
                            color: campaign.roas >= 2 ? 'var(--good)' : campaign.roas >= 1 ? 'var(--warn)' : 'var(--bad)',
                          }}>
                            {campaign.roas.toFixed(2)}×
                          </span>
                        ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </td>
                      <td className="num whitespace-nowrap mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                        {formatDateTime(campaign.launchedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
