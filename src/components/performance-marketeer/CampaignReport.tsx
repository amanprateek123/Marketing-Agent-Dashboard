'use client'

import Link from 'next/link'
import { Fragment } from 'react'
import { getPmCampaignReport } from '@/lib/performance-marketeer-api'
import type { PmCampaignReport, PmCreativeTag, PmReportBreakdown, PmReportCause } from '@/types/performance-marketeer'
import { RunActions, noEv } from './AgentTab'
import { Empty, LoadError, PmSkeleton, fmt, useLoad } from './shared'

/**
 * The owner's report for one AI run: verdict, where the funnel breaks, why,
 * creatives, audience, trend and the plan. One page, readable top to bottom,
 * and printable to PDF (globals.css hides the app chrome in print).
 */
export function CampaignReport({ tenantId, campaignId, date }: { tenantId: string; campaignId: string; date?: string }) {
  const res = useLoad(`campaign-report${campaignId}${date ?? ''}`, () => getPmCampaignReport(tenantId, campaignId, date))
  const back = `/dashboard/${encodeURIComponent(tenantId)}/performance-marketeer?tab=agent`

  if (res.error) return <Shell back={back}><LoadError message={res.error} onRetry={res.reload} /></Shell>
  if (!res.data) return <Shell back={back}><PmSkeleton /></Shell>
  const r = res.data
  const onMeta = r.basis !== null
  const causes = r.causes.filter((c) => c.verdict !== 'rejected').sort((a, b) => b.impactRupeesPerDay - a.impactRupeesPerDay || b.confidence - a.confidence)
  const rejected = r.causes.filter((c) => c.verdict === 'rejected')

  return (
    <Shell back={back}>
      <header className="report-head">
        <p className="report-eyebrow">Campaign analysis · run {fmt.date(r.run.date)} · data {fmt.date(r.window.from)}–{fmt.date(r.window.to)}</p>
        <h1 className="report-title">{r.run.campaignName}</h1>
        <p className="report-meta">
          {[r.settings.objective?.replace('OUTCOME_', '').toLowerCase(), r.settings.status?.toLowerCase(), r.launched && `launched ${fmt.date(r.launched)}`, r.settings.currentDailyBudget && `${fmt.inr(r.settings.currentDailyBudget)}/day`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <button type="button" className="btn btn-ghost report-print" onClick={() => window.print()}>
          Download PDF
        </button>
      </header>

      <Section n={1} title="Summary">
        {r.last7 && (
          <div className="report-kpis">
            <Kpi label="Spend (7 days)" value={fmt.inr(r.last7.spend)} />
            <Kpi label="Purchases (Meta)" value={fmt.int(r.last7.metaPurchases)} />
            <Kpi label="Cost per purchase" value={fmt.inr(r.last7.costPerPurchase)} />
            <Kpi label="ROAS (Meta)" value={fmt.roas(r.last7.metaRoas)} tone={tone(r.last7.metaRoas)} />
            <Kpi label="ROAS (our orders)" value={onMeta ? 'Not linked' : fmt.roas(r.last7.firstPartyRoas)} tone={onMeta ? undefined : tone(r.last7.firstPartyRoas)} />
          </div>
        )}
        {r.basis === 'untracked' && (
          <Note tone="warn">Our orders for this product are not linking to these ads yet, so this report judges the campaign on Meta’s numbers.</Note>
        )}
        {r.basis === 'app' && <Note tone="info">App product: purchases happen in the app, so every number here is Meta-reported.</Note>}
        {r.verdict ? <Md text={r.verdict} /> : <p className="report-muted">The AI wrote no verdict for this run.</p>}
        {r.goal && <Goal g={r.goal} />}
        {r.planSummary && (
          <div className="report-plan">
            <p className="report-label">
              The plan in short
              {r.pathToTarget && <span className={`chip ${r.pathToTarget === 'likely' ? 'chip-good' : r.pathToTarget === 'possible' ? 'chip-info' : 'chip-warn'}`}>Target {r.pathToTarget}</span>}
            </p>
            <p>{noEv(r.planSummary)}</p>
          </div>
        )}
      </Section>

      <Section n={2} title="Where the funnel breaks" hint="Each step as a share of the step before. The benchmark is all Meta-ad visitors of the same product (site steps) or the whole ad account (click rate).">
        <Funnel r={r} />
      </Section>

      <Section n={3} title="Why it isn’t working" hint="Causes the AI found and a second AI checked, biggest ₹ impact first.">
        {causes.length ? <Causes causes={causes} /> : <Empty title="No causes in this run" />}
      </Section>

      <Section n={4} title="Creatives" hint="Every ad that spent in the 7 days, judged on Meta purchases against this campaign’s own average.">
        <Creatives r={r} />
      </Section>

      <Section n={5} title="New creative ideas" hint="What to make next, built on what works in this campaign.">
        <Ideas r={r} />
      </Section>

      <Section n={6} title="Audience and placement" hint="Share of spend next to where purchases came from (Meta-reported).">
        <div className="report-grid-2">
          <Breakdown title="Age and gender" b={r.breakdowns.ageGender} label={ageLabel} />
          <Breakdown title="Placement" b={r.breakdowns.placement} label={placementLabel} />
        </div>
      </Section>

      <Section n={7} title="Day by day" hint="Last 14 days. Few days or few purchases can’t show a trend.">
        <Trend r={r} />
      </Section>

      <Section n={8} title="Action plan" hint="What to do, in order. You approve every change.">
        <RunActions d={{ actions: r.actions, causes: r.causes, unresolved: r.unresolved, status: r.run.status }} />
      </Section>

      <Section n={9} title="Checked and ruled out">
        <div className="report-grid-2">
          <div>
            <p className="report-label">Not the problem</p>
            {r.ruledOut.length || rejected.length ? (
              <ul className="report-list">
                {r.ruledOut.map((x, i) => <li key={i}>{noEv(x)}</li>)}
                {rejected.map((c) => <li key={c.id}>{noEv(c.title)} <span className="report-muted">(rejected by the reviewer)</span></li>)}
              </ul>
            ) : (
              <p className="report-muted">Nothing listed.</p>
            )}
          </div>
          <div>
            <p className="report-label">What the data can’t tell yet</p>
            {r.dataGaps.length ? <ul className="report-list">{r.dataGaps.map((x, i) => <li key={i}>{noEv(x)}</li>)}</ul> : <p className="report-muted">No gaps listed.</p>}
          </div>
        </div>
      </Section>

      <footer className="report-foot">
        Numbers: Meta Ads (spend, clicks, purchases) and our own orders and site visits, {fmt.date(r.window.from)}–{fmt.date(r.window.to)}. Analysis by the Performance Marketeer AI, finished {fmt.dateTime(r.run.finishedAt)}.
      </footer>
    </Shell>
  )
}

// ── Layout ─────────────────────────────────────────────────────────────────

function Shell({ back, children }: { back: string; children: React.ReactNode }) {
  return (
    <div className="report">
      <Link href={back} className="report-back">
        ← Back to analysis
      </Link>
      {children}
    </div>
  )
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  const id = `s${n}`
  return (
    <section className="report-section" aria-labelledby={id}>
      <h2 id={id} className="report-h2">
        <span className="report-num" aria-hidden="true">{n}</span>
        {title}
      </h2>
      {hint && <p className="report-hint">{hint}</p>}
      {children}
    </section>
  )
}

const tone = (roas: number | null) => (roas == null ? undefined : roas >= 1 ? 'good' : 'bad')

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="report-kpi">
      <p className="report-kpi-label">{label}</p>
      <p className="report-kpi-value" style={tone ? { color: `var(--${tone})` } : undefined}>{value}</p>
    </div>
  )
}

