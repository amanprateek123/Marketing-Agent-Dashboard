'use client'

import { useEffect, useState } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import {
  getSnapshotHistory,
  type IntelligenceSnapshotDoc,
} from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

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
 * Renders nothing when the intelligence endpoint isn't wired for a
 * campaign yet — non-invasive on legacy campaigns.
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

  if (loading) return null
  if (reachable === false) return null // silently hide when unreachable
  if (!snap) return null

  const fresh = (snap.freshnessSec ?? 9999) < 1800
  const veryStale = (snap.freshnessSec ?? 9999) > 3600

  return (
    <div
      className="card px-4 py-2.5 flex items-center gap-3 mb-4"
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
        <p className="mono text-[10.5px] font-semibold tracking-wider uppercase" style={{ color: 'var(--ink-2)' }}>
          Intelligence Snapshot
        </p>
        <p className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          {formatRelativeTime(snap.collectedAt as string)} · schema {snap.schemaVersion}
          {snap.freshnessSec != null && (
            <>
              {' '}· freshness {Math.round(snap.freshnessSec / 60)}m
            </>
          )}
        </p>
      </div>
      {snap.missingFields.length > 0 && (
        <span className="chip chip-warn shrink-0" title={snap.missingFields.join(', ')}>
          {snap.missingFields.length} missing
        </span>
      )}
      <RefreshCw size={12} style={{ color: 'var(--ink-4)' }} />
    </div>
  )
}
