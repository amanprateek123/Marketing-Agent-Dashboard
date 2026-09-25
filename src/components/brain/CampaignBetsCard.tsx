'use client'

/**
 * "What this campaign is testing" — the Brain's bets on one live campaign, their status, and the
 * date before which the Brain will not pause the ads that test them ("protected until").
 *
 * Reads GET brain/:t/campaigns/:metaCampaignId/bets (hypotheses by campaign and by the run that
 * built it, plus monitor_thresholds' judge_from). A campaign the Brain did not build carries no
 * bets by design; the card says so in one sentence instead of showing an empty list. When the
 * Brain cannot be reached the card says it could not load and keeps the reason under Details.
 */

import React, { useEffect, useState } from 'react'
import { FlaskConical, Loader2, ShieldCheck } from 'lucide-react'
import { getCampaignBets } from '@/lib/brain-api'
import type { BrainCampaignBets } from '@/types/brain'
import { PLAIN_ERROR, errorDetail } from '@/lib/plain-language'
import { Details } from '@/components/plain/Details'
import { BetList } from './Bets'

export function CampaignBetsCard({ tenantId, metaCampaignId }: { tenantId: string; metaCampaignId: string }) {
  const [data, setData] = useState<BrainCampaignBets | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const next = await getCampaignBets(tenantId, metaCampaignId)
        if (!cancelled) {
          setData(next)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(errorDetail(err) || 'Unknown error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, metaCampaignId])

  // A campaign the Brain did not build: nothing to show, and nothing is wrong.
  if (data && !data.found && data.bets.length === 0) return null

  return (
    <section className="card min-w-0 p-4 sm:p-5" aria-label="What this campaign is testing">
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          <FlaskConical size={15} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
          What this campaign is testing
        </p>
        {data?.protectedUntil && (
          <span className="chip chip-info inline-flex items-center gap-1" title={data.note ?? undefined}>
            <ShieldCheck size={12} aria-hidden="true" />
            Protected until {data.protectedUntil}
          </span>
        )}
      </div>

      {error ? (
        <div className="flex flex-col gap-2" role="alert">
          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
            {PLAIN_ERROR}
          </p>
          <Details items={[{ label: 'Error', value: error }]} />
        </div>
      ) : data === null ? (
        <p className="explain inline-flex items-center gap-2" aria-busy="true">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Loading…
        </p>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {data.note && <p className="explain break-words">{data.note}</p>}
          <BetList bets={data.bets} showProduct={false} />
        </div>
      )}
    </section>
  )
}
