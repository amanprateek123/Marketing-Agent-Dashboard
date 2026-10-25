'use client'

import { getPmEntities, getPmFunnel } from '@/lib/performance-marketeer-api'
import type { PmBand, PmFunnelResponse, PmQuery } from '@/types/performance-marketeer'
import { Bar, Caveat, Empty, LoadError, PmSkeleton, SectionCard, Source, TableWrap, fmt, useLoad } from './shared'
import type { PmView } from './PerformanceMarketeer'

const CHANNELS = ['meta_ad', 'organic_search', 'direct', 'whatsapp', 'google_ads', 'instagram_organic']

export const channelLabel = (c: string) =>
  ({ meta_ad: 'Meta ads', organic_search: 'Organic search', direct: 'Direct', whatsapp: 'WhatsApp', google_ads: 'Google Ads', instagram_organic: 'Instagram (organic)' })[c] ??
  c.replace(/_/g, ' ')

export function FunnelTab({ tenantId, q, view, update }: { tenantId: string; q: PmQuery; view: PmView; update: (p: Partial<PmView>) => void }) {
  const fq = { ...q, channel: view.ad ? 'meta_ad' : view.channel || undefined, adId: view.ad || undefined }
  const f = useLoad(`funnel${JSON.stringify(fq)}`, () => getPmFunnel(tenantId, fq))
  const ads = useLoad(`fads${JSON.stringify(q)}`, () => getPmEntities(tenantId, { ...q, level: 'ad' }))

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-wrap items-end gap-3 px-5 py-4">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[13px] font-semibold sm:flex-none" style={{ color: 'var(--ink-2)' }}>
          Traffic source
          <select className="input" name="channel" value={view.ad ? 'meta_ad' : view.channel} disabled={!!view.ad} onChange={(e) => update({ channel: e.target.value })}>
            <option value="">All sources</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>{channelLabel(c)}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          Meta ad
          <select className="input" name="ad" value={view.ad} onChange={(e) => update({ ad: e.target.value })}>
            <option value="">All ads</option>
            {view.ad && !ads.data?.rows.some((a) => a.id === view.ad) && <option value={view.ad}>Ad {view.ad} (no delivery in range)</option>}
            {(ads.data?.rows ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        {(view.ad || view.channel) && (
          <button type="button" className="btn btn-ghost" onClick={() => update({ ad: '', channel: '' })}>
            Clear Filters
          </button>
        )}
      </div>

      {f.error ? (
        <LoadError message={f.error} onRetry={f.reload} />
      ) : !f.data ? (
        <PmSkeleton rows={3} />
      ) : f.data.steps[0]?.visitors ? (
        <div className={`flex flex-col gap-5 ${f.loading ? 'opacity-60' : ''}`} aria-busy={f.loading}>
          <Steps d={f.data} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Bands title="Scroll depth" bands={f.data.scroll} />
            <Bands title="Time on page" bands={f.data.timeOnPage} />
          </div>
          <Caveat>{f.data.caveat}</Caveat>
          <Breakdowns d={f.data} />
        </div>
      ) : (
        <Empty title="No visitors in this range" hint="Try a longer range or clear the filters." />
      )}
    </div>
  )
}

function Steps({ d }: { d: PmFunnelResponse }) {
  const start = d.steps[0]?.visitors ?? 0
  return (
    <SectionCard title="From landing to paid" description={<>Visitors at each step. <Source s="site" /> for site steps, <Source s="fp" /> for paid orders.</>}>
      <ol className="flex flex-col gap-3">
        {d.steps.map((s, i) => {
          const drop = s.rateFromPrevious == null ? null : 1 - s.rateFromPrevious
          return (
            <li key={s.key} className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,240px)_1fr_auto] sm:items-center sm:gap-4">
              <span className="text-[13.5px] font-semibold">{i + 1}. {s.label}</span>
              <Bar value={s.visitors} max={start} color={`var(--viz-funnel-${Math.min(4, i + 1)})`} label={`${s.label}: ${fmt.pct(s.rateFromStart)} of visitors`} />
              <span className="text-[13px] tabular-nums sm:w-[230px] sm:text-right" style={{ color: 'var(--ink-2)' }}>
                <strong style={{ color: 'var(--ink)' }}>{fmt.int(s.visitors)}</strong> · {fmt.pct(s.rateFromStart)} of start
                {drop != null && (
                  <span style={{ color: drop > 0.5 ? 'var(--bad)' : 'var(--ink-3)' }}> · −{fmt.pct(drop, 0)} here</span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </SectionCard>
  )
}

function Bands({ title, bands }: { title: string; bands: PmBand[] }) {
  const max = Math.max(0.0001, ...bands.map((b) => b.conversion ?? 0))
  return (
    <SectionCard title={title} description="Share of visitors in each band and how often they ordered.">
      <TableWrap label={`${title} bands`}>
        <thead>
          <tr>
            <th>Band</th>
            <th className="num">Visitors <Source s="site" /></th>
            <th className="num">Orders <Source s="fp" /></th>
            <th className="num">Conversion <Source s="fp" /></th>
            <th className="w-[120px]"><span className="sr-only">Conversion bar</span></th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => (
            <tr key={b.band}>
              <td>{b.band}</td>
              <td className="num">{fmt.int(b.visitors)}</td>
              <td className="num">{fmt.int(b.orders)}</td>
              <td className="num font-semibold">{fmt.pct(b.conversion)}</td>
              <td><Bar value={b.conversion ?? 0} max={max} color="var(--viz-value)" /></td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </SectionCard>
  )
}

function Breakdowns({ d }: { d: PmFunnelResponse }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <SectionCard title="By source" className="lg:col-span-2">
        <TableWrap label="Conversion by traffic source">
          <thead>
            <tr>
              <th>Source</th>
              <th className="num">Visitors <Source s="site" /></th>
              <th className="num">Orders <Source s="fp" /></th>
              <th className="num">Visit → order <Source s="fp" /></th>
              <th className="num">Scrolled 75%+ <Source s="site" /></th>
            </tr>
          </thead>
          <tbody>
            {d.byChannel.map((c) => {
              const meta = c.channel === 'meta_ad'
              return (
                <tr key={c.channel} style={meta ? { background: 'var(--accent-soft)' } : undefined}>
                  <td className={meta ? 'font-semibold' : undefined}>
                    {channelLabel(c.channel)} {meta && <span className="chip chip-accent ml-1">Paid Meta</span>}
                  </td>
                  <td className="num">{fmt.int(c.visitors)}</td>
                  <td className="num">{fmt.int(c.orders)}</td>
                  <td className="num font-semibold">{fmt.pct(c.conversion, 2)}</td>
                  <td className="num">{fmt.pct(c.deepScrollShare, 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </SectionCard>
      <Split title="By device" rows={d.byDevice.map((r) => ({ name: r.device, ...r }))} />
      <Split title="By language" rows={d.byLocale.map((r) => ({ name: r.locale === 'hi' ? 'Hindi' : r.locale === 'en' ? 'English' : r.locale, ...r }))} />
    </div>
  )
}

function Split({ title, rows }: { title: string; rows: { name: string; visitors: number; orders: number; conversion: number | null }[] }) {
  return (
    <SectionCard title={title}>
      <TableWrap label={`Conversion ${title.toLowerCase()}`}>
        <thead>
          <tr>
            <th>{title === 'By device' ? 'Device' : 'Language'}</th>
            <th className="num">Visitors <Source s="site" /></th>
            <th className="num">Orders <Source s="fp" /></th>
            <th className="num">Visit → order <Source s="fp" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td className="num">{fmt.int(r.visitors)}</td>
              <td className="num">{fmt.int(r.orders)}</td>
              <td className="num font-semibold">{fmt.pct(r.conversion, 2)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </SectionCard>
  )
}
