'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowUpRight, Link2, Sliders, Target } from 'lucide-react'
import { getCampaignReview } from '@/lib/api'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import type { Campaign, CampaignLaunchReview } from '@/types'

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
 * The bid-vs-breakeven check earns its place: on 2026-07-27 an ad set shipped
 * with a ₹1,400 cost cap against an ₹1,100 breakeven — Meta authorised to buy
 * every sale at a ₹300 loss. Nothing surfaced it. Now it's a red row.
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
  const adSet = (campaign.metaAdSets ?? [])[0] as Record<string, any> | undefined
  const td = (adSet?.targetingDetail ?? {}) as Record<string, any>

  // Meta stores the cap in rupees on our synced copy. Breakeven is what one
  // conversion is actually worth after margin — paying more than that per sale
  // loses money on every single one, however good the CTR looks.
  const bidCap = typeof adSet?.bidAmount === 'number' ? adSet.bidAmount : null
  const breakevenCPA = product
    ? product.conversionValueNet * (product.contributionMargin ?? 1)
    : null
  const bidOverBreakeven =
    bidCap != null && breakevenCPA != null && breakevenCPA > 0 && bidCap > breakevenCPA

  const placements = [
    ...(td.facebookPositions ?? []).map((p: string) => 'FB ' + p.replace(/_/g, ' ')),
    ...(td.instagramPositions ?? []).map((p: string) => 'IG ' + p.replace(/_/g, ' ')),
  ]
  const excluded = (td.excludedCustomAudiences ?? []) as Array<{ id: string; name: string }>
  const attribution = (adSet?.attributionSpec ?? []) as Array<{ event_type: string; window_days: number }>

  if (failed) return null

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="micro-label flex items-center gap-1.5">
          <Sliders size={11} /> How this campaign is set up
        </p>
        {campaign.syncedAt && (
          <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            Meta settings as of {formatRelativeTime(campaign.syncedAt)}
          </span>
        )}
      </div>

      {/* ── Money at risk first: a cap above breakeven loses on every sale ── */}
      {bidOverBreakeven && (
        <div
          className="rounded-lg px-4 py-3 flex items-start gap-2.5"
          style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--bad)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--bad)' }}>
              This is set to buy sales at a loss
            </p>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
              Meta is allowed to pay up to {formatCurrency(bidCap!)} for one sale, but a sale is only
              worth {formatCurrency(Math.round(breakevenCPA!))} to you. That&apos;s{' '}
              {formatCurrency(Math.round(bidCap! - breakevenCPA!))} lost on every conversion at the
              cap. Lower the cost cap, or raise the price/margin on {product?.name}.
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
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
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
              className="mono text-[13px] flex items-center gap-2 px-3 py-2 rounded-lg hover:opacity-80"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--hairline)',
                borderLeft: '3px solid var(--accent)',
                color: 'var(--ink)',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {product.landingUrl}
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
        {[
          product && {
            k: product.conversionTracking.type === 'custom_conversion' ? 'Buying this conversion'
              : product.conversionTracking.type === 'custom_event' ? 'Custom event' : 'Conversion event',
            v: product.conversionTracking.type === 'custom_conversion' ? product.conversionTracking.id
              : product.conversionTracking.type === 'custom_event' ? product.conversionTracking.name
                : product.conversionTracking.event,
            mono: true,
          },
          product && { k: 'Meta Pixel', v: product.pixelId || '—', sub: product.pixelSource === 'product' ? 'from this product' : 'company default', mono: true },
          product && { k: 'Worth per sale', v: formatCurrency(product.conversionValueNet), sub: product.refundRatePercent ? `after ${product.refundRatePercent}% refunds` : 'no refunds expected' },
          breakevenCPA != null && { k: 'Break even at', v: formatCurrency(Math.round(breakevenCPA)) + ' / sale', sub: `ROAS ${product?.breakevenROAS?.toFixed(2) ?? '—'}x` },
          bidCap != null && {
            k: 'Max Meta will pay',
            v: formatCurrency(bidCap),
            sub: adSet?.bidStrategy === 'COST_CAP' ? 'cost cap' : (adSet?.bidStrategy ?? '').toLowerCase().replace(/_/g, ' '),
            bad: bidOverBreakeven,
          },
          adSet?.bidStrategy === 'LOWEST_COST_WITHOUT_CAP' && { k: 'Bidding', v: 'No cap', sub: 'Meta spends freely' },
          { k: 'Daily budget', v: formatCurrency(campaign.budget ?? 0), sub: campaign.budgetModel ? campaign.budgetModel.toUpperCase() : undefined },
          attribution.length > 0 && {
            k: 'Attribution',
            v: attribution.map((a) => `${a.window_days}d ${a.event_type === 'CLICK_THROUGH' ? 'click' : 'view'}`).join(' · '),
          },
        ].filter(Boolean).map((cell: any) => (
          <div key={cell.k} className="px-4 py-3" style={{ background: 'var(--surface)' }}>
            <p className="micro-label">{cell.k}</p>
            <p
              className={`text-sm font-semibold mt-0.5 ${cell.mono ? 'mono' : 'tabular-nums'}`}
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
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]" style={{ color: 'var(--ink-2)' }}>
            {adSet.audienceType && (
              <span><span className="micro-label mr-1.5">Audience</span>{String(adSet.audienceType).replace(/_/g, ' ')}{td.advantageAudience ? ' · Advantage+ expansion on' : ''}</span>
            )}
            {adSet.age && <span><span className="micro-label mr-1.5">Age</span>{adSet.age}</span>}
            {adSet.gender && <span className="capitalize"><span className="micro-label mr-1.5">Gender</span>{adSet.gender}</span>}
            {adSet.geo && <span><span className="micro-label mr-1.5">Location</span>{adSet.geo}</span>}
            {(adSet.interests ?? []).length > 0 && (
              <span><span className="micro-label mr-1.5">Interests</span>{(adSet.interests as string[]).length} selected</span>
            )}
            {excluded.length > 0 && (
              <span><span className="micro-label mr-1.5">Excluding</span>{excluded.map((e) => e.name).join(', ')}</span>
            )}
          </div>

          {placements.length > 0 && (
            <div className="mt-2.5">
              <p className="micro-label mb-1.5">Placements</p>
              <div className="flex flex-wrap gap-1.5">
                {placements.map((p) => (
                  <span key={p} className="chip chip-neutral capitalize">{p}</span>
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

      {/* ── Identifiers ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] pt-1"
        style={{ color: 'var(--ink-3)', borderTop: '1px solid var(--hairline-light)', paddingTop: 12 }}
      >
        {campaign.metaCampaignId && (
          <span><span className="micro-label mr-1">Meta campaign</span><span className="mono">{campaign.metaCampaignId}</span></span>
        )}
        {campaign.metaAccountId && (
          <span><span className="micro-label mr-1">Ad account</span><span className="mono">{campaign.metaAccountId}</span></span>
        )}
        {review?.campaign?.objective && (
          <span className="capitalize"><span className="micro-label mr-1">Objective</span>{review.campaign.objective.replace(/_/g, ' ').toLowerCase()}</span>
        )}
        {campaign.launchedAt && (
          <span><span className="micro-label mr-1">Launched</span>{formatRelativeTime(campaign.launchedAt)}</span>
        )}
      </div>
    </div>
  )
}
