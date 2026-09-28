'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BellRing, CheckCircle2, RefreshCw } from 'lucide-react'
import { BrainOnly } from '@/components/inbox/BrainOnly'
import { SectionNotice } from '@/components/inbox/SectionNotice'
import { notifyInboxChanged, inboxSentence } from '@/components/inbox/InboxBell'
import {
  AlertCard,
  AskBrainBox,
  GateRow,
  QuestionItem,
  ReportRow,
  WaitingRunCard,
} from '@/components/inbox/InboxParts'
import { BrainError, BrainSkeleton, SectionCard } from '@/components/brain/shared'
import { EmptyState } from '@/components/ui/EmptyState'
import { getInbox } from '@/lib/brain-api'
import { errorDetail, formatRelative } from '@/lib/plain-language'
import type { BrainInbox } from '@/types/brain'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

/** After this long a load says so, rather than spinning forever. */
const SLOW_MS = 15_000

/**
 * Waiting on you — everything that used to arrive in Slack and needs a person: approvals, creative
 * runs waiting on an answer, alerts, questions for the Brain, and reports not read yet.
 */
export default function WaitingPage({ params }: PageProps) {
  const { tenantId } = use(params)
  return (
    <BrainOnly>
      <WaitingOnYou tenantId={tenantId} />
    </BrainOnly>
  )
}

function WaitingOnYou({ tenantId }: { tenantId: string }) {
  const [inbox, setInbox] = useState<BrainInbox | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setSlow(false)
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS)
    try {
      const next = await getInbox(tenantId)
      setInbox(next)
      setError(null)
      setLoadedAt(new Date())
    } catch (err) {
      setError(errorDetail(err))
    } finally {
      window.clearTimeout(timer)
      setLoading(false)
      setSlow(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  /** Something here changed: re-read, and tell the bell. */
  const changed = useCallback(() => {
    notifyInboxChanged()
    void load()
  }, [load])

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">Waiting on you</h1>
          <p className="page-subtitle">
            Approvals, questions and alerts that need a person.
            {loadedAt ? ` Updated ${formatRelative(loadedAt)}.` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-ghost shrink-0 self-start" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {!inbox && loading && (
          <>
            <BrainSkeleton rows={3} />
            {slow && (
              <p className="explain" role="status">
                This is taking longer than usual. It will appear as soon as the Brain answers.
              </p>
            )}
          </>
        )}
        {!inbox && !loading && error !== null && <BrainError message={error} onRetry={() => void load()} />}
        {inbox && <InboxBody inbox={inbox} tenantId={tenantId} onChanged={changed} onRetry={() => void load()} />}
      </div>
    </main>
  )
}

function InboxBody({
  inbox,
  tenantId,
  onChanged,
  onRetry,
}: {
  inbox: BrainInbox
  tenantId: string
  onChanged: () => void
  onRetry: () => void
}) {
  const { availability: a } = inbox
  const openAlerts = inbox.alerts.filter((x) => !x.acknowledged)
  const openQuestions = inbox.questions.filter((q) => q.open)
  const answered = inbox.questions.filter((q) => !q.open).slice(0, 5)
  const allClear =
    inbox.gates.length === 0 && inbox.waiting.length === 0 && openAlerts.length === 0 && openQuestions.length === 0

  return (
    <>
      <p className="explain" role="status">
        {inboxSentence(inbox.counts)}.
      </p>

      {allClear && Object.values(a).every((s) => s === 'ok') && (
        <div className="card">
          <EmptyState
            icon={CheckCircle2}
            title="You're all caught up"
            subtitle="Nothing needs you right now. New approvals, questions and alerts will show up here."
          />
        </div>
      )}

      <SectionCard
        title="Approvals"
        description="Plans, launches and budget changes waiting for your go-ahead."
      >
        <SectionNotice state={a.gates} what="Approvals" onRetry={onRetry} />
        {a.gates === 'ok' && inbox.gates.length === 0 && <p className="explain">No approvals waiting.</p>}
        {inbox.gates.length > 0 && (
          <ul className="flex flex-col gap-3">
            {inbox.gates.map((g) => (
              <GateRow key={g.ref} gate={g} tenantId={tenantId} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="The ad maker needs an answer"
        description="Ads that stopped part-way because something wasn't clear. Answer and they carry on."
      >
        <SectionNotice state={a.waiting} what="Questions from the ad maker" onRetry={onRetry} />
        {a.waiting === 'ok' && inbox.waiting.length === 0 && <p className="explain">No ads are waiting on you.</p>}
        {inbox.waiting.length > 0 && (
          <ul className="flex flex-col gap-3">
            {inbox.waiting.map((w) => (
              <WaitingRunCard key={w.runRef} run={w} tenantId={tenantId} onAnswered={onChanged} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Alerts" description="Things that went wrong or need a look. Mark them as seen once handled.">
        <SectionNotice state={a.alerts} what="Alerts" onRetry={onRetry} />
        {a.alerts === 'ok' && openAlerts.length === 0 && <p className="explain">No open alerts.</p>}
        {openAlerts.length > 0 && (
          <ul className="flex flex-col gap-3">
            {openAlerts.map((al) => (
              <AlertCard key={al.ref} alert={al} tenantId={tenantId} onAcknowledged={onChanged} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Questions for the Brain"
        description="Ask the Brain anything about your ads. Questions it raises itself show here too."
      >
        <SectionNotice state={a.questions} what="Questions" onRetry={onRetry} />
        {a.questions === 'ok' && <AskBrainBox tenantId={tenantId} onAsked={onChanged} />}
        {openQuestions.length + answered.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {[...openQuestions, ...answered].map((q) => (
              <QuestionItem key={q.ref} question={q} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="New reports"
        description="Reports you haven't opened yet."
        action={
          <Link href={`/dashboard/${tenantId}/reports`} className="btn btn-ghost">
            All reports
          </Link>
        }
      >
        <SectionNotice state={a.reports} what="Reports" onRetry={onRetry} />
        {a.reports === 'ok' && inbox.reports.length === 0 && <p className="explain">You&apos;ve read every report.</p>}
        {inbox.reports.length > 0 && (
          <ul className="flex flex-col gap-3">
            {inbox.reports.map((r) => (
              <ReportRow key={r.ref} report={r} href={`/dashboard/${tenantId}/reports?open=${encodeURIComponent(r.ref)}`} />
            ))}
          </ul>
        )}
      </SectionCard>

      {!inbox.counts.known && (
        <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink-3)' }}>
          <BellRing size={13} aria-hidden="true" />
          Counts are worked out from the lists above until the Brain is updated.
        </p>
      )}
    </>
  )
}
