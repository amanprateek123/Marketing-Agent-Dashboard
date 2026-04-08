'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  Megaphone, TrendingUp, DollarSign, BarChart3,
  Wifi, WifiOff, Building2, ArrowRight, Play,
  Loader2, CheckCircle, Activity, AlertTriangle,
  Settings, ChevronRight,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { MetricCard } from '@/components/ui/MetricCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import type { Company, Campaign, PipelineRun } from '@/types'
import { useRouter } from 'next/navigation'

const API_BASE = 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

export default function DashboardPage({ params }: PageProps) {
  const { tenantId } = use(params)
  const router = useRouter()

  const [company, setCompany]       = useState<Company | null>(null)
  const [campaigns, setCampaigns]   = useState<Campaign[]>([])
  const [runs, setRuns]             = useState<PipelineRun[]>([])
  const [companyError, setCompanyError]   = useState<string | null>(null)
  const [campaignsError, setCampaignsError] = useState<string | null>(null)
  const [triggerState, setTriggerState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
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
      setTriggerMessage(newRunId ? `Run started` : 'Pipeline triggered!')
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
  const recentCampaigns = [...campaigns]
    .sort((a, b) => new Date(b.launchedAt || 0).getTime() - new Date(a.launchedAt || 0).getTime())
    .slice(0, 5)
  const recentRuns      = [...runs].slice(0, 5)
  const metaConnected   = !!(company?.meta?.accessToken)
  const latestRun       = runs[0] ?? null

  return (
    <div className="min-h-screen" style={{ background: '#f0f2f5' }}>
      {/* ── Page Top Bar ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 px-7 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 0 rgba(15,23,42,0.04)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}
          >
            <Building2 size={17} style={{ color: '#0ea5e9' }} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold leading-tight" style={{ color: '#0f172a' }}>
              {company?.name || tenantId}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {company?.industry && (
                <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ background: '#f1f5f9', color: '#64748b' }}>
                  {company.industry}
                </span>
              )}
              {company?.pipelineConfig?.campaignStrategy && (
                <span className="text-[11px] px-2 py-0.5 rounded font-medium capitalize" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                  {company.pipelineConfig.campaignStrategy}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Meta status pill */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={metaConnected
              ? { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a' }
              : { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: metaConnected ? '#22c55e' : '#ef4444' }} />
            {metaConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            Meta {metaConnected ? 'Connected' : 'Disconnected'}
          </div>

          {/* Latest run chip */}
          {latestRun && (
            <Link
              href={`/dashboard/${tenantId}/runs/${latestRun.runId}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:border-sky-300"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569' }}
            >
              <Activity size={12} />
              <span className="font-mono">{latestRun.runId.slice(0, 8)}</span>
              <StatusBadge status={latestRun.status} />
            </Link>
          )}

          {/* Trigger button */}
          <button
            onClick={handleTrigger}
            disabled={triggerState === 'loading'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
            style={
              triggerState === 'success' ? { background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }
              : triggerState === 'error'   ? { background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }
              : triggerState === 'loading' ? { background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd' }
              : { background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#ffffff', boxShadow: '0 2px 8px rgba(14,165,233,0.35)', border: '1px solid transparent' }
            }
          >
            {triggerState === 'loading' ? <Loader2 size={14} className="animate-spin" />
             : triggerState === 'success' ? <CheckCircle size={14} />
             : <Play size={14} fill="currentColor" />}
            {triggerState === 'loading' ? 'Triggering…' : triggerState === 'success' ? 'Triggered!' : triggerState === 'error' ? 'Retry' : 'Run Pipeline'}
          </button>
          {triggerMessage && (
            <span className="text-xs font-medium" style={{ color: triggerState === 'success' ? '#16a34a' : '#dc2626' }}>
              {triggerMessage}
            </span>
          )}
        </div>
      </div>

      <div className="px-7 py-7 max-w-6xl mx-auto animate-fade-up">
        {/* ── Alerts ───────────────────────────────────────────────────── */}
        {companyError && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5 text-sm" style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626' }}>
            <AlertTriangle size={15} /> {companyError}
          </div>
        )}

        {company && !metaConnected && (
          <div
            className="flex items-center justify-between gap-4 rounded-xl px-5 py-4 mb-6 flex-wrap"
            style={{ background: '#fffbeb', border: '1px solid #fcd34d', boxShadow: '0 1px 4px rgba(217,119,6,0.08)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#fef3c7' }}>
                <AlertTriangle size={15} style={{ color: '#d97706' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#92400e' }}>Meta account not connected</p>
                <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>Connect your Meta account in Settings to enable pipeline runs.</p>
              </div>
            </div>
            <Link
              href={`/dashboard/${tenantId}/settings`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: '#d97706', color: '#ffffff' }}
            >
              <Settings size={11} /> Settings
            </Link>
          </div>
        )}

        {/* ── Metrics ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7 stagger">
          <MetricCard icon={Megaphone} value={campaigns.length} label="Total Campaigns"
            iconColor="#475569" iconBg="#f1f5f9" className="animate-fade-up" />
          <MetricCard icon={DollarSign} value={formatCurrency(totalSpend)} label="Total Spend"
            iconColor="#16a34a" iconBg="#dcfce7" accentColor="#22c55e" className="animate-fade-up" />
          <MetricCard icon={TrendingUp} value={avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : '—'} label="Avg ROAS"
            iconColor="#d97706" iconBg="#fef3c7" accentColor="#f59e0b" className="animate-fade-up" />
          <MetricCard icon={BarChart3} value={activeCampaigns} label="Active Campaigns"
            iconColor="#0ea5e9" iconBg="#e0f2fe" accentColor="#0ea5e9" className="animate-fade-up" />
        </div>

        {/* ── Two-column lower section ─────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* Recent Campaigns — wider */}
          <div
            className="xl:col-span-3 rounded-xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid #f1f5f9' }}
            >
              <div className="flex items-center gap-2">
                <Megaphone size={14} style={{ color: '#94a3b8' }} />
                <h2 className="text-sm font-semibold" style={{ color: '#0f172a' }}>Recent Campaigns</h2>
              </div>
              <Link
                href={`/dashboard/${tenantId}/campaigns`}
                className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity"
                style={{ color: '#0ea5e9' }}
              >
                View all <ChevronRight size={12} />
              </Link>
            </div>

            {campaignsError ? (
              <div className="px-5 py-10 text-center text-sm" style={{ color: '#dc2626' }}>{campaignsError}</div>
            ) : recentCampaigns.length === 0 ? (
              <EmptyState icon={Megaphone} title="No campaigns yet" subtitle="Trigger a pipeline run to get started" />
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    {['Campaign', 'Status', 'Budget', 'ROAS', 'Launched'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider ${i > 1 ? 'text-right' : 'text-left'}`}
                        style={{ color: '#94a3b8' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentCampaigns.map((campaign, idx) => (
                    <tr
                      key={campaign._id || idx}
                      className="group transition-colors hover:bg-slate-50"
                      style={{ borderBottom: '1px solid #f8fafc' }}
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                          className="text-sm font-medium hover:text-sky-600 transition-colors"
                          style={{ color: '#0f172a' }}
                        >
                          {campaign.name || campaign.topic || 'Untitled'}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={campaign.status} /></td>
                      <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#475569' }}>
                        {campaign.budget ? formatCurrency(campaign.budget) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {campaign.roas != null ? (
                          <span className="text-sm font-bold tabular-nums" style={{ color: campaign.roas >= 2 ? '#16a34a' : campaign.roas >= 1 ? '#d97706' : '#dc2626' }}>
                            {campaign.roas.toFixed(2)}x
                          </span>
                        ) : <span className="text-sm" style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs tabular-nums" style={{ color: '#94a3b8' }}>
                        {formatDateTime(campaign.launchedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent Runs — narrower */}
          <div
            className="xl:col-span-2 rounded-xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid #f1f5f9' }}
            >
              <div className="flex items-center gap-2">
                <Activity size={14} style={{ color: '#94a3b8' }} />
                <h2 className="text-sm font-semibold" style={{ color: '#0f172a' }}>Pipeline Runs</h2>
              </div>
              <Link
                href={`/dashboard/${tenantId}/runs`}
                className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity"
                style={{ color: '#0ea5e9' }}
              >
                View all <ChevronRight size={12} />
              </Link>
            </div>

            {recentRuns.length === 0 ? (
              <EmptyState icon={Activity} title="No runs yet" iconSize={24} />
            ) : (
              <div className="flex flex-col divide-y" style={{ borderColor: '#f8fafc' }}>
                {recentRuns.map((run) => (
                  <Link
                    key={run.runId}
                    href={`/dashboard/${tenantId}/runs/${run.runId}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-medium truncate" style={{ color: '#0ea5e9' }}>
                        {run.runId.slice(0, 12)}…
                      </p>
                      <p className="text-[11px] mt-0.5 tabular-nums" style={{ color: '#94a3b8' }}>
                        {formatDateTime(run.startedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={run.status} />
                      <ArrowRight size={13} style={{ color: '#cbd5e1' }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
