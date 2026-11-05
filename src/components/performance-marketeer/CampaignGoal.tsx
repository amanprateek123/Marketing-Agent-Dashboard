'use client'

import { addDays, isPmAppProduct, istToday, type PmGoalChange } from '@/lib/performance-marketeer-api'
import type { PmCampaignTarget } from '@/types/performance-marketeer'
import { fmt } from './shared'

export type PmGoalValues = { targetRoas: number | null; targetPurchases: number | null; targetDays: number | null; maxDailyBudget: number | null }

const DEFAULT_DAYS = 3

/** What's in force: a target whose period has ended doesn't carry over. The budget limit does. */
export function openGoal(t: PmCampaignTarget | undefined) {
  const end = t?.targetDays && t.targetStart ? addDays(t.targetStart, t.targetDays - 1) : null
  const open = end !== null && end >= istToday()
  return {
    targetRoas: open ? (t?.targetRoas ?? null) : null,
    targetPurchases: open ? (t?.targetPurchases ?? null) : null,
    targetDays: open ? (t?.targetDays ?? null) : null,
    maxDailyBudget: t?.maxDailyBudget ?? null,
    end: open ? end : null,
  }
}

/** Reads and checks the fields of one campaign. Returns an error sentence, or the values. */
export function readGoal(form: FormData, prefix: string, name: string): PmGoalValues | string {
  const num = (k: string) => {
    const raw = String(form.get(`${prefix}-${k}`) ?? '').trim()
    return raw === '' ? null : Number(raw)
  }
  const roas = num('roas')
  const purchases = num('purchases')
  const days = num('days')
  const budget = num('budget')
  const whole = (v: number | null, max: number) => v === null || (Number.isInteger(v) && v >= 1 && v <= max)
  if (roas !== null && !(roas >= 0.01 && roas <= 100)) return `Target ROAS for ${name} must be from 0.01 to 100.`
  if (!whole(purchases, 1_000_000)) return `Purchases for ${name} must be a whole number from 1 to 1,000,000.`
  if (!whole(budget, 100_000_000)) return `Max daily budget for ${name} must be a whole number of rupees.`
  const wantsTarget = roas !== null || purchases !== null
  if (wantsTarget && (days === null || !whole(days, 90))) return `Days for ${name} must be a whole number from 1 to 90.`
  return { targetRoas: roas, targetPurchases: purchases, targetDays: wantsTarget ? days : null, maxDailyBudget: budget }
}

/** What to save, or null if nothing changed. A new budget alone doesn't restart the count. */
export function goalChange(stored: PmCampaignTarget | undefined, next: PmGoalValues): PmGoalChange | null {
  const now = openGoal(stored)
  const change: PmGoalChange = {}
  if (next.targetRoas !== now.targetRoas || next.targetPurchases !== now.targetPurchases || next.targetDays !== now.targetDays) {
    change.targetRoas = next.targetRoas
    change.targetPurchases = next.targetPurchases
    change.targetDays = next.targetDays
  }
  if (next.maxDailyBudget !== now.maxDailyBudget) change.maxDailyBudget = next.maxDailyBudget
  return Object.keys(change).length ? change : null
}

/** The four fields. Uncontrolled: remount with a new `key` once saved values load. */
export function GoalFields({ prefix, stored, product, disabled }: { prefix: string; stored: PmCampaignTarget | undefined; product?: string; disabled?: boolean }) {
  const g = openGoal(stored)
  const field = (label: string, key: string, value: number | null, extra: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="flex min-w-0 flex-col gap-1 text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
      {label}
      <input
        type="number"
        name={`${prefix}-${key}`}
        autoComplete="off"
        disabled={disabled}
        defaultValue={value ?? ''}
        className="input !min-h-[34px] w-full !py-1 font-normal tabular-nums"
        {...extra}
      />
    </label>
  )
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="grid w-full grid-cols-2 gap-2">
        {field('Target ROAS (×)', 'roas', g.targetRoas, { inputMode: 'decimal', min: 0.01, max: 100, step: 0.01, placeholder: 'None' })}
        {field('Purchases', 'purchases', g.targetPurchases, { inputMode: 'numeric', min: 1, max: 1000000, step: 1, placeholder: 'None' })}
        {field('In how many days', 'days', g.targetDays ?? DEFAULT_DAYS, { inputMode: 'numeric', min: 1, max: 90, step: 1 })}
        {field('Max daily budget (₹)', 'budget', g.maxDailyBudget, { inputMode: 'numeric', min: 1, max: 100000000, step: 1, placeholder: 'None' })}
      </div>
      {g.end && <span className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>Current goal runs until {fmt.date(g.end)}. Changing the ROAS, purchases or days starts a new count from today.</span>}
      {isPmAppProduct(product) && <span className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>This is an app campaign, so ROAS and purchases count on Meta’s numbers. Our orders aren’t linked to it yet.</span>}
    </div>
  )
}
