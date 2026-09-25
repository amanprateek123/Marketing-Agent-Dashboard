'use client'

/**
 * Recent test results — the Brain's judged experiments (worked / didn't work), each with the
 * figures behind its verdict. Read from GET brain/:t/experiments?view=learned; every string is
 * already in words. Used on the "What has worked in your past ads" page beside <ProvenIdeas>.
 */

import React, { useEffect, useState } from 'react'
import { CircleCheck, Loader2 } from 'lucide-react'
import { getExperimentPage } from '@/lib/brain-api'
import type { BrainExperiment } from '@/types/brain'
import { PLAIN_ERROR, errorDetail } from '@/lib/plain-language'
import { Details } from '@/components/plain/Details'
import { SectionCard } from './shared'
import { BetToneChip } from './Bets'

const PAGE_SIZE = 8

export function LearnedResults({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<BrainExperiment[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const page = await getExperimentPage(tenantId, 'learned')
        if (cancelled) return
        setRows(page.experiments)
        setTruncated(page.truncated)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err) || 'Unknown error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, reload])

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <CircleCheck size={16} aria-hidden style={{ color: 'var(--ink-3)' }} />
          Recent test results
        </span>
      }
      description="Ideas the Brain tested with real ads and got a clear answer on — what worked, what did not, and the numbers."
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
                setRows(null)
                setError(null)
                setReload((n) => n + 1)
              }}
            >
              Try again
            </button>
          </div>
          <Details items={[{ label: 'Error', value: error }]} />
        </div>
      ) : rows === null ? (
        <p className="explain inline-flex items-center gap-2" aria-busy="true">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="explain">No test has finished with a clear answer yet.</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <ul className="flex min-w-0 flex-col gap-2.5">
            {rows.slice(0, shown).map((exp) => (
              <li
                key={exp.ref}
                className="flex min-w-0 flex-col gap-1.5 rounded-xl p-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
              >
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <BetToneChip tone={exp.tone} label={exp.statusLabel} meaning={exp.statusMeaning} />
                  <span className="chip chip-neutral">{exp.levelLabel}</span>
                  {exp.product && (
                    <span className="chip chip-neutral max-w-full truncate" title={exp.product}>
                      {exp.product}
                    </span>
                  )}
                  {exp.since && (
                    <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                      Decided {exp.since}
                    </span>
                  )}
                </span>
                <span className="break-words text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  {exp.claim}
                </span>
                {exp.result && (
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm" style={{ color: 'var(--ink-2)' }}>
                    <span className="min-w-0 break-words">{exp.result.sentence}</span>
                    {exp.result.confidenceLabel && <span className="chip chip-info">{exp.result.confidenceLabel}</span>}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            {rows.length > shown && (
              <button type="button" className="btn btn-ghost" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, rows.length - shown)} more
              </button>
            )}
            {truncated && <span className="explain">The Brain has more results; these are the newest.</span>}
          </div>
        </div>
      )}
    </SectionCard>
  )
}
