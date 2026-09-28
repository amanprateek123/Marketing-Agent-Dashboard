'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ExternalLink, FileText, Loader2, RefreshCw } from 'lucide-react'
import { BrainError, BrainSkeleton } from '@/components/brain/shared'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionNotice } from './SectionNotice'
import { notifyInboxChanged } from './InboxBell'
import { verdictChip } from './InboxParts'
import { getReports, markReportRead } from '@/lib/brain-api'
import { errorDetail, formatWhen } from '@/lib/plain-language'
import { cn } from '@/lib/utils'
import type { BrainReport, BrainSectionState } from '@/types/brain'

/**
 * Reports — daily briefs, performance reports, spend watch and incidents, newest first. Opening one
 * marks it read (which clears it from the bell). On a phone the list and the report take turns; on a
 * wide screen they sit side by side.
 */
export function ReportsView({ tenantId, initialOpen }: { tenantId: string; initialOpen: string | null }) {
  const [kind, setKind] = useState<string | null>(null)
  const [kinds, setKinds] = useState<Array<{ key: string; label: string }>>([])
  const [reports, setReports] = useState<BrainReport[]>([])
  const [state, setState] = useState<BrainSectionState>('ok')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openRef, setOpenRef] = useState<string | null>(initialOpen)
  const marked = useRef(new Set<string>())

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      setLoading(true)
      try {
        const out = await getReports(tenantId, kind, nextPage)
        setState(out.state)
        setReports((prev) => (append ? [...prev, ...out.reports.filter((r) => !prev.some((p) => p.ref === r.ref))] : out.reports))
        setHasMore(out.hasMore)
        setPage(out.page)
        if (!kind) setKinds(out.kinds)
        setError(null)
      } catch (err) {
        setError(errorDetail(err))
      } finally {
        setLoading(false)
      }
    },
    [tenantId, kind],
  )

  useEffect(() => {
    void load(1, false)
  }, [load])

  const open = reports.find((r) => r.ref === openRef) ?? null

  // Opening an unread report marks it read — once, and without blocking the page on the answer.
  useEffect(() => {
    if (!open || open.read || marked.current.has(open.ref)) return
    marked.current.add(open.ref)
    markReportRead(tenantId, open.ref)
      .then(() => {
        setReports((prev) => prev.map((r) => (r.ref === open.ref ? { ...r, read: true } : r)))
        notifyInboxChanged()
      })
      .catch(() => {
        // Not being able to mark it read is not worth interrupting reading it; the bell stays.
      })
  }, [open, tenantId])

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Daily briefs, performance reports, spend watch and incidents.</p>
        </div>
        <button type="button" className="btn btn-ghost shrink-0 self-start" onClick={() => void load(1, false)} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {kinds.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Show reports of one kind">
          <button type="button" className={cn('chip', kind === null ? 'chip-accent' : 'chip-neutral')} onClick={() => setKind(null)} aria-pressed={kind === null}>
            All
          </button>
          {kinds.map((k) => (
            <button key={k.key} type="button" className={cn('chip', kind === k.key ? 'chip-accent' : 'chip-neutral')} onClick={() => setKind(k.key)} aria-pressed={kind === k.key}>
              {k.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4">
        <SectionNotice state={state} what="Reports" onRetry={() => void load(1, false)} />
        {error !== null && reports.length === 0 && <BrainError message={error} onRetry={() => void load(1, false)} />}
        {loading && reports.length === 0 && error === null && <BrainSkeleton rows={3} />}
        {!loading && state === 'ok' && error === null && reports.length === 0 && (
          <div className="card">
            <EmptyState icon={FileText} title="No reports yet" subtitle="Reports from the last three months will show here as they are written." />
          </div>
        )}

        {reports.length > 0 && (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <div className={cn('min-w-0', open && 'hidden lg:block')}>
              <ul className="flex flex-col gap-2">
                {reports.map((r) => (
                  <li key={r.ref}>
                    <button
                      type="button"
                      onClick={() => setOpenRef(r.ref)}
                      aria-current={r.ref === openRef ? 'true' : undefined}
                      className="card card-hover flex w-full min-w-0 flex-col gap-1 p-4 text-left"
                      style={r.ref === openRef ? { borderColor: 'var(--accent-border)' } : undefined}
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        {!r.read && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--accent)' }} aria-label="Not read yet" />}
                        <span className="chip chip-neutral">{r.kindLabel}</span>
                        {r.needsAttention && <span className="chip chip-bad">Needs attention</span>}
                      </span>
                      <span className={cn('mt-1 break-words', r.read ? 'font-medium' : 'font-semibold')} style={{ color: 'var(--ink)' }}>
                        {r.headline}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                        {formatWhen(r.reportDate ?? r.deliveredAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {hasMore && (
                <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => void load(page + 1, true)} disabled={loading}>
                  {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                  Show older reports
                </button>
              )}
            </div>

            <div className={cn('min-w-0', !open && 'hidden lg:block')}>
              {open ? (
                <ReportDetail report={open} onBack={() => setOpenRef(null)} />
              ) : (
                <div className="card">
                  <EmptyState icon={FileText} title="Pick a report" subtitle="Choose a report on the left to read it." />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function ReportDetail({ report, onBack }: { report: BrainReport; onBack: () => void }) {
  return (
    <article className="card min-w-0 p-5">
      <button type="button" className="btn btn-ghost mb-4 lg:hidden" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden="true" />
        All reports
      </button>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="chip chip-neutral">{report.kindLabel}</span>
        {report.verdictLabel && <span className={verdictChip(report.verdictTone)}>{report.verdictLabel}</span>}
        {report.needsAttention && <span className="chip chip-bad">Needs your attention</span>}
      </div>
      <h2 className="section-title mt-3 break-words">{report.headline}</h2>
      <p className="mt-1 text-xs" style={{ color: 'var(--ink-3)' }}>
        {formatWhen(report.reportDate ?? report.deliveredAt)}
      </p>

      {report.figures.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {report.figures.map((f) => (
            <div key={f.label} className="card-inset min-w-0 rounded-xl p-3">
              <dt className="truncate text-xs" style={{ color: 'var(--ink-3)' }} title={f.label}>
                {f.label}
              </dt>
              <dd className="mt-1 break-words text-base font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {report.body && (
        <div className="mt-4 whitespace-pre-line break-words text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {report.body}
        </div>
      )}

      {report.panelUrl && (
        <a href={report.panelUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-5">
          Open the full report
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </article>
  )
}
