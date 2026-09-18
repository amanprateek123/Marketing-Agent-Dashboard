'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Loader2, Pause, Play, Webhook } from 'lucide-react'
import { getAgentTriggers, setAgentTriggerEnabled } from '@/lib/brain-api'
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

  const load = useCallback(async () => {
    try {
      setTriggers(await getAgentTriggers(tenantId, agentKey))
      setError(null)
    } catch (err) {
      // Not fatal to the tab. Schedule control is separately configured from everything else here,
      // so an unconfigured builder token must degrade this panel alone.
      setError(err instanceof Error ? err.message : 'Schedules could not be read.')
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
      try {
        await setAgentTriggerEnabled(tenantId, agentKey, handle, !trigger.enabled)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'That change was not applied.')
      } finally {
        setBusy(null)
      }
    },
    [tenantId, agentKey, load],
  )

  if (triggers === null) {
    return <p className="explain">Reading schedules…</p>
  }

  if (triggers.length === 0) {
    return (
      <p className="explain">
        {error ?? 'Nothing starts this agent automatically — it runs only when you or the Brain ask.'}
      </p>
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
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
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
              <span className="block truncate text-[13px] font-medium" style={{ color: 'var(--ink-2)' }}>
                {t.name}
              </span>
              <span className="explain flex flex-wrap items-center gap-x-2">
                <span className={t.enabled ? 'chip chip-good' : 'chip chip-neutral'}>
                  {t.enabled ? 'On' : 'Paused'}
                </span>
                {t.cron && <code>{t.cron}</code>}
                {!isSchedule && <span>fired by the Brain, not a clock</span>}
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
        <p className="text-sm" style={{ color: 'var(--bad)' }}>
          {error}
        </p>
      )}

      <p className="explain">
        On or off only. Changing <em>when</em> something runs stays in Studio — the bridge is
        restricted to reading schedules and toggling them.
      </p>
    </div>
  )
}
