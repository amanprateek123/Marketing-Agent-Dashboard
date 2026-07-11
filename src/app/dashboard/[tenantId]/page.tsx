'use client'

import { useState, useEffect, use, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Play, Loader2, CheckCircle, AlertTriangle,
  Settings, Inbox, Sparkles, TrendingUp, Rocket,
} from 'lucide-react'
import {
  formatCurrency,
  formatRelativeTime,
  formatROASPlain,
  roasHealth,
  spendVsEarnedSentence,
  statusToPlain,
} from '@/lib/utils'
import { getActionOutcomes } from '@/lib/api'
import { PlainMetric } from '@/components/plain/PlainMetric'
import { HealthBadge } from '@/components/plain/HealthBadge'
import type { Company, Campaign, PipelineRun, ExecutedActionRecord } from '@/types'
import { useRouter } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

export default function HomePage({ params }: PageProps) {
  const { tenantId } = use(params)
  const router = useRouter()

  const [company, setCompany]     = useState<Company | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [runs, setRuns]           = useState<PipelineRun[]>([])
  const [actions, setActions]     = useState<ExecutedActionRecord[]>([])
  const [companyError, setCompanyError]     = useState<string | null>(null)
  const [triggerState, setTriggerState]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [triggerMessage, setTriggerMessage] = useState('')

  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await fetch(`${API_BASE}/companies/${tenantId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setCompany(await res.json())
      } catch (err) {
        setCompanyError(err instanceof Error ? err.message : "Couldn't load your company info")
      }
      try {
        const res = await fetch(`${API_BASE}/campaigns/${tenantId}`)
        if (res.ok) setCampaigns(await res.json())
      } catch { /* silent — surfaced separately in Your Ads section */ }
      try {
        const res = await fetch(`${API_BASE}/pipeline/${tenantId}/runs`)
        if (res.ok) setRuns(await res.json())
      } catch { /* non-critical */ }
      try {
        const out = await getActionOutcomes(tenantId)
        setActions(out.recent ?? [])
      } catch { /* non-critical */ }
    }
    fetchAll()
  }, [tenantId])

  async function handleTrigger() {
    setTriggerState('loading')
    setTriggerMessage('')
    try {
      const res = await fetch(`${API_BASE}/pipeline/${tenantId}/trigger`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTriggerState('success')
      setTriggerMessage("Working on new ad ideas…")
      if (data?.runId) setTimeout(() => router.push(`/dashboard/${tenantId}/runs/${data.runId}`), 900)
      else setTimeout(() => setTriggerState('idle'), 5000)
    } catch (err) {
      setTriggerState('error')
      setTriggerMessage(err instanceof Error ? err.message : "Something went wrong")
      setTimeout(() => setTriggerState('idle'), 4000)
    }
  }

  // ── Derived stats ─────────────────────────────────────────────────
  const totalSpend      = campaigns.reduce((s, c) => s + (c.spend || 0), 0)
  const allRoas         = campaigns.filter(c => c.roas && c.roas > 0).map(c => c.roas as number)
  const avgRoas         = allRoas.length ? allRoas.reduce((a, b) => a + b, 0) / allRoas.length : 0
  const totalEarned     = campaigns.reduce((s, c) => s + (c.spend || 0) * (c.roas || 0), 0)
  const activeCampaigns = campaigns.filter(c => c.status === 'active')
  const pendingList     = campaigns.filter(c => c.status === 'pending_approval')
  const metaConnected   = !!(company?.meta?.accessToken)

  const healthCounts = useMemo(() => {
    const counts = { good: 0, watch: 0, bad: 0, unknown: 0 }
    for (const c of activeCampaigns) {
      counts[roasHealth(c.roas ?? null)] += 1
    }
    return counts
  }, [activeCampaigns])

  const topInsight = useMemo(() => {
    const insights = company?.learnings?.causalInsights ?? []
    return [...insights].sort(
      (a, b) =>
        (b.confidence * Math.log(1 + b.dataPoints)) -
        (a.confidence * Math.log(1 + a.dataPoints)),
    )[0] ?? null
  }, [company])

  const recentCampaigns = [...campaigns]
    .sort((a, b) => new Date(b.launchedAt || 0).getTime() - new Date(a.launchedAt || 0).getTime())
    .slice(0, 5)

  // ── Empty-state helpers ──────────────────────────────────────────
  const nothingConnected = !metaConnected
  const noCampaigns = campaigns.length === 0

  return (
    <div className="min-h-screen">
      <div className="px-8 py-8 max-w-[1600px] mx-auto">

        {/* ── Hero ────────────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="page-title">
              Hi, here's what's happening today
            </h1>
            <p className="page-subtitle">
              {company?.name || tenantId}{company?.industry ? ` · ${company.industry}` : ''}
            </p>
          </div>
          <button
            onClick={handleTrigger}
            disabled={triggerState === 'loading' || !metaConnected}
            className={
              'btn btn-lg ' + (
                triggerState === 'success' ? 'btn-ghost'
                : triggerState === 'error' ? 'btn-danger'
                : 'btn-accent'
              )
            }
            title={!metaConnected ? 'Connect Meta first in Settings' : undefined}
          >
            {triggerState === 'loading' ? <Loader2 size={16} className="animate-spin" />
             : triggerState === 'success' ? <CheckCircle size={16} />
             : <Play size={14} fill="currentColor" />}
            {triggerState === 'loading' ? 'Thinking…'
              : triggerState === 'success' ? 'On it'
              : triggerState === 'error' ? 'Try again'
              : 'Come up with new ad ideas'}
          </button>
        </div>
        {triggerMessage && (
          <p className="mb-4" style={{ color: triggerState === 'success' ? 'var(--good)' : 'var(--bad)' }}>
            {triggerMessage}
          </p>
        )}

        {/* ── Not connected banner ────────────────────────────────── */}
        {companyError && (
          <div
            className="flex items-center gap-3 rounded-xl px-5 py-4 text-[14px] mb-5"
            style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}
          >
            <AlertTriangle size={16} className="shrink-0" />
            <span>{companyError}</span>
          </div>
        )}
        {nothingConnected && !companyError && (
          <div className="card px-5 py-4 flex items-center gap-4 mb-5" style={{ borderColor: 'var(--warn-border)', background: 'var(--warn-bg)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--warn)' }} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>
                Meta not connected yet
              </p>
              <p className="explain">
                Add your Meta Ads token in Settings so we can see your ads and suggest changes.
              </p>
            </div>
            <Link href={`/dashboard/${tenantId}/settings`} className="btn btn-ghost shrink-0">
              <Settings size={14} /> Open settings
            </Link>
          </div>
        )}

        {/* ── Top-line summary tiles ──────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <PlainMetric
            label="Money spent"
            value={formatCurrency(Math.round(totalSpend))}
            sub={`Across ${campaigns.length} ${campaigns.length === 1 ? 'campaign' : 'campaigns'}`}
            help="Total amount your ads have spent on Meta so far."
          />
          <PlainMetric
            label="Money earned"
            value={totalEarned > 0 ? formatCurrency(Math.round(totalEarned)) : '—'}
            sub={
              avgRoas > 0
                ? formatROASPlain(avgRoas)
                : 'Waiting for first conversions'
            }
            help="Revenue attributed by Meta's pixel."
            health={roasHealth(avgRoas)}
          />
          <PlainMetric
            label="Ads running"
            value={String(activeCampaigns.length)}
            sub={
              activeCampaigns.length === 0
                ? 'Nothing live right now'
                : `${healthCounts.good} doing well, ${healthCounts.watch} to watch`
            }
            help="Campaigns currently spending on Meta."
          />
          <PlainMetric
            label="Waiting for you"
            value={String(pendingList.length)}
            sub={
              pendingList.length === 0
                ? 'All caught up 👍'
                : 'Review before they launch'
            }
            health={pendingList.length > 0 ? 'watch' : 'good'}
          />
        </div>

        {/* ── Two-column: What needs your attention · What we're learning ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

          {/* Attention */}
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Inbox size={18} style={{ color: pendingList.length > 0 ? 'var(--warn)' : 'var(--ink-3)' }} />
              <h2 className="section-title">What needs your attention</h2>
              {pendingList.length > 0 && (
                <span className="ml-auto chip chip-warn">{pendingList.length} waiting</span>
              )}
            </div>
            {pendingList.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p style={{ color: 'var(--ink-3)' }}>
                  Nothing waiting on you right now. 🎉
                </p>
                <p className="explain mt-2">
                  When the agent creates a new ad idea it'll show up here for your approval.
                </p>
              </div>
            ) : (
              <div>
                {pendingList.slice(0, 4).map((c) => (
                  <Link
                    key={c._id}
                    href={`/dashboard/${tenantId}/approvals`}
                    className="flex items-center gap-3 px-5 py-3.5"
                    style={{ borderTop: '1px solid var(--hairline-light)' }}
                  >
                    <Rocket size={16} style={{ color: 'var(--accent)' }} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>
                        {c.name || c.topic || 'New ad idea'}
                      </p>
                      <p className="explain">
                        {c.budget ? `Ready to launch with ${formatCurrency(c.budget)} daily budget` : 'Ready to review'}
                      </p>
                    </div>
                    <ArrowRight size={16} style={{ color: 'var(--warn)' }} />
                  </Link>
                ))}
                <Link
                  href={`/dashboard/${tenantId}/approvals`}
                  className="block px-5 py-3 text-center font-medium"
                  style={{ borderTop: '1px solid var(--hairline-light)', color: 'var(--accent-strong)' }}
                >
                  Review all {pendingList.length} →
                </Link>
              </div>
            )}
          </div>

          {/* Latest insight */}
          <div className="card px-5 py-5 flex flex-col">
            <div className="flex items-center gap-2.5 mb-3">
              <Sparkles size={16} style={{ color: 'var(--accent)' }} />
              <h2 className="section-title">What we're learning</h2>
            </div>
            {topInsight ? (
              <>
                <p className="insight-quote">
                  "{topInsight.finding}"
                </p>
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <HealthBadge
                    health={topInsight.confidence >= 0.7 ? 'good' : topInsight.confidence >= 0.5 ? 'watch' : 'unknown'}
                    label={`${(topInsight.confidence * 100).toFixed(0)}% sure`}
                  />
                  <span className="explain">
                    Based on {topInsight.dataPoints} {topInsight.dataPoints === 1 ? 'campaign' : 'campaigns'}
                  </span>
                </div>
                <Link
                  href={`/dashboard/${tenantId}/learnings`}
                  className="mt-auto pt-4 text-sm font-medium"
                  style={{ color: 'var(--accent-strong)' }}
                >
                  See all patterns →
                </Link>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--ink-3)' }}>
                  Not enough data yet.
                </p>
                <p className="explain mt-2">
                  Once a few campaigns finish, the agent will show you which patterns worked best.
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Your ads ────────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <div className="flex items-center gap-2.5">
              <TrendingUp size={18} style={{ color: 'var(--ink-3)' }} />
              <h2 className="section-title">Your ads</h2>
            </div>
            <Link href={`/dashboard/${tenantId}/campaigns`} className="text-sm font-medium" style={{ color: 'var(--accent-strong)' }}>
              See all →
            </Link>
          </div>
          {noCampaigns ? (
            <div className="px-5 py-12 text-center">
              <p style={{ color: 'var(--ink-3)' }}>No ads yet.</p>
              <p className="explain mt-2">
                Click <b>Come up with new ad ideas</b> above to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Campaign</th>
                    <th>How it's doing</th>
                    <th className="num">Spent so far</th>
                    <th className="num">Return</th>
                    <th className="num">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCampaigns.map((c, idx) => {
                    const health = roasHealth(c.roas ?? null)
                    return (
                      <tr key={c._id || idx}>
                        <td>
                          <Link
                            href={`/dashboard/${tenantId}/campaigns/${c._id}`}
                            className="font-semibold hover:underline"
                            style={{ color: 'var(--ink)' }}
                          >
                            {c.name || c.topic || 'Untitled'}
                          </Link>
                          <p className="explain mt-0.5">{statusToPlain(c.status)}</p>
                        </td>
                        <td>
                          <HealthBadge health={health} />
                        </td>
                        <td className="num" style={{ color: 'var(--ink)' }}>
                          {c.spend ? formatCurrency(Math.round(c.spend)) : '—'}
                        </td>
                        <td className="num">
                          {c.roas != null && c.roas > 0 ? (
                            <span
                              className="font-semibold"
                              style={{
                                color:
                                  health === 'good' ? 'var(--good)'
                                  : health === 'watch' ? 'var(--warn)'
                                  : 'var(--bad)',
                              }}
                            >
                              {spendVsEarnedSentence(c.spend ?? 0, c.roas ?? 0)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--ink-3)' }}>—</span>
                          )}
                        </td>
                        <td className="num" style={{ color: 'var(--ink-3)' }}>
                          {c.launchedAt ? formatRelativeTime(c.launchedAt) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
