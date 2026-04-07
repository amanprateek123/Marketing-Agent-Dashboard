'use client'

import { useState, useEffect, use } from 'react'
import {
  Settings,
  Wifi,
  WifiOff,
  Package,
  Users,
  Bell,
  Building2,
  Target,
  Loader2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Company } from '@/types'

const API_BASE = 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

function maskToken(token?: string): string {
  if (!token) return '—'
  return token.slice(0, 8) + '•••••••••••••••'
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: active ? '#15803d' : '#b91c1c' }}
    />
  )
}

const sectionStyle = {
  background: '#ffffff',
  border: '1px solid #e4e4e7',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
}

export default function SettingsPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const { tenantId } = resolvedParams

  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [strategy, setStrategy] = useState<'conservative' | 'balanced' | 'experimental'>('balanced')
  const [slackWebhook, setSlackWebhook] = useState('')

  const [strategyState, setStrategyState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [strategyMsg, setStrategyMsg] = useState('')
  const [slackState, setSlackState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [slackMsg, setSlackMsg] = useState('')
  const [regenState, setRegenState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [regenMsg, setRegenMsg] = useState('')

  async function fetchCompany() {
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Company = await res.json()
      setCompany(data)
      setStrategy(data.pipelineConfig?.campaignStrategy ?? 'balanced')
      setSlackWebhook(data.delivery?.slackWebhook ?? '')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompany()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function saveStrategy() {
    setStrategyState('loading')
    setStrategyMsg('')
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineConfig: { campaignStrategy: strategy } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStrategyState('success')
      setStrategyMsg('Strategy mode saved.')
      fetchCompany()
    } catch (err) {
      setStrategyState('error')
      setStrategyMsg(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setTimeout(() => { setStrategyState('idle'); setStrategyMsg('') }, 4000)
    }
  }

  async function saveSlack() {
    setSlackState('loading')
    setSlackMsg('')
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery: { slackWebhook } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSlackState('success')
      setSlackMsg('Slack webhook saved.')
      fetchCompany()
    } catch (err) {
      setSlackState('error')
      setSlackMsg(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setTimeout(() => { setSlackState('idle'); setSlackMsg('') }, 4000)
    }
  }

  async function handleRegen() {
    setRegenState('loading')
    setRegenMsg('')
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}/regenerate`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRegenState('success')
      setRegenMsg('Prompts regenerated successfully!')
    } catch (err) {
      setRegenState('error')
      setRegenMsg(err instanceof Error ? err.message : 'Regeneration failed')
    } finally {
      setTimeout(() => { setRegenState('idle'); setRegenMsg('') }, 5000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f4f4f5' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: '#0284c7' }} />
          <p className="text-sm" style={{ color: '#71717a' }}>Loading settings...</p>
        </div>
      </div>
    )
  }

  const metaConnected = !!(company?.meta?.accessToken)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Settings size={18} style={{ color: '#0284c7' }} />
              <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181b' }}>
                Settings
              </h1>
            </div>
            <p className="text-sm" style={{ color: '#71717a' }}>
              Manage your BriefOS configuration
            </p>
          </div>
          <button
            onClick={handleRegen}
            disabled={regenState === 'loading'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={
              regenState === 'loading'
                ? { background: '#f4f4f5', color: '#a1a1aa', cursor: 'not-allowed' }
                : regenState === 'success'
                ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
                : regenState === 'error'
                ? { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
                : { background: '#ffffff', border: '1px solid #e4e4e7', color: '#52525b' }
            }
          >
            {regenState === 'loading' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {regenState === 'loading'
              ? 'Regenerating...'
              : regenState === 'success'
              ? 'Regenerated!'
              : regenState === 'error'
              ? 'Failed'
              : 'Regenerate Prompts'}
          </button>
        </div>
        {regenMsg && (
          <p
            className="text-xs mt-2"
            style={{ color: regenState === 'success' ? '#15803d' : '#b91c1c' }}
          >
            {regenMsg}
          </p>
        )}
      </div>

      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm"
          style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Company Info */}
        <section className="rounded-xl p-5" style={sectionStyle}>
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="p-1.5 rounded-lg"
              style={{ background: '#e0f2fe', border: '1px solid #bae6fd' }}
            >
              <Building2 size={14} style={{ color: '#0284c7' }} />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>
              Company Information
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Name', value: company?.name },
              { label: 'Industry', value: company?.industry },
              { label: 'Tone', value: company?.tone },
              { label: 'Target Audience', value: company?.targetAudience },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>{item.label}</p>
                <p className="text-sm font-medium" style={{ color: '#18181b' }}>{item.value || '—'}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline Config */}
        <section className="rounded-xl p-5" style={sectionStyle}>
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="p-1.5 rounded-lg"
              style={{ background: '#fef3c7', border: '1px solid #fde68a' }}
            >
              <Target size={14} style={{ color: '#b45309' }} />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>
              Pipeline Configuration
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs mb-2" style={{ color: '#a1a1aa' }}>Strategy Mode</p>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={strategy}
                  onChange={(e) =>
                    setStrategy(e.target.value as 'conservative' | 'balanced' | 'experimental')
                  }
                  className="rounded-lg px-3 py-2 text-sm cursor-pointer"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e4e4e7',
                    color: '#18181b',
                  }}
                >
                  <option value="conservative">Conservative</option>
                  <option value="balanced">Balanced</option>
                  <option value="experimental">Experimental</option>
                </select>
                <button
                  onClick={saveStrategy}
                  disabled={strategyState === 'loading'}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={
                    strategyState === 'success'
                      ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
                      : strategyState === 'error'
                      ? { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
                      : { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }
                  }
                >
                  {strategyState === 'loading' && <Loader2 size={11} className="animate-spin" />}
                  {strategyState === 'success' && <CheckCircle2 size={11} />}
                  {strategyState === 'loading'
                    ? 'Saving...'
                    : strategyState === 'success'
                    ? 'Saved!'
                    : strategyState === 'error'
                    ? 'Error'
                    : 'Save'}
                </button>
                {strategyMsg && (
                  <span
                    className="text-xs"
                    style={{ color: strategyState === 'success' ? '#15803d' : '#b91c1c' }}
                  >
                    {strategyMsg}
                  </span>
                )}
              </div>
            </div>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3"
              style={{ borderTop: '1px solid #f0f0f1' }}
            >
              <div>
                <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Grace Period</p>
                <p className="text-sm" style={{ color: '#18181b' }}>
                  {company?.pipelineConfig?.pauseGracePeriodHours !== undefined
                    ? `${company.pipelineConfig.pauseGracePeriodHours} hours`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Scale Requires Approval</p>
                <p className="text-sm" style={{ color: '#18181b' }}>
                  {company?.pipelineConfig?.scaleRequiresApproval !== undefined
                    ? company.pipelineConfig.scaleRequiresApproval
                      ? 'Yes'
                      : 'No'
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Delivery */}
        <section className="rounded-xl p-5" style={sectionStyle}>
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="p-1.5 rounded-lg"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
            >
              <Bell size={14} style={{ color: '#b91c1c' }} />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>Delivery</h2>
          </div>
          <div>
            <p className="text-xs mb-2" style={{ color: '#a1a1aa' }}>Slack Webhook URL</p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/..."
                className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm font-mono"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e4e4e7',
                  color: '#18181b',
                }}
              />
              <button
                onClick={saveSlack}
                disabled={slackState === 'loading'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all"
                style={
                  slackState === 'success'
                    ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
                    : slackState === 'error'
                    ? { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
                    : { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }
                }
              >
                {slackState === 'loading' && <Loader2 size={11} className="animate-spin" />}
                {slackState === 'success' && <CheckCircle2 size={11} />}
                {slackState === 'loading'
                  ? 'Saving...'
                  : slackState === 'success'
                  ? 'Saved!'
                  : slackState === 'error'
                  ? 'Error'
                  : 'Save'}
              </button>
            </div>
            {slackMsg && (
              <p
                className="text-xs mt-1.5"
                style={{ color: slackState === 'success' ? '#15803d' : '#b91c1c' }}
              >
                {slackMsg}
              </p>
            )}
          </div>
        </section>

        {/* Meta Connection */}
        <section className="rounded-xl p-5" style={sectionStyle}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="p-1.5 rounded-lg"
                style={
                  metaConnected
                    ? { background: '#dcfce7', border: '1px solid #bbf7d0' }
                    : { background: '#fee2e2', border: '1px solid #fecaca' }
                }
              >
                {metaConnected ? (
                  <Wifi size={14} style={{ color: '#15803d' }} />
                ) : (
                  <WifiOff size={14} style={{ color: '#b91c1c' }} />
                )}
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>
                Meta Connection
              </h2>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={
                metaConnected
                  ? { background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' }
                  : { background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }
              }
            >
              <StatusDot active={metaConnected} />
              {metaConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Access Token', value: maskToken(company?.meta?.accessToken), active: !!company?.meta?.accessToken, mono: true },
              { label: 'Ad Account ID', value: company?.meta?.adAccountId, active: !!company?.meta?.adAccountId },
              { label: 'Page ID', value: company?.meta?.pageId, active: !!company?.meta?.pageId },
              { label: 'Pixel ID', value: company?.meta?.pixelId, active: !!company?.meta?.pixelId },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>{item.label}</p>
                <div className="flex items-center gap-2">
                  <StatusDot active={item.active} />
                  <p
                    className={cn('text-sm', item.mono && 'font-mono')}
                    style={{ color: '#18181b' }}
                  >
                    {item.value || '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Products */}
        {company?.products && company.products.length > 0 && (
          <section className="rounded-xl p-5" style={sectionStyle}>
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="p-1.5 rounded-lg"
                style={{ background: '#dcfce7', border: '1px solid #bbf7d0' }}
              >
                <Package size={14} style={{ color: '#15803d' }} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>Products</h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
              >
                {company.products.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {company.products.map((product, idx) => (
                <div
                  key={idx}
                  className="rounded-lg p-3"
                  style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold" style={{ color: '#18181b' }}>
                      {product.name}
                    </p>
                    {product.price !== undefined && (
                      <span className="text-xs font-semibold shrink-0" style={{ color: '#15803d' }}>
                        ₹{product.price.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  {product.description && (
                    <p className="text-xs leading-relaxed" style={{ color: '#71717a' }}>
                      {product.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {product.landingUrl && (
                      <a
                        href={product.landingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium transition-colors"
                        style={{ color: '#0284c7' }}
                      >
                        Landing URL ↗
                      </a>
                    )}
                    {product.conversionEvent && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                      >
                        {product.conversionEvent}
                      </span>
                    )}
                    {product.category && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
                      >
                        {product.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Competitors */}
        {company?.competitors && company.competitors.length > 0 && (
          <section className="rounded-xl p-5" style={sectionStyle}>
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="p-1.5 rounded-lg"
                style={{ background: '#fee2e2', border: '1px solid #fecaca' }}
              >
                <Users size={14} style={{ color: '#b91c1c' }} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>Competitors</h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
              >
                {company.competitors.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {company.competitors.map((comp, idx) => (
                <span
                  key={idx}
                  className="text-sm px-3 py-1.5 rounded-lg"
                  style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', color: '#52525b' }}
                >
                  {comp}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
