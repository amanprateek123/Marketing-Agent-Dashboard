'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowUpRight, Link2, Sliders, Target } from 'lucide-react'
import { getCampaignReview } from '@/lib/api'
import { formatInr, formatRelative, humanise, plainStatus } from '@/lib/plain-language'
import { Details } from '@/components/plain/Details'
import type { Campaign, CampaignLaunchReview } from '@/types'

interface SetupMetric {
  k: string
  v: string
  sub?: string
  mono?: boolean
  bad?: boolean
}

/**
 * How a LIVE campaign is actually set up.
 *
 * The metrics on this page tell you how it's doing; nothing told you what it
 * IS. Where does it send people, what conversion is it buying, what will Meta
 * pay for one, who can see it — all of that was only visible before launch (on
 * the approve screen) or not at all. When a campaign underdelivers or spends
 * oddly, this is the first thing you need and the hardest thing to find.
 *
 * Two sources, deliberately:
 *   - GET /review — the product, destination and economics, resolved by the
 *     same code the launch used. Correct even for campaigns that predate
 *     productName, and honest when it can't resolve one.
 *   - campaign.metaAdSets — bid, placements, attribution, exclusions, as
 *     LAST SYNCED FROM META. That's ground truth for what's running, but it
 *     lags (~10 min), so it's labelled with its sync time rather than
 *     presented as live.
 *
 * The bid-vs-configured-value check surfaces when Meta can pay more for a sale
 * than the stored net conversion value times contribution margin. It is a
 * configuration warning, not a realized-profit claim.
 */

