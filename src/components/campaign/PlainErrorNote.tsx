'use client'

/**
 * <PlainErrorNote> — how the campaign and approvals pages show a failure: one plain sentence, with
 * the raw technical message (if any) tucked into a collapsed <Details> for support.
 *
 * Error state on these pages is a single string, so a failure caught from the API is stored with
 * `plainFailure(sentence, err)`: the plain sentence first, the raw message after a separator. A
 * message written by the page itself ("Enter a positive number") has no separator and renders as is.
 *
 *   } catch (err) { setError(plainFailure("We couldn't change the budget. Try again.", err)) }
 *   …
 *   {error && <PlainErrorNote error={error} />}
 */

import { AlertTriangle } from 'lucide-react'
import { Details } from '@/components/plain/Details'
import { errorDetail, PLAIN_ERROR } from '@/lib/plain-language'
import { cn } from '@/lib/utils'

const SEPARATOR = '\u0000'

/** A plain sentence to show, carrying the raw error message along for <Details>. */
export function plainFailure(sentence: string, err?: unknown): string {
  const raw = err === undefined ? '' : errorDetail(err)
  return raw && raw !== sentence ? `${sentence}${SEPARATOR}${raw}` : sentence
}

/** Split a stored error into the sentence to show and the technical detail to collapse. */
export function splitFailure(error: string): { message: string; detail: string } {
  const at = error.indexOf(SEPARATOR)
  if (at < 0) return { message: error || PLAIN_ERROR, detail: '' }
  return { message: error.slice(0, at) || PLAIN_ERROR, detail: error.slice(at + 1) }
}

export function PlainErrorNote({
  error,
  className,
  compact = false,
}: {
  error: string
  className?: string
  /** Smaller text and no icon, for inline cells. */
  compact?: boolean
}) {
  const { message, detail } = splitFailure(error)
  return (
    <div className={cn('min-w-0', compact ? 'text-[11px]' : 'text-xs', className)}>
      <p className="flex min-w-0 items-start gap-1.5 break-words" style={{ color: 'var(--bad)' }}>
        {!compact && <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />}
        <span className="min-w-0">{message}</span>
      </p>
      {detail && <Details className="mt-1.5" title="What went wrong" items={[{ label: 'Message', value: detail }]} />}
    </div>
  )
}
