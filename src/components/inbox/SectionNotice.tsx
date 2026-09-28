import { Clock, TriangleAlert } from 'lucide-react'
import type { BrainSectionState } from '@/types/brain'
import { PLAIN_ERROR } from '@/lib/plain-language'

/**
 * What a section says when it could not be read — never "nothing here" for "not read".
 *
 * `not_available_yet`: the Brain has not been updated for this yet. `could_not_load`: it did not
 * answer. `ok` renders nothing.
 */
export function SectionNotice({
  state,
  what,
  onRetry,
}: {
  state: BrainSectionState
  /** A plural noun phrase — "Reports", "Alerts" — used in the sentence. */
  what: string
  onRetry?: () => void
}) {
  if (state === 'ok') return null
  const notYet = state === 'not_available_yet'
  return (
    <div
      role="status"
      className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl px-4 py-3 text-sm"
      style={{
        background: notYet ? 'var(--surface-warm)' : 'var(--bad-bg)',
        border: `1px dashed ${notYet ? 'var(--hairline-strong)' : 'var(--bad-border)'}`,
        color: 'var(--ink-2)',
      }}
    >
      {notYet ? (
        <Clock size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ink-3)' }} aria-hidden="true" />
      ) : (
        <TriangleAlert size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--bad)' }} aria-hidden="true" />
      )}
      <p className="min-w-0 flex-1 break-words">
        {notYet
          ? `${what} aren't available yet. They will show here once the Brain has been updated.`
          : PLAIN_ERROR}
      </p>
      {!notYet && onRetry && (
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
