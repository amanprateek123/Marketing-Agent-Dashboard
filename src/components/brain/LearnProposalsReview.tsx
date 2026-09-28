'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Lightbulb, Loader2, Pencil, X } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Details } from '@/components/plain/Details'
import { BrainLockedError } from '@/lib/brain-api'
import {
  decideLearnProposal,
  getLearnProposals,
  ParityError,
  type LearnProposal,
} from '@/lib/creative-parity-api'
import { errorDetail, formatWhen } from '@/lib/plain-language'
import { useBrainUnlocked } from '@/lib/use-brain-auth'
import { BrainSignIn } from './BrainSignIn'
import { BrainSkeleton, SectionCard } from './shared'

type Load =
  | { state: 'loading' }
  | { state: 'ready'; rows: LearnProposal[] }
  | { state: 'unavailable' }
  | { state: 'error'; detail: string }

type Verdict = { kind: 'ok' | 'bad'; text: string }

/**
 * Lessons the creative pipeline wants to remember, waiting for a person to say yes.
 *
 * This was the Slack /learnings flow. It decides what every later creative is written from, so it
 * sits behind the Brain login; the decision is recorded under that login on the server.
 */
function Review({ tenantId }: { tenantId: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [done, setDone] = useState<Set<string>>(new Set())
  const [gen, setGen] = useState(0)

  useEffect(() => {
    let live = true
    getLearnProposals(tenantId).then(
      rows => { if (live) setLoad({ state: 'ready', rows }) },
      e => {
        if (!live || e instanceof BrainLockedError) return
        if (e instanceof ParityError && e.notAvailable) setLoad({ state: 'unavailable' })
        else setLoad({ state: 'error', detail: e instanceof ParityError ? e.raw : errorDetail(e) })
      },
    )
    return () => { live = false }
  }, [tenantId, gen])

  const retry = useCallback(() => {
    setLoad({ state: 'loading' })
    setGen(g => g + 1)
  }, [])

  const decide = async (p: LearnProposal, decision: 'approve' | 'reject' | 'edit', text?: string) => {
    const key = String(p.id)
    setBusy(`${decision}:${key}`)
    try {
      const res = await decideLearnProposal(tenantId, p.id, decision, text)
      const said = typeof res?.message === 'string' && res.message.trim()
      setVerdicts(v => ({
        ...v,
        [key]: {
          kind: 'ok',
          text: said || (decision === 'reject' ? 'Turned down.' : decision === 'edit' ? 'Saved with your wording.' : 'Approved.'),
        },
      }))
      setDone(d => new Set(d).add(key))
      setEditing(null)
    } catch (e) {
      if (e instanceof BrainLockedError) return
      setVerdicts(v => ({
        ...v,
        [key]: {
          kind: 'bad',
          text: e instanceof ParityError && e.notAvailable
            ? 'Deciding here is not available yet.'
            : e instanceof ParityError ? e.message : "That didn't work. Try again.",
        },
      }))
    } finally {
      setBusy(null)
    }
  }

  const spin = (key: string, icon: React.ReactNode) =>
    busy === key ? <Loader2 size={13} className="animate-spin" /> : icon

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link href={`/dashboard/${tenantId}/brain`} className="mb-4 inline-flex items-center gap-1 text-[12.5px]"
        style={{ color: 'var(--ink-3)' }}>
        <ArrowLeft size={13} /> Back to the Brain
      </Link>
      <div className="mb-6 min-w-0">
        <p className="micro-label mb-2">Brain · Lessons to review</p>
        <h1 className="page-title">What the ad maker wants to remember</h1>
        <p className="page-subtitle">
          Each one changes how every later ad is written. Approve the ones that are true, fix the wording, or turn them down.
        </p>
      </div>

      {load.state === 'loading' && <BrainSkeleton rows={3} />}
      {load.state === 'unavailable' && (
        <EmptyState icon={Lightbulb} title="Not available yet"
          subtitle="Reviewing lessons here is still being built. Nothing is lost — they are waiting." />
      )}
      {load.state === 'error' && (
        <SectionCard>
          <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>We couldn&rsquo;t load the lessons. Try again.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={retry}>Try again</button>
          </div>
          <Details className="mt-3" items={[{ label: 'What the server said', value: load.detail || 'No reply' }]} />
        </SectionCard>
      )}
      {load.state === 'ready' && load.rows.length === 0 && (
        <EmptyState icon={Lightbulb} title="Nothing to review" subtitle="When the ad maker proposes a new lesson it will appear here." />
      )}
      {load.state === 'ready' && load.rows.length > 0 && (
        <ul className="grid gap-3">
          {load.rows.map(p => {
            const key = String(p.id)
            const verdict = verdicts[key]
            const decided = done.has(key)
            return (
              <li key={key} className="card p-5 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {p.product && <span className="chip">{p.product}</span>}
                  {p.created_at && (
                    <span className="text-[11.5px]" style={{ color: 'var(--ink-4)' }}>Proposed {formatWhen(p.created_at)}</span>
                  )}
                </div>
                {editing === key ? (
                  <textarea className="input" rows={3} value={draft} onChange={e => setDraft(e.target.value)}
                    aria-label="Corrected lesson" />
                ) : (
                  <p className="text-[14px] leading-relaxed break-words" style={{ color: 'var(--ink)' }}>{p.text}</p>
                )}
                {p.reason && (
                  <p className="mt-1.5 text-[12.5px] break-words" style={{ color: 'var(--ink-3)' }}>Why: {p.reason}</p>
                )}
                {p.evidence && (
                  <p className="mt-1 text-[12px] break-words" style={{ color: 'var(--ink-4)' }}>Based on: {p.evidence}</p>
                )}

                {!decided && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {editing === key ? (
                      <>
                        <button type="button" className="btn btn-primary" disabled={busy !== null || !draft.trim()}
                          onClick={() => void decide(p, 'edit', draft.trim())}>
                          {spin(`edit:${key}`, <Check size={13} />)} Save and approve
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn-primary" disabled={busy !== null}
                          onClick={() => void decide(p, 'approve')}>
                          {spin(`approve:${key}`, <Check size={13} />)} Approve
                        </button>
                        <button type="button" className="btn btn-ghost" disabled={busy !== null}
                          onClick={() => { setEditing(key); setDraft(p.text) }}>
                          <Pencil size={13} /> Fix the wording
                        </button>
                        <button type="button" className="btn btn-danger" disabled={busy !== null}
                          onClick={() => void decide(p, 'reject')}>
                          {spin(`reject:${key}`, <X size={13} />)} Turn down
                        </button>
                      </>
                    )}
                  </div>
                )}
                {verdict && (
                  <p role="status" className="mt-2 rounded-lg px-3 py-2 text-[12px]"
                    style={verdict.kind === 'ok'
                      ? { background: 'var(--good-bg)', color: 'var(--good)' }
                      : { background: 'var(--warn-bg)', color: 'var(--warn)' }}>
                    {verdict.text}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

/** Brain login only: without it, the Brain sign-in card — same as the console. */
export function LearnProposalsReview({ tenantId }: { tenantId: string }) {
  const unlocked = useBrainUnlocked()
  if (unlocked === null) {
    return (
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <BrainSkeleton rows={2} />
      </main>
    )
  }
  if (!unlocked) return <BrainSignIn />
  return <Review tenantId={tenantId} />
}
