/**
 * An audience / targeting object (Meta targeting spec, or our own audience config) as plain lines a
 * marketer can read — "Women 25–45", "In Maharashtra, Karnataka", "Interested in astrology" — so a
 * page never prints the object as JSON.
 *
 *   describeAudience({ age_min: 25, age_max: 45, genders: [2], geo_locations: { regions: [{ name: 'Maharashtra' }] },
 *                      interests: [{ name: 'Astrology' }] })
 *     → ['Women 25–45', 'In Maharashtra', 'Interested in astrology']
 *
 *   audienceSentence(same) → 'Women 25–45 in Maharashtra, interested in astrology'
 *
 * Ids (custom audience ids, region keys) are never printed; anything unrecognised is summarised by
 * its humanised key with simple values only.
 */

import { humanise, plainStatus } from '@/lib/plain-language'

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

/** Names out of an array of strings or {name} objects; objects without a name are skipped (they are ids). */
function names(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => (typeof x === 'string' ? x : isObj(x) && typeof x.name === 'string' ? x.name : ''))
    .map((x) => x.trim())
    .filter(Boolean)
}

function list(items: string[], max = 4): string {
  if (items.length <= max) return items.join(', ')
  return `${items.slice(0, max).join(', ')} and ${items.length - max} more`
}

const COUNTRY: Record<string, string> = { IN: 'India', US: 'United States', GB: 'United Kingdom', AE: 'UAE' }

function who(a: Obj): string {
  const g = a.genders ?? a.gender
  const gs = (Array.isArray(g) ? g : g == null ? [] : [g]).map((x) => String(x).toLowerCase())
  const men = gs.some((x) => x === '1' || x === 'male' || x === 'men')
  const women = gs.some((x) => x === '2' || x === 'female' || x === 'women')
  const people = men && !women ? 'Men' : women && !men ? 'Women' : 'People'
  const min = num(a.age_min ?? a.ageMin)
  const max = num(a.age_max ?? a.ageMax)
  if (min != null && max != null) return `${people} ${min}–${max >= 65 ? '65+' : max}`
  if (min != null) return `${people} ${min}+`
  if (max != null) return `${people} up to ${max}`
  return people === 'People' ? '' : people
}

function where(a: Obj): string {
  const geo = isObj(a.geo_locations) ? a.geo_locations : isObj(a.geoLocations) ? a.geoLocations : isObj(a.geo) ? a.geo : a
  const places = [
    ...names(geo.cities),
    ...names(geo.regions),
    ...(Array.isArray(geo.countries) ? geo.countries.map((c) => COUNTRY[String(c)] ?? String(c)) : []),
  ]
  if (typeof a.geo === 'string' && a.geo.trim()) places.push(a.geo.trim())
  return places.length ? `in ${list(places)}` : ''
}

function interests(a: Obj): string {
  const flex = Array.isArray(a.flexible_spec) ? a.flexible_spec.filter(isObj) : []
  const all = [...names(a.interests), ...flex.flatMap((f) => [...names(f.interests), ...names(f.behaviors)])]
  return all.length ? `interested in ${list(all.map((x) => x.toLowerCase()))}` : ''
}

/** Plain lines, most important first. Empty array when there is nothing readable. */
export function describeAudience(value: unknown): string[] {
  if (value == null || value === '') return []
  if (typeof value === 'string') return [humanise(value)]
  if (Array.isArray(value)) return value.flatMap(describeAudience)
  if (!isObj(value)) return [String(value)]

  const lines: string[] = []
  if (typeof value.name === 'string' && value.name.trim()) lines.push(value.name.trim())
  const kind = value.audienceType ?? value.audience_type ?? value.type
  if (typeof kind === 'string' && kind) lines.push(plainStatus('audienceKind', kind).label)

  const headline = [who(value), where(value)].filter(Boolean).join(' ')
  if (headline) lines.push(headline.charAt(0).toUpperCase() + headline.slice(1))
  const likes = interests(value)
  if (likes) lines.push(likes.charAt(0).toUpperCase() + likes.slice(1))

  const custom = value.custom_audiences ?? value.customAudiences
  if (Array.isArray(custom) && custom.length) {
    const n = names(custom)
    lines.push(n.length ? `Includes ${list(n)}` : `Includes ${custom.length} saved audience${custom.length === 1 ? '' : 's'}`)
  }
  const excluded = value.excluded_custom_audiences ?? value.excludedCustomAudiences
  if (Array.isArray(excluded) && excluded.length) {
    lines.push(`Leaves out ${excluded.length} saved audience${excluded.length === 1 ? '' : 's'}`)
  }
  const lookalike = num(value.lookalikePercent ?? value.lookalike_percent ?? value.ratio)
  if (lookalike != null) lines.push(`Closest ${lookalike <= 1 ? Math.round(lookalike * 100) : lookalike}% lookalike`)

  if (lines.length === 0) {
    // Unrecognised shape: simple values only, humanised keys, no ids, never JSON.
    for (const [k, v] of Object.entries(value)) {
      if (/(^|_)id$|Id$|ids$|Ids$/.test(k)) continue
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        lines.push(`${humanise(k)}: ${typeof v === 'boolean' ? (v ? 'yes' : 'no') : typeof v === 'string' ? humanise(v) : v}`)
      } else if (Array.isArray(v) && names(v).length) {
        lines.push(`${humanise(k)}: ${list(names(v))}`)
      }
      if (lines.length >= 4) break
    }
  }
  return lines
}

/** One sentence: 'Women 25–45 in Maharashtra, interested in astrology'. '' when unreadable. */
export function audienceSentence(value: unknown): string {
  const lines = describeAudience(value)
  if (!lines.length) return ''
  return [lines[0], ...lines.slice(1).map((l) => l.charAt(0).toLowerCase() + l.slice(1))].join(', ')
}
