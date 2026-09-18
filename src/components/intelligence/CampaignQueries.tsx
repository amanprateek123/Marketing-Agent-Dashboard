'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Database,
  Loader2,
  Search,
  Send,
  Target,
} from 'lucide-react'
import { askCampaignInsights, getInsightCampaigns } from '@/lib/api'
import type {
  InsightsCampaignOption,
  InsightsCampaignSnapshot,
  InsightsResolvedContext,
} from '@/types/campaign-insights'

/**
 * Copilot "Queries" mode — ask about campaigns that already ran.
 *
 * The whole point of the right-hand panel is verification: before trusting an
 * answer, the operator can see exactly which campaign was read, how it was
 * chosen, how many ad groups and ads were included, and what is wrong with the
 * data. An answer about the wrong campaign should be obvious at a glance.
 */

interface QueryTurn {
  role: 'user' | 'assistant'
  content: string
  /** Context captured at answer time, so scrolling back stays truthful. */
  context?: InsightsResolvedContext
}

const STARTERS = [
  'Which ad is performing best, and which should I turn off?',
  'Why is this campaign losing money?',
  'Which audience is wasting the most budget?',
]

function rupees(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function StatusChip({ value }: { value: string }) {
  const v = value.toLowerCase()
  const cls =
    v === 'active' ? 'chip-good' : v === 'paused' ? 'chip-warn' : 'chip-neutral'
  return <span className={`chip ${cls}`} style={{ fontSize: '9.5px', padding: '1px 6px' }}>{value}</span>
}

// ── right panel: what the assistant is actually reading ──────────────────────

function ReadingPanel({
  context,
  pinned,
  options,
  onPin,
  loadingOptions,
}: {
  context: InsightsResolvedContext | null
  pinned: InsightsCampaignOption | null
  options: InsightsCampaignOption[]
  onPin: (c: InsightsCampaignOption | null) => void
  loadingOptions: boolean
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'dashboard' | 'manual'>('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return options
      .filter((c) => (statusFilter === 'all' ? true : c.status === statusFilter))
      .filter((c) =>
        sourceFilter === 'all'
          ? true
          : sourceFilter === 'manual'
            ? c.source === 'manual'
            : c.source === 'agent' || c.source === 'human',
      )
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .slice(0, 40)
  }, [options, search, statusFilter, sourceFilter])

  const campaign: InsightsCampaignSnapshot | null = context?.campaign ?? null

  return (
    <aside className="space-y-3 xl:sticky xl:top-6" aria-label="What this answer is based on">
      <div className="card overflow-hidden">
        <div
          className="px-4 py-3"
          style={{ background: 'var(--surface-warm)', borderBottom: '1px solid var(--hairline-light)' }}
        >
          <p className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: 'var(--ink)' }}>
            <Target size={13} aria-hidden="true" style={{ color: 'var(--accent)' }} />
            What I&rsquo;m looking at
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-3)' }}>
            Check this matches the campaign you meant.
          </p>
        </div>

        <div className="p-4">
          {campaign ? (
            <>
              <p className="text-[13.5px] font-bold leading-snug" style={{ color: 'var(--ink)' }}>
                {campaign.name}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusChip value={campaign.status} />
                {campaign.source === 'manual' ? (
                  <span className="chip chip-neutral" style={{ fontSize: '9.5px', padding: '1px 6px' }}>Built in Meta</span>
                ) : (
                  <span className="chip chip-accent" style={{ fontSize: '9.5px', padding: '1px 6px' }}>Built in Meridian</span>
                )}
              </div>

              {context && (
                <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                  {context.resolutionNote}
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--surface-warm)' }}>
                  <p className="text-[10px] font-semibold" style={{ color: 'var(--ink-3)' }}>Spent</p>
                  <p className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{rupees(campaign.spend)}</p>
                </div>
                <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--surface-warm)' }}>
                  <p className="text-[10px] font-semibold" style={{ color: 'var(--ink-3)' }}>Back per ₹1</p>
                  <p
                    className="text-[13px] font-bold tabular-nums"
                    style={{
                      color:
                        campaign.roas === null || campaign.breakevenRoas === null
                          ? 'var(--ink)'
                          : campaign.roas >= campaign.breakevenRoas
                            ? 'var(--good)'
                            : 'var(--bad)',
                    }}
                  >
                    {campaign.roas === null ? '—' : `₹${campaign.roas.toFixed(2)}`}
                  </p>
                </div>
              </div>
              {campaign.breakevenRoas !== null && (
                <p className="mt-1.5 text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  Needs ₹{campaign.breakevenRoas.toFixed(2)} per ₹1 to break even.
                </p>
              )}

              {context && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  <Database size={11} aria-hidden="true" />
                  Reading {context.coverage.adSetsRead} ad group
                  {context.coverage.adSetsRead === 1 ? '' : 's'} and {context.coverage.adsRead} ad
                  {context.coverage.adsRead === 1 ? '' : 's'}
                </p>
              )}

              {context && context.caveats.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {context.caveats.map((c) => (
                    <li
                      key={c}
                      className="flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11.5px] leading-relaxed"
                      style={{ background: 'var(--warn-bg)', color: 'var(--ink-2)', border: '1px solid var(--warn-border)' }}
                    >
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" style={{ color: 'var(--warn)' }} />
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
              {context?.resolutionNote ??
                'Ask a question, or pick a campaign below so I know what you mean.'}
            </p>
          )}

          {context && context.resolvedBy === 'unresolved' && context.alternatives.length > 0 && (
            <div className="mt-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
                Did you mean
              </p>
              <div className="mt-1.5 space-y-1">
                {context.alternatives.map((a) => (
                  <button
                    key={a.campaignId}
                    type="button"
                    onClick={() =>
                      onPin({
                        campaignId: a.campaignId,
                        name: a.name,
                        status: a.status,
                        source: 'unknown',
                        objective: null,
                        spend: 0,
                      })
                    }
                    className="w-full rounded-lg px-2.5 py-1.5 text-left text-[11.5px] transition-colors hover:bg-[var(--accent-bg)]"
                    style={{ color: 'var(--ink-2)', border: '1px solid var(--hairline-light)' }}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Campaign picker — pin one so every answer is about the same thing */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline-light)' }}>
          <p className="text-[12px] font-bold" style={{ color: 'var(--ink)' }}>Pin a campaign</p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {pinned ? 'Every question stays on this campaign.' : 'Otherwise I work it out from your question.'}
          </p>
        </div>
        <div className="p-3">
          {pinned && (
            <button
              type="button"
              onClick={() => onPin(null)}
              className="mb-2 w-full rounded-lg px-2.5 py-2 text-left text-[11.5px] font-semibold"
              style={{ background: 'var(--accent-bg)', color: 'var(--accent-strong)', border: '1px solid var(--accent-border)' }}
            >
              <Check size={11} className="mr-1 inline" aria-hidden="true" />
              {pinned.name}
              <span className="ml-1 font-normal" style={{ color: 'var(--ink-3)' }}>· tap to unpin</span>
            </button>
          )}

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns…"
              aria-label="Search campaigns"
              className="input pl-7 text-[11.5px]"
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {(['all', 'active', 'paused'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className="rounded-md px-2 py-0.5 text-[10.5px] font-semibold capitalize"
                style={
                  statusFilter === s
                    ? { background: 'var(--accent-bg)', color: 'var(--accent-strong)' }
                    : { background: 'var(--muted)', color: 'var(--ink-3)' }
                }
              >
                {s}
              </button>
            ))}
            <span className="mx-0.5" aria-hidden="true" />
            {(
              [
                ['all', 'Any source'],
                ['dashboard', 'Meridian'],
                ['manual', 'Meta'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSourceFilter(key)}
                className="rounded-md px-2 py-0.5 text-[10.5px] font-semibold"
                style={
                  sourceFilter === key
                    ? { background: 'var(--accent-bg)', color: 'var(--accent-strong)' }
                    : { background: 'var(--muted)', color: 'var(--ink-3)' }
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {loadingOptions ? (
              <p className="px-1 py-2 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>Loading campaigns…</p>
            ) : filtered.length === 0 ? (
              <p className="px-1 py-2 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>No campaigns match.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.campaignId}
                  type="button"
                  onClick={() => onPin(c)}
                  className="w-full rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--accent-bg)]"
                  style={{ border: '1px solid var(--hairline-light)' }}
                >
                  <span className="block truncate text-[11.5px] font-semibold" style={{ color: 'var(--ink)' }} title={c.name}>
                    {c.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--ink-3)' }}>
                    <StatusChip value={c.status} />
                    {rupees(c.spend)} spent
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────

export function CampaignQueries({ tenantId }: { tenantId: string }) {
  const [turns, setTurns] = useState<QueryTurn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<InsightsCampaignOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [pinned, setPinned] = useState<InsightsCampaignOption | null>(null)
  const [context, setContext] = useState<InsightsResolvedContext | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    getInsightCampaigns(tenantId)
      .then((rows) => {
        if (!cancelled) setOptions(rows)
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns.length, busy])

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || busy) return
      setInput('')
      setError(null)
      setBusy(true)
      const history = turns.map((t) => ({ role: t.role, content: t.content }))
      setTurns((prev) => [...prev, { role: 'user', content: trimmed }])
      try {
        const result = await askCampaignInsights(tenantId, {
          question: trimmed,
          ...(pinned ? { campaignId: pinned.campaignId } : {}),
          history,
        })
        setContext(result.context)
        setTurns((prev) => [
          ...prev,
          { role: 'assistant', content: result.answer, context: result.context },
        ])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not get an answer')
      } finally {
        setBusy(false)
      }
    },
    [busy, pinned, tenantId, turns],
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="card flex min-h-[520px] flex-col overflow-hidden" aria-label="Campaign questions">
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--hairline-light)' }}
        >
          <div>
            <p className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>Ask about your ads</p>
            <p className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              Running or paused — answers come only from your recorded Meta data.
            </p>
          </div>
          {pinned && (
            <span className="chip chip-accent max-w-[45%] truncate" title={pinned.name}>
              <Target size={10} aria-hidden="true" /> {pinned.name}
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {turns.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
                What do you want to know?
              </p>
              <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                Name a campaign in your question, or pin one on the right. I only answer from
                figures recorded in your ad account.
              </p>
              <div className="mt-4 flex flex-col items-center gap-1.5">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-lg px-3 py-2 text-[12px] transition-colors hover:bg-[var(--accent-bg)]"
                    style={{ border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed"
                style={
                  t.role === 'user'
                    ? { background: 'var(--accent)', color: '#fff' }
                    : { background: 'var(--surface-warm)', color: 'var(--ink-2)', border: '1px solid var(--hairline-light)' }
                }
              >
                {t.role === 'assistant' && t.context?.campaign && (
                  <p className="mb-1.5 text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>
                    About: {t.context.campaign.name}
                  </p>
                )}
                <span className="whitespace-pre-wrap">{t.content}</span>
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              Reading your campaign data…
            </div>
          )}
          {error && (
            <div
              className="rounded-lg px-3 py-2 text-[12px]"
              style={{ background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }}
            >
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="p-3" style={{ borderTop: '1px solid var(--hairline-light)' }}>
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              rows={2}
              placeholder="Ask about a campaign, ad group or ad…"
              aria-label="Ask about your ads"
              className="input flex-1 resize-none text-[12.5px]"
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={busy || !input.trim()}
              className="btn btn-primary shrink-0"
              aria-label="Send question"
            >
              <Send size={14} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1.5 text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
            Enter to send · Shift + Enter for a new line · This mode only reads data, it never changes an ad
          </p>
        </div>
      </section>

      <ReadingPanel
        context={context}
        pinned={pinned}
        options={options}
        onPin={(c) => setPinned(c)}
        loadingOptions={loadingOptions}
      />
    </div>
  )
}