function Note({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
  return (
    <p className="report-note" style={{ background: `var(--${tone}-bg)`, borderColor: `var(--${tone}-border)` }}>
      {children}
    </p>
  )
}

// ── Markdown (bold, italics, bullets, paragraphs: what the AI writes) ───────

function inline(text: string) {
  return noEv(text)
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('*') && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em> : <Fragment key={i}>{p}</Fragment>))
}

function Md({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className="report-md">
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter((l) => l.trim())
        if (!lines.every((l) => /^\s*[-*] /.test(l))) return <p key={i}>{inline(lines.join(' '))}</p>
        return (
          <ul key={i}>
            {lines.map((l, j) => (
              <li key={j} className={/^\s{2,}/.test(l) ? 'report-md-sub' : undefined}>
                {inline(l.replace(/^\s*[-*] /, ''))}
              </li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}

// ── Goal ───────────────────────────────────────────────────────────────────

function Goal({ g }: { g: NonNullable<PmCampaignReport['goal']> }) {
  if (g.daysLeft == null || !g.end) {
    return g.maxDailyBudget != null ? <p className="report-muted">Your max daily budget: {fmt.inr(g.maxDailyBudget)}. No ROAS or purchase target set.</p> : null
  }
  const wanted = [g.targetRoas != null && `ROAS ${fmt.roas(g.targetRoas)}`, g.targetPurchases != null && `${g.targetPurchases} purchases`].filter(Boolean).join(' and ')
  const done = g.targetPurchases ? Math.min(1, (g.purchases ?? 0) / g.targetPurchases) : null
  const over = g.maxDailyBudget != null && g.spendPerDayNeeded != null && g.spendPerDayNeeded > g.maxDailyBudget
  return (
    <div className="report-goal">
      <p className="report-label">Your goal</p>
      <p>
        <strong>{wanted}</strong> from {fmt.date(g.start)} to {fmt.date(g.end)}, counted on {g.source} numbers.{' '}
        {g.daysLeft === 0 ? 'This goal has ended.' : `${g.daysLeft} day${g.daysLeft === 1 ? '' : 's'} left.`}
      </p>
      {done != null && (
        <div className="report-progress" role="img" aria-label={`${g.purchases ?? 0} of ${g.targetPurchases} purchases`}>
          <span style={{ width: `${done * 100}%` }} />
        </div>
      )}
      <ul className="report-list">
        {g.targetPurchases != null && (
          <li>
            {g.purchases ?? 0} of {g.targetPurchases} purchases so far
            {g.purchasesPerDayNeeded != null && g.daysLeft > 0 ? `; needs ${fmt.dec(g.purchasesPerDayNeeded, 1)} a day` : ''}
            {g.spendPerDayNeeded != null && g.daysLeft > 0 ? `, about ${fmt.inr(g.spendPerDayNeeded)}/day at today’s cost per purchase` : ''}.
          </li>
        )}
        {g.maxDailyBudget != null && (
          <li>
            Your max budget is {fmt.inr(g.maxDailyBudget)}/day{over ? <strong> — the goal needs more than that.</strong> : '.'}
          </li>
        )}
      </ul>
    </div>
  )
}

// ── Funnel ─────────────────────────────────────────────────────────────────

const STEP: Record<string, string> = {
  visitors: 'Site visitors',
  ctaClick: 'Clicked buy button',
  productView: 'Viewed the product',
  formSubmit: 'Filled the form',
  addToCart: 'Added to cart',
  beginCheckout: 'Started checkout',
  couponApplied: 'Applied a coupon',
  paymentInitiated: 'Started payment',
  paid: 'Paid orders',
}
const stepLabel = (k: string) => STEP[k] ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())

function Funnel({ r }: { r: PmCampaignReport }) {
  const m = r.funnel.meta
  const ctr = r.last7?.ctrPct ?? null
  const site = r.funnel.site
  const rows: { label: string; n: number; pct: number | null; bench: number | null; benchLabel?: string }[] = [
    { label: 'Saw the ad (impressions)', n: m.impressions, pct: null, bench: null },
    { label: 'Clicked the link', n: m.linkClicks, pct: ctr, bench: r.account.ctrPct, benchLabel: 'account' },
    { label: 'Page loaded (landing views)', n: m.landingPageViews, pct: m.linkClicks ? (m.landingPageViews / m.linkClicks) * 100 : null, bench: null },
    ...site.map((s) => ({ label: stepLabel(s.step), n: s.campaign, pct: s.campaignPctOfPrev, bench: s.allMetaPctOfPrev, benchLabel: 'all Meta visitors' })),
  ]
  // The step furthest below its benchmark, relative to the benchmark.
  let worst = -1
  let worstGap = -0.15
  rows.forEach((x, i) => {
    if (x.pct == null || x.bench == null || !x.bench) return
    const gap = (x.pct - x.bench) / x.bench
    if (gap < worstGap) {
      worstGap = gap
      worst = i
    }
  })
  const max = Math.max(...rows.map((x) => x.n), 1)
  return (
    <>
      <ol className="report-funnel">
        {rows.map((x, i) => (
          <li key={x.label} className={i === worst ? 'is-worst' : undefined}>
            <div className="report-funnel-row">
              <span className="report-funnel-label">{x.label}</span>
              <span className="report-funnel-n">{fmt.int(x.n)}</span>
            </div>
            <div className="report-funnel-bar" aria-hidden="true">
              <span style={{ width: `${Math.max(0.6, (Math.log10(x.n + 1) / Math.log10(max + 1)) * 100)}%` }} />
            </div>
            {x.pct != null && (
              <p className="report-funnel-pct">
                {x.pct.toFixed(x.pct < 10 ? 2 : 1)}% of the step before
                {x.bench != null && ` · ${x.benchLabel} ${x.bench.toFixed(x.bench < 10 ? 2 : 1)}%`}
                {i === worst && <strong> · biggest drop vs benchmark</strong>}
              </p>
            )}
          </li>
        ))}
      </ol>
      {!site.length && <Note tone="warn">No site steps for this campaign: visits aren’t linking to its ads yet, so the funnel stops at the page load.</Note>}
      {r.funnel.payments && r.funnel.payments.campaign.people > 0 && (
        <p className="report-muted">
          Payment: {r.funnel.payments.campaign.people} people started an order, {r.funnel.payments.campaign.paid} paid
          {r.funnel.payments.campaign.retriedThenPaid ? ` (${r.funnel.payments.campaign.retriedThenPaid} after a failed try)` : ''}.
        </p>
      )}
      <p className="report-fine">Bars use a log scale so small steps stay visible.</p>
    </>
  )
}

// ── Causes ─────────────────────────────────────────────────────────────────

const CONF = (c: number) => (c >= 0.8 ? ['High', 'chip-good'] : c >= 0.5 ? ['Medium', 'chip-info'] : ['Low', 'chip-neutral'])

function Causes({ causes }: { causes: PmReportCause[] }) {
  const max = Math.max(...causes.map((c) => c.impactRupeesPerDay), 1)
  return (
    <ol className="report-causes">
      {causes.map((c) => {
        const [label, chip] = CONF(c.confidence)
        return (
          <li key={c.id} className="report-card">
            <div className="report-card-top">
              <span className="chip chip-accent !font-bold">{c.id}</span>
              <span className={`chip ${chip}`}>{label} confidence</span>
              {c.verdict === 'weakened' && <span className="chip chip-warn" title="The reviewing AI found weaker support for this than the investigator.">Weaker on review</span>}
            </div>
            <h3 className="report-h3">{noEv(c.title)}</h3>
            {c.impactRupeesPerDay > 0 && (
              <div className="report-impact">
                <span className="report-impact-bar" aria-hidden="true">
                  <span style={{ width: `${(c.impactRupeesPerDay / max) * 100}%` }} />
                </span>
                <span>about {fmt.inr(c.impactRupeesPerDay)}/day at stake</span>
              </div>
            )}
            {c.narrative && <Md text={c.narrative} />}
          </li>
        )
      })}
    </ol>
  )
}

// ── Creatives ──────────────────────────────────────────────────────────────

const TAG: Record<PmCreativeTag, { label: string; chip: string }> = {
  scale: { label: 'Scale', chip: 'chip-good' },
  keep: { label: 'Keep', chip: 'chip-info' },
  cut: { label: 'Cut', chip: 'chip-bad' },
  too_early: { label: 'Too early', chip: 'chip-neutral' },
}

function Creatives({ r }: { r: PmCampaignReport }) {
  if (!r.creatives.length) return <Empty title="No ad spent in these 7 days" />
  const counts = (Object.keys(TAG) as PmCreativeTag[]).map((t) => [t, r.creatives.filter((c) => c.verdict.tag === t).length] as const).filter(([, n]) => n)
  return (
    <>
      <p className="report-muted">
        {counts.map(([t, n], i) => (
          <Fragment key={t}>
            {i ? ' · ' : ''}
            {n} {TAG[t].label.toLowerCase()}
          </Fragment>
        ))}
        . Campaign average: CTR {r.last7?.ctrPct?.toFixed(2) ?? '—'}%, cost per purchase {fmt.inr(r.last7?.costPerPurchase)}.
      </p>
      <ul className="report-ads">
        {r.creatives.map((c) => (
          <li key={c.id} className="report-ad">
            {c.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Meta CDN thumbnails, sizes vary
              <img src={c.thumbnailUrl} alt="" width={72} height={72} loading="lazy" className="report-ad-thumb" />
            ) : (
              <span className="report-ad-thumb report-ad-thumb-empty" aria-hidden="true">{c.format === 'video' ? '▶' : '▢'}</span>
            )}
            <div className="min-w-0">
              <div className="report-card-top">
                <span className={`chip ${TAG[c.verdict.tag].chip}`}>{TAG[c.verdict.tag].label}</span>
                <span className="report-ad-name">{c.name}</span>
              </div>
              {c.title && <p className="report-ad-title">“{c.title}”</p>}
              <p className="report-ad-reason">{c.verdict.reason}</p>
              <dl className="report-ad-stats">
                <div><dt>Spend</dt><dd>{fmt.inr(c.spend)} <span className="report-muted">({c.spendSharePct ?? '—'}%)</span></dd></div>
                <div><dt>CTR</dt><dd>{c.ctrPct == null ? '—' : `${c.ctrPct.toFixed(2)}%`}</dd></div>
                <div><dt>CPM</dt><dd>{fmt.inr(c.cpm)}</dd></div>
                <div><dt>Purchases</dt><dd>{c.metaPurchases}</dd></div>
                <div><dt>Cost/purchase</dt><dd>{fmt.inr(c.costPerPurchase)}</dd></div>
                <div><dt>ROAS</dt><dd>{fmt.roas(c.metaRoas)}</dd></div>
              </dl>
              <div className="report-share" aria-hidden="true"><span style={{ width: `${Math.min(100, c.spendSharePct ?? 0)}%` }} /></div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function Ideas({ r }: { r: PmCampaignReport }) {
  const briefs = r.actions.filter((a) => a.type === 'creative' && a.creativeBrief)
  if (!r.creativeIdeas.length && !briefs.length)
    return <Empty title="No creative ideas in this run" hint="Runs from before 6 Nov don’t have them. The next run will." />
  return (
    <ul className="report-ideas">
      {r.creativeIdeas.map((x, i) => (
        <li key={i} className="report-card">
          <h3 className="report-h3">{x.title}</h3>
          <p className="report-muted">{[x.format, x.language, x.basedOn && `builds on ${x.basedOn}`].filter(Boolean).join(' · ')}</p>
          <dl className="report-dl">
            <dt>Angle</dt><dd>{x.angle}</dd>
            <dt>Hook (0–3 s)</dt><dd>{x.hook}</dd>
            <dt>Primary text</dt><dd>{x.primaryText}</dd>
            <dt>Headline</dt><dd>{x.headline}</dd>
            <dt>Button</dt><dd>{x.cta}</dd>
            <dt>Why</dt><dd>{noEv(x.why)}</dd>
          </dl>
        </li>
      ))}
      {briefs.map((a) => (
        <li key={a.id} className="report-card">
          <h3 className="report-h3">From action {a.id}: {noEv(a.title)}</h3>
          <Md text={noEv(a.creativeBrief!).split('\n').map((l) => `- ${l}`).join('\n')} />
        </li>
      ))}
    </ul>
  )
}

// ── Breakdowns ─────────────────────────────────────────────────────────────

const ageLabel = (k: string) => {
  const [g, a] = k.split('|')
  return `${g === 'female' ? 'Women' : g === 'male' ? 'Men' : 'Unknown'} ${a ?? ''}`.trim()
}
const placementLabel = (k: string) =>
  k
    .split('|')
    .map((p) => p.replace(/^(instagram|facebook)_/, '').replace(/_/g, ' '))
    .join(' · ')
    .replace(/^./, (c) => c.toUpperCase())

function Breakdown({ title, b, label }: { title: string; b: PmReportBreakdown | null; label: (k: string) => string }) {
  if (!b || !b.rows.length) return <div><p className="report-label">{title}</p><p className="report-muted">No data for these days.</p></div>
  const purchases = b.rows.reduce((s, x) => s + x.metaPurchases, 0)
  return (
    <div>
      <p className="report-label">{title}</p>
      <ul className="report-bd">
        {b.rows.slice(0, 8).map((x) => {
          const pShare = purchases ? (x.metaPurchases / purchases) * 100 : 0
          return (
            <li key={x.key}>
              <div className="report-bd-row">
                <span className="report-bd-key">{label(x.key)}</span>
                <span className="report-bd-val">
                  {x.metaPurchases} purchase{x.metaPurchases === 1 ? '' : 's'} · CPM {fmt.inr(x.cpm)}
                </span>
              </div>
              <div className="report-bd-bars" aria-label={`${(x.spendSharePct ?? 0).toFixed(0)}% of spend, ${pShare.toFixed(0)}% of purchases`} role="img">
                <span className="is-spend" style={{ width: `${x.spendSharePct ?? 0}%` }} />
                <span className="is-purchase" style={{ width: `${pShare}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
      <p className="report-fine">
        <span className="report-key is-spend" aria-hidden="true" /> share of spend <span className="report-key is-purchase" aria-hidden="true" /> share of purchases
        {b.missingDays.length ? ` · missing ${b.missingDays.length} day(s)` : ''}
      </p>
    </div>
  )
}

// ── Trend ──────────────────────────────────────────────────────────────────

function Trend({ r }: { r: PmCampaignReport }) {
  const days = r.trend.filter((p) => p.spend > 0)
  if (!days.length) return <Empty title="No spend in the last 14 days" />
  const max = Math.max(...days.map((p) => p.spend), 1)
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Spend</th>
            <th scope="col" className="num">CPM</th>
            <th scope="col" className="num">CTR</th>
            <th scope="col" className="num">Purchases</th>
          </tr>
        </thead>
        <tbody>
          {days.map((p) => (
            <tr key={p.date}>
              <td>{fmt.date(p.date)}</td>
              <td>
                <span className="report-spend">
                  <span className="report-spend-bar" aria-hidden="true"><span style={{ width: `${(p.spend / max) * 100}%` }} /></span>
                  <span className="num">{fmt.inr(p.spend)}</span>
                </span>
              </td>
              <td className="num">{fmt.inr(p.cpm)}</td>
              <td className="num">{p.ctrPct == null ? '—' : `${p.ctrPct.toFixed(2)}%`}</td>
              <td className="num">{p.metaPurchases}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
