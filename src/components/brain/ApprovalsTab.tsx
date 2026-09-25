'use client'

import React, { useState } from 'react'
import {
  BadgeCheck,
  CircleCheck,
  Clock3,
  ImageIcon,
  Info,
  CalendarCheck,
  Lightbulb,
  Loader2,
  MessageSquare,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { errorDetail, formatInr, formatRelative, formatWhen, plainStatus, toneChip } from '@/lib/plain-language'
import { Details } from '@/components/plain/Details'
import { decideBrainGate } from '@/lib/brain-api'
import type {
  BrainGate,
  BrainGateActionKey,
  BrainGateDecisionResult,
  BrainGateCampaign,
  BrainGateCreative,
  BrainGatePlan,
  BrainIdea,
} from '@/types/brain'
import { SectionCard, plainCode, plainIfCode } from './shared'

const KIND_META: Record<
  BrainGate['kind'],
  { label: string; chip: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  creative_craft: { label: plainStatus('gateKind', 'creative_craft').label, chip: 'chip-info', Icon: ShieldCheck },
  idea_selection: { label: plainStatus('gateKind', 'idea_selection').label, chip: 'chip-accent', Icon: Lightbulb },
  campaign_launch: { label: plainStatus('gateKind', 'campaign_launch').label, chip: 'chip-warn', Icon: BadgeCheck },
  // A plan gate spends the day's money. Warn rather than accent: it is the one gate on this page
  // where approving commits real budget before a single creative exists.
  plan_approval: { label: plainStatus('gateKind', 'plan_approval').label, chip: 'chip-warn', Icon: CalendarCheck },
}

/**
 * The chip for a gate. A spend gate says which spend decision it is (build / launch / scale) —
 * "Launch approval" on a build gate would tell someone the wrong thing is about to happen.
 */
function gateMeta(gate: BrainGate) {
  const base = KIND_META[gate.kind] ?? {
    label: plainStatus('gateKind', gate.kind).label,
    chip: 'chip-neutral',
    Icon: BadgeCheck,
  }
  if (gate.spendGate && gate.kind !== 'plan_approval') {
    const spend = plainStatus('spendGate', gate.spendGate)
    return { ...base, label: spend.label, meaning: spend.meaning }
  }
  return { ...base, meaning: plainStatus('gateKind', gate.kind).meaning }
}

/** Plain words for the Curator's verdict on an ad; unknown verdicts are humanised. */
function verdictMeta(verdict: string) {
  const plain = plainStatus('creativeVerdict', verdict)
  return { label: plain.label, chip: toneChip(plain.tone), meaning: plain.meaning }
}

/** Status words arriving in capitals from Meta ("Created · PAUSED") read as plain words. */
function plainMetaWords(text: string): string {
  return text.replace(/\b[A-Z][A-Z_]{2,}\b/g, (word) => plainStatus('campaignStatus', word).label.toLowerCase())
}

interface ApprovalsTabProps {
  tenantId: string
  gates: BrainGate[]
  /** Refetches everything — a cleared gate changes the pipeline and the ledger too. */
  onDecided: () => void
}

/** What one decision did, kept after its card is gone so the operator can read it. */
interface DecisionOutcome {
  gateId: string
  title: string
  spendGate: BrainGate['spendGate']
  amountInr: number | undefined
  result: BrainGateDecisionResult
}

export function ApprovalsTab({ tenantId, gates, onDecided }: ApprovalsTabProps) {
  // A decided gate's card disappears on the refetch, so what the decision DID — which contract the
  // brain rescaled, or why it rescaled none — is held here, above the cards, until dismissed.
  const [outcomes, setOutcomes] = useState<DecisionOutcome[]>([])
  const recordOutcome = (outcome: DecisionOutcome) =>
    setOutcomes((current) => [outcome, ...current.filter((o) => o.gateId !== outcome.gateId)])
  const outcomeList = outcomes.length > 0 && (
    <DecisionOutcomes
      outcomes={outcomes}
      onDismiss={(gateId) => setOutcomes((current) => current.filter((o) => o.gateId !== gateId))}
    />
  )

  if (gates.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {outcomeList}
        <SectionCard title="Approvals" description="Anything the Brain needs your go-ahead on shows up here.">
          <div className="py-12 text-center">
            <CircleCheck size={24} aria-hidden="true" style={{ color: 'var(--good)' }} className="mx-auto" />
            <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
              Nothing is waiting on you
            </p>
            <p className="explain mx-auto mt-1 max-w-[52ch]">
              When new ads are ready for a look, or a campaign is set up and ready to switch on, it
              shows up here and in Slack. Answering it in either place clears it in both.
            </p>
          </div>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
      >
        <Info size={16} aria-hidden="true" style={{ color: 'var(--accent-strong)', marginTop: 2, flexShrink: 0 }} />
        <p className="explain min-w-0" style={{ color: 'var(--ink-2)' }}>
          These are the same requests posted to Slack. Answer in either place — the other one
          updates too.
        </p>
      </div>

      {outcomeList}

      {gates.map((gate) => (
        <GateCard
          key={gate.gateId}
          tenantId={tenantId}
          gate={gate}
          onDecided={onDecided}
          onOutcome={recordOutcome}
        />
      ))}
    </div>
  )
}

function GateCard({
  tenantId,
  gate,
  onDecided,
  onOutcome,
}: {
  tenantId: string
  gate: BrainGate
  onDecided: () => void
  onOutcome: (outcome: DecisionOutcome) => void
}) {
  const meta = gateMeta(gate)
  const { Icon } = meta

  const [selected, setSelected] = useState<string[]>(() => defaultSelection(gate))
  const [note, setNote] = useState('')
  // Blank means "at the amount proposed". Kept as a string so a half-typed value does not
  // momentarily read as a different number.
  const [amount, setAmount] = useState('')
  const [pending, setPending] = useState<BrainGateActionKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The raw reason a decision failed to save — Details only.
  const [errorRaw, setErrorRaw] = useState<string | null>(null)

  const selectable = gate.selection !== 'none'

  function toggle(id: string) {
    setSelected((current) => {
      if (gate.selection === 'single') return current[0] === id ? [] : [id]
      return current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    })
  }

  async function decide(action: BrainGateActionKey, requiresNote: boolean) {
    if (requiresNote && !note.trim()) {
      setError('Write a note first — it tells the Brain what to change.')
      setErrorRaw(null)
      return
    }
    if (action === 'approve' && selectable && selected.length === 0) {
      setError('Pick at least one before approving.')
      setErrorRaw(null)
      return
    }

    const typed = amount.trim()
    const overrideInr = typed === '' ? undefined : Number(typed)
    if (overrideInr !== undefined && (!Number.isFinite(overrideInr) || overrideInr < 0)) {
      setError('Enter the daily amount as a number, like 5000.')
      setErrorRaw(null)
      return
    }

    setPending(action)
    setError(null)
    setErrorRaw(null)
    try {
      const amountInr = action === 'approve' ? overrideInr : undefined
      const result = await decideBrainGate(tenantId, gate.gateId, {
        action,
        note: note.trim() || undefined,
        selectedIds: selectable ? selected : undefined,
        // Only on approve: an amount attached to a rejection would record a number nobody authorised.
        amountOverrideInr: amountInr,
      })
      if (amountInr !== undefined) {
        onOutcome({
          gateId: gate.gateId,
          title: gate.title,
          spendGate: gate.spendGate ?? (gate.kind === 'plan_approval' ? 'plan' : null),
          amountInr,
          result,
        })
      }
      onDecided()
    } catch (err) {
      setError("We couldn't save your answer. Try again.")
      setErrorRaw(errorDetail(err) || null)
      setPending(null)
    }
  }

  return (
    <section className="card animate-reveal-up overflow-hidden">
      <header
        className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5"
        style={{ background: 'var(--surface-warm)', borderBottom: '1px solid var(--hairline)' }}
      >
        <div className="flex min-w-0 gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--surface)', color: 'var(--accent-strong)', border: '1px solid var(--accent-border)' }}
          >
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className={`chip ${meta.chip}`} title={meta.meaning || undefined}>
                {meta.label}
              </span>
              {gate.product && (
                <span className="chip chip-neutral max-w-full truncate" title={gate.product}>
                  {gate.product}
                </span>
              )}
              {gate.expiresAt && (
                <span className="chip chip-neutral" title={formatWhen(gate.expiresAt)}>
                  <Clock3 size={11} aria-hidden="true" /> Answer {formatRelative(gate.expiresAt)}
                </span>
              )}
            </div>
            <h2 className="section-title break-words">{cleanGateText(gate.title) || meta.label}</h2>
            {/* A plan gate shows its own card below; every other gate's summary can still carry the
                Slack reply grammar and [H…] ids, so it is cleaned the same way. */}
            {gate.kind !== 'plan_approval' && (
              <div className="explain mt-1 max-w-[72ch]">
                {cleanGateText(gate.summary)
                  .split('\n')
                  .map((line, index) => (
                    <p key={index} className="break-words">
                      {line}
                    </p>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 sm:text-right">
          <p className="micro-label">Asked by</p>
          <p className="break-words text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            {gate.askedBy}
          </p>
          <p className="explain" title={formatWhen(gate.askedAt)}>
            {formatRelative(gate.askedAt)}
          </p>
          {gate.slackChannel && (
            <p className="explain mt-1 flex flex-wrap items-center gap-1 sm:justify-end">
              <MessageSquare size={11} aria-hidden="true" /> also in Slack{' '}
              <span className="break-all">{gate.slackChannel}</span>
            </p>
          )}
        </div>
      </header>

      <div className="min-w-0 p-4 sm:p-5">
        <GatePayload gate={gate} selected={selected} onToggle={toggle} />
        {gate.kind !== 'plan_approval' && (
          <Details
            className="mt-4"
            reference={gate.gateId}
            items={gate.pipelineRunId ? [{ label: 'Campaign reference', value: gate.pipelineRunId }] : undefined}
          />
        )}
      </div>

      <footer
        className="flex flex-col gap-3 px-4 py-4 sm:px-5"
        style={{ background: 'var(--surface-warm)', borderTop: '1px solid var(--hairline)' }}
      >
        {/* Slack has always accepted `approve at <amount>`; the console had no equivalent, so an
            operator who wanted a different number either accepted the proposed one or changed it
            somewhere the record would never show. Spend gates only — there is no amount to
            override on a creative or idea gate. */}
        {(gate.kind === 'plan_approval' || gate.kind === 'campaign_launch') && (
          <label className="block">
            <span className="micro-label">Approve at a different daily amount</span>
            <span className="mt-1.5 flex min-w-0 items-center gap-2">
              <span className="text-[15px] font-semibold" style={{ color: 'var(--ink-3)' }}>₹</span>
              <input
                className="input min-w-0"
                type="number"
                min={0}
                step={500}
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Leave blank to keep the suggested amount"
                disabled={pending != null}
              />
              <span className="explain shrink-0">per day</span>
            </span>
            <span className="explain mt-1 block">{amountHelp(gate)}</span>
          </label>
        )}

        <label className="block">
          <span className="micro-label">Note to the Brain</span>
          <textarea
            className="input mt-1.5"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              gate.kind === 'creative_craft'
                ? 'What should change in the revision? e.g. “Drop the portrait — the copy promises an expert the image never shows.”'
                : 'Optional when approving. Needed when you send it back or say no.'
            }
            disabled={pending != null}
          />
        </label>

        {error && (
          <div role="alert" className="flex min-w-0 flex-col gap-1">
            <p
              className="flex items-center gap-2 break-words text-[13px] font-semibold"
              style={{ color: 'var(--bad)' }}
            >
              <TriangleAlert size={14} aria-hidden="true" className="shrink-0" /> {error}
            </p>
            {errorRaw && <Details items={[{ label: 'What went wrong', value: errorRaw }]} />}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {gate.actions.map((action) => {
            const busy = pending === action.key
            const cls =
              action.tone === 'primary'
                ? 'btn btn-accent'
                : action.tone === 'danger'
                  ? 'btn btn-danger'
                  : 'btn btn-ghost'

            return (
              <button
                key={action.key}
                type="button"
                className={cls}
                disabled={pending != null}
                onClick={() => void decide(action.key, action.requiresNote)}
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : action.key === 'approve' ? (
                  <CircleCheck size={14} aria-hidden="true" />
                ) : action.key === 'reject' ? (
                  <XCircle size={14} aria-hidden="true" />
                ) : (
                  <MessageSquare size={14} aria-hidden="true" />
                )}
                {action.label}
                {action.key === 'approve' && gate.selection === 'multiple' && selected.length > 0
                  ? ` (${selected.length})`
                  : ''}
              </button>
            )
          })}
        </div>
      </footer>
    </section>
  )
}

/**
 * What "approve at <amount>" will actually do on THIS gate, in one sentence.
 *
 * It differs by gate type, and the brain is precise about it: a build gate's amount rescales the
 * run's contract; a plan gate's only when the gate names exactly one run (otherwise it could be the
 * day's total or one launch's budget, and the brain refuses to guess); a launch gate's is applied by
 * the Launcher to the live Meta ad-set budget at activation. Saying anything vaguer here would let
 * an operator believe a number moved money when it did not — or the reverse.
 */
function amountHelp(gate: BrainGate): string {
  const spend = gate.spendGate ?? (gate.kind === 'plan_approval' ? 'plan' : null)
  switch (spend) {
    case 'plan':
      return gate.pipelineRunId
        ? 'This plan is for one campaign, so its audiences are adjusted to add up to your amount, ' +
            'and the campaign is set up at that amount.'
        : "This plan covers more than one campaign, so your amount is noted but doesn't change " +
            "any campaign's budget — it could mean the day's total or one campaign's, and the Brain " +
            "won't guess. To change one campaign's budget, enter the amount when you approve its set-up."
    case 'build':
      return (
        "The campaign's audiences are adjusted to add up to this amount, and it is set up at it. " +
        "If one audience ends up above Meta's daily limit for it, you'll see that once you approve."
      )
    case 'launch':
      return "When the campaign is switched on, its daily budget in Meta is set to this amount."
    case 'scale':
      return "Your amount is noted. What the Brain did with it shows once you approve."
    default:
      return (
        'What this amount changes depends on the request: before set-up it adjusts the audiences; ' +
        "at switch-on it sets the daily budget in Meta. What the Brain did shows once you approve."
      )
  }
}

/**
 * The answer to "what did my amount do?", straight from `approval_record` — rescaled contracts,
 * the reason nothing was rescaled, or an honest "not reported" from an older bridge.
 */
function DecisionOutcomes({
  outcomes,
  onDismiss,
}: {
  outcomes: DecisionOutcome[]
  onDismiss: (gateId: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {outcomes.map((outcome) => {
        const lines = describeOutcome(outcome)
        const warn = lines.some((line) => line.tone === 'warn')
        return (
          <div
            key={outcome.gateId}
            role="status"
            className="flex flex-wrap items-start gap-3 rounded-xl px-4 py-3 sm:flex-nowrap"
            style={{
              background: warn ? 'var(--warn-bg)' : 'var(--surface-warm)',
              border: `1px solid ${warn ? 'var(--warn-border)' : 'var(--hairline)'}`,
            }}
          >
            {warn ? (
              <TriangleAlert size={16} aria-hidden="true" style={{ color: 'var(--warn)', marginTop: 2 }} />
            ) : (
              <CircleCheck size={16} aria-hidden="true" style={{ color: 'var(--good)', marginTop: 2 }} />
            )}
            <div className="min-w-0 flex-1">
              <p className="break-words text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                Approved at {formatInr(outcome.amountInr ?? 0, { perDay: true })} —{' '}
                {cleanGateText(outcome.title)}
              </p>
              {lines.map((line, index) => (
                <p key={index} className="explain mt-1 break-words" style={{ color: 'var(--ink-2)' }}>
                  {line.text}
                </p>
              ))}
              {(outcome.result.budgetRescale?.length ?? 0) > 0 && (
                <Details
                  className="mt-2"
                  reference={outcome.gateId}
                  items={(outcome.result.budgetRescale ?? []).map((r, index) => ({
                    label: `Campaign ${index + 1} reference`,
                    value: r.pipelineRunId,
                  }))}
                />
              )}
            </div>
            <button type="button" className="btn btn-ghost shrink-0" onClick={() => onDismiss(outcome.gateId)}>
              Dismiss
            </button>
          </div>
        )
      })}
    </div>
  )
}

function describeOutcome(outcome: DecisionOutcome): Array<{ text: string; tone: 'ok' | 'warn' }> {
  const { result, spendGate, amountInr } = outcome
  const lines: Array<{ text: string; tone: 'ok' | 'warn' }> = []
  const rescales = result.budgetRescale ?? []
  rescales.forEach((r, index) => {
    // Campaign references live in Details; on screen a campaign is "This campaign" or "Campaign 2".
    const which = rescales.length === 1 ? 'This campaign' : `Campaign ${index + 1}`
    if (r.rescaled) {
      lines.push({
        tone: 'ok',
        text:
          `${which}: audience budgets adjusted` +
          (r.contractTotalBeforeInr !== null ? ` from ${formatInr(r.contractTotalBeforeInr)}` : '') +
          (r.contractTotalInr !== null ? ` to ${formatInr(r.contractTotalInr, { perDay: true })}` : '') +
          '. It will be set up at this amount.',
      })
    } else {
      lines.push({
        tone: 'warn',
        text:
          `${which} is now approved at ${formatInr(r.authorisedDailyBudgetInr ?? amountInr ?? 0, { perDay: true })}, ` +
          `but its audience budgets were not adjusted${r.why ? `: ${r.why}` : ''}.`,
      })
    }
    if (r.exceedsAdsetCap) {
      lines.push({
        tone: 'warn',
        text:
          `Above Meta's ${r.exceedsAdsetCap.capInr !== null ? formatInr(r.exceedsAdsetCap.capInr) + ' ' : ''}` +
          `daily limit per audience: ${r.exceedsAdsetCap.entries.join(', ') || 'one or more audiences'}. ` +
          (r.exceedsAdsetCap.note ?? 'Meta will refuse it as it stands.'),
      })
    }
  })
  if (result.budgetRescaleSkipped) {
    lines.push({ tone: 'warn', text: `No campaign's budget was changed: ${result.budgetRescaleSkipped}` })
  }
  if (lines.length === 0) {
    if (spendGate === 'launch') {
      lines.push({
        tone: 'ok',
        text: "Saved. When the campaign is switched on, its daily budget in Meta is set to this amount.",
      })
    } else if (result.budgetRescale === undefined || result.budgetRescale === null) {
      lines.push({
        tone: 'warn',
        text: "Saved, but we couldn't confirm what the Brain did with the amount.",
      })
    } else {
      lines.push({ tone: 'ok', text: "Saved. The Brain didn't change any campaign's budget for this." })
    }
  }
  return lines
}

function defaultSelection(gate: BrainGate): string[] {
  // Pre-select what the agent itself judged fit. The operator is confirming a
  // recommendation, not doing the Curator's job again — but every box is still
  // theirs to change.
  if (gate.payload.kind === 'creative_craft') {
    return gate.payload.creatives.filter((c) => c.verdict === 'fit').map((c) => c.id)
  }
  return []
}

function GatePayload({
  gate,
  selected,
  onToggle,
}: {
  gate: BrainGate
  selected: string[]
  onToggle: (id: string) => void
}) {
  switch (gate.payload.kind) {
    case 'creative_craft':
      return (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {gate.payload.creatives.map((creative) => (
            <li key={creative.id}>
              <CreativeCard
                creative={creative}
                checked={selected.includes(creative.id)}
                onToggle={() => onToggle(creative.id)}
              />
            </li>
          ))}
        </ul>
      )
    case 'idea_selection':
      return (
        <ul className="flex flex-col gap-2.5">
          {gate.payload.ideas.map((idea) => (
            <li key={idea.id}>
              <IdeaRow
                idea={idea}
                checked={selected.includes(idea.id)}
                onToggle={() => onToggle(idea.id)}
              />
            </li>
          ))}
        </ul>
      )
    case 'campaign_launch':
      return <CampaignPreview campaign={gate.payload.campaign} />
    case 'plan_approval':
      return <PlanCard gate={gate} plan={gate.payload.plan} />
  }
}

/**
 * The day's spend plan, as facts.
 *
 * `gate.plan` is built by the bridge from the brain's own rows — the day plan, the runs this gate
 * releases and what their decisions test — never parsed from the Slack message. When those rows
 * could not be read (or the bridge is older and sends no `plan`), the gate's text is shown instead,
 * cleaned of the Slack reply grammar and internal ids, as plain paragraphs rather than a raw block.
 */
function PlanCard({ gate, plan }: { gate: BrainGate; plan: BrainGatePlan }) {
  const view = gate.plan ?? null
  const dateLabel = view?.dateLabel ?? (plan.planDate ? formatWhen(plan.planDate) : null)
  const fallbackText = view?.summaryText ?? cleanGateText(plan.summary || gate.summary)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {dateLabel && <span className="chip chip-neutral">{dateLabel}</span>}
        {plan.budgetInr !== null && (
          <span className="chip chip-neutral">You set {formatInr(plan.budgetInr, { perDay: true })}</span>
        )}
        {!plan.posted && (
          <span
            className="chip chip-warn"
            title="This has not been posted to Slack yet. Deciding here closes it."
          >
            Not in Slack yet
          </span>
        )}
      </div>

      {view?.structured ? (
        <>
          {view.totalDailyInr !== null && (
            <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                {formatInr(view.totalDailyInr, { perDay: true })}
              </span>
              {view.budgetInr !== null && <> of the {formatInr(view.budgetInr)} daily budget</>}
              {view.unspentInr !== null && view.unspentInr > 0 && (
                <> · {formatInr(view.unspentInr)} left unspent</>
              )}
            </p>
          )}

          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
              Campaigns this approves
            </p>
            {view.runs.length === 0 ? (
              <p className="explain">No campaigns are attached to this plan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col">Type</th>
                      <th scope="col">Daily budget</th>
                      <th scope="col">Ads</th>
                      <th scope="col">Ad sets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.runs.map((run, index) => (
                      <tr key={`${run.product}-${index}`}>
                        <td className="max-w-[16rem] truncate" title={run.product}>
                          {run.product}
                        </td>
                        <td>{run.typeLabel}</td>
                        <td className="tabular-nums">{formatInr(run.dailyBudgetInr)}</td>
                        <td className="tabular-nums">{run.creatives ?? '—'}</td>
                        <td className="tabular-nums">{run.adSets ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {view.testing.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
                What it will test{view.mix ? ` · ${view.mix}` : ''}
              </p>
              <ul className="flex min-w-0 flex-col gap-2">
                {view.testing.map((t, index) => (
                  <li
                    key={`${t.claim}-${index}`}
                    className="flex min-w-0 flex-col gap-1.5 rounded-xl p-3"
                    style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}
                  >
                    <span className="flex min-w-0 flex-wrap gap-1.5">
                      <span className={`chip ${toneChip(plainStatus('experimentKind', kindKey(t.kindLabel)).tone)}`}>
                        {t.kindLabel}
                      </span>
                      {t.product && <span className="chip chip-neutral">{t.product}</span>}
                    </span>
                    <span className="break-words text-sm" style={{ color: 'var(--ink-2)' }}>
                      {t.claim}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view.why && (
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
                Why
              </p>
              <p className="break-words text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {view.why}
              </p>
            </div>
          )}
        </>
      ) : (
        <div
          className="flex min-w-0 flex-col gap-1.5 rounded-xl p-4 text-sm"
          style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}
        >
          {fallbackText ? (
            fallbackText.split('\n').map((line, index) => (
              <p key={index} className="break-words">
                {line}
              </p>
            ))
          ) : (
            <p>The Brain did not write a summary for this plan.</p>
          )}
        </div>
      )}

      <Details reference={gate.gateId} />
    </div>
  )
}

/** The label the bridge sends back to the vocabulary key, only to pick a chip colour. */
function kindKey(label: string): string {
  if (label.startsWith('Proven')) return 'proven'
  if (label.startsWith('New twist')) return 'variant'
  if (label.startsWith('Exploring')) return 'seed'
  return label
}

/**
 * For a bridge too old to send `plan.summaryText`: drop the Slack "Reply: …" line and the internal
 * ids ([H123], → H45, Run #94) the gate text carries.
 */
function cleanGateText(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*Reply\s*:/i.test(line))
    .map((line) =>
      line
        .replace(/\[(?:H\d+|not opened)\]/g, '')
        .replace(/\s*(?:→|->)\s*H\d+\b/g, '')
        .replace(/\bH\d+\b/g, '')
        .replace(/\bRun\s*#\d+\s*/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n')
}

function CreativeCard({
  creative,
  checked,
  onToggle,
}: {
  creative: BrainGateCreative
  checked: boolean
  onToggle: () => void
}) {
  const verdict = verdictMeta(creative.verdict)

  return (
    <label
      className="card-hover flex h-full min-w-0 cursor-pointer flex-col gap-3 rounded-xl p-3.5"
      style={{
        background: 'var(--surface)',
        border: checked ? '1px solid var(--accent)' : '1px solid var(--hairline)',
        boxShadow: checked ? 'var(--glow-accent)' : undefined,
      }}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-4 w-4 shrink-0"
          style={{ accentColor: 'var(--accent)' }}
          aria-label={`Select ${creative.label}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[13.5px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
            {creative.label}
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            <span className={`chip ${verdict.chip}`} title={verdict.meaning || undefined}>
              {verdict.label}
            </span>
            {creative.language && <span className="chip chip-neutral">{creative.language}</span>}
          </span>
        </span>
      </div>

      {/* The real image lands here once the bridge serves it; until then the slot
          is a labelled placeholder, never a broken <img>. */}
      <div
        className="flex aspect-[4/5] w-full items-center justify-center rounded-[10px]"
        style={{ background: 'var(--muted)', border: '1px dashed var(--hairline-strong)' }}
      >
        {creative.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.imageUrl}
            alt={creative.label}
            className="h-full w-full max-w-full rounded-[10px] object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-3 text-center">
            <ImageIcon size={18} aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
            <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              {creative.format}
            </span>
          </span>
        )}
      </div>

      <p className="break-words text-[13px] leading-snug" style={{ color: 'var(--ink-2)' }}>
        {creative.copy}
      </p>

      {creative.rubric.length > 0 && (
        <ul className="flex flex-col gap-1 border-t pt-2.5" style={{ borderColor: 'var(--hairline-light)' }}>
          <li className="micro-label">How the ad checker scored it</li>
          {creative.rubric.map((line) => (
            <li key={line.criterion}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 break-words text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                  {plainCode(line.criterion)}
                </span>
                <span
                  className="shrink-0 text-[11.5px] font-bold tabular-nums"
                  style={{ color: line.score >= 4 ? 'var(--good)' : line.score >= 3 ? 'var(--warn)' : 'var(--bad)' }}
                >
                  {line.score}/5
                </span>
              </div>
              {line.note && (
                <p className="break-words text-[11px] leading-snug" style={{ color: 'var(--ink-4)' }}>
                  {line.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </label>
  )
}

function IdeaRow({
  idea,
  checked,
  onToggle,
}: {
  idea: BrainIdea
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label
      className="flex min-w-0 cursor-pointer items-start gap-3 rounded-xl px-3.5 py-3"
      style={{
        background: 'var(--surface)',
        border: checked ? '1px solid var(--accent)' : '1px solid var(--hairline)',
        boxShadow: checked ? 'var(--glow-accent)' : undefined,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 h-4 w-4 shrink-0"
        style={{ accentColor: 'var(--accent)' }}
        aria-label={`Select ${idea.title}`}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {idea.title}
          </span>
          <span className="chip chip-neutral">{idea.product}</span>
          <span className="chip chip-accent">{plainCode(idea.angle)}</span>
        </span>
        <span className="explain mt-1 block break-words">{idea.rationale}</span>
      </span>
    </label>
  )
}

function CampaignPreview({ campaign }: { campaign: BrainGateCampaign }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="card-inset min-w-0 p-4">
          <p className="micro-label">Campaign</p>
          <p className="mt-1 break-words text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            {campaign.name}
          </p>

          <dl className="mt-4 flex flex-col gap-3">
            <Row label="Goal" value={plainIfCode(campaign.objective, 'objective')} />
            <Row label="Daily budget" value={formatInr(campaign.dailyBudget, { perDay: true })} />
            <Row label="Audience" value={campaign.audience} />
            <Row label="Placements" value={campaign.placements} />
          </dl>
        </div>

        <div className="card-inset min-w-0 p-4">
          <p className="micro-label">What is already set up in Meta</p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {campaign.levels.map((level) => (
              <li key={level.label} className="flex items-baseline justify-between gap-3">
                <span className="shrink-0 text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                  {level.label}
                </span>
                <span className="min-w-0 text-right">
                  <span className="block break-words text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {plainMetaWords(level.value)}
                  </span>
                  {level.note && (
                    <span className="block break-words text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      {level.note}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <p className="micro-label mt-4">Safety checks</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {campaign.checks.map((check) => (
              <li key={check.label} className="flex items-start gap-2">
                {check.passed ? (
                  <CircleCheck size={14} aria-hidden="true" style={{ color: 'var(--good)', marginTop: 2, flexShrink: 0 }} />
                ) : (
                  <TriangleAlert size={14} aria-hidden="true" style={{ color: 'var(--warn)', marginTop: 2, flexShrink: 0 }} />
                )}
                <span className="min-w-0">
                  <span className="block break-words text-[12.5px] font-medium" style={{ color: 'var(--ink-2)' }}>
                    {check.label}
                  </span>
                  {check.note && (
                    <span className="block break-words text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      {check.note}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="micro-label mb-2">Ads that will go live</p>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {campaign.creatives.map((creative) => (
            <li key={creative.id}>
              <div
                className="flex gap-3 rounded-xl p-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
              >
                <div
                  className="flex h-16 w-14 shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: 'var(--muted)', border: '1px dashed var(--hairline-strong)' }}
                >
                  <ImageIcon size={16} aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
                </div>
                <div className="min-w-0">
                  <p className="break-words text-[13px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                    {creative.label}
                  </p>
                  <p className="mt-1 break-words text-[12px] leading-snug" style={{ color: 'var(--ink-2)' }}>
                    {creative.copy}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
        {label}
      </dt>
      <dd
        className="min-w-0 max-w-[38ch] break-words text-right text-[12.5px] font-semibold"
        style={{ color: 'var(--ink)' }}
      >
        {value}
      </dd>
    </div>
  )
}
