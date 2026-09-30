'use client'

/**
 * <SlotPlanEditor> — "what each creative will be", one row per creative in a batch.
 *
 * Pre-filled from the Angles picker above it (picked angles cycled in order, or the standard set
 * when none are picked — see lib/creative-slots). Each row can be changed on its own; the rows are
 * exactly what the form sends as `slots`, so what is on screen is what gets made.
 *
 * Plain words only: angle labels come from the served options, looks from the shared vocabulary.
 * Works at 360px: on a phone each row stacks (label, then its pickers); from `sm` up it is one line.
 */

import { RotateCcw } from 'lucide-react'
import { plainStatus } from '@/lib/plain-language'
import type { PlannedSlot, SlotOverride } from '@/lib/creative-slots'

export interface SlotPlanEditorProps {
  rows: PlannedSlot[]
  /** Angles this style can take, in served order, with their served labels. */
  angles: { value: string; label: string }[]
  /** Looks this style can take (raw visual directions). Empty hides the look picker. */
  looks: string[]
  /** True when any row differs from the suggestion — shows "Back to the suggestion". */
  edited: boolean
  onChange: (slot: number, change: SlotOverride) => void
  onReset: () => void
}

export function SlotPlanEditor({ rows, angles, looks, edited, onChange, onReset }: SlotPlanEditorProps) {
  if (!rows.length) return null
  const showLooks = looks.length > 0
  const angleLabel = (v: string) =>
    angles.find(a => a.value === v)?.label ?? plainStatus('creativeAngle', v).label

  return (
    <div className="mt-4 rounded-lg border p-3 min-w-0" style={{ borderColor: 'var(--hairline)', background: 'var(--surface)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
        <p className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>What each creative will be</p>
        {edited && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: 'var(--accent-strong)', fontSize: 11.5 }}
          >
            <RotateCcw size={11} /> Back to the suggestion
          </button>
        )}
      </div>
      <p className="text-[11px] leading-snug mb-3" style={{ color: 'var(--ink-4)' }}>
        We&rsquo;ve suggested an angle for each one from your picks above. Change any of them —
        each creative is made exactly as its row says.
        {showLooks && ' Leave the look on “Let us choose” and we’ll vary it for you.'}
      </p>

      <ol className="space-y-2">
        {rows.map(r => (
          <li
            key={r.slot}
            className={`grid gap-2 items-center min-w-0 grid-cols-1 ${showLooks
              ? 'sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)]'
              : 'sm:grid-cols-[120px_minmax(0,1fr)]'}`}
          >
            <span className="text-[12px] font-semibold min-w-0 truncate" style={{ color: 'var(--ink-2)' }}
              title={r.language ? `Creative ${r.slot} · ${r.language}` : `Creative ${r.slot}`}>
              Creative {r.slot}
              {r.language && <span className="font-normal" style={{ color: 'var(--ink-4)' }}> · {r.language}</span>}
            </span>
            <label className="block min-w-0">
              <span className="sr-only">Angle for creative {r.slot}</span>
              <select
                value={r.angle}
                onChange={e => onChange(r.slot, { angle: e.target.value })}
                className="input w-full min-w-0"
              >
                {angles.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
                {/* Only if the served list somehow lacks it — never leave the select blank. */}
                {r.angle && !angles.some(a => a.value === r.angle) && (
                  <option value={r.angle}>{angleLabel(r.angle)}</option>
                )}
              </select>
            </label>
            {showLooks && (
              <label className="block min-w-0">
                <span className="sr-only">Look for creative {r.slot} (optional)</span>
                <select
                  value={r.look}
                  onChange={e => onChange(r.slot, { look: e.target.value })}
                  className="input w-full min-w-0"
                >
                  <option value="">Look: let us choose</option>
                  {looks.map(l => (
                    <option key={l} value={l}>{plainStatus('creativeLook', l).label}</option>
                  ))}
                </select>
              </label>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
