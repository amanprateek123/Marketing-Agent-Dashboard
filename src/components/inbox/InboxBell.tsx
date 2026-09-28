'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import type { BrainInboxCounts } from '@/types/brain'

/** Fired by a page after it changes something the counts reflect, so the bell refreshes now. */
export const INBOX_CHANGED = 'inbox:changed'

export function notifyInboxChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INBOX_CHANGED))
}

/** "2 approvals, 1 alert" — the bell's accessible name and tooltip. */
export function inboxSentence(counts: BrainInboxCounts | null): string {
  if (!counts || counts.total === 0) return 'Nothing is waiting on you'
  const parts: string[] = []
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`)
  }
  add(counts.gates, 'approval', 'approvals')
  add(counts.waiting, 'creative question', 'creative questions')
  add(counts.alerts, 'alert', 'alerts')
  add(counts.questions, 'open question', 'open questions')
  add(counts.reports, 'unread report', 'unread reports')
  return `Waiting on you: ${parts.join(', ')}`
}

/**
 * The header bell: how much is waiting on you, linking to the Waiting on you page. The counts are
 * polled by the Sidebar (every 60s) and passed in; a locked Brain shows a plain bell with no count.
 */
export function InboxBell({
  tenantId,
  counts,
  onNavigate,
}: {
  tenantId: string
  counts: BrainInboxCounts | null
  onNavigate?: () => void
}) {
  const total = counts?.total ?? 0
  const label = inboxSentence(counts)
  return (
    <Link
      href={`/dashboard/${tenantId}/waiting`}
      onClick={onNavigate}
      aria-label={label}
      title={label}
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
      // Drawn on the dark navigation surface (sidebar header, mobile header).
      style={{
        border: '1px solid rgba(255, 255, 255, 0.16)',
        background: 'rgba(255, 255, 255, 0.06)',
        color: 'var(--nav-text)',
      }}
    >
      <Bell size={17} aria-hidden="true" />
      {total > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-[18px]"
          style={{ background: 'var(--bad)', color: '#fff' }}
        >
          {total > 99 ? '99+' : total}
        </span>
      )}
    </Link>
  )
}
