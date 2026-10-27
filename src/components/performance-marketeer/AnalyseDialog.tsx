'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Sparkles, X } from 'lucide-react'
import { PM_QUEUE_MAX, enqueuePmAgent, getPmAgentQueue, istToday, istYesterday } from '@/lib/performance-marketeer-api'
import type { PmAgentEnqueueResult } from '@/types/performance-marketeer'
import { fmt, serverMessage, useLoad } from './shared'

export type AnalyseTarget = { id: string; name: string }

/** The per-row / toolbar / panel trigger. Always labelled, never hover-only. */
export function AnalyseButton({ name, onClick, compact }: { name?: string; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      className={`btn btn-ghost ${compact ? '!min-h-[34px] !px-2.5 !py-1.5 text-[13px]' : ''}`}
      aria-label={name ? `Analyse ${name} with AI` : undefined}
      onClick={onClick}
    >
      <Sparkles size={15} aria-hidden="true" />
      {compact ? 'Analyse' : 'Analyse with AI'}
    </button>
  )
}

/**
 * In-page confirm before queueing AI runs (each one costs real API credits).
 * Mount it with `key` tied to the target list so every open starts fresh.
 */
export function AnalyseDialog({
  tenantId,
  campaigns,
  onClose,
  onOpenAgent,
}: {
  tenantId: string
  campaigns: AnalyseTarget[] | null
  onClose: () => void
  onOpenAgent: () => void
}) {
  return (
    <Dialog.Root open={!!campaigns?.length} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay data-portal className="fixed inset-0 z-[70] animate-fade-in" style={{ background: 'rgba(15,23,42,0.45)' }} />
        <Dialog.Content
          data-portal
          className="fixed left-1/2 top-1/2 z-[71] flex max-h-[85dvh] w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto overscroll-contain rounded-2xl animate-fade-in"
          style={{ background: 'var(--paper)', boxShadow: 'var(--shadow-overlay)' }}
        >
          {campaigns?.length ? <Body tenantId={tenantId} campaigns={campaigns} onClose={onClose} onOpenAgent={onOpenAgent} /> : null}
          <Dialog.Close asChild>
            <button type="button" className="btn btn-ghost absolute right-3 top-3 !min-h-[36px] !px-2" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Body({ tenantId, campaigns, onClose, onOpenAgent }: { tenantId: string; campaigns: AnalyseTarget[]; onClose: () => void; onOpenAgent: () => void }) {
  const today = istToday()
  // Today's queue tells us which campaigns already have a run today (→ offer "Run again").
  const queue = useLoad(`analyse-queue${today}`, () => getPmAgentQueue(tenantId, today))
  const qd = queue.data
  const status = new Map<string, string>([
    ...(qd?.finished ?? []).map((x) => [x.campaignId, x.status] as const),
    ...(qd?.queued ?? []).filter((x) => x.date === today).map((x) => [x.campaignId, 'queued'] as const),
    ...(qd?.running ?? []).filter((x) => x.date === today).map((x) => [x.campaignId, 'running'] as const),
  ])
  const done = campaigns.filter((c) => status.get(c.id) === 'done' || status.get(c.id) === 'failed')
  const inLine = campaigns.filter((c) => status.get(c.id) === 'queued' || status.get(c.id) === 'running')
  const [rerun, setRerun] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PmAgentEnqueueResult | null>(null)
  const name = (id: string) => campaigns.find((c) => c.id === id)?.name ?? id
  const n = campaigns.length
  const word = n === 1 ? 'campaign' : 'campaigns'

  async function send(ids: string[], again: boolean) {
    setSending(true)
    setError('')
    try {
      const r = await enqueuePmAgent(tenantId, { campaignIds: ids, ...(again ? { rerun: true } : {}) })
      // A "Run again" follow-up merges into the first result instead of replacing it.
      setResult((prev) => (prev ? { queued: [...prev.queued, ...r.queued], skipped: [...prev.skipped.filter((s) => !ids.includes(s.campaignId)), ...r.skipped] } : r))
    } catch (err) {
      setError(`Couldn’t queue the analysis: ${serverMessage(err)}`)
    } finally {
      setSending(false)
    }
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void send(campaigns.map((c) => c.id), rerun)
  }

  // The server says when a campaign already has today's result; those can be re-run on request.
  const analysed = (result?.skipped ?? []).filter((s) => s.reason.startsWith('already analysed')).map((s) => s.campaignId)

  if (result)
    return (
      <div className="flex flex-col gap-4 p-5 pt-6">
        <Dialog.Title className="section-title pr-10 text-pretty">
          {result.queued.length ? `Queued ${result.queued.length} of ${n} ${word}` : `Nothing queued`}
        </Dialog.Title>
        <Dialog.Description className="explain" aria-live="polite">
          {result.queued.length ? 'Runs start one after another. Follow progress in the AI Analyst tab — results appear there when each one finishes.' : 'Every campaign was skipped — see the reasons below.'}
        </Dialog.Description>
        {result.queued.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {result.queued.map((id) => (
              <li key={id} className="flex min-w-0 items-start gap-2 text-[13.5px]">
                <span className="chip chip-good shrink-0">Queued</span>
                <span className="min-w-0 break-words">{name(id)}</span>
              </li>
            ))}
          </ul>
        )}
        {result.skipped.length > 0 && (
          <ul className="flex flex-col gap-1.5" aria-label="Skipped">
            {result.skipped.map((s) => (
              <li key={s.campaignId} className="flex min-w-0 items-start gap-2 text-[13.5px]">
                <span className="chip chip-neutral shrink-0">Skipped</span>
                <span className="min-w-0 break-words">
                  {name(s.campaignId)} <span style={{ color: 'var(--ink-3)' }}>— {s.reason.startsWith('already analysed') ? 'already analysed today — use Run Again to replace it' : s.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p aria-live="polite" className="text-[13px] empty:hidden" style={{ color: 'var(--bad)' }}>
          {error}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          {analysed.length > 0 && (
            <button type="button" className="btn btn-ghost" disabled={sending} onClick={() => send(analysed, true)}>
              {sending ? 'Queueing…' : `Run Again (${analysed.length})`}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <a
            href="?tab=agent"
            className="btn btn-primary"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              onOpenAgent()
            }}
          >
            Open AI Analyst
          </a>
        </div>
      </div>
    )

  return (
    <form className="flex flex-col gap-4 p-5 pt-6" onSubmit={submit}>
      <Dialog.Title className="section-title pr-10 text-pretty">
        Analyse {n} {word} with AI?
      </Dialog.Title>
      <Dialog.Description className="explain">
        Each analysis runs Claude Opus for several minutes and uses API credits. Data is analysed up to yesterday ({fmt.date(istYesterday())}).
      </Dialog.Description>
      <ul className="flex max-h-[240px] flex-col gap-1.5 overflow-y-auto rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}>
        {campaigns.map((c) => {
          const s = status.get(c.id)
          return (
            <li key={c.id} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
              <span className="min-w-0 break-words font-semibold">{c.name}</span>
              {s === 'done' && <span className="chip chip-good">Analysed today</span>}
              {s === 'failed' && <span className="chip chip-bad">Failed today</span>}
              {s === 'queued' && <span className="chip chip-neutral">Already queued</span>}
              {s === 'running' && <span className="chip chip-info">Running now</span>}
            </li>
          )
        })}
      </ul>
      {queue.loading && !queue.data && <p className="explain">Checking today’s runs…</p>}
      {done.length > 0 && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px]" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
          <input type="checkbox" name="rerun" checked={rerun} onChange={(e) => setRerun(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: 'var(--accent)' }} />
          <span className="min-w-0">
            <strong>Run again</strong> — {done.length === 1 ? '1 campaign was' : `${done.length} campaigns were`} already analysed today. Leave unticked to skip {done.length === 1 ? 'it' : 'them'} and keep today’s result.
          </span>
        </label>
      )}
      {inLine.length > 0 && <p className="explain">{inLine.length === 1 ? '1 campaign is' : `${inLine.length} campaigns are`} already in today’s queue and will be skipped.</p>}
      {n > PM_QUEUE_MAX && <p className="explain" style={{ color: 'var(--bad)' }}>Pick at most {PM_QUEUE_MAX} campaigns at a time.</p>}
      <p aria-live="polite" className="text-[13px] empty:hidden" style={{ color: 'var(--bad)' }}>
        {error}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Dialog.Close asChild>
          <button type="button" className="btn btn-ghost">
            Cancel
          </button>
        </Dialog.Close>
        <button type="submit" className="btn btn-primary" disabled={sending || n > PM_QUEUE_MAX}>
          <Sparkles size={15} aria-hidden="true" />
          {sending ? 'Queueing…' : `Analyse ${n} ${n === 1 ? 'Campaign' : 'Campaigns'}`}
        </button>
      </div>
    </form>
  )
}
