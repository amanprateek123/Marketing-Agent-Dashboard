'use client'

/**
 * Proven ideas — what has worked in past ads, from the Brain's catalogue.
 *
 * The catalogue is the Brain's accepted learnings and confirmed tests, grouped by idea: "Proven"
 * (two or more wins, or one confident one), "Promising" (one win), and a short list of ideas that
 * only ever failed — what not to retry. Every string arrives in words from the bridge
 * (GET brain/:t/proven → experiments.mapper.ts `mapProvenCatalogue`).
 *
 * Used by the Brain console's Experiments tab and by the "What has worked in your past ads" page.
 */

import React, { useEffect, useState } from 'react'
import { Award, Loader2 } from 'lucide-react'
import { getProvenIdeas } from '@/lib/brain-api'
import type { BrainProvenCatalogue, BrainProvenIdea } from '@/types/brain'
import { PLAIN_ERROR, errorDetail } from '@/lib/plain-language'
import { Details } from '@/components/plain/Details'
import { SectionCard } from './shared'
import { BetToneChip } from './Bets'

const SLOW_MS = 15_000
const PAGE_SIZE = 12

export function ProvenIdeas({
  tenantId,
  product = null,
  title = 'Proven ideas',
  description = 'Ideas that have already worked in real ads. The Brain builds new ads from these first, and does not retry the ones that failed.',
}: {
  tenantId: string
  product?: string | null
  title?: string
  description?: string
}) {
  const [data, setData] = useState<BrainProvenCatalogue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [slow, setSlow] = useState(false)
  const [reload, setReload] = useState(0)
  const [shown, setShown] = useState(PAGE_SIZE)

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (!cancelled) setSlow(true)
    }, SLOW_MS)
    void (async () => {
      try {
        const next = await getProvenIdeas(tenantId, product)
        if (cancelled) return
        setData(next)
        setError(null)
        setShown(PAGE_SIZE)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err) || 'Unknown error')
      } finally {
        window.clearTimeout(timer)
        if (!cancelled) setSlow(false)
      }
    })()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [tenantId, product, reload])

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <Award size={16} aria-hidden style={{ color: 'var(--ink-3)' }} />
          {title}
          {data && data.proven.length > 0 && (
            <span className="chip chip-neutral tabular-nums">
              {data.proven.length}
              {data.truncated ? '+' : ''}
            </span>
          )}
        </span>
      }
      description={description}
    >
      {error ? (
        <div className="flex flex-col gap-3" role="alert">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
              {PLAIN_ERROR}
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setData(null)
                setError(null)
                setReload((n) => n + 1)
              }}
            >
              Try again
            </button>
          </div>
          <Details items={[{ label: 'Error', value: error }]} />
        </div>
      ) : data === null ? (
        slow ? (
          <p className="explain">This is taking longer than usual. It may still load — or try again in a minute.</p>
        ) : (
          <p className="explain inline-flex items-center gap-2" aria-busy="true">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Loading…
          </p>
        )
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {data.empty ? (
            <p className="explain">
              Nothing is proven yet. Once a test works, the idea behind it shows up here — and new ads start from it.
            </p>
          ) : (
            <>
              <ul className="grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2">
                {data.proven.slice(0, shown).map((idea) => (
                  <li key={idea.ref} className="min-w-0">
                    <IdeaCard idea={idea} />
                  </li>
                ))}
              </ul>
              {data.proven.length > shown && (
                <div>
                  <button type="button" className="btn btn-ghost" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                    Show {Math.min(PAGE_SIZE, data.proven.length - shown)} more
                  </button>
                </div>
              )}
            </>
          )}
          {data.refuted.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
                Tried and did not work — not retried
              </p>
              <ul className="grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2">
                {data.refuted.map((idea) => (
                  <li key={idea.ref} className="min-w-0">
                    <IdeaCard idea={idea} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

function IdeaCard({ idea }: { idea: BrainProvenIdea }) {
  return (
    <article
      className="flex h-full min-w-0 flex-col gap-2 rounded-xl p-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <BetToneChip tone={idea.tone} label={idea.tierLabel} />
        <span className="chip chip-neutral">{idea.levelLabel}</span>
        {idea.product && (
          <span className="chip chip-neutral max-w-full truncate" title={idea.product}>
            {idea.product}
          </span>
        )}
      </div>
      <p className="break-words text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
        {idea.idea}
      </p>
      <p className="break-words text-xs" style={{ color: 'var(--ink-3)' }}>
        {idea.evidence}
      </p>
      <Details reference={idea.ref} />
    </article>
  )
}
