'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, PauseCircle } from 'lucide-react'
import { getCustomBriefEvents, getCustomBriefRun } from '@/lib/api'
import type { CustomBriefEvent, CustomBriefRun, CustomBriefRunNode } from '@/types'

/**
 * Live progress for one Custom-brief run.
 *
 * The pipeline has no websocket and this codebase has none either, so this
 * polls on the house cadence used elsewhere on the creative pages (10s). Two
 * calls per tick: the run for structure (children, percent) and the event
 * cursor for narration. The cursor means each poll only fetches what is new,
 * so a long run doesn't re-download its whole history every 10 seconds.
 *
 * Polling stops on its own once the run is terminal, or after MAX_TICKS so an
 * abandoned tab doesn't poll forever.
 */

const POLL_MS = 10_000
const MAX_TICKS = 180 // ~30 min; long enough for a 5-creative batch

/** Statuses that mean a human has to act — but there is no Slack thread to act
 *  in, so these are dead ends and must not be shown as "working". */
const BLOCKED = new Set([
  'awaiting_language',
  'awaiting_image_kind',
  'awaiting_badge_image',
  'awaiting_revision',
  'awaiting_clarification',
  'awaiting_research_confirm',
  'awaiting_research_rerun',
  'validation_failed',
])
const FAILED = new Set(['error', 'cancelled'])

/**
 * The best image a run can show right now.
 *
 * The layout preview appears well before the creative is finished, so a run has
 * something to show for most of its life rather than only at the end. Later the
 * finished deliverable replaces it. All of these are presigned by the API —
 * the underlying bucket is private, so they expire and must not be cached.
 */
function previewUrl(node: CustomBriefRunNode): string | undefined {
  const a = node.artifacts
  return a?.deliverable_s3 ?? a?.final_s3 ?? a?.layout_preview_s3
}

/**
 * Used only if the pipeline's own `status_phases` map hasn't loaded yet. Kept deliberately short:
 * the API is the source of truth (api_options.STATUS_PHASES) so a new status needs no deploy here.
 */
const FALLBACK_PHASES: Record<string, string> = {
  queued: 'Queued',
  authoring: 'Writing the brief',
  generating: 'Generating the image',
  resizing: 'Resizing',
  done: 'Complete',
  error: 'Failed',
}

