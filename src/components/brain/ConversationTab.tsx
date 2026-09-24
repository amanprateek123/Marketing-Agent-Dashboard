'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BrainCircuit, CornerDownLeft, Loader2, RotateCcw, User } from 'lucide-react'
import { getBrainAgents, getBrainConversation, sendBrainMessage } from '@/lib/brain-api'
import { getBrainSessionId, resetBrainSessionId } from '@/lib/brain-session'
import type { BrainConversation, BrainConversationTurn } from '@/types/brain'
import { BrainError, SectionCard } from './shared'

/**
 * A conversation with the marketing head.
 *
 * Not a chat window, and the difference is not cosmetic. Every message here starts a real Foundry
 * run: the Brain reads the account, the accepted learnings, the policies and the company wiki
 * before it answers, which takes minutes rather than the second a chat UI implies. So the thread is
 * POLLED, not streamed — the turn appears immediately, the answer appears when the Brain commits
 * it, and the waiting state says plainly that a run is in progress rather than animating three dots
 * as though a reply were moments away.
 *
 * The Brain writes its own side of the conversation, in its own `commit_decisions` step, carrying
 * the run that produced it. Nothing in this component ever writes a brain turn — an answer
 * attributed to the Brain that the Brain did not produce is exactly the untraceable claim this
 * whole system is built to refuse.
 */
