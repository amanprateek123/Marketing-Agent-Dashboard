'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Loader2, Send } from 'lucide-react'
import { Details } from '@/components/plain/Details'
import { acknowledgeAlert, askBrainQuestion, isNotAvailableYet, refusalMessage } from '@/lib/brain-api'
import { clarifyCustomBriefRun } from '@/lib/api'
import { errorDetail, formatRelative, formatWhen } from '@/lib/plain-language'
import { cn } from '@/lib/utils'
import type {
  BrainAlertSeverity,
  BrainInboxAlert,
  BrainInboxGate,
  BrainInboxQuestion,
  BrainReport,
  BrainWaitingRun,
} from '@/types/brain'

const NOT_YET = "This isn't available yet. It will work once the Brain has been updated."

/** A failed write, in words: the server's own sentence when it gave one, else a generic one. */
export function writeError(err: unknown, fallback: string): string {
  if (isNotAvailableYet(err)) return NOT_YET
  return refusalMessage(err) ?? fallback
}

const SEVERITY_CHIP: Record<BrainAlertSeverity, string> = {
  critical: 'chip chip-bad',
  warn: 'chip chip-warn',
  info: 'chip chip-info',
}

const VERDICT_CHIP: Record<BrainReport['verdictTone'], string> = {
  good: 'chip chip-good',
  watch: 'chip chip-warn',
  bad: 'chip chip-bad',
  neutral: 'chip chip-neutral',
}

export function verdictChip(tone: BrainReport['verdictTone']): string {
  return VERDICT_CHIP[tone]
}

/** Muted one-line meta ("Creative pipeline · Today, 3:10 pm"). */
function Meta({ parts }: { parts: Array<string | null | undefined> }) {
  const shown = parts.filter((p): p is string => Boolean(p && p !== '—'))
  if (!shown.length) return null
  return (
    <p className="mt-1 break-words text-xs" style={{ color: 'var(--ink-3)' }}>
      {shown.join(' · ')}
    </p>
  )
}

// ── Approvals ────────────────────────────────────────────────────────────────

export function GateRow({ gate, tenantId }: { gate: BrainInboxGate; tenantId: string }) {
  return (
    <li className="card-inset flex min-w-0 flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="chip chip-accent">{gate.kindLabel}</span>
          {gate.product && (
            <span className="chip chip-neutral max-w-full truncate" title={gate.product}>
              {gate.product}
            </span>
          )}
        </div>
        <p className="mt-2 break-words font-semibold" style={{ color: 'var(--ink)' }}>
          {gate.title}
        </p>
        {gate.summary && (
          <p className="explain mt-1 line-clamp-2 break-words">{gate.summary}</p>
        )}
        <Meta
          parts={[
            gate.askedAt ? `Asked ${formatRelative(gate.askedAt)}` : null,
            gate.expiresAt ? `Closes ${formatRelative(gate.expiresAt)}` : null,
          ]}
        />
      </div>
      <Link
        href={`/dashboard/${tenantId}/brain?tab=approvals`}
        className="btn btn-primary shrink-0 self-start sm:self-center"
      >
        Review
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </li>
  )
}

// ── Creative runs waiting on an answer ──────────────────────────────────────

export function WaitingRunCard({
  run,
  tenantId,
  onAnswered,
}: {
  run: BrainWaitingRun
  tenantId: string
  onAnswered: () => void
}) {
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ text: string; detail: string } | null>(null)

  async function send() {
    const text = answer.trim()
    if (!text) return
    setBusy(true)
    setError(null)
    try {
      await clarifyCustomBriefRun(tenantId, run.runRef, text)
      onAnswered()
    } catch (err) {
      setError({ text: "We couldn't send your answer. Try again.", detail: errorDetail(err) })
      setBusy(false)
    }
  }

  return (
    <li className="card-inset min-w-0 rounded-xl p-4">
      {run.product && <span className="chip chip-neutral max-w-full truncate">{run.product}</span>}
      <p className="mt-2 whitespace-pre-line break-words font-semibold" style={{ color: 'var(--ink)' }}>
        {run.question}
      </p>
      <Meta parts={[run.since ? `Waiting since ${formatWhen(run.since)}` : null]} />
      <label className="mt-3 block text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
        Your answer
        <textarea
          className="input mt-1 min-h-[72px] w-full"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type what the ad maker should do…"
          disabled={busy}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => void send()} disabled={busy || !answer.trim()}>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
          Send answer
        </button>
        {error && (
          <p role="alert" className="text-xs" style={{ color: 'var(--bad)' }}>
            {error.text}
          </p>
        )}
      </div>
      {error?.detail && <Details className="mt-2" items={[{ label: 'What went wrong', value: error.detail }]} />}
      <Details className="mt-2" reference={run.runRef} />
    </li>
  )
}

