'use client'

/**
 * Bets — the idea an ad, an ad set, a gate, a decision or a live campaign is testing.
 *
 * Every string arrives already in words from the bridge (experiments.mapper.ts `mapBet`): the claim,
 * its kind and status labels, what a new twist changes, how many ads carry it and, once judged, the
 * result. The only id is the opaque `ref`, inside a collapsed <Details>.
 *
 *   <BetList bets={…} />          a list of bet cards (gates, decisions, live campaigns)
 *   <BetLine bet={…} />           one compact line under a creative or an ad set
 *   <BetToneChip tone label />    the status chip, shared with the Experiments tab
 */

import React from 'react'
import { Lightbulb } from 'lucide-react'
import type { BrainBet, BrainExperimentTone } from '@/types/brain'
import { plainStatus, toneChip } from '@/lib/plain-language'
import { Details } from '@/components/plain/Details'

export const BET_TONE_CHIP: Record<BrainExperimentTone, string> = {
  progress: 'chip-accent',
  waiting: 'chip-warn',
  good: 'chip-good',
  bad: 'chip-bad',
  idle: 'chip-neutral',
}

export function BetToneChip({ tone, label, meaning }: { tone: BrainExperimentTone; label: string; meaning?: string }) {
  return (
    <span className={`chip ${BET_TONE_CHIP[tone] ?? 'chip-neutral'}`} title={meaning || undefined}>
      {label}
    </span>
  )
}

export function kindChipClass(kind: BrainBet['kind']): string {
  return kind === 'other' ? 'chip-neutral' : toneChip(plainStatus('experimentKind', kind).tone)
}

/** One bet as a small card. */
export function BetCard({ bet, showProduct = true }: { bet: BrainBet; showProduct?: boolean }) {
  return (
    <article
      className="flex min-w-0 flex-col gap-2 rounded-xl p-3"
      style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <BetToneChip tone={bet.tone} label={bet.statusLabel} meaning={bet.statusMeaning} />
        <span className={`chip ${kindChipClass(bet.kind)}`}>{bet.kindLabel}</span>
        <span className="chip chip-neutral">{bet.levelLabel}</span>
        {showProduct && bet.product && (
          <span className="chip chip-neutral max-w-full truncate" title={bet.product}>
            {bet.product}
          </span>
        )}
      </div>
      <p className="break-words text-sm font-medium leading-snug" style={{ color: 'var(--ink)' }}>
        {bet.claim}
      </p>
      {bet.change && (
        <p className="break-words text-xs" style={{ color: 'var(--ink-2)' }}>
          {bet.change}
        </p>
      )}
      {(bet.carriedBy || bet.result) && (
        <div className="flex min-w-0 flex-col gap-1 text-xs" style={{ color: 'var(--ink-3)' }}>
          {bet.carriedBy && <span className="break-words">{bet.carriedBy.sentence}</span>}
          {bet.result && (
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="min-w-0 break-words" style={{ color: 'var(--ink-2)' }}>
                {bet.result.sentence}
              </span>
              {bet.result.confidenceLabel && <span className="chip chip-info">{bet.result.confidenceLabel}</span>}
            </span>
          )}
        </div>
      )}
      <Details reference={bet.ref} />
    </article>
  )
}

/** Several bets, or a plain sentence when there are none. */
export function BetList({
  bets,
  empty,
  showProduct = true,
}: {
  bets: BrainBet[] | null | undefined
  empty?: string
  showProduct?: boolean
}) {
  if (!bets || bets.length === 0) {
    return empty ? <p className="explain">{empty}</p> : null
  }
  return (
    <ul className="flex min-w-0 flex-col gap-2">
      {bets.map((bet) => (
        <li key={bet.ref} className="min-w-0">
          <BetCard bet={bet} showProduct={showProduct} />
        </li>
      ))}
    </ul>
  )
}

/** One compact line — "Testing: Ads that open with a question …" — for a creative or an ad set. */
export function BetLine({ bet, prefix = 'Testing' }: { bet: BrainBet | null | undefined; prefix?: string }) {
  if (!bet) return null
  return (
    <span
      className="flex min-w-0 items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs"
      style={{ background: 'var(--surface-warm)', color: 'var(--ink-2)' }}
      title={bet.statusMeaning || undefined}
    >
      <Lightbulb size={12} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: 'var(--ink-3)' }} />
      <span className="min-w-0 break-words">
        <span className="font-semibold">{prefix}:</span> {bet.claim}{' '}
        <span className={`chip ${BET_TONE_CHIP[bet.tone] ?? 'chip-neutral'} align-middle`}>{bet.statusLabel}</span>
      </span>
    </span>
  )
}
