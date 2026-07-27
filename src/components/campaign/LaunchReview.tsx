'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Check,
  Info,
  Link2,
  Loader2,
  Target,
} from 'lucide-react'
import { getCampaignReview, updateManualCampaignConfig } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { CampaignLaunchReview, LaunchReviewAdSet, Product } from '@/types'

/**
 * What approving this campaign will ACTUALLY do.
 *
 * The old approve screen showed the campaign as stored — budget, copy,
 * targeting — but never the destination, because the destination wasn't
 * decided until launch. A campaign built for one product could launch against
 * a different product's landing page, pixel and conversion event, and nothing
 * on this screen would have shown it.
 *
 * So the destination leads. Product, URL, pixel and conversion event come from
 * GET /review, already resolved by the same code the launch uses — not copied
 * off the campaign document, where they don't exist. Everything that would
 * make the launch fail is listed as a blocker, and Approve stays disabled
 * until they clear.
 */

interface Props {
  tenantId: string
  campaignId: string
  /** Products on the company — powers the one-click fix for "no product set". */
  products?: Product[]
  /** Lets the parent gate its Approve button on `review.ready`. */
  onReview?: (review: CampaignLaunchReview | null) => void
}

/**
 * Plain-English headline per issue code. The server's `message` carries the
 * specifics and is always rendered underneath — this is the "what does this
 * mean for me" line, in the same voice as the rest of the dashboard.
 */
const ISSUE_TITLE: Record<string, string> = {
  product_unresolved: "We don't know which product this ad sells",
  product_no_landing_url: 'This product has no landing page',
  product_inferred: 'Product was guessed, not chosen',
  product_matched_loosely: 'Product name nearly matched',
  creative_package_missing: 'The creative for this ad is missing',
  creative_package_not_ready: 'The creative is still being made',
  no_copy_variants: 'This ad has no text',
  no_creative_assets: 'This ad has no image or video',
  no_access_token: 'Meta account not connected',
  no_page_id: 'No Facebook Page selected',
  no_pixel: 'No Meta Pixel set up',
  account_not_in_list: "This ad account isn't on your list",
  not_pending_approval: 'This campaign is no longer waiting for approval',
  already_launched: 'This campaign is already live on Meta',
  over_campaign_cap: 'Budget is above your per-campaign limit',
  over_weekly_cap: 'This would break your weekly budget cap',
  no_ad_sets: 'No ad groups configured',
  ad_set_no_destination: 'An ad group has nowhere to send people',
  ad_set_missing_variant: 'An ad group points at ad text that no longer exists',
  ad_set_no_ads: 'An ad group has no ads in it',
  budget_split_not_100: "Ad group budgets don't add up to 100%",
  video_missing: 'Video was requested but none exists',
  optimization_goal_overridden: "The product's optimisation goal will win",
  custom_conversion_account_scoped: 'Optimising toward a custom conversion',
}

const AUDIENCE_LABEL: Record<string, string> = {
  advantage_plus: 'Advantage+ (Meta picks the audience)',
  lookalike: 'Lookalike audience',
  interest: 'Interest-based (new people)',
  retarget: 'Retargeting (people who already engaged)',
  custom: 'Custom audience',
}

/** How sure are we this is the right product? 'campaign' = the operator said so. */
const RESOLVED_VIA: Record<string, { chip: string; label: string }> = {
  campaign: { chip: 'chip-good', label: 'Chosen for this campaign' },
  brief: { chip: 'chip-warn', label: 'Guessed from the brief' },
  sole_active: { chip: 'chip-warn', label: 'Guessed — only active product' },
}

function trackingLabel(t: NonNullable<CampaignLaunchReview['product']>['conversionTracking']) {
  if (t.type === 'custom_conversion') return { k: 'Custom conversion', v: t.id }
  if (t.type === 'custom_event') return { k: 'Custom event', v: t.name }
  return { k: 'Conversion event', v: t.event }
}

