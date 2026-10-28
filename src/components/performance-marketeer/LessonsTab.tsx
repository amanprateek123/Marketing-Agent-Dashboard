'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import {
  PM_PRODUCTS,
  approvePmLessonProposal,
  createPmOwnerRule,
  deletePmOwnerRule,
  editPmLesson,
  getPmLessonProposals,
  getPmLessonScorecard,
  getPmLessons,
  getPmOwnerRules,
  productLabel,
  rejectPmLessonProposal,
  retirePmLesson,
  updatePmOwnerRule,
  type PmOwnerRuleInput,
} from '@/lib/performance-marketeer-api'
import type { PmLesson, PmLessonCase, PmLessonProposal, PmLessonScope, PmLessonScorecard, PmLessonStatus, PmLessonType, PmOwnerRule, PmOwnerRuleCheck } from '@/types/performance-marketeer'
import { Empty, LoadError, PmSkeleton, SectionCard, TableWrap, fmt, useLoad } from './shared'
import type { PmView } from './PerformanceMarketeer'

const NO_LESSONS = 'No lessons yet — lessons appear after outcomes are graded (day 3 and day 7 after changes) and the weekly curator runs.'
const NOTE_MAX = 1000
const RULE_MAX = 300

const TYPE: Record<PmLessonType, string> = {
  action_effect: 'Action effect',
  diagnosis_pattern: 'Diagnosis pattern',
  creative_pattern: 'Creative pattern',
  season_effect: 'Season / market',
  segment_fact: 'Segment fact',
  analyst_habit: 'Analyst habit',
}
const STATUS: Record<PmLessonStatus, { label: string; chip: string; help: string }> = {
  active: { label: 'Active', chip: 'chip-good', help: '≥ 3 clean supporting cases from ≥ 2 campaigns, and you approved it. The daily phases use it.' },
  candidate: { label: 'Candidate', chip: 'chip-info', help: 'Proposed by the curator with ≥ 1 clean case. Never used until it is promoted. Expires after 60 days.' },
  review: { label: 'Under review', chip: 'chip-warn', help: '2 contradictions in a row, or support under 60% over the last 8 graded uses.' },
  retired: { label: 'Retired', chip: 'chip-neutral', help: 'No longer used.' },
}
const OP: Record<PmLessonProposal['op'], { label: string; chip: string; help: string }> = {
  ADD: { label: 'Add', chip: 'chip-info', help: 'A new candidate lesson.' },
  PROMOTE: { label: 'Promote', chip: 'chip-good', help: 'A candidate becomes active — the daily phases start using it.' },
  EDIT: { label: 'Edit', chip: 'chip-info', help: 'Change the wording or scope of a lesson.' },
  ATTACH: { label: 'Add cases', chip: 'chip-neutral', help: 'New cases attached to an existing lesson.' },
  MERGE: { label: 'Merge', chip: 'chip-warn', help: 'Combine near-duplicate lessons into one.' },
  RETIRE: { label: 'Retire', chip: 'chip-bad', help: 'Stop using this lesson.' },
}
const CHECK_KIND: Record<PmOwnerRuleCheck['kind'], string> = {
  no_pause_before_days: 'No pause before day N',
  max_budget_step: 'Max budget step',
  no_budget_increase_in_season: 'No budget increase in a season',
  no_action_type: 'Never this action type',
}
const ACTION_TYPES = ['creative', 'budget', 'geo', 'audience', 'placement', 'landing_funnel', 'tracking', 'festival_prep', 'pause', 'hold'] as const
const SCOPE_KEYS =
  'product, structure, objective, audience, spendBand, learning, daysSinceLaunch, daysSinceLastEdit, roas7d, cpa7d, ctr7d, cpm7d, freqDay, accountCpmTrend, season, festivalInDays, symptoms, level, entityId, phase, category'

const LINK = 'rounded text-left font-semibold text-[var(--accent-strong)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--accent)]'
const LABEL = 'flex flex-col gap-1 text-[13px] font-semibold'
const CARD_ITEM = { background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const hitRate = (l: Pick<PmLesson, 'uses' | 'hits'>) => (l.uses ? fmt.pct(l.hits / l.uses, 0) : '—')
const lastCase = (cases: PmLessonCase[] = []) => cases.reduce<string | null>((m, c) => (!m || c.at > m ? c.at : m), null)

/** apiFetch errors are "<status> <body>"; Nest bodies are JSON with a message. */
function errText(err: unknown): string {
  const s = err instanceof Error ? err.message : String(err)
  const m = /^\d{3} (\{[\s\S]*\})$/.exec(s)
  if (m) {
    try {
      const msg = (JSON.parse(m[1]) as { message?: string | string[] }).message
      if (msg) return Array.isArray(msg) ? msg.join('; ') : msg
    } catch {
      /* fall through */
    }
  }
  return s.slice(0, 160)
}

/** Runs one mutation at a time and keeps its error/status message for an aria-live region. */
function useAction() {
  const [state, setState] = useState<{ busy: boolean; error: string }>({ busy: false, error: '' })
  async function run(fn: () => Promise<unknown>, onDone: () => void) {
    setState({ busy: true, error: '' })
    try {
      await fn()
      setState({ busy: false, error: '' })
      onDone()
    } catch (err) {
      setState({ busy: false, error: `Couldn’t save — ${errText(err)}. Fix it and try again.` })
    }
  }
  return { ...state, run, clear: () => setState({ busy: false, error: '' }) }
}

function Msg({ error }: { error: string }) {
  return (
    <span aria-live="polite" className="text-[13px]" style={{ color: 'var(--bad)' }}>
      {error}
    </span>
  )
}

function ScopeChips({ scope }: { scope?: PmLessonScope }) {
  const entries = Object.entries(scope ?? {})
  if (!entries.length) return <span className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Any situation</span>
  return (
    <span className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className="chip chip-neutral max-w-full !whitespace-normal break-all !font-medium" translate="no">
          {k}: {k === 'product' ? v.split('|').map(productLabel).join(' | ') : v}
        </span>
      ))}
    </span>
  )
}

