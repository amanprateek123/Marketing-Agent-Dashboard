'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  Megaphone, Wifi, WifiOff, ArrowRight, Play,
  Loader2, CheckCircle, Activity, AlertTriangle,
  Settings, ChevronRight, Clock, Target,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { Company, Campaign, PipelineRun } from '@/types'
import { useRouter } from 'next/navigation'

const API_BASE = 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

export default function DashboardPage({ params }: PageProps) {
  const { tenantId } = use(params)
  const router = useRouter()

  const [company, setCompany]     = useState<Company | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [runs, setRuns]           = useState<PipelineRun[]>([])
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
  const pendingCount    = campaigns.filter(c => c.status === 'pending_approval').length
  const recentCampaigns = [...campaigns]
    .sort((a, b) => new Date(b.launchedAt || 0).getTime() - new Date(a.launchedAt || 0).getTime())
    .slice(0, 6)
  const recentRuns  = [...runs].slice(0, 6)
  const metaConnected = !!(company?.meta?.accessToken)
  const latestRun   = runs[0] ?? null

  const kpis = [
    { label: 'Campaigns', value: String(campaigns.length), tone: 'var(--ink)' },
    { label: 'Total spend', value: formatCurrency(totalSpend), tone: 'var(--ink)' },
    { label: 'Avg ROAS', value: avgRoas > 0 ? `${avgRoas.toFixed(2)}×` : '—',
      tone: avgRoas >= 1.5 ? 'var(--good)' : avgRoas >= 1 ? 'var(--warn)' : avgRoas > 0 ? 'var(--bad)' : 'var(--ink-4)' },
    { label: 'Active now', value: String(activeCampaigns), tone: 'var(--accent)' },
  ]

  return (
    <div className="min-h-screen">
      <div className="px-8 py-8 max-w-6xl mx-auto stagger">

        {/* ── Masthead ─────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-6 flex-wrap mb-2">
          <div className="min-w-0">
            <p className="micro-label mb-2">{company?.industry ?? 'workspace'}{company?.pipelineConfig?.campaignStrategy ? ` · ${company.pipelineConfig.campaignStrategy}` : ''}</p>
            <h1 className="page-title">{company?.name || tenantId}</h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0 pb-1">
            {/* Meta connection */}
            <span className={metaConnected ? 'chip chip-good' : 'chip chip-bad'}>
              {metaConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
              Meta {metaConnected ? 'connected' : 'disconnected'}
            </span>

            {/* Latest run */}
            {latestRun && (
              <Link
                href={`/dashboard/${tenantId}/runs/${latestRun.runId}`}
                className="chip chip-neutral hover:opacity-75 transition-opacity"
              >
                <Activity size={10} />
                <span className="mono">{latestRun.runId.slice(0, 8)}</span>
                <StatusBadge status={latestRun.status} />
              </Link>
            )}

            {/* Trigger */}
            <button
              onClick={handleTrigger}
              disabled={triggerState === 'loading'}
              className={
                triggerState === 'success' ? 'btn chip-good border'
                : triggerState === 'error' ? 'btn btn-danger'
                : 'btn btn-primary'
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
              <span className="text-xs font-medium hidden sm:inline" style={{ color: triggerState === 'success' ? 'var(--good)' : 'var(--bad)' }}>
                {triggerMessage}
              </span>
            )}
          </div>
        </div>

        {/* ── KPI band — serif numerals over a single hairline ─────── */}
        <div className="card px-2 py-5 mb-6 grid grid-cols-2 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <div
              key={k.label}
              className="px-6 py-1"
              style={i > 0 ? { borderLeft: '1px solid var(--hairline-light)' } : undefined}
            >
              <p className="micro-label mb-2">{k.label}</p>
              <p className="display-num text-[34px]" style={{ color: k.tone }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* ── Alerts ───────────────────────────────────────────────── */}
        {companyError && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm mb-5"
            style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}>
            <AlertTriangle size={14} className="shrink-0" /> {companyError}
          </div>
        )}

        {company && !metaConnected && (
          <div className="card flex items-center justify-between gap-4 px-5 py-4 flex-wrap mb-5"
            style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle size={16} style={{ color: 'var(--warn)' }} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--warn)' }}>Meta account not connected</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-2)' }}>Connect your Meta account in Settings to enable pipeline runs.</p>
              </div>
            </div>
            <Link href={`/dashboard/${tenantId}/settings`} className="btn btn-ghost shrink-0">
              <Settings size={12} /> Go to Settings
            </Link>
          </div>
        )}

        {pendingCount > 0 && (
          <div className="card flex items-center justify-between gap-4 px-5 py-4 flex-wrap mb-5"
            style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <Target size={16} style={{ color: 'var(--accent)' }} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--accent-strong)' }}>
                  {pendingCount} campaign{pendingCount !== 1 ? 's' : ''} awaiting your approval
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-2)' }}>Review and approve before they can launch on Meta.</p>
              </div>
            </div>
            <Link href={`/dashboard/${tenantId}/approvals`} className="btn btn-accent shrink-0">
              Review now <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {/* ── Main grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start mb-5">

          {/* Recent campaigns */}
          <div className="xl:col-span-3 card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--hairline-light)' }}>
              <h2 className="section-title">Recent Campaigns</h2>
              <Link href={`/dashboard/${tenantId}/campaigns`}
                className="inline-flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent)' }}>
                View all <ChevronRight size={11} />
              </Link>
            </div>

            {campaignsError ? (
              <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--bad)' }}>{campaignsError}</div>
            ) : recentCampaigns.length === 0 ? (
              <EmptyState icon={Megaphone} title="No campaigns yet" subtitle="Trigger a pipeline run to get started" />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Campaign</th>
                      <th>Status</th>
                      <th className="num">Budget</th>
                      <th className="num">ROAS</th>
                      <th className="num">Launched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCampaigns.map((campaign, idx) => (
                      <tr key={campaign._id || idx} className="group">
                        <td style={{ maxWidth: 0 }}>
                          <Link
                            href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                            className="block text-[13px] font-semibold truncate transition-colors"
                            style={{ color: 'var(--ink)' }}
                            title={campaign.name || campaign.topic || 'Untitled'}
                          >
                            {campaign.name || campaign.topic || 'Untitled'}
                          </Link>
                          {campaign.name && campaign.topic && (
                            <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>{campaign.topic}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap"><StatusBadge status={campaign.status} /></td>
                        <td className="num whitespace-nowrap mono text-[12px]">
                          {campaign.budget ? formatCurrency(campaign.budget) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                        </td>
                        <td className="num whitespace-nowrap">
                          {campaign.roas != null ? (
                            <span className="mono text-[12px] font-semibold" style={{
                              color: campaign.roas >= 2 ? 'var(--good)' : campaign.roas >= 1 ? 'var(--warn)' : 'var(--bad)',
                            }}>
                              {campaign.roas.toFixed(2)}×
                            </span>
                          ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                        </td>
                        <td className="num whitespace-nowrap text-[11px] mono" style={{ color: 'var(--ink-3)' }}>
                          {formatDateTime(campaign.launchedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pipeline runs */}
          <div className="xl:col-span-2 card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--hairline-light)' }}>
              <h2 className="section-title">Pipeline Runs</h2>
              <Link href={`/dashboard/${tenantId}/runs`}
                className="inline-flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent)' }}>
                View all <ChevronRight size={11} />
              </Link>
            </div>

            {recentRuns.length === 0 ? (
              <EmptyState icon={Activity} title="No runs yet" iconSize={24} />
            ) : (
              <div>
                {recentRuns.map((run, i) => (
                  <Link
                    key={run.runId}
                    href={`/dashboard/${tenantId}/runs/${run.runId}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors group"
                    style={{ borderTop: i > 0 ? '1px solid var(--hairline-light)' : 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-warm)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="mono text-xs font-semibold truncate" style={{ color: 'var(--accent)' }}>
                        {run.runId.slice(0, 14)}…
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock size={10} style={{ color: 'var(--ink-4)' }} />
                        <p className="text-[11px] mono" style={{ color: 'var(--ink-3)' }}>
                          {formatDateTime(run.startedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={run.status} />
                      <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--ink-3)' }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Colophon — company profile strip ─────────────────────── */}
        {company && (
          <div className="card px-6 py-4 flex items-center justify-between gap-6 flex-wrap" style={{ background: 'var(--surface-warm)' }}>
            <div className="flex items-center gap-7 flex-wrap min-w-0">
              {company.tone && (
                <div className="min-w-0">
                  <p className="micro-label mb-1">Tone</p>
                  <p className="text-[13px] font-medium capitalize truncate" style={{ color: 'var(--ink)' }}>{company.tone}</p>
                </div>
              )}
              {company.targetAudience && (
                <div className="min-w-0" style={{ maxWidth: 260 }}>
                  <p className="micro-label mb-1">Audience</p>
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }} title={company.targetAudience}>
                    {company.targetAudience}
                  </p>
                </div>
              )}
              {company.products && company.products.length > 0 && (
                <div className="min-w-0">
                  <p className="micro-label mb-1.5">Products</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {company.products.slice(0, 3).map((p, i) => (
                      <span key={i} className="chip chip-neutral truncate" style={{ maxWidth: 140 }} title={p.name}>
                        {p.name}
                      </span>
                    ))}
                    {company.products.length > 3 && (
                      <span className="text-xs" style={{ color: 'var(--ink-3)' }}>+{company.products.length - 3}</span>
                    )}
                  </div>
                </div>
              )}
              {company.meta?.accountId && (
                <div className="min-w-0">
                  <p className="micro-label mb-1">Meta account</p>
                  <code className="mono text-xs" style={{ color: 'var(--ink-2)' }}>{company.meta.accountId}</code>
                </div>
              )}
            </div>

            <Link href={`/dashboard/${tenantId}/settings`}
              className="inline-flex items-center gap-1.5 text-xs font-medium shrink-0 transition-opacity hover:opacity-70"
              style={{ color: 'var(--ink-3)' }}>
              <Settings size={12} /> Edit profile
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
