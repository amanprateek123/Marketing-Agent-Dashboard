import { AlertCircle } from 'lucide-react'
import type { MetaPage } from '@/types'

/**
 * A dropdown of real Pages (name + category), not a bare ID to hand-type or
 * paste — added after a prod incident (2026-07-29) where a hand-typed
 * company.meta.pageId silently pointed every ad at the wrong Facebook Page
 * and there was no way to see, let alone pick from, the real list.
 */
export function PageSelect({ pages, value, onChange, allowBlank }: { pages: MetaPage[]; value: string; onChange: (v: string) => void; allowBlank?: string }) {
  // promotable first: authorized on THIS tenant's own ad account(s) right
  // now (Meta's promote_pages allowlist) — the exact per-account gate Ads
  // Manager enforces. Everything else is a Page the Business owns/manages
  // but hasn't been authorized on these specific ad accounts yet.
  const ready = pages.filter(p => p.promotable)
  const others = pages.filter(p => !p.promotable)
  const selected = pages.find(p => p.id === value)
  return (
    <div>
      <select value={value} onChange={e => onChange(e.target.value)} className="input">
        {allowBlank && <option value="">{allowBlank}</option>}
        {!allowBlank && !value && <option value="">Select a Page…</option>}
        {ready.length > 0 && (
          <optgroup label="Ready to use — authorized on your ad account(s)">
            {ready.map(p => <option key={p.id} value={p.id}>{p.name}{p.category ? ` — ${p.category}` : ''} ({p.id})</option>)}
          </optgroup>
        )}
        {others.length > 0 && (
          <optgroup label="Other Business pages — not yet authorized on your ad account(s)">
            {others.map(p => <option key={p.id} value={p.id}>{p.name}{p.category ? ` — ${p.category}` : ''} ({p.id})</option>)}
          </optgroup>
        )}
      </select>
      {selected && !selected.promotable && (
        <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--bad)' }}>
          <AlertCircle size={11} /> Not yet authorized on this tenant&apos;s ad account(s) — add it under Meta Business Settings → Ad Account → Page Permissions before launching, or Meta will reject the ad.
        </p>
      )}
      {selected && selected.promotable && !selected.accessible && (
        <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--bad)' }}>
          <AlertCircle size={11} /> This access token doesn&apos;t have management access to this Page yet — add it under Business Settings → People → assign this Page.
        </p>
      )}
      {value && !selected && (
        <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--bad)' }}>
          <AlertCircle size={11} /> This ID ({value}) isn&apos;t in the discovered Page list — click &quot;Discover from Meta&quot; above, or it may be invalid.
        </p>
      )}
    </div>
  )
}
