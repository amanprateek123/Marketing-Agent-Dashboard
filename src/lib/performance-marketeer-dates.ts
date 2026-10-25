/** IST calendar-day helpers for Performance Marketeer (dates are plain YYYY-MM-DD). */

/** First day the analysis backend has data for; earlier dates are clamped to it. */
export const PM_DATA_START = '2026-04-10'
/** Longest range the page will request. */
export const PM_MAX_SPAN_DAYS = 200

export const YMD = /^\d{4}-\d{2}-\d{2}$/

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** Yesterday in IST — the last complete day the backend would have. */
export function istYesterday(now = new Date()): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
  return addDays(today, -1)
}

/** A valid, in-bounds date, or null. */
export function validDay(v: string | undefined, yesterday: string): string | null {
  return v && YMD.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && v >= PM_DATA_START && v <= yesterday ? v : null
}