function phaseLabel(status: string | null | undefined, phases: Record<string, string>): string {
  const key = (status ?? '').trim().toLowerCase()
  if (!key) return 'Pending'
  return phases[key] ?? FALLBACK_PHASES[key] ?? key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

interface LogLine {
  key: number
  text: string
  kind: CustomBriefEvent['kind']
  itemIndex: number | null
}

/**
 * Turn the raw event stream into something readable.
 *
 * Two problems with printing `ev.message` directly. `status` events store the machine value, so the
 * log read "queued / authoring" instead of prose; and the same status is written more than once
 * (create_run, then the first update_run), so a run opened with a duplicate "queued". Here status
 * events become phase labels and only appear when the phase actually CHANGES, while `progress`
 * events — the same narration the pipeline posts into Slack — pass through verbatim.
 *
 * Dedupe is tracked per child, because a batch interleaves its children's events in one stream and
 * "#2 Generating" must not be swallowed just because "#1 Generating" came first.
 */
function toLogLines(events: CustomBriefEvent[], phases: Record<string, string>): LogLine[] {
  const out: LogLine[] = []
  const lastPhase = new Map<number, string>()
  for (const ev of events) {
    const item = ev.item_index ?? 0
    if (ev.kind === 'status') {
      const label = phaseLabel(ev.message, phases)
      if (lastPhase.get(item) === label) continue
      lastPhase.set(item, label)
      out.push({ key: ev.id, text: label, kind: ev.kind, itemIndex: ev.item_index })
      continue
    }
    if (!ev.message) continue // artifact events carry a payload, not always prose
    out.push({ key: ev.id, text: ev.message, kind: ev.kind, itemIndex: ev.item_index })
  }
  return out
}

function statusChip(status: string, phases: Record<string, string>): { cls: string; label: string } {
  if (status === 'done') return { cls: 'chip-good', label: 'Done' }
  if (FAILED.has(status)) return { cls: 'chip-bad', label: status === 'cancelled' ? 'Cancelled' : 'Failed' }
  if (BLOCKED.has(status)) return { cls: 'chip-warn', label: 'Needs attention' }
  // In-flight: show the phase, not the machine value — "Generating the image", not "generating".
  return { cls: 'chip-accent', label: phaseLabel(status, phases) }
}

export function CustomBriefProgress({
  tenantId,
  runId,
  statusPhases,
  onFinished,
  onDismiss,
}: {
  tenantId: string
  runId: number
  /** `status_phases` from GET /v1/options — the pipeline's own status→phase vocabulary. */
  statusPhases?: Record<string, string>
  /** Fired once when the run settles, so the page can reload the library. */
  onFinished?: () => void
  /** Close the panel and forget the run. Only offered once it has settled — dismissing a live run
   *  would lose the only view of work that is still going. */
  onDismiss?: () => void
}) {
  const [run, setRun] = useState<CustomBriefRun | null>(null)
  const [events, setEvents] = useState<CustomBriefEvent[]>([])
  const [error, setError] = useState('')
  const cursor = useRef(0)
  const finished = useRef(false)
  const logEnd = useRef<HTMLDivElement | null>(null)

  const poll = useCallback(async () => {
    try {
      const [next, batch] = await Promise.all([
        getCustomBriefRun(tenantId, runId),
        getCustomBriefEvents(tenantId, runId, cursor.current),
      ])
      setRun(next)
      if (batch.events.length) {
        cursor.current = batch.cursor
        setEvents(prev => [...prev, ...batch.events])
      }
      if (next.progress?.terminal && !finished.current) {
        finished.current = true
        onFinished?.()
      }
      return next.progress?.terminal ?? false
    } catch (e) {
      // Transient failures are expected while the pipeline is busy; keep the
      // last known state on screen rather than blanking the panel.
      setError(e instanceof Error ? e.message : 'Lost contact with the pipeline')
      return false
    }
  }, [tenantId, runId, onFinished])

  useEffect(() => {
    let ticks = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const tick = async () => {
      if (cancelled) return
      const done = await poll()
      ticks += 1
      if (!cancelled && !done && ticks < MAX_TICKS) {
        timer = setTimeout(tick, POLL_MS)
      }
    }
    void tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [poll])

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [events.length])

  const progress = run?.progress
  const percent = progress?.percent ?? 0
  const terminal = progress?.terminal ?? false
  const children = run?.children ?? []

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          {terminal ? (
            progress && progress.failed > 0 ? (
              <AlertTriangle size={16} style={{ color: 'var(--warn)' }} />
            ) : (
              <CheckCircle2 size={16} style={{ color: 'var(--good)' }} />
            )
          ) : (
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-strong)' }} />
          )}
          <p className="micro-label" style={{ margin: 0 }}>
            Slack pipeline · run #{runId}
          </p>
        </div>
        {progress && (
          <p className="text-[12px] mono" style={{ color: 'var(--ink-3)' }}>
            {progress.done}/{progress.total} done
            {progress.failed > 0 ? ` · ${progress.failed} failed` : ''}
            {progress.blocked > 0 ? ` · ${progress.blocked} need attention` : ''}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full overflow-hidden mb-4"
        style={{ height: 6, background: 'var(--surface-warm)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percent}%`,
            background: terminal && progress && progress.failed > 0 ? 'var(--warn)' : 'var(--accent-strong)',
          }}
        />
      </div>

      {error && (
        <p className="text-[12px] mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
          {error} — still retrying.
        </p>
      )}

      {/* A count-of-1 run has no children — the parent IS the creative, so its
          preview has to render here or a single run would show no image at all. */}
      {children.length === 0 && run && previewUrl(run) && (
        <div
          className="mb-4 rounded-lg overflow-hidden mx-auto"
          style={{ maxWidth: 320, aspectRatio: '1 / 1', background: 'var(--surface-warm)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl(run)}
            alt="Creative"
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* One tile per creative. A batch parent stays at brief_ready forever, so
          the children are the only honest view of what is happening. */}
      {children.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
          {children.map(child => {
            const chip = statusChip(child.status, statusPhases ?? {})
            return (
              <div
                key={child.run_id}
                className="card-inset px-3 py-2.5"
                title={child.error ?? undefined}
              >
                {previewUrl(child) && (
                  <div
                    className="w-full mb-2 rounded-md overflow-hidden"
                    style={{ aspectRatio: '1 / 1', background: 'var(--surface)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl(child)}
                      alt={`Creative ${child.item_index ?? child.run_id}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--ink-3)' }}>
                  #{child.item_index ?? child.run_id}
                </p>
                <span className={`chip ${chip.cls}`}>{chip.label}</span>
                {BLOCKED.has(child.status) && (
                  <p className="flex items-center gap-1 text-[10.5px] mt-1.5" style={{ color: 'var(--warn)' }}>
                    <PauseCircle size={10} /> waiting on input
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Narration. This is the same text the pipeline posts into Slack —
          recorded as events so it can be read here too. */}
      <div
        className="rounded-lg px-3 py-2 overflow-y-auto"
        style={{ maxHeight: 200, background: 'var(--surface-warm)' }}
      >
        {events.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--ink-4)' }}>
            Queued — waiting for the pipeline to pick this up…
          </p>
        ) : (
          toLogLines(events, statusPhases ?? {}).map(line => (
            <p
              key={line.key}
              className="text-[12px] leading-relaxed"
              style={{ color: line.kind === 'error' ? 'var(--bad)' : 'var(--ink-3)' }}
            >
              {line.itemIndex ? (
                <span className="mono" style={{ color: 'var(--ink-4)' }}>#{line.itemIndex} </span>
              ) : null}
              {line.text}
            </p>
          ))
        )}
        <div ref={logEnd} />
      </div>

      {terminal && (
        <div className="flex items-center justify-between gap-3 mt-3">
          <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            {progress && progress.done > 0
              ? 'Finished creatives have been added to your library below.'
              : 'This run produced no creatives — check the log above.'}
          </p>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="btn btn-ghost">
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  )
}