export function ConversationTab({ tenantId }: { tenantId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<BrainConversation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  // The send we are waiting on. `correlationId` is what Brain v2 (2.11.0+) stamps as the answering
  // turn's run id; `runId` is Foundry's own and is kept as the fallback for an older bridge/brain.
  const [awaiting, setAwaiting] = useState<{ runId: string; correlationId: string | null } | null>(
    null,
  )
  const awaitingRun = awaiting?.runId ?? null
  // null while unknown. The Brain being un-runnable is worth saying BEFORE someone writes a
  // paragraph and watches it fail: the message is recorded either way, but a person who typed it
  // has no way to tell a refusal from a bug.
  const [brainRunnable, setBrainRunnable] = useState<boolean | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void getBrainAgents(tenantId)
      .then((agents) => {
        const brain = agents.find((a) => a.key === 'brain')
        setBrainRunnable(brain ? brain.runnable !== false : null)
      })
      .catch(() => setBrainRunnable(null))
  }, [tenantId])

  useEffect(() => {
    setSessionId(getBrainSessionId(tenantId))
  }, [tenantId])

  const load = useCallback(
    async (id: string) => {
      try {
        const next = await getBrainConversation(tenantId, id)
        setConversation(next)
        setError(null)
        return next
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The conversation could not be read.')
        return null
      }
    },
    [tenantId],
  )

  useEffect(() => {
    if (sessionId) void load(sessionId)
  }, [sessionId, load])

  /**
   * Poll only while an answer is outstanding, and stop when it lands.
   *
   * Twelve seconds because a Brain run is minutes long — polling faster would spend requests to
   * learn the same thing. The poll ends when a brain turn answering THIS send appears, which is
   * the actual completion signal; a timer that simply gave up would leave the thread looking
   * answered when it is not.
   *
   * The answer is matched on the correlation id the bridge minted for this send, which the Brain
   * writes as that turn's run id. Foundry's run id is the fallback, for a bridge or Brain that
   * predates correlation ids.
   */
  useEffect(() => {
    if (!sessionId || !awaiting) return
    const timer = setInterval(() => {
      void load(sessionId).then((next) => {
        const answered = next?.turns.some(
          (turn) =>
            turn.role === 'brain' &&
            turn.runId !== null &&
            ((awaiting.correlationId !== null && turn.runId === awaiting.correlationId) ||
              turn.runId === awaiting.runId),
        )
        if (answered) setAwaiting(null)
      })
    }, 12_000)
    return () => clearInterval(timer)
  }, [sessionId, awaiting, load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conversation?.turns.length, awaitingRun])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || !sessionId || sending) return
    setSending(true)
    setError(null)
    try {
      const { runId, correlationId } = await sendBrainMessage(tenantId, sessionId, text)
      setDraft('')
      setAwaiting({ runId, correlationId: correlationId ?? null })
      await load(sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The message was not sent.')
    } finally {
      setSending(false)
    }
  }, [draft, sessionId, sending, tenantId, load])

  const startNewThread = useCallback(() => {
    const fresh = resetBrainSessionId(tenantId)
    setConversation(null)
    setAwaiting(null)
    setSessionId(fresh)
  }, [tenantId])

  if (error && !conversation) {
    return <BrainError message={error} onRetry={() => sessionId && void load(sessionId)} />
  }

  const turns = conversation?.turns ?? []

  return (
    <SectionCard
      title="Ask the marketing head"
      description="It reads the account, the accepted learnings and the company wiki before answering, so a reply takes minutes — not seconds. Follow-ups continue this thread."
      action={
        <button type="button" className="btn btn-ghost" onClick={startNewThread}>
          <RotateCcw size={14} aria-hidden="true" /> New thread
        </button>
      }
      padded={false}
    >
      <div className="flex flex-col">
        {brainRunnable === false && (
          <p
            className="mx-5 mt-4 rounded-xl px-4 py-3 text-sm"
            style={{
              background: 'var(--warn-bg)',
              border: '1px solid var(--warn-border)',
              color: 'var(--ink-2)',
            }}
          >
            <strong>The Brain is not granted to this Foundry run token yet.</strong> You can still
            write here and the turn is recorded, but no run will start to answer it until the token
            allows <code>agt_01a08a637be471038bba2efa34cb8c92</code>. Re-sending afterwards lands on
            the same turn rather than asking twice.
          </p>
        )}
        {conversation && conversation.omittedOlder > 0 && (
          <p className="explain px-5 pt-4">
            {conversation.omittedOlder} older turn{conversation.omittedOlder === 1 ? '' : 's'} not
            shown. The Brain reads a bounded window of this thread too — a history that looks
            complete when it is not is how an agent contradicts what it agreed to earlier.
          </p>
        )}

        <ol className="flex flex-col gap-4 p-5">
          {turns.length === 0 && !awaitingRun && (
            <li className="explain">
              Nothing asked yet. Try a question it can actually answer from evidence — “which
              product is carrying the portfolio this week, and what would you stop?” — rather than
              one that needs a number nobody has recorded.
            </li>
          )}
          {turns.map((turn) => (
            <li key={`${turn.turnIndex}-${turn.role}`}>
              <Turn turn={turn} />
            </li>
          ))}
          {awaitingRun && (
            <li>
              <div className="flex items-start gap-3">
                <Avatar role="brain" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Thinking
                  </p>
                  <p className="explain mt-1">
                    Run <code>{awaitingRun}</code> is reading the account and the learnings. The
                    answer lands in this thread when it commits — you can leave this tab.
                  </p>
                </div>
              </div>
            </li>
          )}
          <div ref={bottomRef} />
        </ol>

        {error && conversation && (
          <p className="px-5 pb-2 text-sm" style={{ color: 'var(--bad)' }}>
            {error}
          </p>
        )}

        <div className="px-5 pb-5">
          <label className="sr-only" htmlFor="brain-message">
            Message the Brain
          </label>
          <div
            className="flex items-end gap-2 rounded-xl p-2"
            style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}
          >
            <textarea
              id="brain-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends; Shift+Enter breaks the line. A question worth a multi-minute run is
                // usually one sentence, and reaching for a button for it gets old fast.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
              rows={2}
              placeholder="Should we cut automatic placements on nadi_report_premium?"
              className="min-h-[52px] flex-1 resize-y bg-transparent px-2 py-1.5 text-sm outline-none"
            />
            <button
              type="button"
              className="btn btn-primary shrink-0"
              onClick={() => void send()}
              disabled={sending || !draft.trim()}
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <CornerDownLeft size={14} aria-hidden="true" />
              )}
              {sending ? 'Sending…' : 'Ask'}
            </button>
          </div>
          <p className="explain mt-2">
            Every message starts a real run and is recorded as a turn the Brain reads next time.
          </p>
        </div>
      </div>
    </SectionCard>
  )
}

function Avatar({ role }: { role: 'user' | 'brain' }) {
  const isBrain = role === 'brain'
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
      style={{
        background: isBrain ? 'var(--accent-bg)' : 'var(--muted)',
        color: isBrain ? 'var(--accent-strong)' : 'var(--ink-3)',
      }}
    >
      {isBrain ? <BrainCircuit size={15} /> : <User size={15} />}
    </span>
  )
}

function Turn({ turn }: { turn: BrainConversationTurn }) {
  const isBrain = turn.role === 'brain'
  return (
    <div className="flex items-start gap-3">
      <Avatar role={turn.role} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{isBrain ? 'Brain' : 'You'}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm" style={{ color: 'var(--ink-2)' }}>
          {turn.content}
          {turn.contentClipped && (
            <span className="explain"> … (this turn is longer than what was returned)</span>
          )}
        </p>
        {isBrain && (turn.evidenceRefs.length > 0 || turn.runId) && (
          <p className="explain mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {turn.runId && <span>Run {turn.runId}</span>}
            {/* The refs are what makes an answer checkable rather than merely fluent. They are
                pointers into the brain's own rows — `policies:7`, `observations:54` — and showing
                them is the difference between a claim and a citation. */}
            {turn.evidenceRefs.map((ref) => (
              <code key={ref}>{ref}</code>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}
