'use client'

import { useState, useEffect, use } from 'react'
import {
  Wifi, WifiOff, Package, Users, Bell, Building2, Loader2,
  CheckCircle2, RefreshCw, DollarSign, TrendingUp, TrendingDown, Zap, Plus,
  Trash2, ChevronDown, ChevronUp, AlertCircle, ToggleLeft, ToggleRight,
  ShieldCheck, Palette, Megaphone, Sparkles, X, FlaskConical, Trophy,
} from 'lucide-react'
import type { Company, Product, PromptsHistoryEntry, LandingPageTest, LandingPageTestArm, MetaAdAccount, MetaBusiness, MetaPage } from '@/types'
import { getCompany, rollbackPrompts, startLandingPageTest, promoteLandingPage, cancelLandingPageTest, getMetaAccounts, syncMetaAccounts, getMetaBusinesses, getMetaPages } from '@/lib/api'
import { formatInr, formatWhen, humanise, plainStatus, toneChip, errorDetail, PLAIN_ERROR } from '@/lib/plain-language'
import { Details } from '@/components/plain/Details'
import { Term, GLOSSARY } from '@/components/plain/Term'
import { PageSelect } from '@/components/ui/PageSelect'
import styles from './settings.module.css'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'
interface PageProps { params: Promise<{ tenantId: string }> }

// ── Shared UI components ─────────────────────────────────────────────────────

function SectionCard({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={`card p-5 sm:p-6 ${styles.sectionAnchor}`}>
      {children}
    </section>
  )
}

function SectionHeader({ icon: Icon, iconBg, iconColor, title, subtitle, right, category }: {
  icon: React.ElementType; iconBg: string; iconColor: string; title: string; subtitle?: string; right?: React.ReactNode; category?: string
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1" style={{ background: iconBg }}>
          <Icon size={15} style={{ color: iconColor }} />
        </div>
        <div className="min-w-0">
          {category && <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: iconColor }}>{category}</p>}
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="text-xs mt-0.5 break-words" style={{ color: 'var(--ink-3)' }}>{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

function SaveBtn({ state, onClick, label = 'Save changes' }: { state: 'idle' | 'loading' | 'success' | 'error'; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} disabled={state === 'loading'}
      className={
        state === 'success' ? 'btn chip-good border'
        : state === 'error' ? 'btn btn-danger'
        : 'btn btn-primary'
      }>
      {state === 'loading' && <Loader2 size={11} className="animate-spin" />}
      {state === 'success' && <CheckCircle2 size={11} />}
      {state === 'loading' ? 'Saving…' : state === 'success' ? 'Saved!' : state === 'error' ? "Didn't save — try again" : label}
    </button>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <p className="micro-label mb-1.5" style={{ color: 'var(--ink-2)' }}>{children}{required && <span className="ml-0.5" style={{ color: 'var(--bad)' }}>*</span>}</p>
}

function TextInput({ value, onChange, placeholder, mono, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; type?: string }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className={`input ${mono ? 'mono' : ''}`} />
}

function TextArea({ value, onChange, placeholder, rows = 2 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    className="input resize-none" />
}

function NumericInput({ value, onChange, prefix, suffix, placeholder = '—', step = 1 }: { value: string; onChange: (v: string) => void; prefix?: string; suffix?: string; placeholder?: string; step?: number }) {
  return (
    <div className="flex items-stretch overflow-hidden" style={{ border: '1px solid var(--hairline)', borderRadius: 10, background: 'var(--surface-warm)' }}>
      {prefix && <span className="flex items-center px-2.5 text-xs font-medium mono" style={{ background: 'var(--muted)', color: 'var(--ink-3)', borderRight: '1px solid var(--hairline)' }}>{prefix}</span>}
      <input type="number" step={step} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 min-w-0 px-3 py-2 text-sm tabular-nums outline-none mono bg-transparent" style={{ color: 'var(--ink)' }} />
      {suffix && <span className="flex items-center px-2.5 text-xs font-medium mono" style={{ background: 'var(--muted)', color: 'var(--ink-3)', borderLeft: '1px solid var(--hairline)' }}>{suffix}</span>}
    </div>
  )
}

function TagsInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('')

  function addTag() {
    const tag = input.trim()
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setInput('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((tag, i) => (
          <span key={i} className="chip chip-neutral">
            {tag}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="transition-colors hover:text-[var(--bad)]">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); addTag() }
            if (e.key === ',' ) { e.preventDefault(); addTag() }
          }}
          placeholder={value.length === 0 ? placeholder : 'Add more…'}
          className="input flex-1"
        />
        <button
          onClick={addTag}
          disabled={!input.trim()}
          className="btn btn-ghost px-3 py-2"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

function RuleGroup({ icon: Icon, iconColor, iconBg, title, hint, children }: { icon: React.ElementType; iconColor: string; iconBg: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="card-inset p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: iconBg }}><Icon size={11} style={{ color: iconColor }} /></div>
        <p className="micro-label">{title}</p>
      </div>
      {hint && <p className="text-[11.5px] mb-3 leading-relaxed" style={{ color: 'var(--ink-3)' }}>{hint}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">{children}</div>
    </div>
  )
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={active ? 'chip chip-good' : 'chip chip-bad'}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? 'var(--good)' : 'var(--bad)' }} />
      {active ? 'Connected' : 'Disconnected'}
    </span>
  )
}

interface LaunchCheck {
  id: 'business' | 'products' | 'meta' | 'safety'
  label: string
  detail: string
  ready: boolean
  icon: React.ElementType
}

function ReadinessCheck({ check }: { check: LaunchCheck }) {
  const Icon = check.icon
  return (
    <a href={`#${check.id}`} className={styles.readinessLink}>
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: check.ready ? 'var(--good-bg)' : 'var(--warn-bg)',
          color: check.ready ? 'var(--good)' : 'var(--warn)',
        }}
      >
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>{check.label}</span>
          <span className={check.ready ? 'chip chip-good' : 'chip chip-warn'}>{check.ready ? 'Ready' : 'Set up'}</span>
        </span>
        <span className="mt-1 block text-[11px] leading-4" style={{ color: 'var(--ink-3)' }}>{check.detail}</span>
      </span>
    </a>
  )
}

function SettingsLoading() {
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8" role="status" aria-live="polite">
      <span className="sr-only">Loading launch settings</span>
      <div className="h-8 w-64 animate-pulse rounded-lg" style={{ background: 'var(--muted)' }} aria-hidden="true" />
      <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded" style={{ background: 'var(--muted)' }} aria-hidden="true" />
      <div className="mt-8 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={styles.loadingCard} aria-hidden="true" />
        <div className="space-y-5" aria-hidden="true">
          <div className={styles.loadingCard} />
          <div className={styles.loadingCard} />
        </div>
      </div>
    </main>
  )
}


// ── Conversion tracking ──────────────────────────────────────────────────────
const STANDARD_EVENTS = ['Purchase', 'Lead', 'CompleteRegistration', 'Subscribe']

