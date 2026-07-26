import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function formatRelativeTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  try {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diffMs = now - then
    const absDiff = Math.abs(diffMs)
    const isFuture = diffMs < 0

    const minutes = Math.round(absDiff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return isFuture ? `in ${minutes}m` : `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return isFuture ? `in ${hours}h` : `${hours}h ago`
    const days = Math.round(hours / 24)
    return isFuture ? `in ${days}d` : `${days}d ago`
  } catch {
    return dateStr
  }
}

/**
 * "For every ₹1 spent, you earn ₹1.85" style — human ROAS.
 *
 * Takes breakeven so the sentence carries its own verdict. "You earn ₹0.92"
 * reads as a near-miss on its own; "₹0.92 — you need ₹1.03 to break even"
 * reads as what it is.
 */
export function formatROASPlain(
  roas: number | null | undefined,
  breakeven?: number,
): string {
  if (roas == null || !Number.isFinite(roas) || roas <= 0) return 'No revenue yet'
  const base = `For every ₹1 spent, you earn ₹${roas.toFixed(2)}`
  if (breakeven == null || !Number.isFinite(breakeven) || breakeven <= 0) return base
  return roas >= breakeven
    ? `${base} — above your ₹${breakeven.toFixed(2)} breakeven`
    : `${base} — you need ₹${breakeven.toFixed(2)} to break even`
}

/**
 * Traffic-light health for a ROAS, judged against the tenant's real economics.
 *
 * `breakeven` and `target` are REQUIRED to mean anything. The previous version
 * defaulted to `target = 1.5` with an implicit breakeven of 1.0, which is
 * wrong in both directions: for a 97%-margin digital product (breakeven 1.03,
 * target 2.06) it painted a sub-target 1.5x as "working well", and for a
 * 40%-margin product (breakeven 2.5) it painted a deeply loss-making 1.2x as
 * merely "watch this". Both numbers now come from the server.
 *
 * Note `roas === 0` returns 'bad', not 'unknown' — see `dataStateHealth` for
 * why a zero-revenue campaign is a result rather than a missing measurement.
 * Callers that genuinely have no data should pass null/undefined.
 */
export function roasHealth(
  roas: number | null | undefined,
  breakeven: number,
  target: number,
): 'good' | 'watch' | 'bad' | 'unknown' {
  if (roas == null || !Number.isFinite(roas)) return 'unknown'
  if (roas >= target) return 'good'
  if (roas >= breakeven) return 'watch'
  return 'bad'
}

/** Maps a server-computed verdict severity straight onto the UI's palette. */
export function severityToHealth(
  severity: 'good' | 'watch' | 'bad' | 'neutral',
): 'good' | 'watch' | 'bad' | 'unknown' {
  return severity === 'neutral' ? 'unknown' : severity
}

/** Currency with an explicit sign — for profit/loss figures where the
 *  direction is the whole point. */
export function formatSignedCurrency(amount: number): string {
  const sign = amount < 0 ? '−' : '+'
  return `${sign}₹${Math.abs(Math.round(amount)).toLocaleString('en-IN')}`
}

/** 0.42 → "42%" */
export function formatPercent(fraction: number, dp = 0): string {
  if (!Number.isFinite(fraction)) return '—'
  return `${(fraction * 100).toFixed(dp)}%`
}

/** Compact ₹ for dense tables: 6431174 → "₹64.3L" */
export function formatCompactCurrency(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '−' : ''
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`
}

/** Short label for status enum → non-tech text. */
export function statusToPlain(status: string | undefined): string {
  switch (status) {
    case 'active':
      return 'Running'
    case 'paused':
      return 'Paused'
    case 'pending_approval':
      return 'Waiting for you'
    case 'completed':
      return 'Finished'
    case 'failed':
      return 'Failed'
    case 'superseded':
      return 'Replaced'
    case 'draft':
      return 'Draft'
    default:
      return status ?? '—'
  }
}

/**
 * Status chip for a creative package, derived from its assets rather than from
 * `status` alone.
 *
 * `status` records how the PRODUCTION RUN ended and is never recomputed
 * afterwards — rejecting an asset writes only `images[i].rejected`, by design,
 * since "generation completed" stays true regardless of what a human later
 * decides about the output. But rendering `completed` as a flat "Ready" then
 * claims a package is usable when every one of its assets has been rejected,
 * which is how a discarded creative ends up looking production-ready.
 *
 * Rejection is reversible and per-asset, so this is a labelling concern, not a
 * reason to mutate `status`.
 */
export function creativePackageStatus(pkg: {
  status?: string
  images?: Array<{ imageUrl?: string; rejected?: boolean }>
  video?: { videoUrl?: string; rejected?: boolean }
  carouselCards?: Array<{ imageUrl?: string }>
}): { label: string; chip: string } {
  const base: Record<string, { label: string; chip: string }> = {
    pending: { label: 'Producing…', chip: 'chip-warn' },
    completed: { label: 'Ready', chip: 'chip-good' },
    failed: { label: 'Failed', chip: 'chip-bad' },
  }
  const fallback = { label: pkg.status ?? '—', chip: 'chip-neutral' }
  if (pkg.status !== 'completed') return base[pkg.status ?? ''] ?? fallback

  const usableImages = (pkg.images ?? []).filter(i => i.imageUrl && !i.rejected).length
  const usableVideo = !!pkg.video?.videoUrl && !pkg.video.rejected
  const usableCards = (pkg.carouselCards ?? []).filter(c => c.imageUrl).length
  if (usableImages || usableVideo || usableCards) return base.completed

  // Distinguish "produced nothing" from "produced, then discarded" — the first
  // is a generation failure to investigate, the second is a reversible choice.
  const hadAssets = (pkg.images ?? []).some(i => i.imageUrl) || !!pkg.video?.videoUrl
  return hadAssets
    ? { label: 'All rejected', chip: 'chip-warn' }
    : { label: 'No assets', chip: 'chip-bad' }
}

/**
 * Turn any camelCase / snake_case technical label into readable English.
 * E.g. "creative_fatigue" → "Ads are getting tired".
 * Fallback: word-splits + capitalizes.
 */
const TECHNICAL_LABEL_MAP: Record<string, string> = {
  creative_fatigue: 'Ads are getting tired',
  audience_saturation: 'Audience is overexposed',
  budget_saturation: 'Too much budget for this audience',
  delivery_stalled: 'Ad is not being shown',
  frequency_ceiling: 'People are seeing this ad too often',
  ctr_decay: 'Fewer people are clicking',
  cvr_collapse: 'Buyers stopped converting',
  placement_leak: 'Money leaking into wrong placements',
  hook_burn: 'This ad angle is worn out',
  unprofitable_run: 'Losing money on this campaign',
  winner_emerging: 'This ad is starting to work',
  winner_confirmed: 'Confirmed winner — scale it',
  audience_exhaustion: 'Audience is used up',
  learning_limited_locked: 'Meta stuck in learning mode',
  pause_ad: 'Stop this ad',
  pause_adset: 'Stop this ad group',
  scale_adset: 'Increase this ad group\'s budget',
  replace_creative: 'Change the ad',
  add_creative: 'Add a new ad',
  add_adset: 'Try a new ad group',
  shift_budget_between_adsets: 'Move budget to a better ad group',
  reduce_total_budget: 'Lower this campaign\'s budget',
  narrow_placement: 'Focus on better placements',
  dayparting: 'Only run at certain times',
}

export function plainLabel(technical: string | undefined | null): string {
  if (!technical) return ''
  const mapped = TECHNICAL_LABEL_MAP[technical]
  if (mapped) return mapped
  return technical
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())
}

/** ROAS + spend → "You spent ₹1,000 and made ₹1,850." */
export function spendVsEarnedSentence(
  spend: number,
  roas: number,
): string {
  if (spend <= 0) return 'No spend yet'
  const revenue = spend * (Number.isFinite(roas) ? roas : 0)
  return `You spent ${formatCurrency(Math.round(spend))} and made ${formatCurrency(
    Math.round(revenue),
  )}.`
}
