'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Loader2, Pause, Play, Webhook } from 'lucide-react'
import { getAgentTriggers, setAgentTriggerEnabled } from '@/lib/brain-api'
import { Details } from '@/components/plain/Details'
import { errorDetail, plainStatus } from '@/lib/plain-language'
import type { BrainAgentKey, BrainTrigger } from '@/types/brain'

/**
 * What starts this agent, and whether it is on.
 *
 * This exists because of a specific six-day failure. The four pipeline stage agents ran on
 * ten-minute polls until 2026-09-12, when those were deliberately replaced by a deterministic
 * sweeper — cheaper, faster and better. Nothing on any screen said so. The paused schedules read
 * as breakage, and the correct architecture looked like a bug until someone read the tool's source.
 *
 * So a paused schedule is shown as a STATE, not an absence, and the row says which kind of trigger
 * it is. A webhook-driven agent with every schedule paused is a healthy agent, and this should make
 * that legible rather than alarming.
 *
 * Only the on/off switch is here. Rescheduling lives in Studio — and not merely by convention: the
 * bridge's transport is allowlisted to `list_triggers` and `update_trigger`, so the rest of the
 * builder token's reach is unavailable to this page by construction.
 */
/**
 * Trigger names come from the builder and can carry internals ("fired by the Brain's
 * pipeline_advance", "00:00 UTC"). Keep the readable part; anything code-like becomes a plain phrase.
 * The full name stays in the row's tooltip.
 */
function plainTriggerName(name: string, isSchedule: boolean): string {
  const cleaned = name.replace(/\s*[—-]\s*fired by .*$/i, '').trim()
  if (!cleaned || /[a-z]+_[a-z_]+/.test(cleaned) || /[*/]/.test(cleaned)) {
    return isSchedule ? 'Runs on a timetable' : 'Started by the Brain'
  }
  if (!isSchedule && /webhook/i.test(cleaned)) return 'Started by the Brain'
  return cleaned
}

export function TriggerList({
  tenantId,
  agentKey,
}: {
  tenantId: string
  agentKey: BrainAgentKey
}) {
  const [triggers, setTriggers] = useState<BrainTrigger[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The raw technical message, for the collapsed Details only.
  const [errorRaw, setErrorRaw] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setTriggers(await getAgentTriggers(tenantId, agentKey))
      setError(null)
      setErrorRaw(null)
    } catch (err) {
      // Not fatal to the tab. Schedule control is separately configured from everything else here,
      // so an unconfigured builder token must degrade this panel alone.
      setError("We couldn't check this helper's timetable. Try again later.")
      setErrorRaw(errorDetail(err) || null)
      setTriggers([])
    }
  }, [tenantId, agentKey])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = useCallback(
    async (trigger: BrainTrigger) => {
      // Foundry's list response does not always carry an id, so fall back to a name fragment —
      // which is what `update_trigger` accepts as its second address.
      const handle = trigger.id ?? trigger.name.slice(0, 40)
      setBusy(handle)
      setError(null)
      setErrorRaw(null)
      try {
        await setAgentTriggerEnabled(tenantId, agentKey, handle, !trigger.enabled)
        await load()
      } catch (err) {
        setError("That change didn't go through. Try again.")
        setErrorRaw(errorDetail(err) || null)
      } finally {
        setBusy(null)
      }
    },
    [tenantId, agentKey, load],
  )

  if (triggers === null) {
    return <p className="explain">Checking the timetable…</p>
  }

  if (triggers.length === 0) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <p className="explain">
          {error ?? 'Nothing starts this helper on its own — it works only when you or the Brain ask.'}
        </p>
        {errorRaw && <Details items={[{ label: 'What went wrong', value: errorRaw }]} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {triggers.map((t) => {
        const handle = t.id ?? t.name.slice(0, 40)
        const isSchedule = t.source === 'schedule'
        return (
          <div
            key={`${t.source}-${t.name}`}
            className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 sm:flex-nowrap"
            style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: t.enabled ? 'var(--accent-bg)' : 'var(--muted)',
                color: t.enabled ? 'var(--accent-strong)' : 'var(--ink-4)',
              }}
            >
              {isSchedule ? <CalendarClock size={14} /> : <Webhook size={14} />}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-[13px] font-medium"
                style={{ color: 'var(--ink-2)' }}
                title={t.name}
              >
                {plainTriggerName(t.name, isSchedule)}
              </span>
              <span className="explain flex flex-wrap items-center gap-x-2">
                <span
                  className={t.enabled ? 'chip chip-good' : 'chip chip-neutral'}
                  title={plainStatus('triggerState', t.enabled ? 'enabled' : 'disabled').meaning}
                >
                  {plainStatus('triggerState', t.enabled ? 'enabled' : 'disabled').label}
                </span>
                {!isSchedule && <span>started by the Brain when the step before is done</span>}
              </span>
            </span>

            {/* A webhook has no on/off worth offering: it fires because something upstream
                decided to, and pausing it would strand the run that triggered it. */}
            {isSchedule && (
              <button
                type="button"
                className="btn btn-ghost shrink-0"
                onClick={() => void toggle(t)}
                disabled={busy === handle}
                title={t.enabled ? 'Pause this schedule' : 'Resume this schedule'}
              >
                {busy === handle ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                ) : t.enabled ? (
                  <Pause size={13} aria-hidden="true" />
                ) : (
                  <Play size={13} aria-hidden="true" />
                )}
                {t.enabled ? 'Pause' : 'Resume'}
              </button>
            )}
          </div>
        )
      })}

      {error && (
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm" style={{ color: 'var(--bad)' }}>
            {error}
          </p>
          {errorRaw && <Details items={[{ label: 'What went wrong', value: errorRaw }]} />}
        </div>
      )}

      <p className="explain">
        You can switch a timetable on or off here. To change <em>when</em> it runs, ask your
        admin.
      </p>
    </div>
  )
}