function ConversionTracking({ product, onChange, metaPages }: { product: Product; onChange: (p: Product) => void; metaPages: MetaPage[] }) {
  type Mode = 'standard' | 'custom_event' | 'custom_conversion' | 'app_event'
  const [mode, setModeState] = useState<Mode>(() =>
    product.metaAppId ? 'app_event' : product.customConversionId ? 'custom_conversion' : product.conversionEvent === 'CustomEvent' ? 'custom_event' : 'standard'
  )
  // Clearing every other mode's fields on switch keeps a product from ending
  // up with e.g. both customConversionId and metaAppId set — the backend
  // treats applicationId as taking priority silently, so a stale field here
  // would look configured in this form but do nothing at launch.
  function setMode(m: Mode) {
    setModeState(m)
    const clearApp = { metaAppId: undefined, metaAppStoreUrl: undefined, metaAppStoreUrlIos: undefined, metaAppStoreUrlAndroid: undefined }
    if (m === 'standard') onChange({ ...product, ...clearApp, conversionEvent: product.conversionEvent && product.conversionEvent !== 'CustomEvent' ? product.conversionEvent : 'Purchase', customEventName: undefined, customConversionId: undefined })
    else if (m === 'custom_event') onChange({ ...product, ...clearApp, conversionEvent: 'CustomEvent', customConversionId: undefined })
    else if (m === 'custom_conversion') onChange({ ...product, ...clearApp, customConversionId: product.customConversionId || '', conversionEvent: undefined, customEventName: undefined })
    else onChange({ ...product, metaAppId: product.metaAppId || '', conversionEvent: product.conversionEvent && product.conversionEvent !== 'CustomEvent' ? product.conversionEvent : '', customEventName: undefined, customConversionId: undefined })
  }
  return (
    <div className="card-inset p-4 space-y-3">
      <p className="micro-label">What counts as a sale</p>
      <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>How Meta knows someone bought or signed up, so it can find more people like them. Your developer or Meta setup usually tells you which option to pick.</p>
      <div className="flex gap-2 flex-wrap">
        {([{ value: 'standard', label: 'Standard website action' }, { value: 'custom_event', label: 'Your own website action' }, { value: 'custom_conversion', label: 'Meta custom conversion' }, { value: 'app_event', label: 'In-app action' }] as const).map(opt => (
          <button key={opt.value} onClick={() => setMode(opt.value)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={mode === opt.value ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>{opt.label}</button>
        ))}
      </div>
      {mode === 'app_event' && (
        <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          For products sold inside a mobile app. Meta counts an action inside the app (for example, a completed chat) instead of a visit to your website. Use it for app install or app engagement campaigns.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {mode === 'standard' && <div><FieldLabel>Action to count</FieldLabel><select value={product.conversionEvent || 'Purchase'} onChange={e => onChange({ ...product, conversionEvent: e.target.value })}
          className="input">{STANDARD_EVENTS.map(ev => <option key={ev} value={ev}>{humanise(ev)}</option>)}</select></div>}
        {mode === 'custom_event' && <div><FieldLabel>Action name (as set up on your site)</FieldLabel><TextInput value={product.customEventName || ''} onChange={v => onChange({ ...product, customEventName: v })} placeholder="MY_CUSTOM_EVENT" mono /></div>}
        {mode === 'custom_conversion' && <div><FieldLabel>Custom conversion number (from Meta)</FieldLabel><TextInput value={product.customConversionId || ''} onChange={v => onChange({ ...product, customConversionId: v })} placeholder="1940441453551274" mono /></div>}
        {mode === 'app_event' && (
          <>
            <div><FieldLabel>App number (from Meta)</FieldLabel><TextInput value={product.metaAppId || ''} onChange={v => onChange({ ...product, metaAppId: v })} placeholder="935762695083961" mono /></div>
            <div><FieldLabel>In-app action name</FieldLabel><TextInput value={product.conversionEvent || ''} onChange={v => onChange({ ...product, conversionEvent: v })} placeholder="chat_success" mono /></div>
          </>
        )}
        {mode !== 'app_event' && <div><FieldLabel>Pixel number <span className="font-normal normal-case" style={{ color: 'var(--ink-3)' }}>(leave blank to use the company one)</span></FieldLabel><TextInput value={product.pixelId || ''} onChange={v => onChange({ ...product, pixelId: v || undefined })} placeholder="459303576818354" mono /></div>}
        <div>
          <FieldLabel>Facebook Page <span className="font-normal normal-case" style={{ color: 'var(--ink-3)' }}>(leave blank to use the company one)</span></FieldLabel>
          {metaPages.length > 0 ? (
            <PageSelect pages={metaPages} value={product.pageId || ''} onChange={v => onChange({ ...product, pageId: v || undefined })} allowBlank="— Use company default —" />
          ) : (
            <TextInput value={product.pageId || ''} onChange={v => onChange({ ...product, pageId: v || undefined })} placeholder="No Pages found yet — paste the Page number" mono />
          )}
        </div>
      </div>
      {mode === 'app_event' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><FieldLabel>App store link <span className="font-normal normal-case" style={{ color: 'var(--ink-3)' }}>(used for every phone)</span></FieldLabel><TextInput value={product.metaAppStoreUrl || ''} onChange={v => onChange({ ...product, metaAppStoreUrl: v || undefined })} placeholder="Used when ads are not split by phone type" mono /></div>
          <div><FieldLabel>App store link <span className="font-normal normal-case" style={{ color: 'var(--ink-3)' }}>(iPhone)</span></FieldLabel><TextInput value={product.metaAppStoreUrlIos || ''} onChange={v => onChange({ ...product, metaAppStoreUrlIos: v || undefined })} placeholder="https://apps.apple.com/app/id…" mono /></div>
          <div><FieldLabel>App store link <span className="font-normal normal-case" style={{ color: 'var(--ink-3)' }}>(Android)</span></FieldLabel><TextInput value={product.metaAppStoreUrlAndroid || ''} onChange={v => onChange({ ...product, metaAppStoreUrlAndroid: v || undefined })} placeholder="https://play.google.com/store/apps/details?id=…" mono /></div>
        </div>
      )}
    </div>
  )
}

// ── Product card ─────────────────────────────────────────────────────────────
// ── Landing-page A/B test — one creative set, two URL-split ad sets ──────────
// Self-contained: reads its own live status from the server (so it never
// collides with the bulk product-save form), and drives start / promote /
// cancel via the dedicated endpoints. Winner is report-only — promotion is an
// explicit click here, the agent never changes landingUrl on its own.
function LandingPageTestSection({ tenantId, productName, defaultControlUrl }: { tenantId: string; productName: string; defaultControlUrl: string }) {
  const [test, setTest] = useState<LandingPageTest | null | undefined>(undefined) // undefined = loading
  const [urlA, setUrlA] = useState(defaultControlUrl)
  const [urlB, setUrlB] = useState('')
  const [budget, setBudget] = useState('')
  const [busy, setBusy] = useState(false)
  const [justStarted, setJustStarted] = useState(false)
  const [msg, setMsg] = useState<{ type: 'good' | 'bad'; text: string; detail?: string } | null>(null)

  async function load() {
    try {
      const c = await getCompany(tenantId)
      const p = (c.products || []).find(pp => pp.name === productName)
      setTest(p?.landingPageTest ?? null)
      if (!urlA && p?.landingUrl) setUrlA(p.landingUrl)
    } catch { setTest(null) }
  }
  useEffect(() => { load() }, [tenantId, productName]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onStart() {
    setMsg(null)
    if (!urlA || !urlB) { setMsg({ type: 'bad', text: 'Enter both page links, A and B.' }); return }
    if (urlA === urlB) { setMsg({ type: 'bad', text: 'Page B must be a different link from page A.' }); return }
    const b = Number(budget)
    if (!Number.isFinite(b) || b <= 0) { setMsg({ type: 'bad', text: 'Enter a daily budget above ₹0.' }); return }
    setBusy(true)
    try {
      await startLandingPageTest(tenantId, { product: productName, controlUrl: urlA, variantUrl: urlB, budget: b })
      setJustStarted(true)
      setMsg({ type: 'good', text: 'Making the ads now. The test campaign will appear under Approvals in a few minutes — approve it there to go live.' })
    } catch (e) { setMsg({ type: 'bad', text: "We couldn't start the test. Try again.", detail: errorDetail(e) }) }
    finally { setBusy(false) }
  }

  async function onPromote(url: string) {
    setBusy(true); setMsg(null)
    try {
      await promoteLandingPage(tenantId, productName, url)
      setMsg({ type: 'good', text: `Done — ${url} is now the page your ads send people to. The test is closed.` })
      await load()
    } catch (e) { setMsg({ type: 'bad', text: "We couldn't switch the page. Try again.", detail: errorDetail(e) }) }
    finally { setBusy(false) }
  }

  async function onCancel() {
    setBusy(true); setMsg(null)
    try {
      await cancelLandingPageTest(tenantId, productName)
      setJustStarted(false)
      setMsg({ type: 'good', text: 'Test closed. If its campaign is still running in Meta, pause it there too.' })
      await load()
    } catch (e) { setMsg({ type: 'bad', text: "We couldn't close the test. Try again.", detail: errorDetail(e) }) }
    finally { setBusy(false) }
  }

  const Header = (
    <div className="flex items-center gap-2">
      <FlaskConical size={13} style={{ color: 'var(--accent)' }} />
      <FieldLabel>Test two landing pages</FieldLabel>
    </div>
  )

  if (!productName) {
    return <div className="card-inset p-3">{Header}<p className="text-[11px] mt-1" style={{ color: 'var(--ink-4)' }}>Save the product first, then you can test two landing pages.</p></div>
  }
  if (test === undefined) {
    return <div className="card-inset p-3">{Header}<p className="text-[11px] mt-1" style={{ color: 'var(--ink-4)' }}>Checking for a running test…</p></div>
  }

  const ev = test?.evaluation
  const isWinner = (url?: string | null) => url && ev?.leaderUrl && url === ev.leaderUrl

  const Arm = ({ label, arm, win }: { label: string; arm?: LandingPageTestArm; win?: boolean }) => (
    <div className="card-inset p-3" style={win ? { borderColor: 'var(--good-border)', background: 'var(--good-bg)' } : undefined}>
      <div className="flex min-w-0 items-center justify-between gap-2 mb-1.5">
        <span className="micro-label">{label}</span>
        {win && <span className="chip chip-good inline-flex items-center gap-1"><Trophy size={10} /> Leading</span>}
      </div>
      <p className="text-[11px] truncate mb-2" style={{ color: 'var(--ink-2)' }} title={arm?.url}>{arm?.url || '—'}</p>
      <div className="grid grid-cols-3 gap-2">
        <div><p className="micro-label">Sales</p><p className="mono text-sm" style={{ color: 'var(--ink)' }}>{arm?.conversions ?? 0}</p></div>
        <div><p className="micro-label"><Term help={GLOSSARY.cpa}>Cost per sale</Term></p><p className="mono text-sm" style={{ color: 'var(--ink)' }}>{arm?.cpa != null ? formatInr(arm.cpa) : '—'}</p></div>
        <div><p className="micro-label"><Term help={GLOSSARY.roas}>Return</Term></p><p className="mono text-sm" style={{ color: 'var(--ink)' }}>{arm?.roas != null ? `${arm.roas}x` : '—'}</p></div>
      </div>
    </div>
  )

  return (
    <div className="card-inset p-3.5">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        {Header}
        {test && <span className={`chip ${test.status === 'concluded' ? 'chip-good' : 'chip-accent'}`}>{test.status === 'concluded' ? 'Winner found' : 'Testing now'}</span>}
      </div>

      {msg && <div className="mb-2.5 px-2.5 py-1.5 rounded-md text-[11px] break-words" style={msg.type === 'good' ? { background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)' } : { background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }}>{msg.text}</div>}
      {msg?.detail && <Details className="mb-2.5" items={[{ label: 'Error', value: msg.detail }]} />}

      {/* ── Active test: show live per-URL results + actions ── */}
      {test ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Arm label="Page A · current" arm={ev?.control} win={!!isWinner(ev?.control?.url)} />
            <Arm label="Page B · new" arm={ev?.variant} win={!!isWinner(ev?.variant?.url)} />
          </div>
          {ev ? (
            <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              {ev.decided
                ? <>The leading page gets sales <span className="mono font-semibold" style={{ color: 'var(--good)' }}>{ev.marginPct}%</span> cheaper — a clear winner.</>
                : <>Still collecting results. We call a winner once each page has at least 15 sales and one is at least 15% cheaper per sale. Right now the gap is <span className="mono">{ev.marginPct}%</span>.</>}
            </p>
          ) : (
            <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Waiting for the first sales to come in on each page.</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {(test.winnerUrl || ev?.leaderUrl) && (
              <button disabled={busy} onClick={() => onPromote((test.winnerUrl || ev?.leaderUrl) as string)} className="btn btn-accent text-xs inline-flex items-center gap-1.5">
                <Trophy size={12} /> Use page {isWinner(ev?.variant?.url) ? 'B' : 'A'} from now on
              </button>
            )}
            <button disabled={busy} onClick={onCancel} className="btn btn-ghost text-xs">Close test</button>
          </div>
          {test.campaignId && <Details reference={test.campaignId} />}
        </div>
      ) : justStarted ? (
        <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>The ads and the test campaign are being made. It will show up in Approvals shortly — approve it to launch, and results will appear here.</p>
      ) : (
        /* ── No active test: the start form ── */
        <div className="space-y-2.5">
          <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Sends the same ads to the same people, but half go to page A and half to page B. We tell you which page gets cheaper sales; you decide whether to switch.</p>
          <div><FieldLabel>Page A · your current page</FieldLabel><TextInput value={urlA} onChange={setUrlA} placeholder="https://…/v1" mono type="url" /></div>
          <div><FieldLabel>Page B · the page to try</FieldLabel><TextInput value={urlB} onChange={setUrlB} placeholder="https://…/v2" mono type="url" /></div>
          <div className="w-40"><FieldLabel>Daily budget</FieldLabel><NumericInput value={budget} onChange={setBudget} prefix="₹" placeholder="5000" /></div>
          <button disabled={busy} onClick={onStart} className="btn btn-accent text-xs inline-flex items-center gap-1.5">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />} Start test
          </button>
        </div>
      )}
    </div>
  )
}

function ProductCard({ product, index, onChange, onRemove, tenantId, metaPages }: { product: Product; index: number; onChange: (p: Product) => void; onRemove: () => void; tenantId: string; metaPages: MetaPage[] }) {
  const [open, setOpen] = useState(index === 0)
  const isActive = product.active !== false
  function set<K extends keyof Product>(key: K, val: Product[K]) { onChange({ ...product, [key]: val }) }
  function tags(key: 'languages' | 'trendKeywords' | 'differentiators', raw: string) { onChange({ ...product, [key]: raw.split(',').map(s => s.trim()).filter(Boolean) }) }

  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{ border: `1px solid ${isActive ? 'var(--hairline)' : 'var(--hairline-light)'}`, background: isActive ? 'var(--surface)' : 'var(--surface-warm)' }}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" style={{ borderBottom: open ? '1px solid var(--hairline-light)' : 'none' }} onClick={() => setOpen(o => !o)}>
        <button className="shrink-0" onClick={e => { e.stopPropagation(); set('active', !isActive) }} title={isActive ? 'Turn off — stop promoting this product' : 'Turn on — allow promoting this product'}>
          {isActive ? <ToggleRight size={20} style={{ color: 'var(--good)' }} /> : <ToggleLeft size={20} style={{ color: 'var(--ink-4)' }} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: isActive ? 'var(--ink)' : 'var(--ink-3)' }}>{product.name || <span style={{ color: 'var(--ink-4)' }}>Unnamed product</span>}</p>
          {!open && <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {product.price != null && <span className="text-[11px] mono" style={{ color: 'var(--ink-3)' }}>{(product.currency || 'INR') === 'INR' ? formatInr(product.price) : `${product.currency} ${product.price.toLocaleString('en-IN')}`}</span>}
            {product.conversionEvent && <span className="chip chip-warn">Counts: {humanise(product.conversionEvent)}</span>}
            {!isActive && <span className="chip chip-neutral">Turned off</span>}
          </div>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={e => { e.stopPropagation(); onRemove() }} title="Remove this product" aria-label="Remove this product" className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bad-bg)]"><Trash2 size={13} style={{ color: 'var(--bad-border)' }} /></button>
          {open ? <ChevronUp size={14} style={{ color: 'var(--ink-4)' }} /> : <ChevronDown size={14} style={{ color: 'var(--ink-4)' }} />}
        </div>
      </div>
      {open && (
        <div className="px-4 pt-4 pb-5 space-y-4">
          <div><FieldLabel required>Name</FieldLabel><TextInput value={product.name} onChange={v => set('name', v)} placeholder="e.g. Pro Plan" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><FieldLabel>Price</FieldLabel><div className="flex gap-1.5">
              <select value={product.currency || 'INR'} onChange={e => set('currency', e.target.value)} className="input w-auto text-xs" style={{ width: 'auto' }}>{['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => <option key={c}>{c}</option>)}</select>
              <NumericInput value={product.price != null ? String(product.price) : ''} onChange={v => set('price', v ? Number(v) : undefined)} placeholder="999" />
            </div></div>
            <div><FieldLabel>What one sale is worth (₹)</FieldLabel><NumericInput value={product.conversionValue != null ? String(product.conversionValue) : ''} onChange={v => set('conversionValue', v ? Number(v) : undefined)} placeholder="999" /></div>
          </div>
          {/* Contribution margin before the separate refund adjustment. Raw
              founder proof intentionally stays at recorded value vs spend. */}
          <div>
            <FieldLabel>Profit margin</FieldLabel>
            <div className="flex items-center gap-2">
              <div className="w-32">
                <NumericInput
                  value={product.contributionMargin != null ? String(Math.round(product.contributionMargin * 100)) : ''}
                  onChange={v => {
                    const n = v ? Number(v) : NaN
                    if (!Number.isFinite(n)) { set('contributionMargin', undefined); return }
                    const clamped = Math.max(0, Math.min(100, n))
                    set('contributionMargin', clamped / 100)
                  }}
                  suffix="%"
                  placeholder="97"
                />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                {product.contributionMargin != null && product.contributionMargin > 0
                  ? <>Ads need to return about <span className="mono font-semibold">{(1 / product.contributionMargin).toFixed(2)}x</span> their cost to break even</>
                  : 'Blank uses a typical margin for your industry'}
              </p>
            </div>
          </div>
          {/* Refund rate nets configured conversion value at ingestion. The
              founder raw-ROAS proof does not reapply it. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div>
              <FieldLabel>Share of sales refunded</FieldLabel>
              <div className="flex items-center gap-2">
                <div className="w-32">
                  <NumericInput
                    value={product.refundRatePercent != null ? String(product.refundRatePercent) : ''}
                    onChange={v => {
                      const n = v ? Number(v) : NaN
                      if (!Number.isFinite(n)) { set('refundRatePercent', undefined); return }
                      set('refundRatePercent', Math.max(0, Math.min(95, n)))
                    }}
                    suffix="%"
                    placeholder="0"
                  />
                </div>
                <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {product.refundRatePercent != null && product.refundRatePercent > 0 && product.conversionValue != null
                    ? <>So one sale is really worth <span className="mono font-semibold">{formatInr(Math.round(product.conversionValue * (1 - product.refundRatePercent / 100)))}</span></>
                    : 'Blank means no refunds are taken off'}
                </p>
              </div>
            </div>
            <div>
              <FieldLabel>Hide the price in ads</FieldLabel>
              <button
                type="button"
                onClick={() => set('hidePriceInCreative', !product.hidePriceInCreative)}
                className="flex items-center gap-2 mt-1"
                title="When on, ad copy/images omit price — the landing page handles pricing (premium positioning)"
              >
                {product.hidePriceInCreative
                  ? <ToggleRight size={20} style={{ color: 'var(--good)' }} />
                  : <ToggleLeft size={20} style={{ color: 'var(--ink-4)' }} />}
                <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {product.hidePriceInCreative ? 'Price is hidden in every ad' : 'Price is shown in ads (usual)'}
                </span>
              </button>
            </div>
          </div>
          <ConversionTracking product={product} onChange={onChange} metaPages={metaPages} />
          <div><FieldLabel>Page your ads send people to</FieldLabel><TextInput value={product.landingUrl || ''} onChange={v => set('landingUrl', v)} placeholder="https://example.com/product" mono type="url" /></div>
          <LandingPageTestSection tenantId={tenantId} productName={product.name} defaultControlUrl={product.landingUrl || ''} />
          <div><FieldLabel>Description</FieldLabel><TextArea value={product.description || ''} onChange={v => set('description', v)} placeholder="A short description the AI uses when writing ads…" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([{ key: 'languages' as const, label: 'Languages', ph: 'hindi, english' }, { key: 'trendKeywords' as const, label: 'Search words to watch', ph: 'kundli, astrology' }, { key: 'differentiators' as const, label: 'What makes it different', ph: 'AI-powered, fast' }]).map(({ key, label, ph }) => (
              <div key={key}><FieldLabel>{label}</FieldLabel><p className="text-[11px] mb-1.5" style={{ color: 'var(--ink-4)' }}>Separate with commas</p>
                <TextInput value={(product[key] as string[] || []).join(', ')} onChange={v => tags(key, v)} placeholder={ph} /></div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Settings data type ───────────────────────────────────────────────────────
interface SettingsData {
  info: { tenantId: string; name: string; industry?: string; geography?: string; language?: string }
  brand: { targetAudience?: string; audiencePersonas?: string[]; customerLanguage?: string[]; tone?: string; avoid?: string[]; uniqueValue?: string; brandGuidelines?: string }
  products: Product[]
  services: Array<{ name: string; description?: string; active?: boolean }>
  activePromotions: Array<{ name: string; details?: string; expiresAt?: string }>
  competitors: { competitors?: string[]; competitorNotes?: string; calendarContext?: string }
  delivery: { slackWebhook?: string; whatsappNumber?: string; email?: string; notionDatabaseId?: string }
  meta: { accessToken?: string; accountId?: string; accountIds?: string[]; businessId?: string; pixelId?: string; pageId?: string }
  budget: { weeklyBudgetCap?: number; maxBudgetPerCampaign?: number; maxBudgetScalePercent?: number; primaryObjective?: string; targetROAS?: number; targetCPA?: number; pauseIfROASBelow?: number; pauseIfCTRBelow?: number; pauseIfFrequencyAbove?: number; pauseAfterDaysInLearning?: number; scaleIfROASAbove?: number }
  marketing: { platforms?: string[]; preferredFormats?: string[]; forbiddenTopics?: string[]; campaignsPerRun?: number; runFrequency?: string }
  pipeline: { mode?: string; ideasPerRun?: number; autoSwitch?: boolean; coldStartDays?: number; campaignStrategy?: string; pauseGracePeriodHours?: number; scaleRequiresApproval?: boolean }
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage({ params }: PageProps) {
  const { tenantId } = use(params)

  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Section save states
  const [infoState, setInfoState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [brandState, setBrandState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [productsState, setProductsState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [budgetState, setBudgetState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [marketingState, setMarketingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [pipelineState, setPipelineState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [deliveryState, setDeliveryState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [metaState, setMetaState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [competitorsState, setCompetitorsState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [regenState, setRegenState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [fixCaptionState, setFixCaptionState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [promptsHistory, setPromptsHistory] = useState<PromptsHistoryEntry[]>([])
  const [rollbackState, setRollbackState] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({})
  const [fixCaptionResult, setFixCaptionResult] = useState<string | null>(null)
  const [fixCaptionDetail, setFixCaptionDetail] = useState<string | null>(null)

  // Local editable copies
  const [info, setInfo] = useState({ name: '', industry: '', geography: '', language: '' })
  const [brand, setBrand] = useState({ targetAudience: '', audiencePersonas: [] as string[], customerLanguage: [] as string[], tone: '', avoid: [] as string[], uniqueValue: '', brandGuidelines: '' })
  const [products, setProducts] = useState<Product[]>([])
  const [budgetFields, setBudgetFields] = useState<Record<string, string>>({})
  const [marketing, setMarketing] = useState({ platforms: [] as string[], preferredFormats: [] as string[], forbiddenTopics: [] as string[], campaignsPerRun: '', runFrequency: '' })
  const [pipeline, setPipeline] = useState({ mode: 'daily', ideasPerRun: '', autoSwitch: true, coldStartDays: '', campaignStrategy: 'balanced', pauseGracePeriodHours: '', scaleRequiresApproval: false, teamMode: '' as string })
  const [delivery, setDelivery] = useState({ slackWebhook: '', whatsappNumber: '', email: '', notionDatabaseId: '' })
  const [meta, setMeta] = useState({ pixelId: '', businessId: '', pageId: '' })
  const [metaAccounts, setMetaAccounts] = useState<MetaAdAccount[]>([])
  const [metaAccountsState, setMetaAccountsState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [metaAccountsError, setMetaAccountsError] = useState<string | null>(null)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [metaSyncState, setMetaSyncState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [metaBusinesses, setMetaBusinesses] = useState<MetaBusiness[]>([])
  const [metaPages, setMetaPages] = useState<MetaPage[]>([])
  const [metaPagesState, setMetaPagesState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [metaPagesError, setMetaPagesError] = useState<string | null>(null)
  // The token's Business Manager spans multiple unrelated brands (e.g. an
  // agency-shared portfolio) — default to showing only the accounts already
  // selected for this tenant instead of dumping all discovered accounts.
  const [showAllAccounts, setShowAllAccounts] = useState(false)
  const [competitors, setCompetitors] = useState({ competitors: [] as string[], competitorNotes: '', calendarContext: '' })

  function showToast(msg: string, type: 'success' | 'error') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  async function fetchSettings() {
    try {
      // Try new /settings endpoint first, fall back to /companies/:tenantId
      let data: SettingsData
      const settingsRes = await fetch(`${API_BASE}/companies/${tenantId}/settings`)
      if (settingsRes.ok) {
        data = await settingsRes.json()
      } else {
        // Fallback: load from old company endpoint and reshape
        const companyRes = await fetch(`${API_BASE}/companies/${tenantId}`)
        if (!companyRes.ok) throw new Error(`HTTP ${companyRes.status}`)
        const c = await companyRes.json() as Company & Record<string, unknown>
        const bs = c.budgetSettings ?? {}
        function bv(key: string): number | undefined { const v = (bs as Record<string, unknown>)[key] ?? (c as Record<string, unknown>)[key]; return v != null ? Number(v) : undefined }
        data = {
          info: { tenantId: c.tenantId, name: c.name, industry: c.industry, geography: (c as Record<string, unknown>).geography as string | undefined, language: (c as Record<string, unknown>).language as string | undefined },
          brand: { targetAudience: c.targetAudience, tone: c.tone, audiencePersonas: (c as Record<string, unknown>).audiencePersonas as string[] | undefined, customerLanguage: (c as Record<string, unknown>).customerLanguage as string[] | undefined, avoid: (c as Record<string, unknown>).avoid as string[] | undefined, uniqueValue: (c as Record<string, unknown>).uniqueValue as string | undefined, brandGuidelines: (c as Record<string, unknown>).brandGuidelines as string | undefined },
          products: c.products || [],
          services: (c as Record<string, unknown>).services as SettingsData['services'] || [],
          activePromotions: (c as Record<string, unknown>).activePromotions as SettingsData['activePromotions'] || [],
          competitors: { competitors: Array.isArray(c.competitors) ? c.competitors : [], competitorNotes: (c as Record<string, unknown>).competitorNotes as string || '', calendarContext: (c as Record<string, unknown>).calendarContext as string || '' },
          delivery: c.delivery || {},
          meta: c.meta || {},
          budget: { weeklyBudgetCap: bv('weeklyBudgetCap'), maxBudgetPerCampaign: bv('maxBudgetPerCampaign'), maxBudgetScalePercent: bv('maxBudgetScalePercent'), targetROAS: bv('targetROAS'), targetCPA: bv('targetCPA'), pauseIfROASBelow: bv('pauseIfROASBelow'), pauseIfCTRBelow: bv('pauseIfCTRBelow'), pauseIfFrequencyAbove: bv('pauseIfFrequencyAbove'), scaleIfROASAbove: bv('scaleIfROASAbove') },
          marketing: { platforms: (c as Record<string, unknown>).platforms as string[] || [], preferredFormats: (c as Record<string, unknown>).preferredFormats as string[] || [], forbiddenTopics: (c as Record<string, unknown>).forbiddenTopics as string[] || [] },
          pipeline: { mode: c.pipelineConfig?.campaignStrategy ? undefined : undefined, campaignStrategy: c.pipelineConfig?.campaignStrategy, pauseGracePeriodHours: c.pipelineConfig?.pauseGracePeriodHours, scaleRequiresApproval: c.pipelineConfig?.scaleRequiresApproval, autoSwitch: (c.pipelineConfig as Record<string, unknown> | undefined)?.autoSwitch as boolean | undefined, ideasPerRun: (c.pipelineConfig as Record<string, unknown> | undefined)?.ideasPerRun as number | undefined },
        }
      }
      setSettings(data)

      // Populate local state
      setInfo({ name: data.info?.name || '', industry: data.info?.industry || '', geography: data.info?.geography || '', language: data.info?.language || '' })
      setBrand({ targetAudience: data.brand?.targetAudience || '', audiencePersonas: data.brand?.audiencePersonas || [], customerLanguage: data.brand?.customerLanguage || [], tone: data.brand?.tone || '', avoid: data.brand?.avoid || [], uniqueValue: data.brand?.uniqueValue || '', brandGuidelines: data.brand?.brandGuidelines || '' })
      setProducts(data.products || [])
      const b = data.budget || {} as Record<string, unknown>
      const bf: Record<string, string> = {}
      for (const [k, v] of Object.entries(b)) { bf[k] = v != null ? String(v) : '' }
      setBudgetFields(bf)
      setMarketing({ platforms: data.marketing?.platforms || [], preferredFormats: data.marketing?.preferredFormats || [], forbiddenTopics: data.marketing?.forbiddenTopics || [], campaignsPerRun: data.marketing?.campaignsPerRun != null ? String(data.marketing.campaignsPerRun) : '', runFrequency: data.marketing?.runFrequency || '' })
      setPipeline({ mode: data.pipeline?.mode || 'daily', ideasPerRun: data.pipeline?.ideasPerRun != null ? String(data.pipeline.ideasPerRun) : '', autoSwitch: data.pipeline?.autoSwitch ?? true, coldStartDays: data.pipeline?.coldStartDays != null ? String(data.pipeline.coldStartDays) : '', campaignStrategy: data.pipeline?.campaignStrategy || 'balanced', pauseGracePeriodHours: data.pipeline?.pauseGracePeriodHours != null ? String(data.pipeline.pauseGracePeriodHours) : '', scaleRequiresApproval: data.pipeline?.scaleRequiresApproval ?? false, teamMode: (data.pipeline as Record<string, unknown>)?.teamMode as string || 'sequential' })
      setDelivery({ slackWebhook: data.delivery?.slackWebhook || '', whatsappNumber: data.delivery?.whatsappNumber || '', email: data.delivery?.email || '', notionDatabaseId: data.delivery?.notionDatabaseId || '' })
      setMeta({ pixelId: data.meta?.pixelId || '', businessId: data.meta?.businessId || '', pageId: data.meta?.pageId || '' })
      setSelectedAccountIds(data.meta?.accountIds?.length ? data.meta.accountIds : data.meta?.accountId ? [data.meta.accountId] : [])
      // Handle competitors as either string[] (old) or object (new)
      const comp = data.competitors
      if (Array.isArray(comp)) {
        setCompetitors({ competitors: comp, competitorNotes: '', calendarContext: '' })
      } else {
        setCompetitors({ competitors: comp?.competitors || [], competitorNotes: comp?.competitorNotes || '', calendarContext: comp?.calendarContext || '' })
      }
      setError(null)
    } catch {
      setError(PLAIN_ERROR)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchSettings() }, [tenantId]) // eslint-disable-line

  async function fetchPromptsHistory() {
    try {
      const c = await getCompany(tenantId)
      setPromptsHistory(c.promptsHistory ?? [])
    } catch {
      setPromptsHistory([])
    }
  }

  useEffect(() => { fetchPromptsHistory() }, [tenantId]) // eslint-disable-line

  async function fetchMetaAccounts() {
    setMetaAccountsState('loading')
    setMetaAccountsError(null)
    try {
      const res = await getMetaAccounts(tenantId, true)
      setMetaAccounts(res.accounts)
      setMetaAccountsState('idle')
    } catch {
      setMetaAccounts([])
      setMetaAccountsState('error')
      setMetaAccountsError("We couldn't load your ad accounts from Meta. Try again.")
    }
  }

  async function fetchMetaBusinesses() {
    try {
      const res = await getMetaBusinesses(tenantId)
      setMetaBusinesses(res.businesses)
    } catch {
      setMetaBusinesses([])
    }
  }

  async function fetchMetaPages() {
    setMetaPagesState('loading')
    setMetaPagesError(null)
    try {
      const res = await getMetaPages(tenantId)
      setMetaPages(res.pages)
      setMetaPagesState('idle')
    } catch {
      setMetaPages([])
      setMetaPagesState('error')
      setMetaPagesError("We couldn't load your Facebook Pages from Meta. Try again.")
    }
  }

  // Only discoverable once an access token is on file — the endpoint calls
  // Meta live and 400s without one. Re-runs when businessId changes (saving
  // a new scope should immediately re-narrow the account/page list) — settings
  // is only refetched after a save, so this fires right after that lands.
  useEffect(() => {
    if (settings?.meta?.accessToken) {
      fetchMetaAccounts()
      fetchMetaBusinesses()
      fetchMetaPages()
    }
  }, [tenantId, settings?.meta?.accessToken, settings?.meta?.businessId]) // eslint-disable-line

  function toggleAccountSelected(id: string) {
    setSelectedAccountIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function handleSyncMetaAccounts() {
    setMetaSyncState('loading')
    try {
      await syncMetaAccounts(tenantId, selectedAccountIds)
      setMetaSyncState('success')
      showToast(`Bringing in campaigns from ${selectedAccountIds.length} ad account${selectedAccountIds.length === 1 ? '' : 's'}…`, 'success')
      fetchSettings()
      fetchMetaAccounts()
    } catch {
      setMetaSyncState('error')
      showToast("We couldn't bring in your campaigns from Meta. Try again.", 'error')
    } finally {
      setTimeout(() => setMetaSyncState('idle'), 3000)
    }
  }

  async function handleRollback(version: number) {
    setRollbackState((s) => ({ ...s, [version]: 'loading' }))
    try {
      await rollbackPrompts(tenantId, version)
      setRollbackState((s) => ({ ...s, [version]: 'success' }))
      showToast(`Went back to AI instructions version ${version}`, 'success')
      fetchPromptsHistory()
      setTimeout(() => setRollbackState((s) => ({ ...s, [version]: 'idle' })), 2500)
    } catch {
      setRollbackState((s) => ({ ...s, [version]: 'error' }))
      showToast("We couldn't go back to that version. Nothing was changed.", 'error')
      setTimeout(() => setRollbackState((s) => ({ ...s, [version]: 'idle' })), 3000)
    }
  }

  async function saveSection(body: Record<string, unknown>, setState: (s: 'idle' | 'loading' | 'success' | 'error') => void) {
    setState('loading')
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      setState('success')
      if (result.promptRegenTriggered) showToast('Saved. The AI is updating its instructions…', 'success')
      else showToast('Saved.', 'success')
      fetchSettings()
    } catch { setState('error'); showToast("We couldn't save this. Try again.", 'error') }
    finally { setTimeout(() => setState('idle'), 3000) }
  }

  async function handleRegen() {
    setRegenState('loading')
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}/regenerate`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setRegenState('success')
    } catch { setRegenState('error') }
    finally { setTimeout(() => setRegenState('idle'), 4000) }
  }

  async function handleFixCaptionVideos() {
    setFixCaptionState('loading')
    setFixCaptionResult(null)
    setFixCaptionDetail(null)
    try {
      const res = await fetch(`${API_BASE}/creative/${tenantId}/fix-caption-videos`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFixCaptionState('success')
      const fixed = data.fixed ?? data.fixedCount ?? 0
      const total = data.total ?? data.totalCount ?? 0
      setFixCaptionResult(`Fixed ${fixed} of ${total} videos`)
    } catch (err) {
      setFixCaptionState('error')
      setFixCaptionResult("We couldn't fix the videos. Try again.")
      setFixCaptionDetail(errorDetail(err) || null)
    } finally {
      setTimeout(() => { setFixCaptionState('idle'); setFixCaptionResult(null); setFixCaptionDetail(null) }, 6000)
    }
  }

  if (loading) return <SettingsLoading />

  if (error && !settings) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-[760px] items-center px-4 py-12 sm:px-6">
        <div className="card w-full p-6 text-center sm:p-9" role="alert">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}>
            <AlertCircle size={22} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-bold" style={{ color: 'var(--ink)' }}>We couldn&apos;t load your settings</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: 'var(--ink-3)' }}>{error}</p>
          <button type="button" onClick={fetchSettings} className="btn btn-primary mt-5">
            <RefreshCw size={14} aria-hidden="true" /> Try again
          </button>
        </div>
      </main>
    )
  }

  const metaConnected = !!(settings?.meta?.accessToken)
  const currentPage = metaPages.find(p => p.id === settings?.meta?.pageId)
  const savedActiveProducts = (settings?.products ?? []).filter((product) => product.active !== false && product.name?.trim())
  const savedAccountCount = settings?.meta?.accountIds?.length ?? (settings?.meta?.accountId ? 1 : 0)
  const businessReady = Boolean(settings?.info?.name?.trim() && settings?.brand?.targetAudience?.trim())
  const productsReady = savedActiveProducts.length > 0
  const metaReady = Boolean(metaConnected && savedAccountCount > 0 && settings?.meta?.pageId)
  const safetyReady = Number(settings?.budget?.weeklyBudgetCap) > 0 && Number(settings?.budget?.maxBudgetPerCampaign) > 0
  const launchChecks: LaunchCheck[] = [
    {
      id: 'business',
      label: 'Business',
      detail: businessReady ? 'Company and target audience are saved.' : 'Add the company and target audience context.',
      ready: businessReady,
      icon: Building2,
    },
    {
      id: 'products',
      label: 'Products',
      detail: productsReady ? `${savedActiveProducts.length} active product${savedActiveProducts.length === 1 ? '' : 's'} ready to promote.` : 'Add at least one active product.',
      ready: productsReady,
      icon: Package,
    },
    {
      id: 'meta',
      label: 'Meta connection',
      detail: metaReady ? `${savedAccountCount} ad account${savedAccountCount === 1 ? '' : 's'} and a Page are selected.` : 'Connect Meta, then pick an ad account and a Facebook Page.',
      ready: metaReady,
      icon: metaConnected ? Wifi : WifiOff,
    },
    {
      id: 'safety',
      label: 'Spending limits',
      detail: safetyReady ? 'Weekly and per-campaign spending limits are set.' : 'Set a weekly and a per-campaign spending limit.',
      ready: safetyReady,
      icon: ShieldCheck,
    },
  ]
  const readyCount = launchChecks.filter((check) => check.ready).length
  const readinessPercent = Math.round((readyCount / launchChecks.length) * 100)

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Toast */}
      {toast && <div className="fixed right-4 top-4 z-50 max-w-[calc(100vw-2rem)] break-words rounded-xl px-4 py-3 text-sm font-medium shadow-lg animate-scale-in" style={toast.type === 'success' ? { background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)' } : { background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }} role="status" aria-live="polite">{toast.msg}</div>}

      {/* Page header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="micro-label mb-2">Settings · Ready to launch?</p>
          <h1 className="page-title">Launch settings</h1>
          <p className="page-subtitle max-w-2xl">Tell Meridian about your business, connect your Meta account, and set spending limits. It uses these to prepare campaigns you approve.</p>
        </div>
        <button onClick={handleRegen} disabled={regenState === 'loading'} className="btn btn-ghost">
          {regenState === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {regenState === 'loading' ? 'Updating the AI…' : regenState === 'success' ? 'AI updated' : 'Update the AI with these settings'}
        </button>
      </div>

      {error && <div className="mb-5 flex items-center gap-3 break-words rounded-xl p-4 text-sm" style={{ background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }} role="alert"><AlertCircle size={14} /> {error}</div>}

      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6" aria-label="Launch readiness and settings navigation">
          <div className={styles.readinessCard}>
            <p className="micro-label">Before your first launch</p>
            <div className="mt-4 flex items-center gap-4">
              <div className={styles.score} style={{ background: `conic-gradient(var(--good) ${readinessPercent}%, var(--muted) 0)` }} aria-label={`${readyCount} of ${launchChecks.length} launch essentials ready`}>
                <span className={styles.scoreValue}>{readyCount}/4</span>
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>{readyCount === 4 ? 'Ready to launch' : `${4 - readyCount} setup step${4 - readyCount === 1 ? '' : 's'} left`}</p>
                <p className="mt-1 text-[11px] leading-4" style={{ color: 'var(--ink-3)' }}>
                  Counts only what you have saved.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-1">
              {launchChecks.map((check) => <ReadinessCheck key={check.id} check={check} />)}
            </div>
          </div>

          <nav className={styles.sideNav} aria-label="Settings sections">
            <p className="micro-label px-2 pb-2">Jump to</p>
            {[
              { href: '#business', label: 'Business foundation', icon: Building2 },
              { href: '#products', label: 'Products & sales tracking', icon: Package },
              { href: '#meta', label: 'Meta connection', icon: Wifi },
              { href: '#safety', label: 'Spending limits & automation', icon: ShieldCheck },
            ].map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} className={styles.sideNavLink}>
                <span className="flex items-center gap-2"><Icon size={14} aria-hidden="true" /> {label}</span>
                <ChevronDown size={13} className="-rotate-90" aria-hidden="true" />
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-5 stagger">

        {/* ── Company Info ── */}
        <SectionCard id="business">
          <SectionHeader icon={Building2} iconBg="var(--accent-bg)" iconColor="var(--accent)" category="Business" title="Company profile" subtitle="Who you are and where you sell. Meridian reads this before it suggests a campaign." />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><FieldLabel required>Name</FieldLabel><TextInput value={info.name} onChange={v => setInfo(s => ({ ...s, name: v }))} placeholder="Company name" /></div>
            <div><FieldLabel>Industry</FieldLabel><TextInput value={info.industry} onChange={v => setInfo(s => ({ ...s, industry: v }))} placeholder="e.g. Astrology" /></div>
            <div><FieldLabel>Where you sell</FieldLabel><TextInput value={info.geography} onChange={v => setInfo(s => ({ ...s, geography: v }))} placeholder="e.g. India" /></div>
            <div><FieldLabel>Language</FieldLabel><TextInput value={info.language} onChange={v => setInfo(s => ({ ...s, language: v }))} placeholder="e.g. English" /></div>
          </div>
          <div className="mt-5"><SaveBtn state={infoState} onClick={() => saveSection({ name: info.name, industry: info.industry, geography: info.geography, language: info.language }, setInfoState)} label="Save" /></div>
        </SectionCard>

        {/* ── Brand ── */}
        <SectionCard>
          <SectionHeader icon={Palette} iconBg="var(--accent-bg)" iconColor="var(--accent)" category="Business" title="Brand & voice" subtitle="Who you sell to, how you sound, and what the AI should never say." />
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><FieldLabel>Who you sell to</FieldLabel><TextInput value={brand.targetAudience} onChange={v => setBrand(s => ({ ...s, targetAudience: v }))} placeholder="25-40 year old professionals" /></div>
              <div><FieldLabel>Tone of voice</FieldLabel><TextInput value={brand.tone} onChange={v => setBrand(s => ({ ...s, tone: v }))} placeholder="bold and friendly" /></div>
            </div>
            <div><FieldLabel>Why people choose you</FieldLabel><TextArea value={brand.uniqueValue} onChange={v => setBrand(s => ({ ...s, uniqueValue: v }))} placeholder="What makes you different?" /></div>
            <div><FieldLabel>Brand rules</FieldLabel><TextArea value={brand.brandGuidelines} onChange={v => setBrand(s => ({ ...s, brandGuidelines: v }))} placeholder="Key brand rules the AI should follow…" rows={3} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><FieldLabel>Types of customer</FieldLabel><TagsInput value={brand.audiencePersonas} onChange={v => setBrand(s => ({ ...s, audiencePersonas: v }))} placeholder="busy mom, student" /></div>
              <div><FieldLabel>Languages your customers use</FieldLabel><TagsInput value={brand.customerLanguage} onChange={v => setBrand(s => ({ ...s, customerLanguage: v }))} placeholder="hindi, english" /></div>
              <div><FieldLabel>Topics to avoid</FieldLabel><TagsInput value={brand.avoid} onChange={v => setBrand(s => ({ ...s, avoid: v }))} placeholder="politics, religion" /></div>
            </div>
          </div>
          <div className="mt-5"><SaveBtn state={brandState} onClick={() => saveSection({ targetAudience: brand.targetAudience, tone: brand.tone, uniqueValue: brand.uniqueValue, brandGuidelines: brand.brandGuidelines, audiencePersonas: brand.audiencePersonas, customerLanguage: brand.customerLanguage, avoid: brand.avoid }, setBrandState)} label="Save brand" /></div>
        </SectionCard>

        {/* ── Products ── */}
        <SectionCard id="products">
          <SectionHeader icon={Package} iconBg="var(--accent-bg)" iconColor="var(--accent)" category="Products & sales tracking" title="Products" subtitle="What Meridian can promote, where your ads send people, and how a sale is counted."
            right={<button onClick={() => setProducts(p => [...p, { name: '', active: true, currency: 'INR' }])} className="btn btn-ghost"><Plus size={12} /> Add product</button>} />
          {products.length === 0 ? (
            <div className="card-inset py-10 text-center" style={{ borderStyle: 'dashed' }}>
              <Package size={22} className="mx-auto mb-2" style={{ color: 'var(--ink-4)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--ink-3)' }}>No products yet. Add one so Meridian has something to promote.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((p, i) => <ProductCard key={i} product={p} index={i} tenantId={tenantId} metaPages={metaPages} onChange={u => setProducts(ps => ps.map((x, j) => j === i ? u : x))} onRemove={() => setProducts(ps => ps.filter((_, j) => j !== i))} />)}
            </div>
          )}
          {products.length > 0 && <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--hairline-light)' }}><SaveBtn state={productsState} onClick={() => { if (products.some(p => !p.name.trim())) { showToast('All products need a name', 'error'); return }; saveSection({ products }, setProductsState) }} label="Save products" /></div>}
        </SectionCard>

        {/* ── Budget & Rules ── */}
        <SectionCard id="safety">
          <SectionHeader icon={DollarSign} iconBg="var(--good-bg)" iconColor="var(--good)" category="Spending limits & automation" title="Spending limits" subtitle="The most it may spend, what good results look like, and when to pause or grow a campaign on its own." />
          <div className="space-y-3">
            <RuleGroup icon={DollarSign} iconBg="var(--good-bg)" iconColor="var(--good)" title="Spending caps" hint="Limits it will never spend past, however well things are going.">
              <div><FieldLabel>Weekly cap — most you&apos;ll spend in 7 days</FieldLabel><NumericInput value={budgetFields.weeklyBudgetCap ?? ''} onChange={v => setBudgetFields(b => ({ ...b, weeklyBudgetCap: v }))} prefix="₹" /></div>
              <div><FieldLabel>Most any single campaign can spend per day</FieldLabel><NumericInput value={budgetFields.maxBudgetPerCampaign ?? ''} onChange={v => setBudgetFields(b => ({ ...b, maxBudgetPerCampaign: v }))} prefix="₹" /></div>
              <div><FieldLabel>Biggest single budget increase it can make</FieldLabel><NumericInput value={budgetFields.maxBudgetScalePercent ?? ''} onChange={v => setBudgetFields(b => ({ ...b, maxBudgetScalePercent: v }))} suffix="%" /></div>
            </RuleGroup>
            <RuleGroup icon={TrendingUp} iconBg="var(--accent-bg)" iconColor="var(--accent)" title="Goals" hint="What doing well means for this business — every campaign is measured against these.">
              <div><FieldLabel><Term help={GLOSSARY.targetRoas}>Target ROAS</Term> — the return you want once healthy</FieldLabel><NumericInput value={budgetFields.targetROAS ?? ''} onChange={v => setBudgetFields(b => ({ ...b, targetROAS: v }))} suffix="x" step={0.1} /></div>
              <div><FieldLabel><Term help={GLOSSARY.cpa}>Target CPA</Term> — what you&apos;re willing to pay per sale</FieldLabel><NumericInput value={budgetFields.targetCPA ?? ''} onChange={v => setBudgetFields(b => ({ ...b, targetCPA: v }))} prefix="₹" /></div>
            </RuleGroup>
            <RuleGroup icon={TrendingDown} iconBg="var(--bad-bg)" iconColor="var(--bad)" title="Pause automatically when" hint="If a campaign crosses any of these lines, it is paused straight away instead of waiting for you to notice.">
              <div><FieldLabel>Pause if <Term help={GLOSSARY.roas}>ROAS</Term> drops below</FieldLabel><NumericInput value={budgetFields.pauseIfROASBelow ?? ''} onChange={v => setBudgetFields(b => ({ ...b, pauseIfROASBelow: v }))} suffix="x" step={0.1} /></div>
              <div><FieldLabel>Pause if <Term help={GLOSSARY.ctr}>CTR</Term> drops below</FieldLabel><NumericInput value={budgetFields.pauseIfCTRBelow ?? ''} onChange={v => setBudgetFields(b => ({ ...b, pauseIfCTRBelow: v }))} suffix="%" step={0.1} /></div>
              <div><FieldLabel>Pause if <Term help={GLOSSARY.freq}>frequency</Term> goes above</FieldLabel><NumericInput value={budgetFields.pauseIfFrequencyAbove ?? ''} onChange={v => setBudgetFields(b => ({ ...b, pauseIfFrequencyAbove: v }))} step={0.1} /></div>
            </RuleGroup>
            <RuleGroup icon={Zap} iconBg="var(--warn-bg)" iconColor="var(--warn)" title="Grow automatically when" hint="When a campaign is clearly winning, its budget can be raised without waiting for approval.">
              <div><FieldLabel>Increase budget once <Term help={GLOSSARY.roas}>ROAS</Term> is above</FieldLabel><NumericInput value={budgetFields.scaleIfROASAbove ?? ''} onChange={v => setBudgetFields(b => ({ ...b, scaleIfROASAbove: v }))} suffix="x" step={0.1} /></div>
            </RuleGroup>
          </div>
          <div className="mt-5"><SaveBtn state={budgetState} onClick={() => { const body: Record<string, number> = {}; for (const [k, v] of Object.entries(budgetFields)) { if (v.trim()) body[k] = Number(v) }; saveSection(body, setBudgetState) }} label="Save spending limits" /></div>
        </SectionCard>

        {/* ── Marketing Preferences ── */}
        <SectionCard>
          <SectionHeader icon={Megaphone} iconBg="var(--accent-bg)" iconColor="var(--accent)" category="Business" title="Marketing preferences" subtitle="Where to advertise, which ad formats to prefer, and what to stay away from." />
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><FieldLabel>Platforms</FieldLabel><TagsInput value={marketing.platforms} onChange={v => setMarketing(s => ({ ...s, platforms: v }))} placeholder="instagram, facebook, youtube" /></div>
              <div><FieldLabel>Preferred ad formats</FieldLabel><TagsInput value={marketing.preferredFormats} onChange={v => setMarketing(s => ({ ...s, preferredFormats: v }))} placeholder="video, carousel, image" /></div>
            </div>
            <div><FieldLabel>Never mention</FieldLabel><TagsInput value={marketing.forbiddenTopics} onChange={v => setMarketing(s => ({ ...s, forbiddenTopics: v }))} placeholder="politics, religion" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><FieldLabel>Campaigns each time it plans</FieldLabel><NumericInput value={marketing.campaignsPerRun} onChange={v => setMarketing(s => ({ ...s, campaignsPerRun: v }))} /></div>
              <div><FieldLabel>How often it plans</FieldLabel><TextInput value={marketing.runFrequency} onChange={v => setMarketing(s => ({ ...s, runFrequency: v }))} placeholder="daily, weekly" /></div>
            </div>
          </div>
          <div className="mt-5"><SaveBtn state={marketingState} onClick={() => saveSection({ platforms: marketing.platforms, preferredFormats: marketing.preferredFormats, forbiddenTopics: marketing.forbiddenTopics, campaignsPerRun: marketing.campaignsPerRun ? Number(marketing.campaignsPerRun) : undefined, runFrequency: marketing.runFrequency || undefined }, setMarketingState)} label="Save preferences" /></div>
        </SectionCard>

        {/* ── Pipeline Config ── */}
        <SectionCard>
          <SectionHeader icon={Zap} iconBg="var(--warn-bg)" iconColor="var(--warn)" category="Spending limits & automation" title="How it works on its own" subtitle="How boldly it plans, how often, and what still needs your approval." />
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <FieldLabel>Approach</FieldLabel>
              {(['conservative', 'balanced', 'experimental'] as const).map(s => (
                <button key={s} onClick={() => setPipeline(p => ({ ...p, campaignStrategy: s }))} className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                  style={pipeline.campaignStrategy === s ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-warm)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>{s}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <FieldLabel>How often</FieldLabel>
                <select value={pipeline.mode} onChange={e => setPipeline(p => ({ ...p, mode: e.target.value }))} disabled={pipeline.autoSwitch}
                  className="input disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="daily">Daily</option><option value="weekly">Weekly</option>
                </select>
                {pipeline.autoSwitch && <p className="text-[10px] mt-1" style={{ color: 'var(--ink-3)' }}>Chosen automatically while “Pick how often automatically” is on</p>}
              </div>
              <div><FieldLabel>Ad ideas each time</FieldLabel><NumericInput value={pipeline.ideasPerRun} onChange={v => setPipeline(p => ({ ...p, ideasPerRun: v }))} placeholder="3" /></div>
              <div><FieldLabel>Settling-in days for new campaigns</FieldLabel><NumericInput value={pipeline.coldStartDays} onChange={v => setPipeline(p => ({ ...p, coldStartDays: v }))} placeholder="7" /></div>
              <div><FieldLabel>Hours before it may pause a new ad</FieldLabel><NumericInput value={pipeline.pauseGracePeriodHours} onChange={v => setPipeline(p => ({ ...p, pauseGracePeriodHours: v }))} placeholder="48" /></div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <button onClick={() => setPipeline(p => ({ ...p, autoSwitch: !p.autoSwitch }))} className="flex items-center gap-2 text-sm">
                {pipeline.autoSwitch ? <ToggleRight size={22} style={{ color: 'var(--accent)' }} /> : <ToggleLeft size={22} style={{ color: 'var(--ink-4)' }} />}
                <span className="font-medium" style={{ color: pipeline.autoSwitch ? 'var(--accent)' : 'var(--ink-3)' }}>Pick how often automatically</span>
              </button>
              <button onClick={() => setPipeline(p => ({ ...p, scaleRequiresApproval: !p.scaleRequiresApproval }))} className="flex items-center gap-2 text-sm">
                {pipeline.scaleRequiresApproval ? <ToggleRight size={22} style={{ color: 'var(--accent)' }} /> : <ToggleLeft size={22} style={{ color: 'var(--ink-4)' }} />}
                <span className="font-medium" style={{ color: pipeline.scaleRequiresApproval ? 'var(--accent)' : 'var(--ink-3)' }}>Ask me before raising a budget</span>
              </button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <FieldLabel>How the AI team works</FieldLabel>
              {(['sequential', 'cli'] as const).map(m => (
                <button key={m} onClick={() => setPipeline(p => ({ ...p, teamMode: m }))} className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={(pipeline as Record<string, unknown>).teamMode === m ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-warm)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>
                  {m === 'sequential' ? 'One after another (usual)' : 'Debate first'}
                </button>
              ))}
              <p className="text-xs w-full" style={{ color: 'var(--ink-3)' }}>One after another is quick and reliable. Debate first lets the AI helpers argue ideas through — slower, sometimes better.</p>
            </div>
          </div>
          <div className="mt-5"><SaveBtn state={pipelineState} onClick={() => saveSection({ pipelineConfig: { mode: pipeline.mode, ideasPerRun: pipeline.ideasPerRun ? Number(pipeline.ideasPerRun) : undefined, autoSwitch: pipeline.autoSwitch, coldStartDays: pipeline.coldStartDays ? Number(pipeline.coldStartDays) : undefined, campaignStrategy: pipeline.campaignStrategy, pauseGracePeriodHours: pipeline.pauseGracePeriodHours ? Number(pipeline.pauseGracePeriodHours) : undefined, scaleRequiresApproval: pipeline.scaleRequiresApproval, teamMode: (pipeline as Record<string, unknown>).teamMode } }, setPipelineState)} label="Save automation settings" /></div>
        </SectionCard>

        {/* ── Competitors ── */}
        <SectionCard>
          <SectionHeader icon={Users} iconBg="var(--info-bg)" iconColor="var(--info)" category="Business" title="Competitive context" subtitle="Competitors and dates in the year the research should keep an eye on." />
          <div className="space-y-4">
            <div><FieldLabel>Competitors</FieldLabel><TagsInput value={competitors.competitors} onChange={v => setCompetitors(s => ({ ...s, competitors: v }))} placeholder="Nike, Adidas, Puma" /></div>
            <div><FieldLabel>Notes on competitors</FieldLabel><TextArea value={competitors.competitorNotes} onChange={v => setCompetitors(s => ({ ...s, competitorNotes: v }))} placeholder="Key things to watch for…" /></div>
            <div><FieldLabel>Key dates and seasons</FieldLabel><TextArea value={competitors.calendarContext} onChange={v => setCompetitors(s => ({ ...s, calendarContext: v }))} placeholder="Seasonal events, sale periods…" /></div>
          </div>
          <div className="mt-5"><SaveBtn state={competitorsState} onClick={() => saveSection({ competitors: competitors.competitors, competitorNotes: competitors.competitorNotes, calendarContext: competitors.calendarContext }, setCompetitorsState)} label="Save competitors" /></div>
        </SectionCard>

        {/* ── Notifications ── */}
        <SectionCard>
          <SectionHeader icon={Bell} iconBg="var(--info-bg)" iconColor="var(--info)" category="Business" title="Where we send updates" subtitle="Where daily summaries and “needs your attention” alerts are sent." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><FieldLabel>Slack link (webhook)</FieldLabel><TextInput value={delivery.slackWebhook} onChange={v => setDelivery(s => ({ ...s, slackWebhook: v }))} placeholder="Stored securely" mono type="password" /></div>
            <div><FieldLabel>Email</FieldLabel><TextInput value={delivery.email} onChange={v => setDelivery(s => ({ ...s, email: v }))} placeholder="team@company.com" type="email" /></div>
            <div><FieldLabel>WhatsApp number</FieldLabel><TextInput value={delivery.whatsappNumber} onChange={v => setDelivery(s => ({ ...s, whatsappNumber: v }))} placeholder="+91..." /></div>
            <div><FieldLabel>Notion database (copy from its link)</FieldLabel><TextInput value={delivery.notionDatabaseId} onChange={v => setDelivery(s => ({ ...s, notionDatabaseId: v }))} placeholder="abc123..." mono /></div>
          </div>
          <div className="mt-5"><SaveBtn state={deliveryState} onClick={() => saveSection({ delivery: { slackWebhook: delivery.slackWebhook || undefined, email: delivery.email || undefined, whatsappNumber: delivery.whatsappNumber || undefined, notionDatabaseId: delivery.notionDatabaseId || undefined } }, setDeliveryState)} label="Save where to send updates" /></div>
        </SectionCard>

        {/* ── Meta Ads ── */}
        <SectionCard id="meta">
          <SectionHeader icon={metaConnected ? Wifi : WifiOff} iconBg={metaConnected ? 'var(--good-bg)' : 'var(--bad-bg)'} iconColor={metaConnected ? 'var(--good)' : 'var(--bad)'} category="Meta connection" title="Your Meta account" subtitle="Pick the business, Facebook Page and ad accounts Meridian may use." right={<StatusPill active={metaConnected} />} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mb-5">
            {[{ label: 'Meta login', value: metaConnected ? 'Connected' : 'Not connected', sub: undefined as string | undefined, active: metaConnected, warn: false },
              { label: 'Ad accounts', value: savedAccountCount > 0 ? `${savedAccountCount} selected` : 'None selected', sub: undefined as string | undefined, active: savedAccountCount > 0, warn: false },
              { label: 'Page', value: currentPage ? currentPage.name : (settings?.meta?.pageId ? 'Page not found' : 'None selected'), sub: undefined as string | undefined, active: !!settings?.meta?.pageId, warn: !!settings?.meta?.pageId && !currentPage && metaPages.length > 0 }
            ].map(f => (
              <div key={f.label} className="min-w-0">
                <p className="micro-label mb-1.5">{f.label}</p>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: f.warn ? 'var(--bad)' : f.active ? 'var(--good)' : 'var(--ink-4)' }} />
                  <p className="min-w-0 truncate text-sm font-semibold" style={{ color: 'var(--ink)' }} title={f.value}>{f.value}</p>
                </div>
                {f.sub && <p className="text-[11px] mono truncate mt-0.5" style={{ color: 'var(--ink-4)' }}>{f.sub}</p>}
                {f.warn && <p className="text-[11px] mt-0.5" style={{ color: 'var(--bad)' }}>We can&apos;t find this Page in your Meta account — pick one below</p>}
              </div>
            ))}
          </div>
          {settings?.meta?.pageId && <Details title="Page reference" reference={settings.meta.pageId} className="mb-4" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mb-4" style={{ borderTop: '1px solid var(--hairline-light)' }}>
            <div><FieldLabel>Pixel number <span className="font-normal normal-case" style={{ color: 'var(--ink-3)' }}>(Meta&apos;s sales tracker on your site)</span></FieldLabel><TextInput value={meta.pixelId} onChange={v => setMeta(s => ({ ...s, pixelId: v }))} placeholder="123456789" mono /></div>
            <div>
              <FieldLabel>Business <span className="font-normal normal-case" style={{ color: 'var(--ink-3)' }}>(limits the ad accounts and Pages listed below)</span></FieldLabel>
              {metaBusinesses.length > 0 ? (
                <select value={meta.businessId} onChange={e => setMeta(s => ({ ...s, businessId: e.target.value }))} className="input">
                  <option value="">All businesses (may include other brands&apos; accounts)</option>
                  {metaBusinesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              ) : (
                <TextInput value={meta.businessId} onChange={v => setMeta(s => ({ ...s, businessId: v }))} placeholder="No businesses found — paste the business number" mono />
              )}
            </div>
          </div>
          <div className="pt-1 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <div className="min-w-0"><FieldLabel>Facebook Page <span className="font-normal normal-case" style={{ color: 'var(--ink-3)' }}>— the Page your ads appear from. Pick the wrong one and ads run under the wrong brand.</span></FieldLabel></div>
              <button onClick={fetchMetaPages} disabled={!metaConnected || metaPagesState === 'loading'} className="btn btn-ghost shrink-0">
                <RefreshCw size={11} className={metaPagesState === 'loading' ? 'animate-spin' : ''} /> Look up in Meta
              </button>
            </div>
            {!metaConnected && <p className="text-xs" style={{ color: 'var(--ink-3)' }}>Connect Meta first, then we can list your Pages.</p>}
            {metaPagesState === 'error' && <p className="text-xs mb-1" style={{ color: 'var(--bad)' }}>{metaPagesError}</p>}
            {metaConnected && metaPages.length === 0 && metaPagesState === 'idle' && (
              <p className="text-xs" style={{ color: 'var(--ink-3)' }}>We didn&apos;t find any Facebook Pages in this Meta account.</p>
            )}
            {metaPages.length > 0 && (
              <PageSelect pages={metaPages} value={meta.pageId} onChange={v => setMeta(s => ({ ...s, pageId: v }))} />
            )}
          </div>
          <div className="mb-5"><SaveBtn state={metaState} onClick={() => saveSection({ meta: { pixelId: meta.pixelId.trim() || undefined, businessId: meta.businessId.trim() || undefined, pageId: meta.pageId.trim() || undefined } }, setMetaState)} label="Save Meta settings" /></div>

          <div className="pt-4" style={{ borderTop: '1px solid var(--hairline-light)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <FieldLabel>
                Ad accounts{metaAccounts.length > 0 && (
                  <span className="font-normal normal-case ml-1" style={{ color: 'var(--ink-3)' }}>
                    ({selectedAccountIds.length} selected{showAllAccounts ? ` · ${metaAccounts.length} found` : ''})
                  </span>
                )}
              </FieldLabel>
              <button onClick={fetchMetaAccounts} disabled={!metaConnected || metaAccountsState === 'loading'} className="btn btn-ghost">
                <RefreshCw size={11} className={metaAccountsState === 'loading' ? 'animate-spin' : ''} /> Look up in Meta
              </button>
            </div>

            {!metaConnected && (
              <p className="text-xs" style={{ color: 'var(--ink-3)' }}>Connect Meta first, then we can list your ad accounts.</p>
            )}
            {metaAccountsState === 'error' && (
              <p className="text-xs mb-2" style={{ color: 'var(--bad)' }}>{metaAccountsError}</p>
            )}
            {metaConnected && metaAccounts.length === 0 && metaAccountsState === 'idle' && (
              <p className="text-xs" style={{ color: 'var(--ink-3)' }}>We didn&apos;t find any ad accounts in this Meta account.</p>
            )}

            {metaAccounts.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {(showAllAccounts ? metaAccounts : metaAccounts.filter((acc) => selectedAccountIds.includes(acc.id))).map((acc) => {
                  const checked = selectedAccountIds.includes(acc.id)
                  const accStatus = plainStatus('metaAccountStatus', acc.status)
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => toggleAccountSelected(acc.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                      style={{ background: checked ? 'var(--accent-bg)' : 'var(--surface-warm)', border: `1px solid ${checked ? 'var(--accent)' : 'var(--hairline)'}` }}
                    >
                      {checked ? <ToggleRight size={20} className="shrink-0" style={{ color: 'var(--accent)' }} /> : <ToggleLeft size={20} className="shrink-0" style={{ color: 'var(--ink-4)' }} />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }} title={acc.name || undefined}>{acc.name || 'Unnamed ad account'}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--ink-3)' }}>{acc.currency || '—'} · {acc.timezoneName || '—'}</p>
                      </div>
                      <span className={`chip ${toneChip(accStatus.tone)} shrink-0`} title={accStatus.meaning || undefined}>{accStatus.label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {metaAccounts.length > 0 && (
              <Details
                title="Ad account references"
                className="mb-2"
                items={(showAllAccounts ? metaAccounts : metaAccounts.filter((acc) => selectedAccountIds.includes(acc.id))).map((acc) => ({ label: acc.name || 'Unnamed ad account', value: acc.id }))}
              />
            )}

            {metaAccounts.length > selectedAccountIds.length && (
              <button type="button" onClick={() => setShowAllAccounts((s) => !s)} className="text-xs font-medium mb-4" style={{ color: 'var(--accent)' }}>
                {showAllAccounts ? 'Show only selected accounts' : `Show all ${metaAccounts.length} ad accounts we found…`}
              </button>
            )}
            {!(metaAccounts.length > selectedAccountIds.length) && <div className="mb-4" />}

            <SaveBtn
              state={metaSyncState}
              onClick={handleSyncMetaAccounts}
              label={selectedAccountIds.length > 0 ? `Bring in campaigns from ${selectedAccountIds.length} selected account${selectedAccountIds.length === 1 ? '' : 's'}` : 'Bring in campaigns from all active accounts'}
            />
          </div>
        </SectionCard>

        {/* ── AI Prompts ── */}
        <SectionCard>
          <SectionHeader icon={ShieldCheck} iconBg="var(--muted)" iconColor="var(--ink-3)" category="Safety & automation" title="AI instructions" subtitle="Update the AI from what you saved above, or go back to an earlier version." />
          <div className="flex items-center gap-3">
            <button onClick={handleRegen} disabled={regenState === 'loading'} className="btn btn-ghost">
              {regenState === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {regenState === 'loading' ? 'Updating…' : regenState === 'success' ? 'Done' : 'Update now'}
            </button>
            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>Takes about 10–30 seconds. Safe to run any time.</p>
          </div>

          {/* Prompts version history */}
          <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--hairline-light)' }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="micro-label">Earlier versions</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>If the AI started doing worse after an update, go back to an earlier version.</p>
              </div>
            </div>

            {promptsHistory.length === 0 ? (
              <p className="text-xs italic" style={{ color: 'var(--ink-3)' }}>No prior versions yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--hairline-light)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Made</th>
                      <th>Lessons included</th>
                      <th className="num">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...promptsHistory]
                      .sort((a, b) => b.version - a.version)
                      .map((entry, i) => {
                        const isCurrent = i === 0
                        const rs = rollbackState[entry.version] ?? 'idle'
                        return (
                          <tr key={entry.version}>
                            <td>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs mono font-semibold" style={{ color: 'var(--ink)' }}>Version {entry.version}</span>
                                {isCurrent && (
                                  <span className="chip chip-good">Current</span>
                                )}
                              </div>
                            </td>
                            <td className="text-xs tabular-nums whitespace-nowrap">{formatWhen(entry.generatedAt)}</td>
                            <td className="text-xs">{entry.learningVersion != null ? `Set ${entry.learningVersion}` : '—'}</td>
                            <td className="num">
                              {isCurrent ? (
                                <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>—</span>
                              ) : (
                                <button
                                  onClick={() => handleRollback(entry.version)}
                                  disabled={rs === 'loading'}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors disabled:opacity-60"
                                  style={
                                    rs === 'success' ? { background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)' }
                                    : rs === 'error' ? { background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }
                                    : { background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }
                                  }
                                >
                                  {rs === 'loading' ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                  {rs === 'loading' ? 'Rolling back…' : rs === 'success' ? 'Done' : rs === 'error' ? "Didn't work" : 'Go back to this'}
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Fix Caption Videos ── */}
        <SectionCard>
          <SectionHeader icon={Sparkles} iconBg="var(--warn-bg)" iconColor="var(--warn)" category="Maintenance" title="Repair missing video captions" subtitle="Fetch again any video ads whose captions came through incomplete." />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleFixCaptionVideos}
              disabled={fixCaptionState === 'loading'}
              className={
                fixCaptionState === 'success' ? 'btn chip-good border'
                : fixCaptionState === 'error' ? 'btn btn-danger'
                : 'btn btn-ghost'
              }
            >
              {fixCaptionState === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {fixCaptionState === 'loading' ? 'Working…' : fixCaptionState === 'success' ? 'Done' : fixCaptionState === 'error' ? "Didn't work" : 'Fix videos missing captions'}
            </button>
            {fixCaptionResult && (
              <p className="text-xs font-medium" style={{ color: fixCaptionState === 'error' ? 'var(--bad)' : 'var(--good)' }}>
                {fixCaptionResult}
              </p>
            )}
            {fixCaptionDetail && <Details className="w-full" items={[{ label: 'Error', value: fixCaptionDetail }]} />}
          </div>
        </SectionCard>

      </div>
    </div>
    </main>
  )
}
