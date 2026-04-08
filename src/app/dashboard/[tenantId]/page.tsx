'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  Megaphone, TrendingUp, DollarSign, BarChart3,
  Wifi, WifiOff, Building2, ArrowRight, Play,
  Loader2, CheckCircle, Activity, AlertTriangle,
  Settings, ChevronRight, Clock, Target,
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

  return (
    <div className="min-h-screen" style={{ background: '#f4f6f9' }}>

      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 0 rgba(15,23,42,0.04)' }}
      >
        {/* Company identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}
          >
            <Building2 size={16} style={{ color: '#0ea5e9' }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold leading-tight truncate" style={{ color: '#0f172a' }}>
              {company?.name || tenantId}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {company?.industry && (
                <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ background: '#f1f5f9', color: '#64748b' }}>
                  {company.industry}
                </span>
              )}
              {company?.pipelineConfig?.campaignStrategy && (
                <span className="text-[11px] px-1.5 py-0.5 rounded font-medium capitalize" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                  {company.pipelineConfig.campaignStrategy}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Meta status */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={metaConnected
              ? { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a' }
              : { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: metaConnected ? '#22c55e' : '#ef4444' }} />
            {metaConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            <span className="hidden sm:inline">Meta</span> {metaConnected ? 'Connected' : 'Disconnected'}
          </div>

          {/* Latest run chip */}
          {latestRun && (
            <Link
              href={`/dashboard/${tenantId}/runs/${latestRun.runId}`}
              className="hidden md:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:border-sky-300"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}
            >
              <Activity size={11} />
              <span className="font-mono">{latestRun.runId.slice(0, 8)}</span>
              <StatusBadge status={latestRun.status} />
            </Link>
          )}

          {/* Trigger */}
          <button
            onClick={handleTrigger}
            disabled={triggerState === 'loading'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
            style={
              triggerState === 'success' ? { background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }
              : triggerState === 'error'   ? { background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }
              : triggerState === 'loading' ? { background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd' }
              : { background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#ffffff', boxShadow: '0 2px 8px rgba(14,165,233,0.30)', border: '1px solid transparent' }
            }
          >
            {triggerState === 'loading' ? <Loader2 size={13} className="animate-spin" />
             : triggerState === 'success' ? <CheckCircle size={13} />
             : <Play size={13} fill="currentColor" />}
            {triggerState === 'loading' ? 'Starting…'
              : triggerState === 'success' ? 'Started!'
              : triggerState === 'error' ? 'Retry'
              : 'Run Pipeline'}
          </button>

          {triggerMessage && (
            <span className="text-xs font-medium hidden sm:inline" style={{ color: triggerState === 'success' ? '#16a34a' : '#dc2626' }}>
              {triggerMessage}
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto animate-fade-up space-y-5">

        {/* ── Error alerts ─────────────────────────────────────────── */}
        {companyError && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626' }}>
            <AlertTriangle size={14} className="shrink-0" /> {companyError}
          </div>
        )}

        {/* ── Meta not connected banner ─────────────────────────── */}
        {company && !metaConnected && (
          <div
            className="flex items-center justify-between gap-4 rounded-xl px-5 py-4 flex-wrap"
            style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#fef3c7' }}>
                <AlertTriangle size={14} style={{ color: '#d97706' }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#92400e' }}>Meta account not connected</p>
                <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>Connect your Meta account in Settings to enable pipeline runs.</p>
              </div>
            </div>
            <Link
              href={`/dashboard/${tenantId}/settings`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
              style={{ background: '#d97706', color: '#ffffff' }}
            >
              <Settings size={11} /> Go to Settings
            </Link>
          </div>
        )}

        {/* ── Pending approval banner ───────────────────────────── */}
        {pendingCount > 0 && (
          <div
            className="flex items-center justify-between gap-4 rounded-xl px-5 py-4 flex-wrap"
            style={{ background: '#fffbeb', border: '2px solid #fbbf24' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#fef3c7' }}>
                <Target size={14} style={{ color: '#f59e0b' }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                  {pendingCount} campaign{pendingCount !== 1 ? 's' : ''} need{pendingCount === 1 ? 's' : ''} your approval
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>Review and approve before they can launch on Meta.</p>
              </div>
            </div>
            <Link
              href={`/dashboard/${tenantId}/campaigns?filter=pending_approval`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
              style={{ background: '#f59e0b', color: '#ffffff' }}
            >
              Review now <ChevronRight size={11} />
            </Link>
          </div>
        )}

        {/* ── Metric cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={Megaphone}
            value={campaigns.length}
            label="Total Campaigns"
            iconColor="#475569"
            iconBg="#f1f5f9"
          />
          <MetricCard
            icon={DollarSign}
            value={formatCurrency(totalSpend)}
            label="Total Spend"
            iconColor="#16a34a"
            iconBg="#dcfce7"
            accentColor="#22c55e"
          />
          <MetricCard
            icon={TrendingUp}
            value={avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : '—'}
            label="Avg ROAS"
            iconColor="#d97706"
            iconBg="#fef3c7"
            accentColor="#f59e0b"
          />
          <MetricCard
            icon={BarChart3}
            value={activeCampaigns}
            label="Active Campaigns"
            iconColor="#0ea5e9"
            iconBg="#e0f2fe"
            accentColor="#0ea5e9"
          />
        </div>

        {/* ── Main content grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">

          {/* Recent Campaigns — wider */}
          <div
            className="xl:col-span-3 rounded-xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#f0f9ff' }}>
                  <Megaphone size={12} style={{ color: '#0ea5e9' }} />
                </div>
                <h2 className="text-sm font-semibold" style={{ color: '#0f172a' }}>Recent Campaigns</h2>
                {recentCampaigns.length > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#f1f5f9', color: '#64748b' }}>
                    {recentCampaigns.length}
                  </span>
                )}
              </div>
              <Link
                href={`/dashboard/${tenantId}/campaigns`}
                className="inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: '#0ea5e9' }}
              >
                View all <ChevronRight size={11} />
              </Link>
            </div>

            {campaignsError ? (
              <div className="px-5 py-10 text-center text-sm" style={{ color: '#dc2626' }}>{campaignsError}</div>
            ) : recentCampaigns.length === 0 ? (
              <EmptyState icon={Megaphone} title="No campaigns yet" subtitle="Trigger a pipeline run to get started" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8', width: '40%' }}>
                        Campaign
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                        Budget
                      </th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                        ROAS
                      </th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                        Launched
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCampaigns.map((campaign, idx) => (
                      <tr
                        key={campaign._id || idx}
                        className="group transition-colors hover:bg-slate-50"
                        style={{ borderBottom: idx < recentCampaigns.length - 1 ? '1px solid #f8fafc' : 'none' }}
                      >
                        {/* Name */}
                        <td className="px-5 py-3" style={{ maxWidth: 0 }}>
                          <Link
                            href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                            className="block text-sm font-medium truncate hover:text-sky-600 transition-colors"
                            style={{ color: '#0f172a' }}
                            title={campaign.name || campaign.topic || 'Untitled'}
                          >
                            {campaign.name || campaign.topic || 'Untitled'}
                          </Link>
                          {campaign.name && campaign.topic && (
                            <p className="text-[11px] truncate mt-0.5" style={{ color: '#94a3b8' }}>{campaign.topic}</p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={campaign.status} />
                        </td>

                        {/* Budget */}
                        <td className="px-4 py-3 text-right text-sm tabular-nums whitespace-nowrap" style={{ color: '#475569' }}>
                          {campaign.budget ? formatCurrency(campaign.budget) : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>

                        {/* ROAS */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {campaign.roas != null ? (
                            <span className="text-sm font-semibold tabular-nums" style={{
                              color: campaign.roas >= 2 ? '#16a34a' : campaign.roas >= 1 ? '#d97706' : '#dc2626'
                            }}>
                              {campaign.roas.toFixed(2)}x
                            </span>
                          ) : <span className="text-sm" style={{ color: '#cbd5e1' }}>—</span>}
                        </td>

                        {/* Launched */}
                        <td className="px-5 py-3 text-right text-xs tabular-nums whitespace-nowrap" style={{ color: '#94a3b8' }}>
                          {formatDateTime(campaign.launchedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pipeline Runs — narrower */}
          <div
            className="xl:col-span-2 rounded-xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                  <Activity size={12} style={{ color: '#16a34a' }} />
                </div>
                <h2 className="text-sm font-semibold" style={{ color: '#0f172a' }}>Pipeline Runs</h2>
                {recentRuns.length > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#f1f5f9', color: '#64748b' }}>
                    {recentRuns.length}
                  </span>
                )}
              </div>
              <Link
                href={`/dashboard/${tenantId}/runs`}
                className="inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: '#0ea5e9' }}
              >
                View all <ChevronRight size={11} />
              </Link>
            </div>

            {recentRuns.length === 0 ? (
              <EmptyState icon={Activity} title="No runs yet" iconSize={24} />
            ) : (
              <div className="divide-y" style={{ borderColor: '#f8fafc' }}>
                {recentRuns.map((run) => (
                  <Link
                    key={run.runId}
                    href={`/dashboard/${tenantId}/runs/${run.runId}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                  >
                    {/* Run ID + time */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-semibold truncate" style={{ color: '#0284c7' }}>
                        {run.runId.slice(0, 14)}…
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock size={10} style={{ color: '#cbd5e1' }} />
                        <p className="text-[11px] tabular-nums" style={{ color: '#94a3b8' }}>
                          {formatDateTime(run.startedAt)}
                        </p>
                      </div>
                    </div>

                    {/* Status + arrow */}
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={run.status} />
                      <ArrowRight
                        size={12}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: '#94a3b8' }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Footer hint */}
            {recentRuns.length > 0 && (
              <div className="px-5 py-3" style={{ borderTop: '1px solid #f1f5f9' }}>
                <p className="text-[11px]" style={{ color: '#cbd5e1' }}>Click any run to view full pipeline output</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Company profile strip ─────────────────────────────────── */}
        {company && (
          <div
            className="rounded-xl px-5 py-4 flex items-center justify-between gap-6 flex-wrap"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
          >
            <div className="flex items-center gap-5 flex-wrap min-w-0">
              {company.tone && (
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Tone</p>
                  <p className="text-sm font-medium capitalize truncate" style={{ color: '#0f172a' }}>{company.tone}</p>
                </div>
              )}
              {company.targetAudience && (
                <div className="min-w-0" style={{ maxWidth: 240 }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Target Audience</p>
                  <p className="text-sm font-medium truncate" style={{ color: '#0f172a' }} title={company.targetAudience}>
                    {company.targetAudience}
                  </p>
                </div>
              )}
              {company.products && company.products.length > 0 && (
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Products</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {company.products.slice(0, 3).map((p, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full font-medium truncate max-w-30"
                        style={{ background: '#f1f5f9', color: '#475569' }}
                        title={p.name}
                      >
                        {p.name}
                      </span>
                    ))}
                    {company.products.length > 3 && (
                      <span className="text-xs" style={{ color: '#94a3b8' }}>+{company.products.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}
              {company.meta?.accountId && (
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Meta Account</p>
                  <code className="text-xs font-mono" style={{ color: '#64748b' }}>{company.meta.accountId}</code>
                </div>
              )}
            </div>

            <Link
              href={`/dashboard/${tenantId}/settings`}
              className="inline-flex items-center gap-1.5 text-xs font-medium shrink-0 transition-opacity hover:opacity-70"
              style={{ color: '#94a3b8' }}
            >
              <Settings size={12} /> Edit profile
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
