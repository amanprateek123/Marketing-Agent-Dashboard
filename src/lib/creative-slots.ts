/**
 * The per-creative slot plan the creative form sends with a batch (SLOT-CONTRACT.md, 2026-09-30).
 *
 * The form still has the old unordered "Angles" multi-select; that is now the SOURCE for a
 * suggested plan, not the thing sent on its own. For a batch of N, creative i gets the picked
 * angles cycled in order (or, when none are picked, the pipeline's standard angle set in order —
 * the same no-repeat-until-all-used rule the pipeline applies itself). The operator can then change
 * any one creative's angle or look, and the resulting list is sent as `slots`. Explicit fields win
 * verbatim on the pipeline side, so what is on screen is what gets made.
 *
 * Pure functions, no React, so the rules are in one place and readable.
 */

import type { CustomBriefSlot, CustomBriefTrack } from '@/types/pipeline'

/**
 * Never assigned to a quick (raw) creative by default, and refused by the pipeline when asked for
 * explicitly — a price-first hook is a polished-ad move.
 */
export const RAW_EXCLUDED_ANGLE = 'price_led'

/** What the operator changed on one row; anything unset follows the suggestion. */
export interface SlotOverride {
  angle?: string
  /** '' means "let the pipeline choose" (explicitly cleared). */
  look?: string
}

/** One row of the plan as the form shows it. `look` '' = pipeline chooses. */
export interface PlannedSlot {
  slot: number
  angle: string
  look: string
  language?: string
}

/**
 * The count the form will actually produce: blank → the served default, clamped to the served
 * range. Unparseable input counts as the default, the same as the pipeline treats it.
 */
export function resolveCount(
  typed: string,
  opts: { default: number; min: number; max: number } | undefined,
): number {
  const def = opts?.default ?? 5
  const min = opts?.min ?? 1
  const max = opts?.max ?? 50
  const n = Number.parseInt(typed.trim(), 10)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, n))
}

/** The angles a creative of this style may be given. */
export function allowedAngles(standard: string[], track: CustomBriefTrack): string[] {
  return track === 'raw' ? standard.filter(a => a !== RAW_EXCLUDED_ANGLE) : standard
}

/**
 * The suggested angle for each of `count` creatives: the picked angles in the order they appear in
 * the served list, cycled; or the whole standard set when none are picked. A quick (raw) batch never
 * gets price-led by default — if that was the only pick, it falls back to the standard set.
 */
export function suggestedAngles(
  count: number,
  picked: string[],
  standard: string[],
  track: CustomBriefTrack,
): string[] {
  const allowed = allowedAngles(standard, track)
  // Keep the served order, so the plan reads the same way as the picker above it.
  const pickedInOrder = allowed.filter(a => picked.includes(a))
  const cycle = pickedInOrder.length ? pickedInOrder : allowed
  if (!cycle.length) return Array.from({ length: count }, () => '')
  return Array.from({ length: count }, (_, i) => cycle[i % cycle.length])
}

/**
 * The plan as shown: suggestions with the operator's per-row changes laid over them. Languages are
 * shared out round-robin, exactly as the pipeline's own language plan does, so the row says which
 * language that creative will be in.
 */
export function planSlots(args: {
  count: number
  picked: string[]
  standard: string[]
  track: CustomBriefTrack
  languages: string[]
  /** The looks this style can take (raw visual directions); [] when none are offered. */
  looks: string[]
  overrides: Record<number, SlotOverride>
}): PlannedSlot[] {
  const { count, picked, standard, track, languages, looks, overrides } = args
  const allowed = allowedAngles(standard, track)
  const angles = suggestedAngles(count, picked, standard, track)
  return angles.map((suggested, i) => {
    const o = overrides[i + 1] ?? {}
    // An override that is no longer legal (e.g. price-led, then switched to quick) quietly reverts
    // to the suggestion rather than being sent to a certain refusal.
    const angle = o.angle && allowed.includes(o.angle) ? o.angle : suggested
    return {
      slot: i + 1,
      angle,
      // Same for a look: only one this style actually offers is kept.
      look: o.look && looks.includes(o.look) ? o.look : '',
      language: languages.length ? languages[i % languages.length] : undefined,
    }
  })
}

/** The wire shape: only what was decided, so the pipeline fills the rest by its own rules. */
export function toSlotBody(rows: PlannedSlot[], track: CustomBriefTrack): CustomBriefSlot[] {
  return rows.map(r => ({
    slot: r.slot,
    track,
    ...(r.language ? { language: r.language } : {}),
    ...(r.angle ? { angle: r.angle } : {}),
    ...(r.look ? { visual_direction: r.look } : {}),
  }))
}
