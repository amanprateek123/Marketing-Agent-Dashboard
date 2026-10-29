'use client'

import { useMemo, useState } from 'react'
import { getPmCampaignList, productLabel } from '@/lib/performance-marketeer-api'
import type { PmCampaignListItem } from '@/types/performance-marketeer'
import { Empty, LoadError, SectionCard, TableWrap, fmt, useLoad } from './shared'
import { AnalyseButton, AnalyseDialog, type AnalyseTarget } from './AnalyseDialog'

const PAGE = 25
const IST_MS = 5.5 * 3600 * 1000
const istDate = (iso: string | null) => (iso ? new Date(Date.parse(iso) + IST_MS).toISOString().slice(0, 10) : null)

/**
 * Every campaign (list from Meta, refreshed hourly), whether or not its data
 * is loaded. Analyse loads that campaign's missing history, then runs the AI.
 */
export function CampaignList({ tenantId, onOpenAgent }: { tenantId: string; onOpenAgent: () => void }) {
  const list = useLoad(`campaign-list${tenantId}`, () => getPmCampaignList(tenantId))
  const [search, setSearch] = useState('')
  const [show, setShow] = useState<'active' | 'all'>('active')
  const [limit, setLimit] = useState(PAGE)
  const [analyse, setAnalyse] = useState<AnalyseTarget[] | null>(null)

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (list.data ?? []).filter(
      (c: PmCampaignListItem) => (show === 'all' || c.effectiveStatus === 'ACTIVE') && (!s || c.name.toLowerCase().includes(s) || c.id.includes(s)),
    )
  }, [list.data, search, show])
  const activeCount = (list.data ?? []).filter((c) => c.effectiveStatus === 'ACTIVE').length

  return (
    <SectionCard
      padded={false}
      title="Campaigns"
      description="Pick any campaign to analyse. Its missing history (from launch) is loaded first, then the AI runs."
    >
      <div className="p-5 pt-4">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            Search
            <input
              type="search"
              name="campaign-search"
              className="input !min-h-[38px] !py-1.5"
              placeholder="Campaign name or id…"
              autoComplete="off"
              spellCheck={false}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setLimit(PAGE)
              }}
            />
          </label>
          <label className="flex min-w-[200px] flex-col gap-1 text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            Show
            <select
              className="input !min-h-[38px] !py-1.5"
              name="campaign-status"
              value={show}
              onChange={(e) => {
                setShow(e.target.value as 'active' | 'all')
                setLimit(PAGE)
              }}
            >
              <option value="active">Active ({activeCount})</option>
              <option value="all">All since 10 Apr ({list.data?.length ?? 0})</option>
            </select>
          </label>
        </div>
        {list.error ? (
          <LoadError message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <span className="sr-only">Loading…</span>
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <Empty
            title={list.data.length ? 'No campaigns match' : 'No campaigns yet'}
            hint={list.data.length ? 'Try another name, or show all campaigns.' : 'The list comes from Meta and refreshes hourly.'}
          />
        ) : (
          <>
            <TableWrap label="Campaigns to analyse">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Launched</th>
                  <th className="num">Daily budget</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((c) => (
                  <tr key={c.id}>
                    <td className="max-w-[420px]">
                      <span className="font-semibold break-words" style={{ color: 'var(--ink)' }}>{c.name}</span>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className={c.effectiveStatus === 'ACTIVE' ? 'chip chip-good' : 'chip chip-neutral'}>
                          {c.effectiveStatus === 'ACTIVE' ? 'Active' : c.effectiveStatus.toLowerCase().replace(/_/g, ' ')}
                        </span>
                        {c.product && c.product !== 'other' && <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{productLabel(c.product)}</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{fmt.date(istDate(c.createdTime))}</td>
                    <td className="num">{c.dailyBudget != null ? fmt.inr(c.dailyBudget) : '—'}</td>
                    <td>
                      <AnalyseButton compact name={c.name} onClick={() => setAnalyse([{ id: c.id, name: c.name }])} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {rows.length > limit && (
              <button type="button" className="btn btn-ghost mt-3" onClick={() => setLimit((n) => n + PAGE)}>
                Show More ({rows.length - limit} left)
              </button>
            )}
          </>
        )}
      </div>
      <AnalyseDialog
        key={analyse?.map((c) => c.id).join() ?? ''}
        tenantId={tenantId}
        campaigns={analyse}
        onClose={() => setAnalyse(null)}
        onOpenAgent={() => {
          setAnalyse(null)
          onOpenAgent()
        }}
      />
    </SectionCard>
  )
}
