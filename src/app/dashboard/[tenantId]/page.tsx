'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  Megaphone,
  TrendingUp,
  DollarSign,
  BarChart3,
  Wifi,
  WifiOff,
  Building2,
  ArrowRight,
  Play,
  Loader2,
  CheckCircle,
  Activity,
  AlertCircle,
  Settings,
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

  const [company, setCompany] = useState<Company | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [companyError, setCompanyError] = useState<string | null>(null)
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
        setCompanyError(err instanceof Error ? err.message : 'Failed to load company data')
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
      } catch {
        // runs are non-critical
      }
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
      setTriggerMessage(newRunId ? `Run started: ${newRunId.slice(0, 8)}...` : 'Pipeline triggered!')
      if (newRunId) {
        setTimeout(() => router.push(`/dashboard/${tenantId}/runs/${newRunId}`), 1000)
      } else {
        setTimeout(() => setTriggerState('idle'), 5000)
      }
    } catch (err) {
      setTriggerState('error')
      setTriggerMessage(err instanceof Error ? err.message : 'Failed to trigger pipeline')
      setTimeout(() => setTriggerState('idle'), 4000)
    }
  }

  const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0)
  const allRoas = campaigns.filter((c) => c.roas && c.roas > 0).map((c) => c.roas as number)
  const avgRoas = allRoas.length > 0 ? allRoas.reduce((a, b) => a + b, 0) / allRoas.length : 0
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length
  const recentCampaigns = [...campaigns]
    .sort((a, b) => new Date(b.launchedAt || 0).getTime() - new Date(a.launchedAt || 0).getTime())
    .slice(0, 5)
  const recentRuns = [...runs].slice(0, 5)

  const metaConnected = !!(company?.meta?.accessToken)
  const latestRun = runs[0] ?? null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {companyError ? (
              <div
                className="text-sm rounded-lg px-4 py-3 mb-4"
                style={{ color: '#b91c1c', background: '#fee2e2', border: '1px solid #fecaca' }}
              >
                {companyError}
              </div>
            ) : null}
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: '#e0f2fe', border: '1px solid #bae6fd' }}
              >
                <Building2 size={18} style={{ color: '#0284c7' }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#18181b' }}>
                  {company?.name || tenantId}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {company?.industry && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
                    >
                      {company.industry}
                    </span>
                  )}
                  {company?.pipelineConfig?.campaignStrategy && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                      style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                    >
                      {company.pipelineConfig.campaignStrategy}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Meta Connection Status */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              style={
                metaConnected
                  ? { background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' }
                  : { background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }
              }
            >
              {metaConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>Meta {metaConnected ? 'Connected' : 'Disconnected'}</span>
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: metaConnected ? '#15803d' : '#b91c1c' }}
              />
            </div>

            {/* Latest run status */}
            {latestRun && (
              <Link
                href={`/dashboard/${tenantId}/runs/${latestRun.runId}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e4e4e7',
                  color: '#71717a',
                }}
              >
                <Activity size={13} />
                <span className="font-mono text-xs">{latestRun.runId.slice(0, 8)}</span>
                <StatusBadge status={latestRun.status} />
              </Link>
            )}

            {/* Trigger button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleTrigger}
                disabled={triggerState === 'loading'}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200',
                  triggerState === 'loading' && 'cursor-not-allowed opacity-60'
                )}
                style={
                  triggerState === 'loading'
                    ? { background: '#e0f2fe', color: '#0284c7' }
                    : triggerState === 'success'
                    ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
                    : triggerState === 'error'
                    ? { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
                    : { background: '#0284c7', color: '#ffffff', boxShadow: '0 1px 3px rgba(2,132,199,0.3)' }
                }
              >
                {triggerState === 'loading' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : triggerState === 'success' ? (
                  <CheckCircle size={15} />
                ) : (
                  <Play size={15} fill="currentColor" />
                )}
                {triggerState === 'loading' ? 'Triggering...' :
                 triggerState === 'success' ? 'Triggered!' :
                 triggerState === 'error' ? 'Retry' :
                 'Run Pipeline'}
              </button>
              {triggerMessage && (
                <span
                  className="text-xs"
                  style={{ color: triggerState === 'success' ? '#15803d' : '#b91c1c' }}
                >
                  {triggerMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Meta disconnected banner */}
      {company && !metaConnected && (
        <div
          className="flex items-center justify-between gap-4 rounded-xl px-5 py-4 mb-6 flex-wrap"
          style={{ background: '#fef3c7', border: '1px solid #fde68a' }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle size={16} style={{ color: '#b45309' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                Meta account not connected
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
                Connect your Meta account in Settings before triggering a pipeline run.
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/${tenantId}/settings`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
            style={{ background: '#b45309', color: '#ffffff' }}
          >
            <Settings size={12} /> Go to Settings
          </Link>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={Megaphone}
          value={campaigns.length}
          label="Total Campaigns"
          iconColor="#52525b"
          iconBg="#f4f4f5"
        />
        <MetricCard
          icon={DollarSign}
          value={formatCurrency(totalSpend)}
          label="Total Spend"
          iconColor="#15803d"
          iconBg="#dcfce7"
        />
        <MetricCard
          icon={TrendingUp}
          value={avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : '—'}
          label="Avg ROAS"
          iconColor="#b45309"
          iconBg="#fef3c7"
        />
        <MetricCard
          icon={BarChart3}
          value={activeCampaigns}
          label="Active Campaigns"
          iconColor="#0284c7"
          iconBg="#e0f2fe"
        />
      </div>

      {/* Recent Campaigns */}
      <div
        className="rounded-xl overflow-hidden mb-5"
        style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid #f0f0f1' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>Recent Campaigns</h2>
          <Link
            href={`/dashboard/${tenantId}/campaigns`}
            className="text-xs flex items-center gap-1 transition-colors font-medium"
            style={{ color: '#0284c7' }}
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {campaignsError ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm" style={{ color: '#b91c1c' }}>{campaignsError}</p>
          </div>
        ) : recentCampaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            subtitle="Trigger a pipeline run to create your first campaign"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>Budget</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>ROAS</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>Launch Date</th>
                </tr>
              </thead>
              <tbody>
                {recentCampaigns.map((campaign, idx) => (
                  <tr
                    key={campaign._id || idx}
                    className="transition-colors hover:bg-zinc-50"
                    style={{ borderBottom: '1px solid #f4f4f5' }}
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                        className="text-sm font-medium transition-colors hover:text-sky-700"
                        style={{ color: '#18181b' }}
                      >
                        {campaign.name || campaign.topic || 'Untitled'}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#52525b' }}>
                      {campaign.budget ? formatCurrency(campaign.budget) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {campaign.roas != null ? (
                        <span className="text-sm font-semibold" style={{
                          color: campaign.roas >= 2 ? '#15803d' : campaign.roas >= 1 ? '#b45309' : '#b91c1c'
                        }}>
                          {campaign.roas.toFixed(2)}x
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: '#d4d4d8' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#a1a1aa' }}>
                      {formatDateTime(campaign.launchedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Runs */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid #f0f0f1' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>Recent Pipeline Runs</h2>
          <Link
            href={`/dashboard/${tenantId}/runs`}
            className="text-xs flex items-center gap-1 transition-colors font-medium"
            style={{ color: '#0284c7' }}
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {recentRuns.length === 0 ? (
          <EmptyState icon={Activity} title="No pipeline runs yet" iconSize={24} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>Run ID</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>Started</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr
                    key={run.runId}
                    className="transition-colors hover:bg-zinc-50"
                    style={{ borderBottom: '1px solid #f4f4f5' }}
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/${tenantId}/runs/${run.runId}`}
                        className="text-xs font-mono transition-colors hover:text-sky-700"
                        style={{ color: '#0284c7' }}
                      >
                        {run.runId.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs" style={{ color: '#a1a1aa' }}>
                      {formatDateTime(run.startedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
