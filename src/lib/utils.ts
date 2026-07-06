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

/** "For every ₹1 spent, you earn ₹1.85" style — human ROAS. */
export function formatROASPlain(roas: number | null | undefined): string {
  if (roas == null || !Number.isFinite(roas) || roas <= 0) return 'No revenue yet'
  const rounded = roas.toFixed(2)
  return `For every ₹1 spent, you earn ₹${rounded}`
}

/** Simple traffic-light health from a ROAS number vs a target. */
export function roasHealth(
  roas: number | null | undefined,
  target = 1.5,
): 'good' | 'watch' | 'bad' | 'unknown' {
  if (roas == null || !Number.isFinite(roas) || roas === 0) return 'unknown'
  if (roas >= target) return 'good'
  if (roas >= 1) return 'watch'
  return 'bad'
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
