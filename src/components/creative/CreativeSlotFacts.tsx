'use client'

/**
 * <CreativeSlotFacts> — what one creative was planned to be, and who wrote it.
 *
 * Reads the per-creative fields a run node carries since the slot plan (SLOT-CONTRACT.md "Where it
 * comes back"): angle, opening hook, look, and `authoring_engine` ("Written by Foundry" / "Written
 * by backup writer"). Every field is optional — a run started before the plan existed carries none,
 * and then this renders nothing at all rather than a row of dashes.
 *
 * Plain words only, via the shared vocabulary; the hypothesis id is an internal id and is never
 * shown. `compact` is for the narrow per-creative tiles (two to a row on a phone).
 */

import { plainStatus, toneChip } from '@/lib/plain-language'
import type { CustomBriefRunNode } from '@/types'

type SlotFields = Pick<CustomBriefRunNode, 'angle' | 'hook_type' | 'visual_direction' | 'authoring_engine'>

export function hasSlotFacts(node: SlotFields | null | undefined): boolean {
  return !!(node && (node.angle || node.hook_type || node.visual_direction || node.authoring_engine))
}

export function CreativeSlotFacts({
  node,
  angleLabels,
  compact = false,
}: {
  node: SlotFields | null | undefined
  /** Served angle labels (GET /v1/options angles), preferred over the local vocabulary. */
  angleLabels?: { value: string; label: string }[]
  compact?: boolean
}) {
  if (!node || !hasSlotFacts(node)) return null
  const facts: { label: string; value: string; meaning: string }[] = []
  if (node.angle) {
    const plain = plainStatus('creativeAngle', node.angle)
    facts.push({
      label: 'Angle',
      value: angleLabels?.find(a => a.value === node.angle)?.label ?? plain.label,
      meaning: plain.meaning,
    })
  }
  if (node.hook_type) {
    const plain = plainStatus('hookType', node.hook_type)
    facts.push({ label: 'Opens with', value: plain.label, meaning: plain.meaning })
  }
  if (node.visual_direction) {
    const plain = plainStatus('creativeLook', node.visual_direction)
    facts.push({ label: 'Look', value: plain.label, meaning: plain.meaning })
  }
  const engine = node.authoring_engine ? plainStatus('authoringEngine', node.authoring_engine) : null
  // An unknown engine value humanises to something like "Other" — say nothing rather than guess.
  const engineKnown = engine && engine.meaning

  const size = compact ? 'text-[10.5px]' : 'text-[12px]'
  return (
    <div className={`min-w-0 ${compact ? 'mt-1.5' : 'mt-2'}`}>
      <dl className={`${size} leading-snug space-y-0.5 min-w-0`}>
        {facts.map(f => (
          <div key={f.label} className="flex gap-1 min-w-0" title={f.meaning || undefined}>
            <dt className="shrink-0" style={{ color: 'var(--ink-4)' }}>{f.label}:</dt>
            <dd className="min-w-0 break-words" style={{ color: 'var(--ink-2)' }}>{f.value}</dd>
          </div>
        ))}
      </dl>
      {engineKnown && (
        <span
          className={`chip ${toneChip(engine.tone)} mt-1 max-w-full`}
          // Chips are nowrap by default; in a two-to-a-row tile on a phone the label must wrap.
          style={{ whiteSpace: 'normal', height: 'auto', ...(compact ? { fontSize: 10 } : {}) }}
          title={engine.meaning}
        >
          {engine.label}
        </span>
      )}
    </div>
  )
}
