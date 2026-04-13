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
  DollarSign,
  TrendingUp,
  TrendingDown,
  Zap,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
} from 'lucide-react'
import type { Company, Product } from '@/types'

const API_BASE = 'http://localhost:8082/api/v1'
interface PageProps { params: Promise<{ tenantId: string }> }

// ── Helpers ───────────────────────────────────────────────────────────────────
function maskToken(token?: string) {
  if (!token) return '—'
  return token.slice(0, 6) + '••••••••••••••••••••'
}

// ── Shared components ─────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  right,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: iconBg }}>
          <Icon size={15} style={{ color: iconColor }} />
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{title}</h2>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

function SaveBtn({
  state,
  onClick,
  label = 'Save changes',
}: {
  state: 'idle' | 'loading' | 'success' | 'error'
  onClick: () => void
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={state === 'loading'}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
      style={
        state === 'success' ? { background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }
        : state === 'error'  ? { background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }
        : { background: '#111827', color: '#ffffff', border: '1px solid #111827' }
      }
    >
      {state === 'loading' && <Loader2 size={11} className="animate-spin" />}
      {state === 'success' && <CheckCircle2 size={11} />}
      {state === 'loading' ? 'Saving…' : state === 'success' ? 'Saved!' : state === 'error' ? 'Error — retry' : label}
    </button>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="text-xs font-medium mb-1.5" style={{ color: '#374151' }}>
      {children}{required && <span className="ml-0.5" style={{ color: '#dc2626' }}>*</span>}
    </p>
  )
}

