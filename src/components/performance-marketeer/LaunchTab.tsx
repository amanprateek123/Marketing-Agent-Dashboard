'use client'

import { useEffect, useId, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { X } from 'lucide-react'
import { uploadCreativeFile } from '@/lib/api'
import { PM_MOCK, createPmLaunchPaused, getPmLaunchPlan, getPmLaunchPlans, getPmLaunchProducts, istToday, retryPmLaunchPlan, startPmLaunchPlan } from '@/lib/performance-marketeer-api'
import type { PmLaunchAdSet, PmLaunchChecklist, PmLaunchCreative, PmLaunchFinding, PmLaunchLabel, PmLaunchPlan, PmLaunchSummary } from '@/types/performance-marketeer'
import { Bar, Caveat, Empty, LoadError, PmSkeleton, SectionCard, TableWrap, fmt, serverMessage, useLoad } from './shared'

const POLL_MS = 10_000
const MAX_FILES = 20

const LABEL: Record<PmLaunchLabel, { text: string; chip: string; help: string }> = {
  fact: { text: 'Fact', chip: 'chip-good', help: 'Checked directly.' },
  assumption: { text: 'Assumption', chip: 'chip-info', help: 'A sensible working choice, not proven.' },
  hypothesis: { text: 'Hypothesis', chip: 'chip-warn', help: 'An idea to test, not proof.' },
  unknown: { text: 'Unknown', chip: 'chip-neutral', help: 'Only live data can answer this.' },
}
const VERDICT = {
  realistic: { text: 'Target looks realistic', chip: 'chip-good' },
  unrealistic: { text: 'Target looks unrealistic', chip: 'chip-bad' },
  unknown: { text: 'Target: unknown until live', chip: 'chip-neutral' },
}
const PLACEMENT = { vertical: 'Stories and Reels only', vertical_feed: 'Stories, Reels and Feed', everywhere: 'All Facebook and Instagram' }
const STATUS: Record<PmLaunchCreative['finalStatus'], { text: string; chip: string }> = {
  ready: { text: 'Ready', chip: 'chip-good' },
  needs_fixes: { text: 'Needs fixes', chip: 'chip-warn' },
  excluded: { text: 'Excluded', chip: 'chip-bad' },
}
const CHECKLIST: { key: keyof PmLaunchChecklist; text: string }[] = [
  { key: 'testPurchase', text: 'I made a real test purchase, and Events Manager shows the right value in INR.' },
  { key: 'deduplicated', text: 'That purchase is counted once in Events Manager.' },
  { key: 'mobilePath', text: 'The landing page, preview and payment work on a phone.' },
  { key: 'claimsVerified', text: 'Every number or promise used in these ads is true.' },
]
const roasName = (t: 'meta' | 'first_party') => (t === 'meta' ? 'Meta ROAS' : 'first-party ROAS')

export function LaunchTab({ tenantId }: { tenantId: string }) {
  const [openId, setOpenId] = useState('')
  const [nonce, setNonce] = useState(0)
  const plans = useLoad(`launch-plans${nonce}`, () => getPmLaunchPlans(tenantId))
  const reload = plans.reload
  const active = (plans.data ?? []).some((p) => p.status === 'queued' || p.status === 'running')
  useEffect(() => {
    if (!active) return
    const t = setInterval(reload, POLL_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  if (openId) return <PlanView tenantId={tenantId} id={openId} onBack={() => { setOpenId(''); setNonce((n) => n + 1) }} />
  return (
    <div className="flex flex-col gap-5">
      <NewPlanForm tenantId={tenantId} onStarted={(id) => setOpenId(id)} />
      <SectionCard padded={false} title="Your plans" description="Each plan reviews your images, researches the market and proposes a setup. Nothing reaches Meta until you approve it.">
        <div className="p-5 pt-4">
          {plans.error ? (
            <LoadError message={plans.error} onRetry={plans.reload} />
          ) : !plans.data ? (
            <PmSkeleton rows={2} />
          ) : plans.data.length === 0 ? (
            <Empty title="No plans yet" hint="Fill in the form above to plan your first campaign." />
          ) : (
            <TableWrap label="Launch plans">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Created</th>
                  <th className="num">Daily spend</th>
                  <th>Status</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {plans.data.map((p) => (
                  <tr key={p._id}>
                    <td className="font-semibold">{p.input.productName}</td>
                    <td className="whitespace-nowrap">{fmt.dateTime(p.createdAt)}</td>
                    <td className="num">{fmt.inr(p.input.dailySpend)}</td>
                    <td><PlanStatus p={p} /></td>
                    <td><button type="button" className="btn btn-ghost !min-h-[34px]" onClick={() => setOpenId(p._id)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

function PlanStatus({ p }: { p: PmLaunchSummary }) {
  if (p.createStatus === 'paused') return <span className="chip chip-good">Created, paused</span>
  if (p.createStatus === 'creating') return <span className="chip chip-info">Creating…</span>
  if (p.status === 'queued') return <span className="chip chip-neutral">Queued</span>
  if (p.status === 'running') return <span className="chip chip-info">Working{p.step ? ` · ${p.step}` : ''}…</span>
  if (p.status === 'failed') return <span className="chip chip-bad">Failed</span>
  return p.readiness?.ready ? <span className="chip chip-good">Ready to create</span> : <span className="chip chip-warn">Not ready</span>
}

// ── Form ───────────────────────────────────────────────────────────────────

function NewPlanForm({ tenantId, onStarted }: { tenantId: string; onStarted: (id: string) => void }) {
  const products = useLoad('launch-products', () => getPmLaunchProducts(tenantId))
  const [product, setProduct] = useState('')
  const [images, setImages] = useState<{ name: string; url: string }[]>([])
  const [uploading, setUploading] = useState(0)
  const [spend, setSpend] = useState('')
  const [roas, setRoas] = useState('')
  const [roasType, setRoasType] = useState<'meta' | 'first_party'>('first_party')
  const [date, setDate] = useState(istToday())
  const [maxCpa, setMaxCpa] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selected = product || products.data?.[0]?.name || ''
  const price = products.data?.find((p) => p.name === selected)?.price

  async function addFiles(files: FileList | null) {
    const list = [...(files ?? [])].slice(0, MAX_FILES - images.length)
    if (!list.length) return
    setError('')
    setUploading((n) => n + list.length)
    await Promise.all(
      list.map(async (f) => {
        try {
          const { url } = PM_MOCK ? { url: URL.createObjectURL(f) } : await uploadCreativeFile(tenantId, f)
          setImages((xs) => [...xs, { name: f.name, url }])
        } catch (e) {
          setError(`${f.name} failed to upload: ${serverMessage(e)}`)
        } finally {
          setUploading((n) => n - 1)
        }
      }),
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!images.length) return setError('Add at least one image.')
    setBusy(true)
    try {
      const { id } = await startPmLaunchPlan(tenantId, {
        productName: selected,
        creativeUrls: images.map((i) => i.url),
        dailySpend: Number(spend),
        desiredRoas: Number(roas),
        roasType,
        launchDate: date,
        ...(maxCpa ? { maxCpa: Number(maxCpa) } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      onStarted(id)
    } catch (err) {
      setError(serverMessage(err))
      setBusy(false)
    }
  }

  const labelClass = 'flex flex-col gap-1 text-[13px] font-semibold'
  return (
    <SectionCard title="Plan a new campaign" description="Give the images and your budget. The AI ignores past campaign results and gives you a setup to approve. It won’t predict your ROAS.">
      {products.error ? (
        <LoadError message={products.error} onRetry={products.reload} />
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className={labelClass} style={{ color: 'var(--ink-2)' }}>
              Product
              <select className="input" name="product" value={selected} onChange={(e) => setProduct(e.target.value)} required>
                {(products.data ?? []).map((p) => <option key={p.name} value={p.name}>{p.name} · ₹{fmt.int(p.price)}</option>)}
              </select>
            </label>
            <label className={labelClass} style={{ color: 'var(--ink-2)' }}>
              Daily spend (₹)
              <input className="input tabular-nums" name="daily-spend" type="number" inputMode="numeric" min={1} step={1} autoComplete="off" placeholder="5000…" value={spend} onChange={(e) => setSpend(e.target.value)} required />
            </label>
            <label className={labelClass} style={{ color: 'var(--ink-2)' }}>
              Launch date
              <input className="input" name="launch-date" type="date" min={istToday()} value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className={labelClass} style={{ color: 'var(--ink-2)' }}>
              Desired ROAS
              <input className="input tabular-nums" name="desired-roas" type="number" inputMode="decimal" min={0.1} max={50} step={0.1} autoComplete="off" placeholder="1.5…" value={roas} onChange={(e) => setRoas(e.target.value)} required />
            </label>
            <label className={labelClass} style={{ color: 'var(--ink-2)' }}>
              Which ROAS?
              <select className="input" name="roas-type" value={roasType} onChange={(e) => setRoasType(e.target.value as 'meta' | 'first_party')}>
                <option value="first_party">First-party (confirmed orders, without GST)</option>
                <option value="meta">Meta (as shown in Ads Manager)</option>
              </select>
            </label>
            <label className={labelClass} style={{ color: 'var(--ink-2)' }}>
              Maximum cost per order (₹, optional)
              <input className="input tabular-nums" name="max-cpa" type="number" inputMode="numeric" min={1} step={1} autoComplete="off" placeholder={price ? `Below ₹${fmt.int(price)}…` : '1000…'} value={maxCpa} onChange={(e) => setMaxCpa(e.target.value)} />
            </label>
          </div>

          <label className={labelClass} style={{ color: 'var(--ink-2)' }}>
            Note for the AI (optional)
            <textarea className="input" name="note" rows={2} maxLength={2000} autoComplete="off" placeholder="Anything it should know…" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <div>
            <label className={labelClass} style={{ color: 'var(--ink-2)' }}>
              Images
              <input className="input" name="images" type="file" accept="image/*" multiple disabled={images.length >= MAX_FILES} onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }} />
            </label>
            <p className="explain mt-1">Upload every size you have, even of the same design. Videos come later.</p>
            {(images.length > 0 || uploading > 0) && (
              <ul className="mt-2 flex flex-wrap gap-2" aria-live="polite">
                {images.map((i) => (
                  <li key={i.url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i.url} alt={i.name} width={72} height={72} className="h-[72px] w-[72px] rounded-lg object-cover" style={{ border: '1px solid var(--hairline)' }} />
                    <button type="button" aria-label={`Remove ${i.name}`} className="btn btn-ghost absolute -right-1 -top-1 !min-h-[24px] !rounded-full !px-1" style={{ background: 'var(--surface)' }} onClick={() => setImages((xs) => xs.filter((x) => x.url !== i.url))}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
                {uploading > 0 && <li className="self-center text-[13px]" style={{ color: 'var(--ink-3)' }}>Uploading {uploading}…</li>}
              </ul>
            )}
          </div>

          {error && <p role="alert" className="text-[13px]" style={{ color: 'var(--bad)' }}>{error}</p>}
          <div>
            <button type="submit" className="btn btn-primary" disabled={busy || uploading > 0 || !products.data}>{busy ? 'Starting…' : 'Plan campaign'}</button>
          </div>
        </form>
      )}
    </SectionCard>
  )
}

// ── One plan ───────────────────────────────────────────────────────────────

function PlanView({ tenantId, id, onBack }: { tenantId: string; id: string; onBack: () => void }) {
  const q = useLoad(`launch-plan${id}`, () => getPmLaunchPlan(tenantId, id))
  const d = q.data
  const reload = q.reload
  const working = !d || d.status === 'queued' || d.status === 'running' || d.createStatus === 'creating'
  useEffect(() => {
    if (!working) return
    const t = setInterval(reload, PM_MOCK ? 1000 : POLL_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working])
  const [retrying, setRetrying] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div><button type="button" className="btn btn-ghost" onClick={onBack}>← All plans</button></div>
      {q.error && !d ? (
        <LoadError message={q.error} onRetry={q.reload} />
      ) : !d ? (
        <PmSkeleton rows={3} />
      ) : d.status === 'failed' ? (
        <SectionCard title="This plan failed">
          <p role="alert" className="break-words text-[13.5px]">{d.error}</p>
          <button type="button" className="btn btn-primary mt-3" disabled={retrying} onClick={() => { setRetrying(true); void retryPmLaunchPlan(tenantId, id).finally(() => { setRetrying(false); q.reload() }) }}>Try again</button>
        </SectionCard>
      ) : d.status !== 'done' || !d.plan || !d.review || !d.economics ? (
        <SectionCard title={`Planning ${d.input.productName}…`} description="This can take a while. You can leave this page and come back.">
          <p className="text-[13.5px]" aria-live="polite"><span className="chip chip-info">{d.status === 'queued' ? 'Waiting to start' : stepLabel(d.step)}</span></p>
        </SectionCard>
      ) : (
        <Done tenantId={tenantId} d={d} onChanged={q.reload} />
      )}
    </div>
  )
}

function stepLabel(step: string) {
  if (step.startsWith('review')) return 'Reviewing images and the page…'
  if (step.startsWith('research')) return 'Researching the market…'
  if (step.startsWith('plan check')) return 'A second AI is challenging the plan…'
  if (step.startsWith('plan')) return 'Writing the plan…'
  return 'Checking tracking…'
}

const TILE = 'card-inset flex min-w-0 flex-col gap-1 px-4 py-3.5'
const PANEL = 'flex min-w-0 flex-col gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]'
const CARD = { background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }
const TAB_CLASS = '-mb-px shrink-0 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-3 py-2 text-[14px] font-semibold text-[var(--ink-3)] transition-colors hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] data-[state=active]:border-[var(--accent)] data-[state=active]:text-[var(--accent-strong)]'

const PRIORITY = {
  must: { text: 'Must do', chip: 'chip-bad' },
  should: { text: 'Should do', chip: 'chip-warn' },
  nice: { text: 'Nice to have', chip: 'chip-neutral' },
}
const IMPACT = {
  high: { text: 'High impact', chip: 'chip-bad' },
  medium: { text: 'Medium impact', chip: 'chip-warn' },
  low: { text: 'Low impact', chip: 'chip-neutral' },
}
const PATH_STATUS = {
  ok: { text: 'Fine', chip: 'chip-good' },
  warning: { text: 'Watch', chip: 'chip-warn' },
  problem: { text: 'Problem', chip: 'chip-bad' },
  unknown: { text: 'Not checked', chip: 'chip-neutral' },
}
const PLACE = {
  include: { text: 'Include', chip: 'chip-good' },
  exclude: { text: 'Exclude', chip: 'chip-bad' },
  test_later: { text: 'Test later', chip: 'chip-info' },
  no_preference: { text: 'No preference', chip: 'chip-neutral' },
}
const EFFECT = {
  higher_demand: { text: 'More demand', chip: 'chip-good' },
  lower_demand: { text: 'Less demand', chip: 'chip-warn' },
  higher_costs: { text: 'Costlier ads', chip: 'chip-warn' },
  neutral: { text: 'Little effect', chip: 'chip-neutral' },
}
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 })

function Done({ tenantId, d, onChanged }: { tenantId: string; d: PmLaunchPlan; onChanged: () => void }) {
  const plan = d.plan!
  const e = d.economics!
  const r = d.readiness
  const a = plan.analysis
  const [creating, setCreating] = useState(false)
  const created = d.createStatus === 'paused'
  const designs = new Set((d.review?.creatives ?? []).map((c) => c.designId))
  const used = new Set(plan.adSets.flatMap((x) => x.designIds))
  return (
    <>
      <SectionCard title={plan.campaignName} description={`${d.input.productName} · launch ${fmt.date(d.input.launchDate)} · AI cost $${d.costUsd.toFixed(2)}`}>
        {created ? (
          <Banner tone="good" title="Created in Meta, paused. Nothing is spending yet.">
            <p>Check the previews in Ads Manager, then turn the campaign on there. Meta campaign id: <span className="tabular-nums" translate="no">{d.metaCampaignId}</span></p>
            {d.approved?.metaStatus && <p className="mt-1">Meta reports: campaign {d.approved.metaStatus.campaign.toLowerCase()}, {d.approved.metaStatus.adSets.paused} of {d.approved.metaStatus.adSets.total} ad sets paused, {d.approved.metaStatus.ads.paused} of {d.approved.metaStatus.ads.total} ads paused.</p>}
          </Banner>
        ) : r?.ready ? (
          <Banner tone="good" title="Ready to create" />
        ) : (
          <Banner tone="bad" title="Not ready: fix these first"><List items={r?.blocks ?? []} /></Banner>
        )}
        {d.createStatus === 'failed' && d.createError && <div className="mt-2"><Banner tone="bad" title="Creating it failed"><p className="break-words">{d.createError}</p></Banner></div>}

        <p className="mt-4 text-[18px] font-semibold leading-snug text-pretty">{a.headline}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{a.summary}</p>

        <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Tile label="Daily spend" value={fmt.inr(e.dailySpend)} foot={`${plan.adSets.length} ad set${plan.adSets.length === 1 ? '' : 's'}`} />
          <Tile label="Most per order" value={fmt.inr(e.allowedCpa)} foot={`For ${roasName(e.roasType)} ${fmt.dec(e.desiredRoas)}`} />
          <Tile label="Orders a week, at most" value={fmt.int(Math.floor(e.ordersPerWeekAtTarget))} foot="If you hit the target. Not a forecast." />
          <Tile label="Designs used" value={`${used.size} of ${designs.size}`} foot={`${d.creatives.length} image${d.creatives.length === 1 ? '' : 's'} reviewed`} />
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px]">
          <span className={`chip ${VERDICT[plan.targetVerdict].chip}`}>{VERDICT[plan.targetVerdict].text}</span>
          <span style={{ color: 'var(--ink-2)' }}>{plan.targetNote}</span>
        </p>

        {!created && (
          <div className="mt-4">
            <button type="button" className="btn btn-primary" disabled={!r?.ready || d.createStatus === 'creating'} onClick={() => setCreating(true)}>
              {d.createStatus === 'creating' ? 'Creating…' : d.createStatus === 'failed' ? 'Try creating again' : 'Approve and Create Paused'}
            </button>
            <p className="explain mt-1">This creates the campaign in Meta, paused. It spends nothing until you turn it on in Ads Manager.</p>
          </div>
        )}
      </SectionCard>

      <Tabs.Root defaultValue="analysis" className="flex min-w-0 flex-col gap-4">
        <Tabs.List aria-label="Plan details" className="flex gap-1 overflow-x-auto overflow-y-hidden" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <Tabs.Trigger value="analysis" className={TAB_CLASS}>Analysis</Tabs.Trigger>
          <Tabs.Trigger value="setup" className={TAB_CLASS}>Campaign Setup</Tabs.Trigger>
          <Tabs.Trigger value="creatives" className={TAB_CLASS}>Creatives</Tabs.Trigger>
          <Tabs.Trigger value="audience" className={TAB_CLASS}>Audience &amp; Locations</Tabs.Trigger>
          <Tabs.Trigger value="competitors" className={TAB_CLASS}>Competitors</Tabs.Trigger>
          <Tabs.Trigger value="page" className={TAB_CLASS}>Landing Page</Tabs.Trigger>
          <Tabs.Trigger value="after" className={TAB_CLASS}>After Launch</Tabs.Trigger>
          <Tabs.Trigger value="sources" className={TAB_CLASS}>Tracking &amp; Sources</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="analysis" className={PANEL}><AnalysisPanel d={d} /></Tabs.Content>
        <Tabs.Content value="setup" className={PANEL}><SetupPanel d={d} /></Tabs.Content>
        <Tabs.Content value="creatives" className={PANEL}><CreativesCard d={d} /></Tabs.Content>
        <Tabs.Content value="audience" className={PANEL}><AudiencePanel d={d} /></Tabs.Content>
        <Tabs.Content value="competitors" className={PANEL}><CompetitorPanel d={d} /></Tabs.Content>
        <Tabs.Content value="page" className={PANEL}><PagePanel d={d} /></Tabs.Content>
        <Tabs.Content value="after" className={PANEL}><AfterPanel d={d} /></Tabs.Content>
        <Tabs.Content value="sources" className={PANEL}><SourcesPanel d={d} /></Tabs.Content>
      </Tabs.Root>

      <CreateDialog tenantId={tenantId} id={d._id} name={plan.campaignName} budget={e.dailySpend} open={creating} onClose={() => setCreating(false)} onDone={() => { setCreating(false); onChanged() }} />
    </>
  )
}

function Tile({ label, value, foot }: { label: string; value: string; foot?: string }) {
  return (
    <div className={TILE}>
      <p className="micro-label">{label}</p>
      <p className="display-num text-[20px] tabular-nums sm:text-[24px]" style={{ color: 'var(--ink)' }}>{value}</p>
      {foot && <p className="explain leading-snug">{foot}</p>}
    </div>
  )
}

function AnalysisPanel({ d }: { d: PmLaunchPlan }) {
  const a = d.plan!.analysis
  const e = d.economics!
  const warnings = d.readiness?.warnings ?? []
  const order = { must: 0, should: 1, nice: 2 }
  return (
    <>
      <SectionCard title="Do these before going live" description="In order of importance.">
        <ul className="flex flex-col gap-2">
          {[...a.todo].sort((x, y) => order[x.priority] - order[y.priority]).map((t, i) => (
            <li key={i} className="flex flex-col gap-1.5 rounded-xl px-4 py-3 sm:flex-row sm:items-start sm:gap-3" style={CARD}>
              <span className={`chip ${PRIORITY[t.priority].chip} w-fit shrink-0`}>{PRIORITY[t.priority].text}</span>
              <span className="min-w-0 break-words text-[13.5px]">
                <strong>{t.action}</strong>
                <span className="block" style={{ color: 'var(--ink-2)' }}>{t.why}</span>
              </span>
            </li>
          ))}
        </ul>
        {warnings.length > 0 && <div className="mt-3"><Banner tone="warn" title="Also worth knowing"><List items={warnings} /></Banner></div>}
      </SectionCard>

      <SectionCard title="Why this setup">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {a.whySetup.map((w, i) => (
            <div key={i} className="rounded-xl px-4 py-3" style={CARD}>
              <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">{w.title} <LabelChip l={w.label} /></p>
              <p className="mt-1 break-words text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{w.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Your creatives, in short"><p className="text-[13.5px] leading-relaxed">{a.creativeTakeaway}</p></SectionCard>
        <SectionCard title="Competitors, in short"><p className="text-[13.5px] leading-relaxed">{a.competitorTakeaway}</p></SectionCard>
      </div>

      <SectionCard title="What each cost per order would mean" description="Arithmetic from your price and budget. Not a forecast: nobody knows the real cost until the campaign runs.">
        <TableWrap label="Cost per order scenarios">
          <thead>
            <tr>
              <th className="num">If an order costs</th>
              <th className="num">Orders a week</th>
              <th className="min-w-[110px]"><span className="sr-only">Orders a week, as a bar</span></th>
              <th className="num">First-party ROAS</th>
              <th className="num">Meta ROAS</th>
              <th>Your target</th>
            </tr>
          </thead>
          <tbody>
            {e.scenarios.map((s) => (
              <tr key={s.costPerOrder}>
                <td className="num">{fmt.inr(s.costPerOrder)}</td>
                <td className="num">{fmt.int(Math.floor(s.ordersPerWeek))}</td>
                <td><Bar value={s.ordersPerWeek} max={e.scenarios[0].ordersPerWeek} /></td>
                <td className="num">{fmt.dec(s.firstPartyRoas)}×</td>
                <td className="num">{fmt.dec(s.metaRoas)}×</td>
                <td>{s.meetsTarget ? <span className="chip chip-good">Met</span> : <span className="chip chip-neutral">Missed</span>}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <p className="explain mt-2">Meta’s benchmark for finishing learning is about {e.learningBenchmark} purchases a week per ad set.</p>
      </SectionCard>

      <SectionCard title="Main risks">
        <ul className="flex flex-col gap-2">
          {a.risks.map((x, i) => (
            <li key={i} className="flex flex-col gap-1.5 rounded-xl px-4 py-3 sm:flex-row sm:items-start sm:gap-3" style={CARD}>
              <span className={`chip ${IMPACT[x.impact].chip} w-fit shrink-0`}>{IMPACT[x.impact].text}</span>
              <span className="min-w-0 break-words text-[13.5px]">
                <strong>{x.risk}</strong>
                <span className="block" style={{ color: 'var(--ink-2)' }}>{x.response}</span>
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  )
}

/** One design's images, with every size it has. */
function DesignImages({ d, id, note }: { d: PmLaunchPlan; id: string; note?: string }) {
  const files = (d.review?.creatives ?? []).filter((c) => c.designId === id)
  const live = files.filter((c) => c.finalStatus !== 'excluded')
  const shown = live.length ? live : files
  return (
    <li className="max-w-[280px] rounded-lg p-2" style={{ background: 'var(--surface)', border: '1px solid var(--hairline-light)' }}>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((c) => {
          const f = d.creatives.find((x) => x.file === c.file)
          return f ? (
            <figure key={c.file} className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={`${id}, size ${f.ratio}: ${c.summary}`} width={84} height={84} className="h-[84px] w-[84px] rounded-md object-contain" style={{ background: 'var(--surface-warm)' }} />
              <figcaption className="mt-0.5 text-center text-[11.5px] tabular-nums" style={{ color: 'var(--ink-3)' }}>{f.ratio}</figcaption>
            </figure>
          ) : null
        })}
      </div>
      <p className="mt-1 break-words text-[12.5px]"><strong>{id}</strong> · {shown[0]?.angle}</p>
      {note && <p className="mt-0.5 break-words text-[12.5px]" style={{ color: 'var(--ink-2)' }}>{note}</p>}
    </li>
  )
}

function SetupPanel({ d }: { d: PmLaunchPlan }) {
  const plan = d.plan!
  const e = d.economics!
  const used = new Set(plan.adSets.flatMap((a) => a.designIds))
  const unused = [...new Set((d.review?.creatives ?? []).map((c) => c.designId))].filter((id) => !used.has(id))
  return (
    <>
      <SectionCard title="What will be created" description="Objective: website purchases. Bidding: Meta’s lowest cost, with no cap.">
        <div className="flex flex-col gap-3">
          {plan.adSets.map((a) => (
            <div key={a.name} className="rounded-xl px-4 py-3" style={CARD}>
              <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">{a.name} <LabelChip l={a.label} /></p>
              <p className="mt-1 break-words text-[13.5px]">{a.reason}</p>
              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-[auto_1fr]" style={{ color: 'var(--ink-2)' }}>
                <dt style={{ color: 'var(--ink-3)' }}>Budget</dt>
                <dd className="tabular-nums">{fmt.inr((e.dailySpend * (plan.adSets.length === 1 ? 100 : a.budgetPercent)) / 100)}/day</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Audience</dt>
                <dd>{audienceText(a)}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Location</dt>
                <dd>{a.geoStates.length || a.geoCities.length ? `${a.geoStates.length} states, ${a.geoCities.length} cities` : 'All India'}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Age and gender</dt>
                <dd className="tabular-nums">{a.ageMin}–{a.ageMax}, {a.gender === 'all' ? 'everyone' : a.gender}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Placements</dt>
                <dd>{PLACEMENT[a.placementPreset]}</dd>
              </dl>
              <p className="mt-3 text-[13px] font-semibold">Images in this ad set ({a.designIds.length} {a.designIds.length === 1 ? 'ad' : 'ads'})</p>
              <ul className="mt-1.5 flex flex-wrap gap-3">
                {a.designIds.map((id) => <DesignImages key={id} d={d} id={id} />)}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>
      {unused.length > 0 && (
        <SectionCard title="Images not used" description="See the Creatives tab for the full review.">
          <ul className="flex flex-wrap gap-3">
            {unused.map((id) => <DesignImages key={id} d={d} id={id} note={d.review!.creatives.find((c) => c.designId === id)?.weaknesses[0]} />)}
          </ul>
        </SectionCard>
      )}
      <SectionCard title="Ad text">
        <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {plan.copy.map((c) => {
            const file = d.review?.creatives.find((x) => x.designId === c.designId && x.finalStatus !== 'excluded')
            const img = d.creatives.find((x) => x.file === file?.file)
            return (
              <li key={c.designId} className="flex gap-3 rounded-xl px-3 py-3" style={CARD}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img && <img src={img.url} alt={`${c.designId}: ${file?.summary ?? ''}`} width={72} height={72} className="h-[72px] w-[72px] shrink-0 rounded-lg object-contain" style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }} />}
                <div className="min-w-0 break-words text-[13.5px]">
                  <p className="micro-label">{c.designId}</p>
                  <p className="font-semibold">{c.headline}</p>
                  <p style={{ color: 'var(--ink-2)' }}>{c.primaryText}</p>
                  <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-3)' }}>Button: {c.cta.replace(/_/g, ' ').toLowerCase()}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </SectionCard>
      <SectionCard title="Every choice, and how sure we are">
        <Findings rows={plan.decisions.map((x) => ({ ...x, text: `${x.topic}: ${x.text}` }))} />
      </SectionCard>
    </>
  )
}

function audienceText(a: PmLaunchAdSet) {
  const base = a.audienceType === 'advantage_plus' ? 'Broad (Advantage+)' : a.audienceType === 'interest' ? `Interests: ${a.interests.map((i) => i.name).join(', ')}` : `Custom audience (${a.audienceType})`
  return a.excludeAudienceIds.length ? `${base}, excluding ${a.excludeAudienceIds.length} audience${a.excludeAudienceIds.length === 1 ? '' : 's'}` : base
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[62px_1fr_28px] items-center gap-2 text-[12.5px]">
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <Bar value={value} max={5} label={`${label}: ${value} out of 5`} />
      <span className="tabular-nums text-right">{value}/5</span>
    </div>
  )
}

function CreativesCard({ d }: { d: PmLaunchPlan }) {
  const review = d.review!
  const byFile = new Map(d.creatives.map((c) => [c.file, c]))
  const designs = [...new Set(review.creatives.map((c) => c.designId))]
  const ideas = d.plan!.analysis.newCreativeIdeas
  return (
    <>
      <SectionCard title="Your creatives" description="Scores are the AI’s opinion, from 1 (weak) to 5 (strong). Real results will decide.">
        <ul className="flex flex-col gap-3">
          {designs.map((id) => {
            const files = review.creatives.filter((c) => c.designId === id)
            const first = files[0]
            // An excluded file never ships, even when other sizes of the design do.
            const live = files.filter((c) => c.finalStatus !== 'excluded')
            const left = files.filter((c) => c.finalStatus === 'excluded' && live.length > 0)
            const worst = live.find((c) => c.finalStatus === 'needs_fixes') ?? live[0] ?? first
            const lead = live[0] ?? first
            const sizes = (live.length ? live : files).map((c) => byFile.get(c.file)?.ratio ?? '')
            const uniq = (f: (c: PmLaunchCreative) => string[]) => [...new Set(files.flatMap(f))]
            const advice = uniq((c) => c.resizeAdvice)
            const claims = uniq((c) => c.claimsToVerify)
            const strengths = uniq((c) => c.strengths)
            const weaknesses = uniq((c) => c.weaknesses)
            return (
              <li key={id} className="flex flex-col gap-4 rounded-xl px-4 py-4 md:flex-row" style={CARD}>
                <div className="flex shrink-0 flex-col gap-3 md:w-[220px]">
                  <div className="flex flex-wrap gap-1.5">
                    {files.map((c) => {
                      const f = byFile.get(c.file)
                      return f ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={c.file} src={f.url} alt={`${id}, size ${f.ratio}: ${c.summary}`} width={104} height={104} className="h-[104px] w-[104px] rounded-lg object-contain" style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }} />
                      ) : null
                    })}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Meter label="Hook" value={lead.scores.hook} />
                    <Meter label="Clarity" value={lead.scores.clarity} />
                    <Meter label="Offer" value={lead.scores.offer} />
                    <Meter label="Trust" value={lead.scores.trust} />
                  </div>
                </div>
                <div className="min-w-0 flex-1 text-[13px]" style={{ color: 'var(--ink-2)' }}>
                  <p className="flex flex-wrap items-center gap-1.5">
                    <strong className="text-[15px]" style={{ color: 'var(--ink)' }}>{id}</strong>
                    <span className={`chip ${STATUS[worst.finalStatus].chip}`}>{STATUS[worst.finalStatus].text}</span>
                    <span>{first.language} · {first.angle}</span>
                  </p>
                  <p className="mt-1 break-words text-[13.5px]" style={{ color: 'var(--ink)' }}>{first.summary}</p>
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {(['1:1', '4:5', '9:16'] as const).map((s) => <span key={s} className={`chip ${sizes.includes(s) ? 'chip-good' : 'chip-neutral'}`}>{s} {sizes.includes(s) ? 'available' : 'missing'}</span>)}
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className={`chip ${files.every((c) => c.phoneReadability === 'pass') ? 'chip-good' : 'chip-bad'}`}>{files.every((c) => c.phoneReadability === 'pass') ? 'Readable on a phone' : 'Hard to read on a phone'}</span>
                    <span className={`chip ${files.every((c) => c.landingMatch === 'pass') ? 'chip-good' : 'chip-warn'}`}>{files.every((c) => c.landingMatch === 'pass') ? 'Matches the page' : 'Doesn’t match the page'}</span>
                    <span className={`chip ${files.some((c) => c.policyRisk === 'block') ? 'chip-bad' : files.some((c) => c.policyRisk === 'review') ? 'chip-warn' : 'chip-good'}`}>{files.some((c) => c.policyRisk === 'block') ? 'Likely rejected by Meta' : files.some((c) => c.policyRisk === 'review') ? 'Policy: needs a check' : 'Low policy risk'}</span>
                  </p>
                  <div className="mt-2.5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {strengths.length > 0 && <div><strong style={{ color: 'var(--ink)' }}>What works</strong><List items={strengths} /></div>}
                    {weaknesses.length > 0 && <div><strong style={{ color: 'var(--ink)' }}>What’s weak</strong><List items={weaknesses} /></div>}
                    {advice.length > 0 && <div><strong style={{ color: 'var(--ink)' }}>Resize and fix</strong><List items={advice} /></div>}
                    {claims.length > 0 && <div><strong style={{ color: 'var(--ink)' }}>Needs proof</strong><List items={claims} /></div>}
                  </div>
                  {left.length > 0 && <p className="mt-2"><strong>Left out:</strong> {left.map((c) => `size ${byFile.get(c.file)?.ratio ?? c.file}`).join(', ')}, as it failed the review.</p>}
                </div>
              </li>
            )
          })}
        </ul>
        {review.missingAngles.length > 0 && <div className="mt-3 text-[13.5px]"><strong>Angles none of these use</strong><List items={review.missingAngles} /></div>}
      </SectionCard>
      {ideas.length > 0 && (
        <SectionCard title="Images worth making next" description="Ideas to test, based on the gaps above.">
          <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {ideas.map((x, i) => (
              <li key={i} className="break-words rounded-xl px-4 py-3 text-[13.5px]" style={CARD}>
                <p className="micro-label">{x.angle}</p>
                <p className="mt-0.5 font-semibold">“{x.hook}”</p>
                <p className="mt-1" style={{ color: 'var(--ink-2)' }}>{x.why}</p>
                <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-3)' }}>{x.format}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  )
}

function AudiencePanel({ d }: { d: PmLaunchPlan }) {
  const r = d.research
  if (!r) return <Empty title="No research saved" />
  return (
    <>
      <SectionCard title="Who may buy" description="Groups to test, from public research. Meta’s broad targeting can reach all of them.">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {r.audience.map((a) => (
            <div key={a.name} className="break-words rounded-xl px-4 py-3" style={CARD}>
              <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">{a.name} <LabelChip l={a.label} /></p>
              <p className="mt-1 text-[13.5px]">{a.situation}</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]" style={{ color: 'var(--ink-2)' }}>
                <dt style={{ color: 'var(--ink-3)' }}>Why they buy</dt><dd>{a.whyTheyBuy}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Age</dt><dd className="tabular-nums">{a.ageRange}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Languages</dt><dd>{a.languages}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Message idea</dt><dd>{a.messageIdea}</dd>
              </dl>
            </div>
          ))}
        </div>
      </SectionCard>
      {r.reach.length > 0 && (
        <SectionCard title="How many people can we reach?" description="Meta’s own estimate of monthly active people.">
          <TableWrap label="Reach estimates">
            <thead><tr><th>Targeting</th><th className="num">Reach</th></tr></thead>
            <tbody>{r.reach.map((x, i) => <tr key={i}><td className="break-words">{x.targeting}</td><td className="num whitespace-nowrap">{compact.format(x.low)}–{compact.format(x.high)}</td></tr>)}</tbody>
          </TableWrap>
        </SectionCard>
      )}
      <SectionCard title="Locations" description="A place is only included or excluded with a real reason. Otherwise the campaign stays broad.">
        <TableWrap label="Location decisions">
          <thead><tr><th>Place</th><th>Decision</th><th>Why</th><th>How sure</th></tr></thead>
          <tbody>
            {r.locations.map((x, i) => (
              <tr key={i}>
                <td className="font-semibold">{x.place}</td>
                <td><span className={`chip ${PLACE[x.decision].chip}`}>{PLACE[x.decision].text}</span></td>
                <td className="min-w-[240px] whitespace-normal break-words">{x.reason}</td>
                <td><LabelChip l={x.label} /></td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </SectionCard>
      {r.dates.length > 0 && (
        <SectionCard title="Dates around the launch">
          <ul className="flex flex-col gap-2">
            {r.dates.map((x, i) => (
              <li key={i} className="flex flex-col gap-1 rounded-xl px-4 py-3 text-[13.5px] sm:flex-row sm:items-start sm:gap-3" style={CARD}>
                <span className="w-[72px] shrink-0 font-semibold tabular-nums">{fmt.date(x.date)}</span>
                <span className="min-w-0 flex-1 break-words">
                  <span className="flex flex-wrap items-center gap-2"><strong>{x.event}</strong><span className={`chip ${EFFECT[x.effect].chip}`}>{EFFECT[x.effect].text}</span></span>
                  <span className="mt-0.5 block" style={{ color: 'var(--ink-2)' }}>{x.whatToDo}</span>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  )
}

function CompetitorPanel({ d }: { d: PmLaunchPlan }) {
  const r = d.research
  if (!r) return <Empty title="No research saved" />
  return (
    <>
      <Caveat>Ad libraries don’t show competitors’ spend, ROAS or audience in India. A long-running ad probably works, but that isn’t proof.</Caveat>
      {r.competitors.length === 0 ? (
        <Empty title="No competitor data this time" hint={r.gaps.join(' ') || 'The source returned nothing.'} />
      ) : (
        <SectionCard title="What competitors are running">
          <TableWrap label="Competitor ads">
            <thead><tr><th>Brand</th><th>Angle</th><th>Offer</th><th>Format</th><th>Running for</th><th>What it means for us</th></tr></thead>
            <tbody>
              {r.competitors.map((c, i) => (
                <tr key={i}>
                  <td className="font-semibold">{c.brand}</td>
                  <td className="min-w-[180px] whitespace-normal break-words">{c.angle}</td>
                  <td className="min-w-[120px] whitespace-normal break-words">{c.offer}</td>
                  <td>{c.format}</td>
                  <td className="whitespace-nowrap">{c.runningFor}</td>
                  <td className="min-w-[220px] whitespace-normal break-words">{c.takeaway}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </SectionCard>
      )}
      {r.patterns.length > 0 && <SectionCard title="Patterns across competitors"><Findings rows={r.patterns} /></SectionCard>}
    </>
  )
}

function PagePanel({ d }: { d: PmLaunchPlan }) {
  const l = d.review!.landing
  return (
    <>
      <SectionCard title="The path from ad to paid order" description={l.summary}>
        <ol className="flex flex-col gap-2">
          {l.path.map((s, i) => (
            <li key={i} className="flex flex-col gap-1 rounded-xl px-4 py-3 text-[13.5px] sm:flex-row sm:items-center sm:gap-3" style={CARD}>
              <span className="flex items-center gap-2 sm:w-[210px] sm:shrink-0">
                <span className="tabular-nums" style={{ color: 'var(--ink-3)' }}>{i + 1}.</span>
                <strong>{s.step}</strong>
                <span className={`chip ${PATH_STATUS[s.status].chip}`}>{PATH_STATUS[s.status].text}</span>
              </span>
              <span className="min-w-0 break-words" style={{ color: 'var(--ink-2)' }}>{s.note}</span>
            </li>
          ))}
        </ol>
        <p className="explain mt-2">Main button: {l.mainButton}. Can people buy directly? {l.directPurchase === 'yes' ? 'Yes' : l.directPurchase === 'no' ? 'No' : 'Not known'}.</p>
      </SectionCard>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {l.whatWorks.length > 0 && <SectionCard title="What works"><div className="text-[13.5px]"><List items={l.whatWorks} /></div></SectionCard>}
        {l.issues.length > 0 && <SectionCard title="Problems to fix"><div className="text-[13.5px]"><List items={l.issues} /></div></SectionCard>}
      </div>
      {l.claimsToVerify.length > 0 && (
        <SectionCard title="Claims left out of the ads" description="These are on the page, but aren’t verified, so the ad text doesn’t use them.">
          <p className="flex flex-wrap gap-1.5">{l.claimsToVerify.map((c) => <span key={c} className="chip chip-neutral">{c}</span>)}</p>
        </SectionCard>
      )}
    </>
  )
}

function AfterPanel({ d }: { d: PmLaunchPlan }) {
  const p = d.plan!
  const days = [['Before going live', p.reviewPlan.beforeLive], ['Day 1', p.reviewPlan.day1], ['Day 3', p.reviewPlan.day3], ['Day 7', p.reviewPlan.day7]] as const
  return (
    <>
      <SectionCard title="What to check, and when">
        <ol className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {days.map(([k, v]) => (
            <li key={k} className="rounded-xl px-4 py-3 text-[13.5px]" style={CARD}>
              <p className="mb-1 font-semibold">{k}</p>
              <List items={[...v]} />
            </li>
          ))}
        </ol>
      </SectionCard>
      <SectionCard title="When to pause or scale" description="Based on spend and purchases, never the calendar alone.">
        <div className="text-[13.5px]"><List items={p.reviewPlan.rules} /></div>
      </SectionCard>
      {p.unknowns.length > 0 && (
        <SectionCard title="Only live data can answer">
          <p className="flex flex-wrap gap-1.5">{p.unknowns.map((u) => <span key={u} className="chip chip-neutral">{u}</span>)}</p>
        </SectionCard>
      )}
    </>
  )
}

function SourcesPanel({ d }: { d: PmLaunchPlan }) {
  const t = d.tracking
  const sources = d.plan!.sources
  return (
    <>
      {t && (
        <SectionCard title="Tracking check" description="Read from Meta when this plan was made, and again when you create it.">
          <div className="text-[13.5px]"><List items={t.facts} /></div>
          {t.blocks.length > 0 && <div className="mt-2"><Banner tone="bad" title="Blocks"><List items={t.blocks} /></Banner></div>}
          {t.warnings.length > 0 && <div className="mt-2"><Banner tone="warn" title="Warnings"><List items={t.warnings} /></Banner></div>}
        </SectionCard>
      )}
      {(d.research?.gaps.length ?? 0) > 0 && <SectionCard title="Couldn’t research"><div className="text-[13.5px]"><List items={d.research!.gaps} /></div></SectionCard>}
      <SectionCard title="Sources">
        {sources.length === 0 ? <p className="text-[13.5px]">None listed.</p> : (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px]">
            {sources.map((s) => <li key={s} className="break-words">{/^https?:\/\//.test(s) ? <a href={s} target="_blank" rel="noreferrer" className="underline">{s}</a> : s}</li>)}
          </ul>
        )}
      </SectionCard>
    </>
  )
}

function CreateDialog({ tenantId, id, name, budget, open, onClose, onDone }: { tenantId: string; id: string; name: string; budget: number; open: boolean; onClose: () => void; onDone: () => void }) {
  const [ticks, setTicks] = useState<Partial<PmLaunchChecklist>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const base = useId()
  const allTicked = CHECKLIST.every((c) => ticks[c.key])
  async function create() {
    setBusy(true)
    setError('')
    try {
      await createPmLaunchPaused(tenantId, id, ticks as PmLaunchChecklist)
      onDone()
    } catch (e) {
      setError(serverMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay data-portal className="fixed inset-0 z-[70] animate-fade-in" style={{ background: 'rgba(15,23,42,0.45)' }} />
        <Dialog.Content data-portal className="card fixed left-1/2 top-1/2 z-[71] flex max-h-[90vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto p-5" style={{ background: 'var(--surface)' }}>
          <Dialog.Title className="section-title pr-10 text-pretty">Create “{name}” paused?</Dialog.Title>
          <Dialog.Description className="explain">
            This creates the campaign in Meta at {fmt.inr(budget)}/day, paused. It spends nothing until you turn it on in Ads Manager. Please confirm these. Code can’t check them.
          </Dialog.Description>
          <ul className="flex flex-col gap-2">
            {CHECKLIST.map((c) => (
              <li key={c.key}>
                <label htmlFor={`${base}-${c.key}`} className="flex cursor-pointer items-start gap-2 text-[13.5px]">
                  <input id={`${base}-${c.key}`} type="checkbox" className="mt-0.5" checked={!!ticks[c.key]} onChange={(e) => setTicks((t) => ({ ...t, [c.key]: e.target.checked }))} />
                  {c.text}
                </label>
              </li>
            ))}
          </ul>
          {error && <p role="alert" className="break-words text-[13px]" style={{ color: 'var(--bad)' }}>{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!allTicked || busy} onClick={() => void create()}>{busy ? 'Creating…' : 'Approve and Create Paused'}</button>
          </div>
          <Dialog.Close asChild>
            <button type="button" className="btn btn-ghost absolute right-3 top-3 !min-h-[36px] !px-2" aria-label="Close" disabled={busy}><X size={18} aria-hidden="true" /></button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── Small parts ────────────────────────────────────────────────────────────

function LabelChip({ l }: { l: PmLaunchLabel }) {
  return <span className={`chip ${LABEL[l].chip}`} title={LABEL[l].help}>{LABEL[l].text}</span>
}

function Banner({ tone, title, children }: { tone: 'good' | 'warn' | 'bad'; title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg px-3 py-2 text-[13px]" style={{ background: `var(--${tone}-bg)`, border: `1px solid var(--${tone}-border)`, color: 'var(--ink-2)' }}>
      <strong style={{ color: `var(--${tone})` }}>{title}</strong>
      {children && <div className="mt-1">{children}</div>}
    </div>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-0.5 pl-5">
      {items.map((x, i) => <li key={i} className="break-words">{x}</li>)}
    </ul>
  )
}

function Findings({ rows }: { rows: PmLaunchFinding[] }) {
  return (
    <ul className="flex flex-col gap-2 text-[13.5px]">
      {rows.map((r, i) => (
        <li key={i} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
          <span className="w-fit shrink-0 sm:w-[96px]"><LabelChip l={r.label} /></span>
          <span className="min-w-0 flex-1 break-words">{r.text}</span>
        </li>
      ))}
    </ul>
  )
}