// ── Alerts ───────────────────────────────────────────────────────────────────

export function AlertCard({
  alert,
  tenantId,
  onAcknowledged,
}: {
  alert: BrainInboxAlert
  tenantId: string
  onAcknowledged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ack() {
    setBusy(true)
    setError(null)
    try {
      await acknowledgeAlert(tenantId, alert.ref)
      onAcknowledged()
    } catch (err) {
      setError(writeError(err, "We couldn't mark this as seen. Try again."))
      setBusy(false)
    }
  }

  return (
    <li className="card-inset flex min-w-0 flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <span className={SEVERITY_CHIP[alert.severity]}>{alert.severityLabel}</span>
        <p className="mt-2 break-words font-semibold" style={{ color: 'var(--ink)' }}>
          {alert.title}
        </p>
        {alert.body && (
          <p className="explain mt-1 whitespace-pre-line break-words">{alert.body}</p>
        )}
        <Meta parts={[alert.sourceLabel, alert.raisedAt ? formatWhen(alert.raisedAt) : null]} />
        {error && (
          <p role="alert" className="mt-2 text-xs" style={{ color: 'var(--bad)' }}>
            {error}
          </p>
        )}
      </div>
      {!alert.acknowledged && (
        <button type="button" className="btn btn-ghost shrink-0 self-start" onClick={() => void ack()} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
          Mark as seen
        </button>
      )}
    </li>
  )
}

// ── Questions for the Brain ─────────────────────────────────────────────────

export function QuestionItem({ question }: { question: BrainInboxQuestion }) {
  return (
    <li className="card-inset min-w-0 rounded-xl p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className={cn('chip', question.open ? 'chip-warn' : 'chip-good')}>{question.statusLabel}</span>
        {question.kindLabel && <span className="chip chip-neutral">{question.kindLabel}</span>}
      </div>
      <p className="mt-2 whitespace-pre-line break-words font-semibold" style={{ color: 'var(--ink)' }}>
        {question.question}
      </p>
      <Meta parts={[`Asked by ${question.askedBy}`, question.askedAt ? formatWhen(question.askedAt) : null]} />
      {question.answer && (
        <div className="mt-3 rounded-lg px-3 py-2" style={{ background: 'var(--surface-warm)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--ink-3)' }}>
            Answer{question.answeredAt ? ` · ${formatWhen(question.answeredAt)}` : ''}
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-sm" style={{ color: 'var(--ink-2)' }}>
            {question.answer}
          </p>
        </div>
      )}
    </li>
  )
}

export function AskBrainBox({ tenantId, onAsked }: { tenantId: string; onAsked: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  async function ask() {
    const t = text.trim()
    if (!t) return
    setBusy(true)
    setNote(null)
    try {
      await askBrainQuestion(tenantId, t)
      setText('')
      setNote({ ok: true, text: 'Sent. The Brain will answer here, usually within a few minutes.' })
      onAsked()
    } catch (err) {
      setNote({ ok: false, text: writeError(err, "We couldn't send your question. Try again.") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-w-0">
      <label className="block text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
        Ask the Brain something
        <textarea
          className="input mt-1 min-h-[72px] w-full"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Why did spend drop yesterday?"
          maxLength={2000}
          disabled={busy}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => void ask()} disabled={busy || !text.trim()}>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
          Ask
        </button>
        {note && (
          <p role={note.ok ? 'status' : 'alert'} className="text-xs" style={{ color: note.ok ? 'var(--good)' : 'var(--bad)' }}>
            {note.text}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Reports (short row) ──────────────────────────────────────────────────────

export function ReportRow({ report, href }: { report: BrainReport; href: string }) {
  return (
    <li>
      <Link href={href} className="card-inset card-hover flex min-w-0 flex-col gap-1 rounded-xl p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="chip chip-neutral">{report.kindLabel}</span>
          {report.verdictLabel && <span className={verdictChip(report.verdictTone)}>{report.verdictLabel}</span>}
          {report.needsAttention && <span className="chip chip-bad">Needs your attention</span>}
        </div>
        <p className="mt-1 break-words font-semibold" style={{ color: 'var(--ink)' }}>
          {report.headline}
        </p>
        <Meta parts={[report.reportDate ? formatWhen(report.reportDate) : null]} />
      </Link>
    </li>
  )
}