function TextInput({
  value, onChange, placeholder, mono, type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none transition-shadow ${mono ? 'font-mono' : ''}`}
      style={{ background: '#fafafa', border: '1px solid #e5e7eb', color: '#111827' }}
      onFocus={e => e.currentTarget.style.border = '1px solid #9ca3af'}
      onBlur={e => e.currentTarget.style.border = '1px solid #e5e7eb'}
    />
  )
}

function NumericInput({
  value, onChange, prefix, suffix, placeholder = '—', step = 1,
}: {
  value: string
  onChange: (v: string) => void
  prefix?: string
  suffix?: string
  placeholder?: string
  step?: number
}) {
  return (
    <div className="flex items-stretch rounded-lg overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
      {prefix && (
        <span className="flex items-center px-2.5 text-xs font-medium" style={{ background: '#f3f4f6', color: '#4b5563', borderRight: '1px solid #e5e7eb' }}>
          {prefix}
        </span>
      )}
      <input
        type="number"
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 px-3 py-2 text-sm tabular-nums outline-none"
        style={{ background: '#fafafa', color: '#111827' }}
      />
      {suffix && (
        <span className="flex items-center px-2.5 text-xs font-medium" style={{ background: '#f3f4f6', color: '#4b5563', borderLeft: '1px solid #e5e7eb' }}>
          {suffix}
        </span>
      )}
    </div>
  )
}

function InfoChip({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>{label}</p>
      <p className={`text-sm font-medium truncate ${mono ? 'font-mono' : ''}`} style={{ color: '#111827' }}>{value || '—'}</p>
    </div>
  )
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={active
        ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
        : { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? '#22c55e' : '#ef4444' }} />
      {active ? 'Connected' : 'Disconnected'}
    </span>
  )
}

function RuleGroup({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  children,
}: {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#fafafa', border: '1px solid #f3f4f6' }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: iconBg }}>
          <Icon size={11} style={{ color: iconColor }} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>{title}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {children}
      </div>
    </div>
  )
}

// ── Conversion tracking sub-form ──────────────────────────────────────────────
const STANDARD_EVENTS = ['Purchase', 'Lead', 'CompleteRegistration', 'Subscribe']

function ConversionTracking({ product, onChange }: { product: Product; onChange: (p: Product) => void }) {
  type Mode = 'standard' | 'custom_event' | 'custom_conversion'

  // Derive initial mode from product fields, but hold it in state so switching works
  const [mode, setModeState] = useState<Mode>(() =>
    product.customConversionId ? 'custom_conversion'
    : product.conversionEvent === 'CustomEvent' ? 'custom_event'
    : 'standard'
  )

  function setMode(m: Mode) {
    setModeState(m)
    if (m === 'standard') {
      onChange({ ...product, conversionEvent: product.conversionEvent && product.conversionEvent !== 'CustomEvent' ? product.conversionEvent : 'Purchase', customEventName: undefined, customConversionId: undefined })
    } else if (m === 'custom_event') {
      onChange({ ...product, conversionEvent: 'CustomEvent', customConversionId: undefined })
    } else {
      onChange({ ...product, customConversionId: product.customConversionId || '', conversionEvent: undefined, customEventName: undefined })
    }
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#fafafa', border: '1px solid #f3f4f6' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>Conversion Tracking</p>

      {/* Mode selector */}
      <div className="flex gap-2 flex-wrap">
        {([
          { value: 'standard', label: 'Standard Event' },
          { value: 'custom_event', label: 'Custom Event' },
          { value: 'custom_conversion', label: 'Custom Conversion' },
        ] as const).map(opt => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={mode === opt.value
              ? { background: '#111827', color: '#fff', border: '1px solid #111827' }
              : { background: '#fff', color: '#4b5563', border: '1px solid #e5e7eb' }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Mode-specific input */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {mode === 'standard' && (
          <div>
            <FieldLabel>Event</FieldLabel>
            <select
              value={product.conversionEvent || 'Purchase'}
              onChange={e => onChange({ ...product, conversionEvent: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
            >
              {STANDARD_EVENTS.map(ev => <option key={ev}>{ev}</option>)}
            </select>
          </div>
        )}

        {mode === 'custom_event' && (
          <div>
            <FieldLabel>Event Name</FieldLabel>
            <TextInput
              value={product.customEventName || ''}
              onChange={v => onChange({ ...product, customEventName: v })}
              placeholder="NADI_REPORT_PURCHASE_COMPLETED"
              mono
            />
          </div>
        )}

        {mode === 'custom_conversion' && (
          <div>
            <FieldLabel>Conversion ID <span style={{ color: '#9ca3af', fontWeight: 400 }}>(from Meta Events Manager)</span></FieldLabel>
            <TextInput
              value={product.customConversionId || ''}
              onChange={v => onChange({ ...product, customConversionId: v })}
              placeholder="1940441453551274"
              mono
            />
          </div>
        )}

        {/* Pixel override — always shown */}
        <div>
          <FieldLabel>Pixel ID <span style={{ color: '#9ca3af', fontWeight: 400 }}>(leave blank for company default)</span></FieldLabel>
          <TextInput
            value={product.pixelId || ''}
            onChange={v => onChange({ ...product, pixelId: v || undefined })}
            placeholder="459303576818354"
            mono
          />
        </div>
      </div>
    </div>
  )
}

// ── Product card ──────────────────────────────────────────────────────────────
function ProductCard({
  product, index, onChange, onRemove,
}: {
  product: Product
  index: number
  onChange: (p: Product) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(index === 0)
  const isActive = product.active !== false
  function set<K extends keyof Product>(key: K, val: Product[K]) { onChange({ ...product, [key]: val }) }
  function tags(key: 'languages' | 'trendKeywords' | 'differentiators', raw: string) {
    onChange({ ...product, [key]: raw.split(',').map(s => s.trim()).filter(Boolean) })
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ border: `1px solid ${isActive ? '#e5e7eb' : '#f3f4f6'}`, background: isActive ? '#ffffff' : '#fafafa' }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        style={{ borderBottom: open ? '1px solid #f3f4f6' : 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        {/* Active toggle */}
        <button
          className="shrink-0"
          onClick={e => { e.stopPropagation(); set('active', !isActive) }}
          title={isActive ? 'Deactivate' : 'Activate'}
        >
          {isActive
            ? <ToggleRight size={20} style={{ color: '#16a34a' }} />
            : <ToggleLeft size={20} style={{ color: '#d1d5db' }} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: isActive ? '#111827' : '#9ca3af' }}>
            {product.name || <span style={{ color: '#d1d5db' }}>Unnamed product</span>}
          </p>
          {!open && (
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {product.price != null && (
                <span className="text-[11px]" style={{ color: '#4b5563' }}>
                  {product.currency || 'INR'} {product.price.toLocaleString()}
                </span>
              )}
              {product.conversionEvent && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#b45309' }}>
                  {product.conversionEvent}
                </span>
              )}
              {!isActive && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#9ca3af' }}>
                  Inactive
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50"
          >
            <Trash2 size={13} style={{ color: '#fca5a5' }} />
          </button>
          {open
            ? <ChevronUp size={14} style={{ color: '#d1d5db' }} />
            : <ChevronDown size={14} style={{ color: '#d1d5db' }} />}
        </div>
      </div>

      {/* Expanded form */}
      {open && (
        <div className="px-4 pt-4 pb-5 space-y-4">
          {/* Row 1: name */}
          <div>
            <FieldLabel required>Name</FieldLabel>
            <TextInput value={product.name} onChange={v => set('name', v)} placeholder="e.g. Nadi Report" />
          </div>

          {/* Row 2: price + conversion value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Price</FieldLabel>
              <div className="flex gap-1.5">
                <select
                  value={product.currency || 'INR'}
                  onChange={e => set('currency', e.target.value)}
                  className="rounded-lg px-2 py-2 text-xs outline-none"
                  style={{ background: '#fafafa', border: '1px solid #e5e7eb', color: '#374151' }}
                >
                  {['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => <option key={c}>{c}</option>)}
                </select>
                <NumericInput value={product.price != null ? String(product.price) : ''} onChange={v => set('price', v ? Number(v) : undefined)} placeholder="999" />
              </div>
            </div>
            <div>
              <FieldLabel>Conversion Value</FieldLabel>
              <NumericInput value={product.conversionValue != null ? String(product.conversionValue) : ''} onChange={v => set('conversionValue', v ? Number(v) : undefined)} placeholder="999" />
            </div>
          </div>

          {/* Conversion tracking */}
          <ConversionTracking product={product} onChange={onChange} />

          {/* Row 3: landing URL */}
          <div>
            <FieldLabel>Landing URL</FieldLabel>
            <TextInput value={product.landingUrl || ''} onChange={v => set('landingUrl', v)} placeholder="https://example.com/product" mono type="url" />
          </div>

          {/* Row 4: description */}
          <div>
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={product.description || ''}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Brief description for the AI agent…"
              className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none transition-shadow"
              style={{ background: '#fafafa', border: '1px solid #e5e7eb', color: '#111827' }}
              onFocus={e => e.currentTarget.style.border = '1px solid #9ca3af'}
              onBlur={e => e.currentTarget.style.border = '1px solid #e5e7eb'}
            />
          </div>

          {/* Row 5: tag fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { key: 'languages' as const, label: 'Languages', placeholder: 'hindi, english' },
              { key: 'trendKeywords' as const, label: 'Trend Keywords', placeholder: 'kundli, astrology' },
              { key: 'differentiators' as const, label: 'Differentiators', placeholder: 'AI-powered, fast delivery' },
            ]).map(({ key, label, placeholder }) => (
              <div key={key}>
                <FieldLabel>{label}</FieldLabel>
                <p className="text-[11px] mb-1.5" style={{ color: '#9ca3af' }}>comma-separated</p>
                <TextInput
                  value={(product[key] as string[] || []).join(', ')}
                  onChange={v => tags(key, v)}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage({ params }: PageProps) {
  const { tenantId } = use(params)

  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const [strategy, setStrategy] = useState<'conservative' | 'balanced' | 'experimental'>('balanced')
  const [strategyState, setStrategyState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const [slackWebhook, setSlackWebhook] = useState('')
  const [slackState, setSlackState]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const [pixelId, setPixelId]           = useState('')
  const [accountIdsRaw, setAccountIdsRaw] = useState('')
  const [metaState, setMetaState]       = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [metaMsg, setMetaMsg]           = useState('')

  const [budget, setBudget]             = useState<Record<string, string>>({})
  const [budgetState, setBudgetState]   = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [budgetMsg, setBudgetMsg]       = useState('')

  const [products, setProducts]         = useState<Product[]>([])
  const [productsState, setProductsState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [productsMsg, setProductsMsg]   = useState('')

  const [regenState, setRegenState]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function fetchCompany() {
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Company = await res.json()
      setCompany(data)
      setStrategy(data.pipelineConfig?.campaignStrategy ?? 'balanced')
      setSlackWebhook(data.delivery?.slackWebhook ?? '')
      setPixelId(data.meta?.pixelId ?? '')
      setAccountIdsRaw((data.meta?.accountIds ?? []).join(', '))
      // Budget fields may come back nested in budgetSettings OR flat at top level
      const bs = data.budgetSettings ?? {}
      function bv(key: keyof typeof bs): string {
        const flat = data[key as keyof typeof data]
        const nested = bs[key]
        const val = nested ?? flat
        return val != null ? String(val) : ''
      }
      setBudget({
        weeklyBudgetCap:       bv('weeklyBudgetCap'),
        maxBudgetPerCampaign:  bv('maxBudgetPerCampaign'),
        maxBudgetScalePercent: bv('maxBudgetScalePercent'),
        targetROAS:            bv('targetROAS'),
        targetCPA:             bv('targetCPA'),
        pauseIfROASBelow:      bv('pauseIfROASBelow'),
        pauseIfCTRBelow:       bv('pauseIfCTRBelow'),
        pauseIfFrequencyAbove: bv('pauseIfFrequencyAbove'),
        scaleIfROASAbove:      bv('scaleIfROASAbove'),
      })
      setProducts(data.products ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCompany() }, [tenantId]) // eslint-disable-line

  async function saveStrategy() {
    setStrategyState('loading')
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineConfig: { campaignStrategy: strategy } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStrategyState('success'); fetchCompany()
    } catch { setStrategyState('error') }
    finally { setTimeout(() => setStrategyState('idle'), 3000) }
  }

  async function saveSlack() {
    setSlackState('loading')
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery: { slackWebhook } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSlackState('success'); fetchCompany()
    } catch { setSlackState('error') }
    finally { setTimeout(() => setSlackState('idle'), 3000) }
  }

  async function saveMeta() {
    setMetaState('loading'); setMetaMsg('')
    try {
      const accountIds = accountIdsRaw.split(',').map(s => s.trim()).filter(Boolean)
      const res = await fetch(`${API_BASE}/companies/${tenantId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta: { accountIds, pixelId: pixelId.trim() || undefined } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setMetaState('success'); setMetaMsg('Saved.'); fetchCompany()
    } catch (err) {
      setMetaState('error'); setMetaMsg(err instanceof Error ? err.message : 'Save failed')
    } finally { setTimeout(() => { setMetaState('idle'); setMetaMsg('') }, 3000) }
  }

  async function saveBudget() {
    setBudgetState('loading'); setBudgetMsg('')
    const body: Record<string, number> = {}
    for (const [k, v] of Object.entries(budget)) { if (v.trim()) body[k] = Number(v) }
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}/budget`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setBudgetState('success'); setBudgetMsg('Budget rules saved.'); fetchCompany()
    } catch (err) {
      setBudgetState('error'); setBudgetMsg(err instanceof Error ? err.message : 'Save failed')
    } finally { setTimeout(() => { setBudgetState('idle'); setBudgetMsg('') }, 3000) }
  }

  async function saveProducts() {
    if (products.some(p => !p.name.trim())) {
      setProductsState('error'); setProductsMsg('All products need a name.')
      setTimeout(() => { setProductsState('idle'); setProductsMsg('') }, 3000)
      return
    }
    setProductsState('loading'); setProductsMsg('')
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}/products`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      setProductsState('success')
      setProductsMsg(result.promptRegenTriggered
        ? 'Saved. AI prompts regenerating in background (~30s)…'
        : 'Products saved.')
      fetchCompany()
    } catch (err) {
      setProductsState('error'); setProductsMsg(err instanceof Error ? err.message : 'Save failed')
    } finally { setTimeout(() => { setProductsState('idle'); setProductsMsg('') }, 5000) }
  }

  async function handleRegen() {
    setRegenState('loading')
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}/regenerate`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRegenState('success')
    } catch { setRegenState('error') }
    finally { setTimeout(() => setRegenState('idle'), 4000) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f8f9fb' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={22} className="animate-spin" style={{ color: '#4f46e5' }} />
          <p className="text-sm" style={{ color: '#9ca3af' }}>Loading settings…</p>
        </div>
      </div>
    )
  }

  const metaConnected = !!(company?.meta?.accessToken)

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto" style={{ background: '#f8f9fb', minHeight: '100vh' }}>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#e0e7ff', border: '1px solid #c7d2fe' }}>
            <Settings size={16} style={{ color: '#4f46e5' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#111827' }}>Settings</h1>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{tenantId}</p>
          </div>
        </div>

        <button
          onClick={handleRegen}
          disabled={regenState === 'loading'}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
          style={
            regenState === 'success' ? { background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }
            : regenState === 'error'  ? { background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }
            : { background: '#ffffff', border: '1px solid #e5e7eb', color: '#4b5563', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }
          }
        >
          {regenState === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {regenState === 'loading' ? 'Regenerating…' : regenState === 'success' ? 'Regenerated!' : regenState === 'error' ? 'Failed' : 'Regenerate Prompts'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 mb-5 flex items-center gap-3 text-sm" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626' }}>
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-4">

        {/* ── Company info ─────────────────────────────────────────── */}
        <section className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <SectionHeader icon={Building2} iconBg="#eef2ff" iconColor="#4f46e5" title="Company" subtitle="Read-only — edit from backend" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
            <InfoChip label="Name"            value={company?.name} />
            <InfoChip label="Industry"        value={company?.industry} />
            <InfoChip label="Tone"            value={company?.tone} />
            <InfoChip label="Target Audience" value={company?.targetAudience} />
          </div>
          {(company?.pipelineConfig?.pauseGracePeriodHours != null || company?.pipelineConfig?.scaleRequiresApproval != null) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 mt-4 pt-4" style={{ borderTop: '1px solid #f3f4f6' }}>
              <InfoChip label="Grace Period" value={company?.pipelineConfig?.pauseGracePeriodHours != null ? `${company.pipelineConfig.pauseGracePeriodHours}h` : undefined} />
              <InfoChip label="Scale Approval" value={company?.pipelineConfig?.scaleRequiresApproval != null ? (company.pipelineConfig.scaleRequiresApproval ? 'Required' : 'Auto') : undefined} />
            </div>
          )}
        </section>

        {/* ── Pipeline strategy ─────────────────────────────────────── */}
        <section className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <SectionHeader icon={Target} iconBg="#fef3c7" iconColor="#d97706" title="Campaign Strategy" subtitle="Controls how aggressively the pipeline pursues new campaigns" />
          <div className="flex items-center gap-3 flex-wrap">
            {(['conservative', 'balanced', 'experimental'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                style={
                  strategy === s
                    ? { background: '#111827', color: '#fff', border: '1px solid #111827' }
                    : { background: '#fafafa', color: '#4b5563', border: '1px solid #e5e7eb' }
                }
              >
                {s}
              </button>
            ))}
            <SaveBtn state={strategyState} onClick={saveStrategy} label="Save" />
          </div>
        </section>

        {/* ── Budget & Rules ────────────────────────────────────────── */}
        <section className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <SectionHeader icon={DollarSign} iconBg="#f0fdf4" iconColor="#16a34a" title="Budget & Rules" subtitle="Caps, performance targets, and auto-pause / auto-scale thresholds" />

          <div className="space-y-3">
            {/* Caps */}
            <RuleGroup icon={DollarSign} iconBg="#dcfce7" iconColor="#16a34a" title="Budget Caps">
              <div>
                <FieldLabel>Weekly Cap</FieldLabel>
                <NumericInput value={budget.weeklyBudgetCap ?? ''} onChange={v => setBudget(b => ({ ...b, weeklyBudgetCap: v }))} prefix="₹" />
              </div>
              <div>
                <FieldLabel>Max per Campaign</FieldLabel>
                <NumericInput value={budget.maxBudgetPerCampaign ?? ''} onChange={v => setBudget(b => ({ ...b, maxBudgetPerCampaign: v }))} prefix="₹" />
              </div>
              <div>
                <FieldLabel>Max Scale %</FieldLabel>
                <NumericInput value={budget.maxBudgetScalePercent ?? ''} onChange={v => setBudget(b => ({ ...b, maxBudgetScalePercent: v }))} suffix="%" />
              </div>
            </RuleGroup>

            {/* Targets */}
            <RuleGroup icon={TrendingUp} iconBg="#e0e7ff" iconColor="#1d4ed8" title="Performance Targets">
              <div>
                <FieldLabel>Target ROAS</FieldLabel>
                <NumericInput value={budget.targetROAS ?? ''} onChange={v => setBudget(b => ({ ...b, targetROAS: v }))} suffix="x" step={0.1} />
              </div>
              <div>
                <FieldLabel>Target CPA</FieldLabel>
                <NumericInput value={budget.targetCPA ?? ''} onChange={v => setBudget(b => ({ ...b, targetCPA: v }))} prefix="₹" />
              </div>
            </RuleGroup>

            {/* Pause triggers */}
            <RuleGroup icon={TrendingDown} iconBg="#fee2e2" iconColor="#dc2626" title="Auto-Pause Triggers">
              <div>
                <FieldLabel>ROAS below</FieldLabel>
                <NumericInput value={budget.pauseIfROASBelow ?? ''} onChange={v => setBudget(b => ({ ...b, pauseIfROASBelow: v }))} suffix="x" step={0.1} />
              </div>
              <div>
                <FieldLabel>CTR below</FieldLabel>
                <NumericInput value={budget.pauseIfCTRBelow ?? ''} onChange={v => setBudget(b => ({ ...b, pauseIfCTRBelow: v }))} suffix="%" step={0.1} />
              </div>
              <div>
                <FieldLabel>Frequency above</FieldLabel>
                <NumericInput value={budget.pauseIfFrequencyAbove ?? ''} onChange={v => setBudget(b => ({ ...b, pauseIfFrequencyAbove: v }))} step={0.1} />
              </div>
            </RuleGroup>

            {/* Scale trigger */}
            <RuleGroup icon={Zap} iconBg="#fef3c7" iconColor="#d97706" title="Auto-Scale Trigger">
              <div>
                <FieldLabel>Scale if ROAS above</FieldLabel>
                <NumericInput value={budget.scaleIfROASAbove ?? ''} onChange={v => setBudget(b => ({ ...b, scaleIfROASAbove: v }))} suffix="x" step={0.1} />
              </div>
            </RuleGroup>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <SaveBtn state={budgetState} onClick={saveBudget} label="Save Budget Rules" />
            {budgetMsg && (
              <p className="text-xs" style={{ color: budgetState === 'success' ? '#16a34a' : '#dc2626' }}>{budgetMsg}</p>
            )}
          </div>
        </section>

        {/* ── Products ─────────────────────────────────────────────── */}
        <section className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <SectionHeader
            icon={Package}
            iconBg="#ede9fe"
            iconColor="#7c3aed"
            title="Products"
            subtitle="Full array is sent on save — changes trigger AI prompt regeneration"
            right={
              <div className="flex items-center gap-3 shrink-0">
                {products.length > 0 && (
                  <span className="text-xs" style={{ color: '#9ca3af' }}>
                    {products.filter(p => p.active !== false).length} active
                  </span>
                )}
                <button
                  onClick={() => setProducts(p => [...p, { name: '', active: true, currency: 'INR' }])}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }}
                >
                  <Plus size={12} /> Add Product
                </button>
              </div>
            }
          />

          {products.length === 0 ? (
            <div className="rounded-xl py-10 text-center" style={{ background: '#fafafa', border: '1px dashed #e5e7eb' }}>
              <Package size={22} className="mx-auto mb-2" style={{ color: '#e5e7eb' }} />
              <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>No products configured</p>
              <p className="text-xs mt-1" style={{ color: '#d1d5db' }}>Add a product so the AI agent knows what to promote</p>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((p, i) => (
                <ProductCard
                  key={i}
                  product={p}
                  index={i}
                  onChange={updated => setProducts(ps => ps.map((x, j) => j === i ? updated : x))}
                  onRemove={() => setProducts(ps => ps.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}

          {products.length > 0 && (
            <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: '1px solid #f3f4f6' }}>
              <SaveBtn state={productsState} onClick={saveProducts} label="Save All Products" />
              {productsMsg && (
                <p className="text-xs leading-relaxed" style={{ color: productsState === 'success' ? '#16a34a' : productsState === 'error' ? '#dc2626' : '#4b5563' }}>
                  {productsMsg}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Notifications ─────────────────────────────────────────── */}
        <section className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <SectionHeader icon={Bell} iconBg="#fef2f2" iconColor="#dc2626" title="Notifications" subtitle="Where pipeline digests and alerts are delivered" />
          <div className="space-y-1">
            <FieldLabel>Slack Webhook URL</FieldLabel>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <TextInput value={slackWebhook} onChange={setSlackWebhook} placeholder="https://hooks.slack.com/services/…" mono />
              </div>
              <SaveBtn state={slackState} onClick={saveSlack} label="Save" />
            </div>
          </div>
        </section>

        {/* ── Meta ──────────────────────────────────────────────────── */}
        <section className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <SectionHeader
            icon={metaConnected ? Wifi : WifiOff}
            iconBg={metaConnected ? '#f0fdf4' : '#fef2f2'}
            iconColor={metaConnected ? '#16a34a' : '#dc2626'}
            title="Meta Ads"
            subtitle="Access token and account details for campaign delivery"
            right={<StatusPill active={metaConnected} />}
          />

          {/* Read-only */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mb-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: '#9ca3af' }}>Access Token</p>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: company?.meta?.accessToken ? '#22c55e' : '#e5e7eb' }} />
                <p className="text-sm font-mono truncate" style={{ color: '#111827' }}>{maskToken(company?.meta?.accessToken)}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: '#9ca3af' }}>Ad Account ID</p>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: company?.meta?.accountId ? '#22c55e' : '#e5e7eb' }} />
                <p className="text-sm font-mono" style={{ color: '#111827' }}>{company?.meta?.accountId || '—'}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: '#9ca3af' }}>Page ID</p>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: company?.meta?.pageId ? '#22c55e' : '#e5e7eb' }} />
                <p className="text-sm font-mono" style={{ color: '#111827' }}>{company?.meta?.pageId || '—'}</p>
              </div>
            </div>
          </div>

          {/* Editable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mb-4" style={{ borderTop: '1px solid #f3f4f6' }}>
            <div>
              <FieldLabel>Pixel ID</FieldLabel>
              <TextInput value={pixelId} onChange={setPixelId} placeholder="123456789" mono />
            </div>
            <div>
              <FieldLabel>Account IDs</FieldLabel>
              <p className="text-[11px] mb-1.5" style={{ color: '#9ca3af' }}>comma-separated</p>
              <TextInput value={accountIdsRaw} onChange={setAccountIdsRaw} placeholder="123456, 789012" mono />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SaveBtn state={metaState} onClick={saveMeta} label="Save Meta Settings" />
            {metaMsg && <span className="text-xs" style={{ color: metaState === 'success' ? '#16a34a' : '#dc2626' }}>{metaMsg}</span>}
          </div>
        </section>

        {/* ── Competitors ───────────────────────────────────────────── */}
        {company?.competitors && company.competitors.length > 0 && (
          <section className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
            <SectionHeader
              icon={Users}
              iconBg="#fef2f2"
              iconColor="#dc2626"
              title="Competitors"
              subtitle="Used by scouts and research agents"
              right={
                <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                  {company.competitors.length}
                </span>
              }
            />
            <div className="flex flex-wrap gap-2">
              {company.competitors.map((c, i) => (
                <span key={i} className="text-sm px-3 py-1.5 rounded-lg font-medium" style={{ background: '#fafafa', border: '1px solid #e5e7eb', color: '#4b5563' }}>
                  {c}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Danger zone ───────────────────────────────────────────── */}
        <section className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <SectionHeader icon={ShieldCheck} iconBg="#f3f4f6" iconColor="#9ca3af" title="AI Agent Prompts" subtitle="Force-regenerate all system prompts from current company data" />
          <div className="flex items-center gap-3">
            <button
              onClick={handleRegen}
              disabled={regenState === 'loading'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
              style={
                regenState === 'success' ? { background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }
                : regenState === 'error'  ? { background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }
                : { background: '#fafafa', border: '1px solid #e5e7eb', color: '#4b5563' }
              }
            >
              {regenState === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {regenState === 'loading' ? 'Regenerating…' : regenState === 'success' ? 'Done!' : 'Regenerate Now'}
            </button>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Takes ~10–30 seconds. Safe to run at any time.</p>
          </div>
        </section>

      </div>
    </div>
  )
}
