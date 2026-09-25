'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertCircle, Clock3 } from 'lucide-react'
import {
  getSnapshotHistory,
  type IntelligenceSnapshotDoc,
} from '@/lib/api'
import { formatRelative, humanise } from '@/lib/plain-language'

interface Props {
  tenantId: string
  campaignId: string
  /**
   * How often to re-poll the history endpoint. Default 30s — matches
   * the intelligence pipeline's 15-min snapshot cadence with headroom.
   */
  pollMs?: number
}

/**
 * Small header widget that surfaces the newest IntelligenceSnapshot
 * for a campaign, its freshness, and the engine schema version.
 *
 * Keeps provenance visible even when the snapshot endpoint is unavailable;
 * trust-critical campaign evidence should never fail as a silent blank.
 */
export function SnapshotFreshnessBanner({
  tenantId,
  campaignId,
  pollMs = 30_000,
}: Props) {
  const [snap, setSnap] = useState<IntelligenceSnapshotDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [reachable, setReachable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const list = await getSnapshotHistory(tenantId, campaignId, 1)
        if (cancelled) return
        setSnap(list[0] ?? null)
        setReachable(true)
      } catch {
        if (!cancelled) setReachable(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    tick()
    const id = window.setInterval(tick, pollMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [tenantId, campaignId, pollMs])

  if (loading) {
    return (
      <div className="card mb-4 flex items-center gap-3 px-4 py-3" role="status">
        <div className="skeleton h-8 w-8 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="skeleton h-3 w-32 rounded" />
          <div className="skeleton mt-2 h-2.5 w-52 max-w-full rounded" />
        </div>
        <span className="sr-only">Checking how up to date these numbers are…</span>
      </div>
    )
  }

  if (reachable === false) {
    return (
      <div
        className="card mb-4 flex items-start gap-3 px-4 py-3"
        role="status"
        style={{ borderColor: 'var(--warn-border)', background: 'var(--warn-bg)' }}
      >
        <AlertCircle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--warn)' }} />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>We couldn&apos;t check how fresh these numbers are</p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-2)' }}>
            The campaign numbers below are still shown, but we could not confirm when they were last updated. Try again in a minute.
          </p>
        </div>
      </div>
    )
  }

  if (!snap) {
    return (
      <div className="card mb-4 flex items-start gap-3 px-4 py-3" role="status">
        <Clock3 size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ink-3)' }} />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>No health check yet</p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-3)' }}>
            This campaign has not had its first automatic check-up yet. It runs every 15 minutes or so.
          </p>
        </div>
      </div>
    )
  }

  const fresh = (snap.freshnessSec ?? 9999) < 1800
  const veryStale = (snap.freshnessSec ?? 9999) > 3600

  return (
    <div
      className="card mb-4 flex flex-wrap items-center gap-3 px-4 py-3"
      role="status"
      style={
        veryStale
          ? { borderColor: 'var(--warn-border)', background: 'var(--warn-bg)' }
          : fresh
            ? { borderColor: 'var(--good-border)', background: 'var(--good-bg)' }
            : undefined
      }
    >
      <Activity
        size={14}
        style={{ color: veryStale ? 'var(--warn)' : fresh ? 'var(--good)' : 'var(--ink-3)' }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>
          Latest check-up
        </p>
        <p className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          Updated {formatRelative(snap.collectedAt as string)}
          {snap.freshnessSec != null && (
            <>
              {' '}· Meta&apos;s numbers were {Math.round(snap.freshnessSec / 60)} minutes old
            </>
          )}
        </p>
      </div>
      {snap.missingFields.length > 0 && (
        <span className="chip chip-warn shrink-0" title={`Missing: ${snap.missingFields.map(humanise).join(', ')}`}>
          {snap.missingFields.length} {snap.missingFields.length === 1 ? 'number' : 'numbers'} missing
        </span>
      )}
      <span
        className={`chip shrink-0 ${veryStale ? 'chip-warn' : fresh ? 'chip-good' : 'chip-neutral'}`}
        title={veryStale ? 'More than an hour old.' : fresh ? 'Less than 30 minutes old.' : 'Between 30 minutes and an hour old.'}
      >
        {veryStale ? 'Out of date' : fresh ? 'Up to date' : 'A little old'}
      </span>
    </div>
  )
}