export function LaunchReview({ tenantId, campaignId, products = [], onReview }: Props) {
  const [review, setReview] = useState<CampaignLaunchReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getCampaignReview(tenantId, campaignId)
      setReview(data)
      onReview?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the review')
      onReview?.(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, campaignId])

  async function assignProduct(productName: string) {
    setAssigning(true)
    try {
      await updateManualCampaignConfig(tenantId, campaignId, { productName })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set the product')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
    return (
      <div className="card-inset p-4 flex items-center gap-2.5" style={{ color: 'var(--ink-3)' }}>
        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span className="text-sm">Checking what this will do…</span>
      </div>
    )
  }

  if (error || !review) {
    return (
      <div
        className="rounded-lg p-3.5 text-sm flex items-start gap-2.5"
        style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--warn)' }}
      >
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        <span>
          Couldn&apos;t check this campaign before launch — {error}. Approving is still possible, but
          you won&apos;t see where the ads point until they&apos;re live.
        </span>
      </div>
    )
  }

  const { product, campaign, adSets, blockers, warnings } = review

  return (
    <div className="space-y-3">
      {/* ── Verdict ───────────────────────────────────────────────────── */}
      <div
        className="rounded-lg px-4 py-3 flex items-start gap-2.5 text-sm font-semibold"
        style={
          review.ready
            ? { background: 'var(--good-bg)', border: '1px solid var(--good-border)', color: 'var(--good)' }
            : { background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }
        }
      >
        {review.ready ? (
          <Check size={15} className="shrink-0 mt-0.5" />
        ) : (
          <Ban size={15} className="shrink-0 mt-0.5" />
        )}
        <span>
          {review.ready
            ? 'Ready to launch — we checked the landing page, tracking and creative.'
            : `Can't launch yet — ${blockers.length} thing${blockers.length === 1 ? '' : 's'} to fix first.`}
        </span>
      </div>

      {/* ── Where the money goes. This block is why the screen exists. ─── */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--hairline)', background: 'var(--surface)' }}
      >
        <div
          className="px-4 py-3"
          style={{ borderBottom: '1px solid var(--hairline-light)' }}
        >
          <p className="micro-label flex items-center gap-1.5 mb-2">
            <Link2 size={11} /> Where this ad sends people
          </p>

          {product ? (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
                  {product.name}
                </span>
                <span className={`chip ${RESOLVED_VIA[product.resolvedVia]?.chip ?? 'chip-neutral'}`}>
                  {RESOLVED_VIA[product.resolvedVia]?.label ?? product.resolvedVia}
                </span>
              </div>
              <a
                href={product.landingUrl}
                target="_blank"
                rel="noreferrer"
                className="mono text-sm flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors hover:opacity-80"
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
                <ArrowUpRight size={13} className="shrink-0" style={{ color: 'var(--ink-3)' }} />
              </a>
              <p className="explain mt-2">
                Every ad in this campaign lands here. Tracking tags are added automatically per ad.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--bad)' }}>
                No product chosen — nothing will be sent to Meta
              </p>
              <p className="explain">
                The landing page, pixel and conversion event all come from the product. Pick one and
                we&apos;ll use its settings.
              </p>
              {products.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  {products.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => assignProduct(p.name)}
                      disabled={assigning}
                      className="chip chip-accent transition-opacity hover:opacity-75 disabled:opacity-40"
                      title={p.landingUrl || 'No landing page set on this product'}
                    >
                      {assigning ? <Loader2 size={10} className="animate-spin" /> : null}
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {product && (
          <div
            className="grid gap-px"
            style={{
              background: 'var(--hairline-light)',
              gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
            }}
          >
            {[
              { k: trackingLabel(product.conversionTracking).k, v: trackingLabel(product.conversionTracking).v, mono: true },
              {
                k: 'Meta Pixel',
                v: product.pixelId || '—',
                sub: product.pixelSource === 'product' ? 'from this product' : 'company default',
                mono: true,
              },
              {
                k: 'Worth per sale',
                v: formatCurrency(product.conversionValueNet),
                sub: product.refundRatePercent
                  ? `after ${product.refundRatePercent}% refunds`
                  : 'no refunds expected',
              },
              {
                k: 'Break even at',
                v: product.breakevenROAS ? `${product.breakevenROAS.toFixed(2)}x` : '—',
                sub: product.contributionMargin
                  ? `${Math.round(product.contributionMargin * 100)}% margin`
                  : 'margin not set',
              },
            ].map((cell) => (
              <div key={cell.k} className="px-4 py-3" style={{ background: 'var(--surface)' }}>
                <p className="micro-label">{cell.k}</p>
                <p
                  className={`text-sm font-semibold mt-0.5 ${cell.mono ? 'mono' : 'tabular-nums'}`}
                  style={{ color: 'var(--ink)', overflowWrap: 'anywhere' }}
                >
                  {cell.v}
                </p>
                {cell.sub && (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                    {cell.sub}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Blockers, then things to note ─────────────────────────────── */}
      {(blockers.length > 0 || warnings.length > 0) && (
        <div className="space-y-2">
          {blockers.map((issue, i) => (
            <IssueRow
              key={`b${i}`}
              issue={issue}
              tone="bad"
              // The server's `fix` for a missing product is a curl command.
              // When we can offer the product chips above instead, that's the
              // better affordance and the raw command is just noise.
              hideFix={issue.code === 'product_unresolved' && products.length > 0}
            />
          ))}
          {warnings.map((issue, i) => (
            <IssueRow key={`w${i}`} issue={issue} tone="warn" />
          ))}
        </div>
      )}

      {/* ── Ad groups ─────────────────────────────────────────────────── */}
      {adSets.length > 0 && (
        <div className="space-y-2">
          <p className="micro-label flex items-center gap-1.5">
            <Target size={11} /> Who this reaches ({adSets.length} ad group
            {adSets.length === 1 ? '' : 's'} · {formatCurrency(campaign.dailyBudget)} a day total)
          </p>
          {adSets.map((a, i) => (
            <AdSetRow key={i} adSet={a} showSplit={adSets.length > 1} />
          ))}
        </div>
      )}

      {/* ── What Meta receives ────────────────────────────────────────── */}
      <div className="card-inset px-4 py-3">
        <p className="micro-label mb-2">What gets created on Meta</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]" style={{ color: 'var(--ink-2)' }}>
          <span className="min-w-0">
            <span className="micro-label mr-1.5">Campaign name</span>
            <span className="mono" style={{ overflowWrap: 'anywhere' }}>
              {campaign.metaCampaignName}
            </span>
          </span>
          <span>
            <span className="micro-label mr-1.5">Objective</span>
            <span className="capitalize">{campaign.objective.replace(/_/g, ' ').toLowerCase()}</span>
          </span>
          <span>
            <span className="micro-label mr-1.5">Projected 7 days</span>
            <span className="tabular-nums">{formatCurrency(campaign.projectedWeeklySpend)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Issue row ───────────────────────────────────────────────────────────────
function IssueRow({
  issue,
  tone,
  hideFix,
}: {
  issue: { code: string; message: string; fix?: string }
  tone: 'bad' | 'warn'
  hideFix?: boolean
}) {
  const palette =
    tone === 'bad'
      ? { bg: 'var(--bad-bg)', border: 'var(--bad-border)', fg: 'var(--bad)' }
      : { bg: 'var(--warn-bg)', border: 'var(--warn-border)', fg: 'var(--warn)' }

  return (
    <div
      className="rounded-lg px-3.5 py-3 flex items-start gap-2.5"
      style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
    >
      {tone === 'bad' ? (
        <Ban size={14} className="shrink-0 mt-0.5" style={{ color: palette.fg }} />
      ) : (
        <Info size={14} className="shrink-0 mt-0.5" style={{ color: palette.fg }} />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: palette.fg }}>
          {ISSUE_TITLE[issue.code] ?? issue.code.replace(/_/g, ' ')}
        </p>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
          {issue.message}
        </p>
        {issue.fix && !hideFix && (
          <p
            className="mono text-[11px] mt-2 px-2.5 py-2 rounded whitespace-pre-wrap"
            style={{ background: 'var(--surface)', color: 'var(--ink-3)', overflowX: 'auto' }}
          >
            {issue.fix}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Ad group row ────────────────────────────────────────────────────────────
function AdSetRow({ adSet, showSplit }: { adSet: LaunchReviewAdSet; showSplit: boolean }) {
  const facts: Array<[string, string]> = []
  if (adSet.customAudience) facts.push(['Audience', adSet.customAudience.name])
  if (adSet.ageMin != null || adSet.ageMax != null)
    facts.push(['Age', `${adSet.ageMin ?? 18}–${adSet.ageMax ?? 65}`])
  if (adSet.gender && adSet.gender !== 'all') facts.push(['Gender', adSet.gender])
  if (adSet.geoLocations.length) facts.push(['Location', adSet.geoLocations.join(', ')])
  if (adSet.interestIds.length) facts.push(['Interests', `${adSet.interestIds.length} selected`])
  if (adSet.optimizationGoal)
    facts.push(['Optimising for', adSet.optimizationGoal.replace(/_/g, ' ').toLowerCase()])
  if (adSet.copyVariantIndices.length)
    facts.push([
      'Ads',
      `${adSet.copyVariantIndices.map((i) => `#${i + 1}`).join(', ')} · ${adSet.creativeFormat}`,
    ])
  const excluded = adSet.excludedAudiences.filter(Boolean) as Array<{ id: string; name: string }>
  if (excluded.length) facts.push(['Excluding', excluded.map((e) => e.name).join(', ')])

  return (
    <div className="card-inset p-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {adSet.name}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
            {formatCurrency(adSet.dailyBudget)}
            <span className="font-normal" style={{ color: 'var(--ink-3)' }}>
              {' '}
              a day
            </span>
          </span>
          {showSplit && <span className="chip chip-neutral">{adSet.budgetPercent}%</span>}
          <span className="chip chip-accent">
            {AUDIENCE_LABEL[adSet.audienceType] ?? adSet.audienceType}
          </span>
        </div>
      </div>

      {showSplit && (
        <div
          className="h-1 rounded-full overflow-hidden mt-2"
          style={{ background: 'var(--muted)' }}
        >
          <div
            className="h-full rounded-full animate-bar-grow"
            style={{ width: `${Math.min(100, adSet.budgetPercent)}%`, background: 'var(--accent)' }}
          />
        </div>
      )}

      <div
        className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] mt-2"
        style={{ color: 'var(--ink-2)' }}
      >
        {facts.map(([k, v]) => (
          <span key={k} className="capitalize">
            <span className="micro-label mr-1">{k}</span>
            {v}
          </span>
        ))}
      </div>

      <p
        className="mono text-[11px] mt-2"
        style={{
          color: adSet.destinationUrl ? 'var(--ink-3)' : 'var(--bad)',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        → {adSet.destinationUrl || 'no destination set'}
      </p>
    </div>
  )
}
