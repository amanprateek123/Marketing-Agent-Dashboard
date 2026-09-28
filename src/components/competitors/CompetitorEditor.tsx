'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { SectionNotice } from '@/components/inbox/SectionNotice'
import { writeError } from '@/components/inbox/InboxParts'
import { BrainSkeleton } from '@/components/brain/shared'
import { getCompetitors, saveCompetitors } from '@/lib/brain-api'
import { cn } from '@/lib/utils'
import type { BrainCompetitor, BrainProductOption, BrainSectionState } from '@/types/brain'

const BLANK: BrainCompetitor = { name: '', website: null, facebookPage: null, products: [] }

/**
 * The list of competitors the Competitor Research agent watches: name, website, Facebook page and
 * which of our products each competes with. Saved as a whole list. Used on the Competitors page and
 * in Settings.
 */
export function CompetitorEditor({ tenantId, onSaved }: { tenantId: string; onSaved?: () => void }) {
  const [rows, setRows] = useState<BrainCompetitor[]>([])
  const [products, setProducts] = useState<BrainProductOption[]>([])
  const [state, setState] = useState<BrainSectionState | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const out = await getCompetitors(tenantId)
      setRows(out.competitors)
      setProducts(out.products)
      setState(out.state)
      setDirty(false)
    } catch {
      setState('could_not_load')
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  function update(i: number, patch: Partial<BrainCompetitor>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    setDirty(true)
    setNote(null)
  }

  function toggleProduct(i: number, product: BrainProductOption) {
    const has = rows[i].products.some((p) => p.key === product.key)
    update(i, {
      products: has ? rows[i].products.filter((p) => p.key !== product.key) : [...rows[i].products, product],
    })
  }

  async function save() {
    const cleaned = rows.filter((r) => r.name.trim() || r.website?.trim() || r.facebookPage?.trim())
    if (cleaned.some((r) => !r.name.trim())) {
      setNote({ ok: false, text: 'Every competitor needs a name.' })
      return
    }
    setSaving(true)
    setNote(null)
    try {
      const out = await saveCompetitors(tenantId, cleaned)
      setRows(out.competitors)
      if (out.products.length) setProducts(out.products)
      setDirty(false)
      setNote({ ok: true, text: 'Saved. The next competitor check will use this list.' })
      onSaved?.()
    } catch (err) {
      setNote({ ok: false, text: writeError(err, "We couldn't save the list. Try again.") })
    } finally {
      setSaving(false)
    }
  }

  if (state === null) return <BrainSkeleton rows={1} />
  if (state !== 'ok') return <SectionNotice state={state} what="Competitor settings" onRetry={() => void load()} />

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {rows.length === 0 && (
        <p className="explain">No competitors yet. Add the brands whose ads you want the Brain to watch.</p>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <li key={i} className="card-inset min-w-0 rounded-xl p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-3">
              <label className="min-w-0 text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
                Name
                <input className="input mt-1 w-full" value={row.name} maxLength={120} onChange={(e) => update(i, { name: e.target.value })} placeholder="AstroTalk" />
              </label>
              <label className="min-w-0 text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
                Website
                <input className="input mt-1 w-full" value={row.website ?? ''} maxLength={500} inputMode="url" onChange={(e) => update(i, { website: e.target.value })} placeholder="https://…" />
              </label>
              <label className="min-w-0 text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
                Facebook page
                <input className="input mt-1 w-full" value={row.facebookPage ?? ''} maxLength={500} onChange={(e) => update(i, { facebookPage: e.target.value })} placeholder="Page name or link" />
              </label>
            </div>
            {products.length > 0 && (
              <fieldset className="mt-3 min-w-0">
                <legend className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
                  Competes with
                </legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {products.map((p) => {
                    const on = row.products.some((x) => x.key === p.key)
                    return (
                      <button key={p.key} type="button" aria-pressed={on} onClick={() => toggleProduct(i, p)} className={cn('chip max-w-full truncate', on ? 'chip-accent' : 'chip-neutral')} title={p.name}>
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )}
            <button
              type="button"
              className="btn btn-ghost mt-3"
              onClick={() => {
                setRows((prev) => prev.filter((_, j) => j !== i))
                setDirty(true)
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => { setRows((prev) => [...prev, { ...BLANK }]); setDirty(true) }}>
          <Plus size={14} aria-hidden="true" />
          Add a competitor
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
          Save list
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
