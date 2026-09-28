'use client'

import { useCallback, useState } from 'react'
import { ParityError, type ParityResult } from '@/lib/creative-parity-api'
import { errorDetail } from '@/lib/plain-language'

export type ActionOutcome =
  | { kind: 'idle' }
  | { kind: 'ok'; text: string }
  | { kind: 'unavailable'; text: string }
  | { kind: 'error'; text: string; detail: string }

/**
 * One button's lifecycle: busy while the call is out, then a plain sentence.
 *
 * A 404 is its own outcome, not an error: the creativebot route behind it is still being built,
 * and saying "something went wrong" would send people hunting for a fault that is not there.
 */
export function useParityAction() {
  const [busy, setBusy] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<ActionOutcome>({ kind: 'idle' })

  const run = useCallback(
    async <T,>(
      key: string,
      fn: () => Promise<T>,
      okText: string,
    ): Promise<T | undefined> => {
      setBusy(key)
      setOutcome({ kind: 'idle' })
      try {
        const res = await fn()
        const msg = (res as ParityResult | null)?.message
        const said = typeof msg === 'string' ? msg.trim() : ''
        setOutcome({ kind: 'ok', text: said || okText })
        return res
      } catch (e) {
        if (e instanceof ParityError && e.notAvailable) {
          setOutcome({ kind: 'unavailable', text: 'Not available yet — this action is still being built.' })
        } else {
          setOutcome({
            kind: 'error',
            text: e instanceof ParityError ? e.message : "That didn't work. Try again.",
            detail: e instanceof ParityError ? e.raw : errorDetail(e),
          })
        }
        return undefined
      } finally {
        setBusy(null)
      }
    },
    [],
  )

  return { busy, outcome, run, clear: () => setOutcome({ kind: 'idle' }) }
}

/** The sentence under a row of buttons. Raw server text never appears here. */
export function OutcomeLine({ outcome }: { outcome: ActionOutcome }) {
  if (outcome.kind === 'idle') return null
  const tone =
    outcome.kind === 'ok'
      ? { background: 'var(--good-bg)', color: 'var(--good)' }
      : outcome.kind === 'unavailable'
        ? { background: 'var(--surface-warm)', color: 'var(--ink-3)' }
        : { background: 'var(--warn-bg)', color: 'var(--warn)' }
  return (
    <p role="status" className="mt-2 rounded-lg px-3 py-2 text-[12px] break-words" style={tone}>
      {outcome.text}
    </p>
  )
}