function ConfChip({ c }: { c: number | undefined }) {
  if (c == null) return <span style={{ color: 'var(--ink-4)' }}>—</span>
  const label = c >= 0.8 ? 'High' : c >= 0.5 ? 'Medium' : 'Low'
  return (
    <span className={`chip ${c >= 0.8 ? 'chip-good' : c >= 0.5 ? 'chip-info' : 'chip-neutral'}`} title="Code-computed from the number of cases and their support share (0.2 / 0.5 / 0.8).">
      {label} · {c}
    </span>
  )
}

function Cases({ cases }: { cases: PmLessonCase[] }) {
  if (!cases.length) return <p className="explain">No cases attached.</p>
  return (
    <ul className="flex flex-col gap-1 text-[13px]">
      {cases.map((c) => (
        <li key={c.ref} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={`chip ${c.supports ? 'chip-good' : 'chip-bad'}`}>{c.supports ? 'Supports' : 'Contradicts'}</span>
          <span className="tabular-nums" style={{ color: 'var(--ink-2)' }}>{fmt.date(c.at)}</span>
          <span className="break-all" style={{ color: 'var(--ink-3)' }} translate="no">
            campaign {c.campaignId} · {c.ref}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ── Tab ────────────────────────────────────────────────────────────────────

export function LessonsTab({ tenantId, view, update }: { tenantId: string; view: PmView; update: (p: Partial<PmView>) => void }) {
  // One counter refetches every section after any change (approve moves a lesson, retire changes the table…).
  const [nonce, setNonce] = useState(0)
  const changed = () => setNonce((n) => n + 1)
  return (
    <div className="flex flex-col gap-5">
      <p className="explain max-w-3xl text-pretty">
        Lessons are earned from measured outcomes, never from the AI’s own opinion. Each Monday the curator proposes small changes; nothing becomes active until you approve it. Lessons are priors — today’s evidence wins. Owner rules are rules.
      </p>
      <Proposals tenantId={tenantId} nonce={nonce} onChanged={changed} onOpen={(lesson) => update({ lesson })} />
      <LessonsTable tenantId={tenantId} nonce={nonce} onOpen={(lesson) => update({ lesson })} />
      <OwnerRules tenantId={tenantId} />
      <Scorecard tenantId={tenantId} />
      <LessonPanel tenantId={tenantId} lessonId={view.lesson} nonce={nonce} onChanged={changed} onClose={() => update({ lesson: '' })} />
    </div>
  )
}

// ── Waiting for you ────────────────────────────────────────────────────────

function Proposals({ tenantId, nonce, onChanged, onOpen }: { tenantId: string; nonce: number; onChanged: () => void; onOpen: (id: string) => void }) {
  const p = useLoad(`lesson-proposals#${nonce}`, () => getPmLessonProposals(tenantId, 'pending'))
  const n = p.data?.length
  return (
    <SectionCard title={`Waiting for you${n ? ` (${n})` : ''}`} description="Changes the weekly curator proposed that need your yes. Code has already checked the cases exist and recomputed the numbers.">
      {p.error ? (
        <LoadError message={p.error} onRetry={p.reload} />
      ) : !p.data ? (
        <PmSkeleton rows={1} />
      ) : p.data.length === 0 ? (
        <Empty title="Nothing waiting for you" hint="The curator runs every Monday; proposals that need your approval show up here." />
      ) : (
        <ul className={`flex flex-col gap-3 ${p.loading ? 'opacity-60' : ''}`} aria-busy={p.loading}>
          {p.data.map((x) => (
            <ProposalCard key={x.proposalId} tenantId={tenantId} p={x} onChanged={onChanged} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function ProposalCard({ tenantId, p, onChanged, onOpen }: { tenantId: string; p: PmLessonProposal; onChanged: () => void; onOpen: (id: string) => void }) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle')
  const [note, setNote] = useState('')
  const act = useAction()
  const op = OP[p.op] ?? OP.EDIT
  const l = p.lesson ?? {}
  const lessonId = p.lessonId ?? l.lessonId
  const cases = p.cases ?? l.cases ?? []
  const support = cases.filter((c) => c.supports).length
  const nid = `pm-prop-${p.proposalId}`
  const cancel = () => {
    setMode('idle')
    setNote('')
    act.clear()
  }

  return (
    <li className="rounded-xl px-4 py-3" style={CARD_ITEM}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`chip ${op.chip} !font-bold`} title={op.help}>{op.label}</span>
        {lessonId &&
          (p.op === 'ADD' || p.op === 'PROMOTE' ? (
            <span className="chip chip-accent">{lessonId}</span>
          ) : (
            <button type="button" className={`${LINK} text-[13px]`} onClick={() => onOpen(lessonId)}>
              {lessonId}
            </button>
          ))}
        {p.mergeIds && p.mergeIds.length > 0 && <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>merges {p.mergeIds.join(' + ')}</span>}
        {l.type && <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{TYPE[l.type] ?? l.type}</span>}
        <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>· {p.week} · {p.proposalId}</span>
      </div>
      {l.statement && <p className="mt-1.5 break-words text-[15px] font-semibold leading-snug">{l.statement}</p>}
      {l.because && <p className="explain mt-1 break-words">Because (curator’s reading): {l.because}</p>}
      <div className="mt-2">
        <ScopeChips scope={l.scope} />
      </div>
      <p className="mt-2 break-words text-[13px]" style={{ color: 'var(--ink-2)' }}>
        <strong>Why: </strong>
        {p.why}
      </p>

      <details className="mt-2">
        <summary className="cursor-pointer rounded text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-[var(--accent)]" style={{ color: 'var(--ink-2)' }}>
          {plural(cases.length, 'case')} behind it · {support} support · {cases.length - support} contradict
        </summary>
        <div className="mt-2">
          <Cases cases={cases} />
        </div>
      </details>

      {p.validation.problems.length > 0 && (
        <div className="mt-2 rounded-lg px-3 py-2 text-[13px]" style={{ background: p.validation.ok ? 'var(--warn-bg)' : 'var(--bad-bg)', border: `1px solid ${p.validation.ok ? 'var(--warn-border)' : 'var(--bad-border)'}` }}>
          <strong style={{ color: p.validation.ok ? 'var(--warn)' : 'var(--bad)' }}>{p.validation.ok ? 'Notes from the code checks:' : 'Failed the code checks — cannot be approved:'}</strong>
          <ul className="mt-1 list-disc pl-5">
            {p.validation.problems.map((x, i) => (
              <li key={i} className="break-words">{x}</li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'idle' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={!p.validation.ok} onClick={() => setMode('approve')}>
            Approve…
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setMode('reject')}>
            Reject…
          </button>
        </div>
      ) : (
        <form
          className="mt-3 flex flex-col gap-2 rounded-lg px-3 py-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--hairline-light)' }}
          onSubmit={(e) => {
            e.preventDefault()
            if (mode === 'reject' && !note.trim()) return
            act.run(async () => {
              if (mode === 'reject') return rejectPmLessonProposal(tenantId, p.proposalId, note.trim())
              // The server re-checks before applying; a proposal that no longer fits comes back as invalid (and leaves this list).
              const r = await approvePmLessonProposal(tenantId, p.proposalId, note.trim() || undefined)
              if (r.status === 'invalid') throw new Error(`not applied, it no longer passes the checks: ${(r.problems ?? []).join('; ')}. Reload the page to clear it`)
            }, onChanged)
          }}
        >
          <p className="text-[13.5px] font-semibold">
            {mode === 'approve' ? `Approve: ${op.label.toLowerCase()} ${lessonId ?? 'this lesson'}? ${p.op === 'PROMOTE' ? 'The daily phases start using it tomorrow.' : ''}` : `Reject this ${op.label.toLowerCase()}? The curator reads your reason next Monday.`}
          </p>
          <label htmlFor={nid} className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            {mode === 'approve' ? 'Note (optional)' : 'Reason (required)'}
          </label>
          <textarea
            id={nid}
            name="note"
            className="input !min-h-[72px] resize-y"
            value={note}
            maxLength={NOTE_MAX}
            required={mode === 'reject'}
            autoComplete="off"
            placeholder={mode === 'approve' ? 'Matches what we saw in Navratri…' : 'Only 2 campaigns and both were in learning…'}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={`btn ${mode === 'approve' ? 'btn-primary' : 'btn-danger'}`} disabled={act.busy || (mode === 'reject' && !note.trim())}>
              {act.busy ? 'Saving…' : mode === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancel} disabled={act.busy}>
              Cancel
            </button>
            <Msg error={act.error} />
          </div>
        </form>
      )}
    </li>
  )
}

// ── Lessons table ──────────────────────────────────────────────────────────

const STATUS_FILTERS: (PmLessonStatus | '')[] = ['', 'active', 'candidate', 'review', 'retired']

function LessonsTable({ tenantId, nonce, onOpen }: { tenantId: string; nonce: number; onOpen: (id: string) => void }) {
  const [status, setStatus] = useState<PmLessonStatus | ''>('')
  const [type, setType] = useState<PmLessonType | ''>('')
  const q = { ...(status ? { status } : {}), ...(type ? { type } : {}) }
  const r = useLoad(`lessons-${status}-${type}#${nonce}`, () => getPmLessons(tenantId, q))
  const rows = r.data
  const filtered = !!(status || type)

  return (
    <SectionCard title={`Lessons${rows ? ` (${rows.length})` : ''}`} description="What we learned: “in context X, doing Y did Z (n cases)”. Confidence and hit rates are computed by code from the cases." padded={false}>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 px-4 pb-3 sm:px-5">
        <div className="flex flex-col gap-1" role="group" aria-label="Filter by status">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }} aria-hidden="true">Status</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button key={s || 'all'} type="button" aria-pressed={status === s} className={`btn !min-h-[34px] !px-3 !py-1.5 ${status === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatus(s)}>
                {s ? STATUS[s].label : 'All'}
              </button>
            ))}
          </div>
        </div>
        <label className={`${LABEL} min-w-[180px]`} style={{ color: 'var(--ink-2)' }}>
          Type
          <select className="input !min-h-[34px] !py-1" name="type" value={type} onChange={(e) => setType(e.target.value as PmLessonType | '')}>
            <option value="">All types</option>
            {(Object.keys(TYPE) as PmLessonType[]).map((t) => (
              <option key={t} value={t}>{TYPE[t]}</option>
            ))}
          </select>
        </label>
      </div>
      {r.error ? (
        <div className="px-4 pb-4 sm:px-5">
          <LoadError message={r.error} onRetry={r.reload} />
        </div>
      ) : !rows ? (
        <div className="px-4 pb-4 sm:px-5">
          <PmSkeleton rows={2} />
        </div>
      ) : rows.length === 0 ? (
        <Empty title={filtered ? 'No lessons match these filters' : NO_LESSONS} hint={filtered ? 'Try another status or type.' : undefined} />
      ) : (
        <div className={r.loading ? 'opacity-60' : ''} aria-busy={r.loading}>
          <TableWrap label="Lessons">
            <thead>
              <tr>
                <th>Id</th>
                <th>Type</th>
                <th>Lesson</th>
                <th>Confidence</th>
                <th className="num">Cases</th>
                <th className="num">Uses · hit rate</th>
                <th>Last case</th>
                <th>Review by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const sup = l.cases.filter((c) => c.supports).length
                const s = STATUS[l.status] ?? STATUS.candidate
                return (
                  <tr key={l.lessonId} style={l.status === 'retired' ? { opacity: 0.65 } : undefined}>
                    <td className="font-semibold tabular-nums">{l.lessonId}</td>
                    <td className="text-[13px]">{TYPE[l.type] ?? l.type}</td>
                    <td className="min-w-[260px] max-w-[440px] whitespace-normal">
                      <button type="button" className={`${LINK} line-clamp-2 break-words`} onClick={() => onOpen(l.lessonId)}>
                        {l.statement}
                      </button>
                      <span className={`chip ${s.chip} mt-1`} title={s.help}>{s.label}</span>
                    </td>
                    <td>
                      <ConfChip c={l.confidence} />
                    </td>
                    <td className="num">
                      <span style={{ color: 'var(--good)' }}>{sup}</span>
                      <span style={{ color: 'var(--ink-4)' }}> / </span>
                      <span style={{ color: l.cases.length - sup ? 'var(--bad)' : 'var(--ink-3)' }}>{l.cases.length - sup}</span>
                      <span className="sr-only"> supporting / contradicting</span>
                    </td>
                    <td className="num">
                      {fmt.int(l.uses)} · {hitRate(l)}
                    </td>
                    <td className="tabular-nums">{fmt.date(lastCase(l.cases))}</td>
                    <td className="tabular-nums">{fmt.date(l.reviewBy)}</td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
        </div>
      )}
    </SectionCard>
  )
}

// ── Lesson panel ───────────────────────────────────────────────────────────

function LessonPanel({ tenantId, lessonId, nonce, onChanged, onClose }: { tenantId: string; lessonId: string; nonce: number; onChanged: () => void; onClose: () => void }) {
  const open = !!lessonId
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay data-portal className="fixed inset-0 z-[60] animate-fade-in" style={{ background: 'rgba(15,23,42,0.35)' }} />
        <Dialog.Content
          data-portal
          className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-[720px] flex-col overflow-y-auto overscroll-contain animate-panel-slide-in"
          style={{ background: 'var(--paper)', boxShadow: 'var(--shadow-overlay)' }}
        >
          {open && <LessonBody key={lessonId} tenantId={tenantId} lessonId={lessonId} nonce={nonce} onChanged={onChanged} />}
          <Dialog.Close asChild>
            <button type="button" className="btn btn-ghost absolute right-4 top-4 !min-h-[36px] !px-2" aria-label="Close panel">
              <X size={18} aria-hidden="true" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function LessonBody({ tenantId, lessonId, nonce, onChanged }: { tenantId: string; lessonId: string; nonce: number; onChanged: () => void }) {
  // ponytail: loads the whole list (≤ 60 active + candidates) and picks one; add GET /lessons/:id if the list grows.
  const r = useLoad(`lesson-all#${nonce}`, () => getPmLessons(tenantId))
  const [mode, setMode] = useState<'view' | 'edit' | 'retire'>('view')
  const l = r.data?.find((x) => x.lessonId === lessonId)
  const s = l ? (STATUS[l.status] ?? STATUS.candidate) : null
  const done = () => {
    setMode('view')
    onChanged()
  }

  return (
    <div className="flex flex-col gap-4 p-5 pt-6">
      <div className="pr-12">
        <p className="micro-label">Lesson · {lessonId}{l ? ` · ${TYPE[l.type] ?? l.type} · v${l.version}` : ''}</p>
        <Dialog.Title className="section-title mt-1 break-words text-pretty">{l?.statement ?? lessonId}</Dialog.Title>
        <Dialog.Description className="explain mt-1">
          {l ? `${plural(l.cases.length, 'case')} · used ${plural(l.uses, 'time')} · hit rate ${hitRate(l)}` : r.data ? 'This lesson no longer exists.' : 'Loading lesson…'}
        </Dialog.Description>
        {s && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`chip ${s.chip}`} title={s.help}>{s.label}</span>
            <ConfChip c={l?.confidence} />
          </div>
        )}
      </div>
      {r.error ? (
        <LoadError message={r.error} onRetry={r.reload} />
      ) : !r.data ? (
        <PmSkeleton rows={2} />
      ) : !l ? (
        <Empty title="Lesson not found" hint="It may have been merged into another lesson. Close the panel and pick one from the table." />
      ) : mode === 'edit' ? (
        <EditLesson tenantId={tenantId} l={l} onDone={done} onCancel={() => setMode('view')} />
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-[auto_1fr]" style={{ color: 'var(--ink-2)' }}>
            <dt style={{ color: 'var(--ink-3)' }}>Because</dt>
            <dd className="break-words">{l.because || '—'}</dd>
            <dt style={{ color: 'var(--ink-3)' }}>Scope</dt>
            <dd>
              <ScopeChips scope={l.scope} />
            </dd>
            <dt style={{ color: 'var(--ink-3)' }}>Uses · hits</dt>
            <dd className="tabular-nums">{fmt.int(l.uses)} · {fmt.int(l.hits)} ({hitRate(l)})</dd>
            <dt style={{ color: 'var(--ink-3)' }}>Approved</dt>
            <dd>{fmt.dateTime(l.approvedAt)}</dd>
            <dt style={{ color: 'var(--ink-3)' }}>Review by</dt>
            <dd>{fmt.date(l.reviewBy)}</dd>
            <dt style={{ color: 'var(--ink-3)' }}>Created</dt>
            <dd>{fmt.dateTime(l.createdAt)}</dd>
          </dl>
          <section aria-labelledby="pm-lesson-cases">
            <h3 id="pm-lesson-cases" className="mb-2 text-[14px] font-semibold">Cases</h3>
            <Cases cases={l.cases} />
          </section>
          {l.events && l.events.length > 0 && (
            <section aria-labelledby="pm-lesson-history">
              <h3 id="pm-lesson-history" className="mb-2 text-[14px] font-semibold">History</h3>
              <ol className="flex flex-col gap-1.5 text-[13px]">
                {l.events.map((e, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2" style={{ color: 'var(--ink-2)' }}>
                    <span className="tabular-nums" style={{ color: 'var(--ink-3)' }}>{fmt.dateTime(e.at)}</span>
                    <span className="font-semibold capitalize">{e.kind}</span>
                    {e.version != null && <span style={{ color: 'var(--ink-3)' }}>v{e.version}</span>}
                    {e.note && <span className="min-w-0 break-words">— {e.note}</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}
          {l.status !== 'retired' &&
            (mode === 'retire' ? (
              <RetireLesson tenantId={tenantId} l={l} onDone={done} onCancel={() => setMode('view')} />
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => setMode('edit')}>
                  Edit Lesson
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setMode('retire')}>
                  Retire…
                </button>
              </div>
            ))}
        </>
      )}
    </div>
  )
}

const scopeText = (s: PmLessonScope) =>
  Object.entries(s)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

function parseScope(text: string): PmLessonScope | string {
  const out: PmLessonScope = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const i = line.indexOf(':')
    if (i < 1 || !line.slice(i + 1).trim()) return `“${line}” — write each line as key: value.`
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

function EditLesson({ tenantId, l, onDone, onCancel }: { tenantId: string; l: PmLesson; onDone: () => void; onCancel: () => void }) {
  const [statement, setStatement] = useState(l.statement)
  const [because, setBecause] = useState(l.because ?? '')
  const [scope, setScope] = useState(scopeText(l.scope))
  const [scopeErr, setScopeErr] = useState('')
  const act = useAction()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const parsed = parseScope(scope)
        if (typeof parsed === 'string') {
          setScopeErr(parsed)
          document.getElementById('pm-lesson-scope')?.focus()
          return
        }
        setScopeErr('')
        act.run(() => editPmLesson(tenantId, l.lessonId, { statement: statement.trim(), because: because.trim(), scope: parsed }), onDone)
      }}
    >
      <label className={LABEL} style={{ color: 'var(--ink-2)' }}>
        Statement (when / then)
        <textarea className="input !min-h-[88px] resize-y font-normal" name="statement" value={statement} maxLength={500} required autoComplete="off" onChange={(e) => setStatement(e.target.value)} />
      </label>
      <label className={LABEL} style={{ color: 'var(--ink-2)' }}>
        Because (optional)
        <textarea className="input !min-h-[64px] resize-y font-normal" name="because" value={because} maxLength={NOTE_MAX} autoComplete="off" onChange={(e) => setBecause(e.target.value)} />
      </label>
      <div className="flex flex-col gap-1">
        <label htmlFor="pm-lesson-scope" className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          Scope — one “key: value” per line
        </label>
        <textarea
          id="pm-lesson-scope"
          className="input !min-h-[100px] resize-y font-mono text-[13px]"
          name="scope"
          value={scope}
          spellCheck={false}
          autoComplete="off"
          placeholder={'structure: ABO|CBO\nroas7d: >=1.1'}
          aria-invalid={!!scopeErr || undefined}
          aria-describedby="pm-lesson-scope-help"
          onChange={(e) => setScope(e.target.value)}
        />
        <p id="pm-lesson-scope-help" className="explain">
          Keys: <span translate="no">{SCOPE_KEYS}</span>. Values: exact (ABO), any of (ABO|CBO), or a comparison (&gt;=1.1). Every key must match the situation.
        </p>
        {scopeErr && (
          <p role="alert" className="text-[13px]" style={{ color: 'var(--bad)' }}>
            {scopeErr}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={act.busy || !statement.trim()}>
          {act.busy ? 'Saving…' : 'Save Lesson'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={act.busy}>
          Cancel
        </button>
        <Msg error={act.error} />
      </div>
    </form>
  )
}

function RetireLesson({ tenantId, l, onDone, onCancel }: { tenantId: string; l: PmLesson; onDone: () => void; onCancel: () => void }) {
  const [note, setNote] = useState('')
  const act = useAction()
  return (
    <form
      className="flex flex-col gap-2 rounded-lg px-3 py-3"
      style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}
      onSubmit={(e) => {
        e.preventDefault()
        if (note.trim()) act.run(() => retirePmLesson(tenantId, l.lessonId, note.trim()), onDone)
      }}
    >
      <p className="text-[13.5px] font-semibold">Retire {l.lessonId}? The daily phases stop using it from the next run.</p>
      <label htmlFor="pm-retire-note" className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
        Reason (required)
      </label>
      <textarea id="pm-retire-note" name="note" className="input !min-h-[72px] resize-y" value={note} maxLength={NOTE_MAX} required autoComplete="off" placeholder="Meta changed how Advantage+ budgets work…" onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-danger" disabled={act.busy || !note.trim()}>
          {act.busy ? 'Retiring…' : 'Confirm Retire'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={act.busy}>
          Cancel
        </button>
        <Msg error={act.error} />
      </div>
    </form>
  )
}

// ── Owner rules ────────────────────────────────────────────────────────────

function describeCheck(c: PmOwnerRuleCheck): string {
  const prod = 'product' in c && c.product ? ` · ${productLabel(c.product)}` : ''
  switch (c.kind) {
    case 'no_pause_before_days':
      return `No pause before day ${c.days}`
    case 'max_budget_step':
      return `Budget steps at most ±${Math.round(c.step * 100)}%`
    case 'no_budget_increase_in_season':
      return `No budget increase during ${c.season}${prod}`
    case 'no_action_type':
      return `Never “${c.type}” actions${prod}`
  }
}

function OwnerRules({ tenantId }: { tenantId: string }) {
  const r = useLoad('lesson-owner-rules', () => getPmOwnerRules(tenantId))
  const [editing, setEditing] = useState<string | null>(null) // ruleId, 'new' or null
  const close = () => {
    setEditing(null)
    r.reload()
  }
  return (
    <SectionCard title={`Owner rules${r.data ? ` (${r.data.length})` : ''}`} description="Your standing instructions. Active at once, given to every phase, and never overridden by evidence. Rules checked by code are enforced on every plan.">
      {r.error ? (
        <LoadError message={r.error} onRetry={r.reload} />
      ) : !r.data ? (
        <PmSkeleton rows={1} />
      ) : (
        <div className="flex flex-col gap-3">
          {r.data.length === 0 && editing !== 'new' && <Empty title="No owner rules yet" hint="Add the rules you always follow, e.g. “Never pause an ad before day 3”." />}
          {r.data.length > 0 && (
            <ul className="flex flex-col gap-2">
              {r.data.map((x) =>
                editing === x.ruleId ? (
                  <li key={x.ruleId}>
                    <RuleForm tenantId={tenantId} rule={x} onDone={close} onCancel={() => setEditing(null)} />
                  </li>
                ) : (
                  <RuleRow key={x.ruleId} tenantId={tenantId} rule={x} onEdit={() => setEditing(x.ruleId)} onDeleted={r.reload} />
                ),
              )}
            </ul>
          )}
          {editing === 'new' ? (
            <RuleForm tenantId={tenantId} onDone={close} onCancel={() => setEditing(null)} />
          ) : (
            <div>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing('new')}>
                Add Rule
              </button>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

function RuleRow({ tenantId, rule, onEdit, onDeleted }: { tenantId: string; rule: PmOwnerRule; onEdit: () => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const act = useAction()
  return (
    <li className="flex flex-col gap-2 rounded-xl px-4 py-3 sm:flex-row sm:items-start sm:justify-between" style={{ ...CARD_ITEM, opacity: rule.active ? 1 : 0.7 }}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--ink-3)' }}>{rule.ruleId}</span>
          {!rule.active && <span className="chip chip-neutral">Paused</span>}
          {rule.check ? <span className="chip chip-info max-w-full !whitespace-normal break-words" title="Code checks every plan against this rule.">Checked by code · {describeCheck(rule.check)}</span> : <span className="chip chip-neutral" title="The phases are told to follow it; code does not check it.">Text only</span>}
        </div>
        <p className="mt-1 break-words text-[14.5px] font-semibold leading-snug">{rule.text}</p>
      </div>
      {confirm ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold">Delete {rule.ruleId}?</span>
          <button type="button" className="btn btn-danger !min-h-[34px]" disabled={act.busy} onClick={() => act.run(() => deletePmOwnerRule(tenantId, rule.ruleId), onDeleted)}>
            {act.busy ? 'Deleting…' : 'Confirm Delete'}
          </button>
          <button type="button" className="btn btn-ghost !min-h-[34px]" disabled={act.busy} onClick={() => (setConfirm(false), act.clear())}>
            Cancel
          </button>
          <Msg error={act.error} />
        </div>
      ) : (
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn btn-ghost !min-h-[34px]" onClick={onEdit} aria-label={`Edit rule ${rule.ruleId}`}>
            Edit
          </button>
          <button type="button" className="btn btn-ghost !min-h-[34px]" onClick={() => setConfirm(true)} aria-label={`Delete rule ${rule.ruleId}`}>
            Delete
          </button>
        </div>
      )}
    </li>
  )
}

type CheckDraft = { kind: PmOwnerRuleCheck['kind'] | ''; days: string; stepPct: string; season: string; type: string; product: string }

function draftOf(c?: PmOwnerRuleCheck): CheckDraft {
  return {
    kind: c?.kind ?? '',
    days: c?.kind === 'no_pause_before_days' ? String(c.days) : '3',
    stepPct: c?.kind === 'max_budget_step' ? String(Math.round(c.step * 100)) : '20',
    season: c?.kind === 'no_budget_increase_in_season' ? c.season : '',
    type: c?.kind === 'no_action_type' ? c.type : 'pause',
    product: c && 'product' in c ? (c.product ?? '') : '',
  }
}

function checkOf(d: CheckDraft): PmOwnerRuleCheck | null | string {
  const product = d.product ? { product: d.product } : {}
  switch (d.kind) {
    case '':
      return null
    case 'no_pause_before_days': {
      const days = Number(d.days)
      return Number.isInteger(days) && days >= 1 && days <= 60 ? { kind: d.kind, days } : 'Days must be a whole number from 1 to 60.'
    }
    case 'max_budget_step': {
      const pct = Number(d.stepPct)
      return pct > 0 && pct <= 100 ? { kind: d.kind, step: pct / 100 } : 'Step must be a percentage above 0 and at most 100.'
    }
    case 'no_budget_increase_in_season':
      return d.season.trim() ? { kind: d.kind, season: d.season.trim(), ...product } : 'Name the season, e.g. kharmas.'
    case 'no_action_type':
      return { kind: d.kind, type: d.type, ...product }
  }
}

function RuleForm({ tenantId, rule, onDone, onCancel }: { tenantId: string; rule?: PmOwnerRule; onDone: () => void; onCancel: () => void }) {
  const [text, setText] = useState(rule?.text ?? '')
  const [active, setActive] = useState(rule?.active ?? true)
  const [d, setD] = useState<CheckDraft>(() => draftOf(rule?.check))
  const [checkErr, setCheckErr] = useState('')
  const act = useAction()
  const set = (p: Partial<CheckDraft>) => setD((x) => ({ ...x, ...p }))
  const id = rule?.ruleId ?? 'new'
  const productSelect = (
    <label className={LABEL} style={{ color: 'var(--ink-2)' }}>
      Product (optional)
      <select className="input !min-h-[36px] !py-1 font-normal" name="product" value={d.product} onChange={(e) => set({ product: e.target.value })}>
        <option value="">All products</option>
        {PM_PRODUCTS.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
    </label>
  )

  return (
    <form
      className="flex flex-col gap-3 rounded-xl px-4 py-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
      aria-label={rule ? `Edit rule ${rule.ruleId}` : 'New owner rule'}
      onSubmit={(e) => {
        e.preventDefault()
        const check = checkOf(d)
        if (typeof check === 'string') return setCheckErr(check)
        setCheckErr('')
        const input: PmOwnerRuleInput = { text: text.trim(), active, check }
        act.run(() => (rule ? updatePmOwnerRule(tenantId, rule.ruleId, input) : createPmOwnerRule(tenantId, input)), onDone)
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`pm-rule-text-${id}`} className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          Rule
        </label>
        <textarea
          id={`pm-rule-text-${id}`}
          name="text"
          className="input !min-h-[64px] resize-y"
          value={text}
          maxLength={RULE_MAX}
          required
          autoComplete="off"
          placeholder="Never raise Golu Devta budget during Kharmas…"
          onChange={(e) => setText(e.target.value)}
        />
        <p className="explain tabular-nums">{text.length} / {RULE_MAX} characters</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className={`${LABEL} min-w-[220px]`} style={{ color: 'var(--ink-2)' }}>
          Checked by code
          <select className="input !min-h-[36px] !py-1 font-normal" name="kind" value={d.kind} onChange={(e) => set({ kind: e.target.value as CheckDraft['kind'] })}>
            <option value="">No — text the phases follow</option>
            {(Object.keys(CHECK_KIND) as PmOwnerRuleCheck['kind'][]).map((k) => (
              <option key={k} value={k}>{CHECK_KIND[k]}</option>
            ))}
          </select>
        </label>
        {d.kind === 'no_pause_before_days' && (
          <label className={`${LABEL} w-[120px]`} style={{ color: 'var(--ink-2)' }}>
            Days
            <input className="input !min-h-[36px] !py-1 font-normal" type="number" inputMode="numeric" name="days" min={1} max={60} step={1} value={d.days} autoComplete="off" onChange={(e) => set({ days: e.target.value })} />
          </label>
        )}
        {d.kind === 'max_budget_step' && (
          <label className={`${LABEL} w-[140px]`} style={{ color: 'var(--ink-2)' }}>
            Max step (%)
            <input className="input !min-h-[36px] !py-1 font-normal" type="number" inputMode="decimal" name="step" min={1} max={100} value={d.stepPct} autoComplete="off" onChange={(e) => set({ stepPct: e.target.value })} />
          </label>
        )}
        {d.kind === 'no_budget_increase_in_season' && (
          <>
            <label className={`${LABEL} w-[180px]`} style={{ color: 'var(--ink-2)' }}>
              Season id
              <input className="input !min-h-[36px] !py-1 font-normal" name="season" value={d.season} maxLength={100} spellCheck={false} autoComplete="off" placeholder="kharmas…" onChange={(e) => set({ season: e.target.value })} />
            </label>
            {productSelect}
          </>
        )}
        {d.kind === 'no_action_type' && (
          <>
            <label className={`${LABEL} w-[180px]`} style={{ color: 'var(--ink-2)' }}>
              Action type
              <select className="input !min-h-[36px] !py-1 font-normal" name="actionType" value={d.type} onChange={(e) => set({ type: e.target.value })}>
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
            {productSelect}
          </>
        )}
      </div>
      {checkErr && (
        <p role="alert" className="text-[13px]" style={{ color: 'var(--bad)' }}>
          {checkErr}
        </p>
      )}
      <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
        <input type="checkbox" name="active" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={act.busy || !text.trim()}>
          {act.busy ? 'Saving…' : rule ? 'Save Rule' : 'Add Rule'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={act.busy}>
          Cancel
        </button>
        <Msg error={act.error} />
      </div>
    </form>
  )
}

// ── Scorecard ──────────────────────────────────────────────────────────────

function Scorecard({ tenantId }: { tenantId: string }) {
  const r = useLoad('lesson-scorecard', () => getPmLessonScorecard(tenantId, 8))
  const weeks = r.data?.weeks
  return (
    <SectionCard title="Is it working?" description="Weekly scorecard of graded recommendations. Hit rate = share of graded changes that worked; calibration = share of results inside the predicted range." padded={false}>
      {r.error ? (
        <div className="px-4 pb-4 sm:px-5">
          <LoadError message={r.error} onRetry={r.reload} />
        </div>
      ) : !weeks ? (
        <div className="px-4 pb-4 sm:px-5">
          <PmSkeleton rows={1} />
        </div>
      ) : !weeks.some((w) => Object.keys(w.byActionType).length || w.diagnosis.n) ? (
        <Empty title="Nothing graded yet" hint="Outcomes are graded on day 3 and day 7 after each change; the first weeks fill in after that." />
      ) : (
        <ScoreTable weeks={weeks} />
      )}
    </SectionCard>
  )
}

function ScoreTable({ weeks }: { weeks: PmLessonScorecard['weeks'] }) {
  const types = [...new Set(weeks.flatMap((w) => Object.keys(w.byActionType)))].sort()
  const graded = (w: PmLessonScorecard['weeks'][number]) => Object.values(w.byActionType).reduce((s, a) => s + a.n, 0)
  return (
    <TableWrap label="Weekly lessons scorecard">
      <thead>
        <tr>
          <th>Week</th>
          <th className="num">Graded</th>
          {types.map((t) => (
            <th key={t} className="num capitalize">{t.replace('_', ' ')} hit rate</th>
          ))}
          <th className="num">Calibration</th>
          <th className="num">Accepted</th>
          <th className="num">Diagnosis held</th>
          <th className="num">₹ realised</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map((w) => (
          <tr key={w.week}>
            <td className="tabular-nums">{w.week}</td>
            <td className="num">{fmt.int(graded(w))}</td>
            {types.map((t) => {
              const h = w.byActionType[t]
              return (
                <td key={t} className="num" title={h ? `${h.worked} of ${h.n} worked` : undefined}>
                  {h && h.n ? fmt.pct(h.rate, 0) : '—'}
                  {h && h.n > 0 && <span className="ml-1 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>n={h.n}</span>}
                </td>
              )
            })}
            <td className="num" title={`${w.calibration.inside} of ${w.calibration.n} inside the predicted range`}>{fmt.pct(w.calibration.share, 0)}</td>
            <td className="num" title={`${w.acceptance.taken} of ${w.acceptance.recommended} recommendations taken`}>{fmt.pct(w.acceptance.share, 0)}</td>
            <td className="num" title={`${w.diagnosis.held} of ${w.diagnosis.n} causes held up`}>{fmt.pct(w.diagnosis.accuracy, 0)}</td>
            <td className="num">{graded(w) ? fmt.inr(w.realisedRupees) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  )
}