export function CampaignSetup({
  tenantId,
  campaign,
}: {
  tenantId: string
  campaign: Campaign
}) {
  const [review, setReview] = useState<CampaignLaunchReview | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCampaignReview(tenantId, campaign._id)
      .then((r) => { if (!cancelled) setReview(r) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [tenantId, campaign._id])

  const product = review?.product
  const adSet = campaign.metaAdSets?.[0]
  const td = adSet?.targetingDetail ?? {}

  // Meta stores the cap in rupees on our synced copy. This compares that cap
  // with the configured net conversion value after the stored margin. It is a
  // planning estimate and stays separate from founder-facing raw ROAS proof.
  const bidCap = typeof adSet?.bidAmount === 'number' ? adSet.bidAmount : null
  const breakevenCPA = product
    ? product.conversionValueNet * (product.contributionMargin ?? 1)
    : null
  const bidOverBreakeven =
    bidCap != null && breakevenCPA != null && breakevenCPA > 0 && bidCap > breakevenCPA

  const placements = [
    ...(td.facebookPositions ?? []).map((p: string) => 'Facebook ' + humanise(p).toLowerCase()),
    ...(td.instagramPositions ?? []).map((p: string) => 'Instagram ' + humanise(p).toLowerCase()),
  ]
  const excluded = (td.excludedCustomAudiences ?? []) as Array<{ id: string; name: string }>
  const attribution = (adSet?.attributionSpec ?? []) as Array<{ event_type: string; window_days: number }>
  const setupMetrics: Array<SetupMetric | null> = [
    product
      ? {
          k: 'What counts as a sale',
          v: product.conversionTracking.type === 'custom_conversion' ? 'A custom conversion set up in Meta'
            : product.conversionTracking.type === 'custom_event' ? humanise(product.conversionTracking.name)
              : humanise(product.conversionTracking.event),
          sub: product.conversionTracking.type === 'app_event' ? 'Counted in the app' : 'Counted on the website',
        }
      : null,
    product
      ? { k: 'Worth per sale', v: formatInr(product.conversionValueNet), sub: product.refundRatePercent ? `after ${product.refundRatePercent}% refunds` : 'no refunds expected' }
      : null,
    breakevenCPA != null
      ? { k: 'Most a sale is worth to you', v: formatInr(Math.round(breakevenCPA)) + ' a sale', sub: 'Worth per sale × your margin' }
      : null,
    bidCap != null
      ? {
          k: 'Most Meta will pay',
          v: formatInr(bidCap),
          sub: adSet?.bidStrategy === 'COST_CAP' ? 'a cap per sale' : humanise(adSet?.bidStrategy ?? '').toLowerCase(),
          bad: bidOverBreakeven,
        }
      : null,
    adSet?.bidStrategy === 'LOWEST_COST_WITHOUT_CAP'
      ? { k: 'Bidding', v: 'No limit', sub: 'Meta spends freely' }
      : null,
    { k: 'Daily budget', v: formatInr(campaign.budget ?? 0), sub: campaign.budgetModel === 'abo' ? 'Set per ad set' : campaign.budgetModel === 'asc' ? "Meta's shopping campaign" : campaign.budgetModel ? 'Meta splits it across ad sets' : undefined },
    attribution.length > 0
      ? {
          k: 'Sales counted if they happen within',
          v: attribution.map((a) => `${a.window_days} day${a.window_days === 1 ? '' : 's'} of a ${a.event_type === 'CLICK_THROUGH' ? 'click' : 'view'}`).join(' · '),
        }
      : null,
  ]
  const visibleSetupMetrics = setupMetrics.filter((cell): cell is SetupMetric => cell !== null)

  if (failed) return null

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="micro-label flex items-center gap-1.5">
          <Sliders size={11} /> How this campaign is set up
        </p>
        {campaign.syncedAt && (
          <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            Settings fetched from Meta {formatRelative(campaign.syncedAt)}
          </span>
        )}
      </div>

      {/* A configuration guard, not a realized-profit verdict. */}
      {bidOverBreakeven && (
        <div
          className="rounded-lg px-4 py-3 flex items-start gap-2.5"
          style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--bad)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--bad)' }}>
              Meta may pay more for a sale than a sale is worth to you
            </p>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
              Meta may pay up to {formatInr(bidCap!)} for one sale, but by your settings a sale is
              worth {formatInr(Math.round(breakevenCPA!))} after your margin — {formatInr(Math.round(bidCap! - breakevenCPA!))}{' '}
              less. Check the product&apos;s price and margin, then lower the cap or update {product?.name}.
            </p>
          </div>
        </div>
      )}

      {/* ── Destination ─────────────────────────────────────────────────── */}
      <div>
        <p className="micro-label flex items-center gap-1.5 mb-2">
          <Link2 size={11} /> Where it sends people
        </p>
        {product ? (
          <>
            <div className="flex min-w-0 items-center gap-2 flex-wrap mb-2">
              <span className="min-w-0 break-words text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {product.name}
              </span>
              {product.resolvedVia !== 'campaign' && (
                <span className="chip chip-warn">Product was guessed, not recorded</span>
              )}
            </div>
            <a
              href={product.landingUrl}
              target="_blank"
              rel="noreferrer"
              className="mono text-[13px] flex min-w-0 items-center gap-2 px-3 py-2 rounded-lg hover:opacity-80"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--hairline)',
                borderLeft: '3px solid var(--accent)',
                color: 'var(--ink)',
              }}
              title={product.landingUrl}
            >
              <span className="min-w-0 truncate">{product.landingUrl}</span>
              <ArrowUpRight size={12} className="shrink-0" style={{ color: 'var(--ink-3)' }} />
            </a>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--bad)' }}>
            No product recorded — we can&apos;t tell which product this campaign sells.
            {review?.blockers?.find((b) => b.code === 'product_unresolved')?.message}
          </p>
        )}
      </div>

      {/* ── The numbers that decide profitability ───────────────────────── */}
      <div
        className="grid gap-px rounded-lg overflow-hidden"
        style={{ background: 'var(--hairline-light)', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        {visibleSetupMetrics.map((cell) => (
          <div key={cell.k} className="px-4 py-3" style={{ background: 'var(--surface)' }}>
            <p className="micro-label">{cell.k}</p>
            <p
              className={`text-sm font-semibold mt-0.5 break-words ${cell.mono ? 'mono' : 'tabular-nums'}`}
              style={{ color: cell.bad ? 'var(--bad)' : 'var(--ink)', overflowWrap: 'anywhere' }}
            >
              {cell.v}
            </p>
            {cell.sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{cell.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Reach ───────────────────────────────────────────────────────── */}
      {adSet && (
        <div>
          <p className="micro-label flex items-center gap-1.5 mb-2">
            <Target size={11} /> Who can see it
          </p>
          <div className="flex min-w-0 flex-wrap gap-x-5 gap-y-1.5 text-[13px]" style={{ color: 'var(--ink-2)' }}>
            {adSet.audienceType && (
              <span><span className="micro-label mr-1.5">Audience</span>{plainStatus('audienceKind', String(adSet.audienceType)).label}{td.advantageAudience ? ' · Meta may widen it' : ''}</span>
            )}
            {adSet.age && <span><span className="micro-label mr-1.5">Age</span>{adSet.age}</span>}
            {adSet.gender && <span><span className="micro-label mr-1.5">Gender</span>{humanise(adSet.gender)}</span>}
            {adSet.geo && <span className="min-w-0 break-words"><span className="micro-label mr-1.5">Location</span>{adSet.geo}</span>}
            {(adSet.interests ?? []).length > 0 && (
              <span><span className="micro-label mr-1.5">Interests</span>{(adSet.interests as string[]).length} selected</span>
            )}
            {excluded.length > 0 && (
              <span className="min-w-0 break-words"><span className="micro-label mr-1.5">Leaving out</span>{excluded.map((e) => e.name).filter(Boolean).join(', ') || `${excluded.length} saved audience${excluded.length === 1 ? '' : 's'}`}</span>
            )}
          </div>

          {placements.length > 0 && (
            <div className="mt-2.5">
              <p className="micro-label mb-1.5">Where the ads show</p>
              <div className="flex flex-wrap gap-1.5">
                {placements.map((p) => (
                  <span key={p} className="chip chip-neutral">{p}</span>
                ))}
              </div>
              <p className="explain mt-1.5">
                Vertical placements only — this campaign&apos;s images are 9:16, and Feed would crop
                the headline and button off.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Goal and launch date; Meta ids only inside Details ─────────── */}
      <div
        className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] pt-1"
        style={{ color: 'var(--ink-3)', borderTop: '1px solid var(--hairline-light)', paddingTop: 12 }}
      >
        {review?.campaign?.objective && (
          <span><span className="micro-label mr-1">Goal</span>{plainStatus('objective', review.campaign.objective).label}</span>
        )}
        {campaign.launchedAt && (
          <span><span className="micro-label mr-1">Launched</span>{formatRelative(campaign.launchedAt)}</span>
        )}
      </div>
      {(campaign.metaCampaignId || campaign.metaAccountId || product) && (
        <Details
          reference={campaign.metaCampaignId}
          items={[
            ...(campaign.metaCampaignId ? [{ label: 'Meta campaign', value: campaign.metaCampaignId }] : []),
            ...(campaign.metaAccountId ? [{ label: 'Meta ad account', value: campaign.metaAccountId }] : []),
            ...(product && product.conversionTracking.type === 'custom_conversion' ? [{ label: 'Custom conversion', value: product.conversionTracking.id }] : []),
            ...(product && product.conversionTracking.type === 'app_event' ? [{ label: 'Meta app', value: product.applicationId || '—' }] : []),
            ...(product && product.conversionTracking.type !== 'app_event' ? [{ label: product.pixelSource === 'product' ? 'Meta Pixel (this product)' : 'Meta Pixel (company default)', value: product.pixelId || '—' }] : []),
          ]}
        />
      )}
    </div>
  )
}
