'use client'

import { useEffect, useState } from 'react'
import { Check, ExternalLink, ImageOff, Lightbulb, Loader2, X } from 'lucide-react'
import { SectionNotice } from '@/components/inbox/SectionNotice'
import { writeError } from '@/components/inbox/InboxParts'
import { BrainSkeleton } from '@/components/brain/shared'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  decideCompetitorCandidate,
  getCompetitorCandidates,
  getCompetitorFindings,
} from '@/lib/brain-api'
import { formatWhen } from '@/lib/plain-language'
import type {
  BrainCompetitorCandidate,
  BrainCompetitorFinding,
  BrainSectionState,
} from '@/types/brain'

// ── What competitors are running ─────────────────────────────────────────────

/** Re-mount (change `key`) to re-read. */
export function CompetitorFindings({ tenantId }: { tenantId: string }) {
  const [findings, setFindings] = useState<BrainCompetitorFinding[]>([])
  const [state, setState] = useState<BrainSectionState | null>(null)

  const [attempt, setAttempt] = useState(0)
  const load = () => setAttempt((n) => n + 1)

  useEffect(() => {
    let cancelled = false
    getCompetitorFindings(tenantId)
      .then((out) => {
        if (cancelled) return
        setFindings(out.findings)
        setState(out.state)
      })
      .catch(() => {
        if (!cancelled) setState('could_not_load')
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, attempt])

  if (state === null) return <BrainSkeleton rows={2} />
  if (state !== 'ok') return <SectionNotice state={state} what="Competitor findings" onRetry={load} />
  if (findings.length === 0) {
    return (
      <EmptyState
        icon={ImageOff}
        title="Nothing seen yet"
        subtitle="Once competitor research runs, the ads and pages it found in the last 30 days show here."
      />
    )
  }
  return (
    <ul className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {findings.map((f) => (
        <FindingCard key={f.ref} finding={f} />
      ))}
    </ul>
  )
}

function FindingCard({ finding: f }: { finding: BrainCompetitorFinding }) {
  const [broken, setBroken] = useState(false)
  const facts: Array<[string, string | null]> = [
    ['Opening hook', f.hook],
    ['Message angle', f.angle],
    ['Offer', f.offer],
    ['Button', f.cta],
  ]
  return (
    <li className="card flex min-w-0 flex-col overflow-hidden">
      {f.imageUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- third-party ad images; no loader configured for them
        <img
          src={f.imageUrl}
          alt={f.headline ? `${f.competitor} ad: ${f.headline}` : `${f.competitor} ad`}
          className="aspect-square w-full max-w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex aspect-[3/1] w-full items-center justify-center" style={{ background: 'var(--surface-warm)', color: 'var(--ink-4)' }}>
          <ImageOff size={20} aria-hidden="true" />
          <span className="sr-only">No picture</span>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="chip chip-neutral max-w-full truncate" title={f.competitor}>
            {f.competitor}
          </span>
          <span className="chip chip-info">{f.kindLabel}</span>
          {f.longRunning && (
            <span className="chip chip-good" title="Ads that run this long are usually working for them.">
              Running a long time
            </span>
          )}
        </div>
        {f.headline && (
          <p className="mt-2 break-words font-semibold" style={{ color: 'var(--ink)' }}>
            {f.headline}
          </p>
        )}
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          {facts
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="inline text-xs font-semibold" style={{ color: 'var(--ink-3)' }}>
                  {label}:{' '}
                </dt>
                <dd className="inline break-words" style={{ color: 'var(--ink-2)' }}>
                  {value}
                </dd>
              </div>
            ))}
        </dl>
        <p className="mt-auto pt-3 text-xs" style={{ color: 'var(--ink-3)' }}>
          {f.firstSeen ? `First seen ${formatWhen(f.firstSeen)}` : ''}
          {f.firstSeen && f.lastSeen ? ' · ' : ''}
          {f.lastSeen ? `last seen ${formatWhen(f.lastSeen)}` : ''}
        </p>
        {f.link && (
          <a href={f.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-3 self-start">
            See it
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </li>
  )
}

// ── Ideas from competitors, to review ───────────────────────────────────────

/** Re-mount (change `key`) to re-read. */
export function CompetitorCandidates({ tenantId }: { tenantId: string }) {
  const [candidates, setCandidates] = useState<BrainCompetitorCandidate[]>([])
  const [state, setState] = useState<BrainSectionState | null>(null)

  const [attempt, setAttempt] = useState(0)
  const load = () => setAttempt((n) => n + 1)

  useEffect(() => {
    let cancelled = false
    getCompetitorCandidates(tenantId)
      .then((out) => {
        if (cancelled) return
        setCandidates(out.candidates)
        setState(out.state)
      })
      .catch(() => {
        if (!cancelled) setState('could_not_load')
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, attempt])

  if (state === null) return <BrainSkeleton rows={1} />
  if (state !== 'ok') return <SectionNotice state={state} what="Ideas from competitors" onRetry={load} />
  if (candidates.length === 0) {
    return <p className="explain">No ideas waiting for review.</p>
  }
  return (
    <ul className="flex flex-col gap-3">
      {candidates.map((c) => (
        <CandidateCard
          key={c.ref}
          candidate={c}
          tenantId={tenantId}
          onDecided={() => setCandidates((prev) => prev.filter((x) => x.ref !== c.ref))}
        />
      ))}
    </ul>
  )
}

function CandidateCard({
  candidate: c,
  tenantId,
  onDecided,
}: {
  candidate: BrainCompetitorCandidate
  tenantId: string
  onDecided: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: 'accept' | 'reject') {
    if (!reason.trim()) {
      setError(decision === 'accept' ? 'Say why this idea is worth keeping.' : 'Say why you are turning it down.')
      return
    }
    setBusy(decision)
    setError(null)
    try {
      await decideCompetitorCandidate(tenantId, c.ref, decision, reason.trim())
      onDecided()
    } catch (err) {
      setError(writeError(err, "We couldn't save your decision. Try again."))
      setBusy(null)
    }
  }

  return (
    <li className="card-inset min-w-0 rounded-xl p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="chip chip-accent">
          <Lightbulb size={12} aria-hidden="true" />
          Idea from a competitor
        </span>
        {c.product && <span className="chip chip-neutral max-w-full truncate">{c.product}</span>}
        {c.competitor && <span className="chip chip-neutral max-w-full truncate">Seen at {c.competitor}</span>}
      </div>
      <p className="mt-2 break-words font-semibold" style={{ color: 'var(--ink)' }}>
        {c.claim}
      </p>
      {c.evidence && <p className="explain mt-1 break-words">{c.evidence}</p>}
      {c.proposedAt && (
        <p className="mt-1 text-xs" style={{ color: 'var(--ink-3)' }}>
          Suggested {formatWhen(c.proposedAt)}
        </p>
      )}
      <label className="mt-3 block text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
        Why? (saved with your decision)
        <textarea
          className="input mt-1 min-h-[60px] w-full"
          value={reason}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Fits our audience — worth testing on Saathi."
          disabled={busy !== null}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => void decide('accept')} disabled={busy !== null}>
          {busy === 'accept' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
          Keep this idea
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void decide('reject')} disabled={busy !== null}>
          {busy === 'reject' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
          Turn down
        </button>
        {error && (
          <p role="alert" className="text-xs" style={{ color: 'var(--bad)' }}>
            {error}
          </p>
        )}
      </div>
    </li>
  )
}
