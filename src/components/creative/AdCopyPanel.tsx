'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Save, Sparkles } from 'lucide-react'
import {
  approveAdCopy,
  generateAdCopy,
  saveAdCopy,
  type CampaignFields,
  type CampaignFieldsResult,
} from '@/lib/creative-parity-api'
import { OutcomeLine, useParityAction } from './parity-shared'

const FIELDS: { key: keyof CampaignFields; label: string; hint: string; rows: number }[] = [
  { key: 'headline', label: 'Headline', hint: 'The bold line under the image.', rows: 1 },
  { key: 'primary_text', label: 'Main text', hint: 'The words above the image.', rows: 3 },
  { key: 'description', label: 'Description', hint: 'The small line under the headline.', rows: 2 },
  { key: 'cta', label: 'Button', hint: 'What the button says, e.g. "Book now".', rows: 1 },
]

/**
 * The ad copy that goes out with a finished creative: write it, change it, approve it.
 *
 * In Slack this was the "campaign fields" card. The copy starts empty here because the
 * pipeline only returns it from these calls; nothing is shown until it has been written.
 */
export function AdCopyPanel({ tenantId, runId }: { tenantId: string; runId: number }) {
  const { busy, outcome, run } = useParityAction()
  const [fields, setFields] = useState<CampaignFields | null>(null)
  const [draft, setDraft] = useState<CampaignFields>({})
  const [approved, setApproved] = useState(false)

  const absorb = (res: CampaignFieldsResult | null | undefined) => {
    if (!res) return
    if (res.fields) {
      setFields(res.fields)
      setDraft(res.fields)
    }
    if (typeof res.approved === 'boolean') setApproved(res.approved)
  }

  const write = async (okText: string) => {
    const res = await run('gen', () => generateAdCopy(tenantId, runId), okText)
    absorb(res)
    // Written but not echoed back: open the fields anyway so they can be typed in.
    if (res !== undefined && !res?.fields) setFields(f => f ?? {})
  }

  const changed = FIELDS.filter(f => (draft[f.key] ?? '') !== (fields?.[f.key] ?? ''))
  const disabled = busy !== null

  return (
    <div className="card-inset mt-3 px-4 py-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Ad copy</p>
        {approved && <span className="chip chip-good">Approved</span>}
      </div>

      {!fields ? (
        <div className="mt-2">
          <p className="text-[12px] mb-2" style={{ color: 'var(--ink-3)' }}>
            Write the headline, main text and button to go with this ad.
          </p>
          <button type="button" className="btn btn-ghost" disabled={disabled}
            onClick={() => void write('Ad copy written.')}>
            {busy === 'gen' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Write the ad copy
          </button>
        </div>
      ) : (
        <div className="mt-2 grid gap-3">
          {FIELDS.map(f => (
            <label key={f.key} className="block min-w-0">
              <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--ink-2)' }}>{f.label}</span>
              <textarea
                className="input"
                rows={f.rows}
                value={draft[f.key] ?? ''}
                disabled={disabled}
                onChange={e => { setDraft(d => ({ ...d, [f.key]: e.target.value })); setApproved(false) }}
              />
              <span className="block text-[11px] mt-1" style={{ color: 'var(--ink-4)' }}>{f.hint}</span>
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" disabled={disabled || changed.length === 0}
              onClick={async () => {
                const body = Object.fromEntries(changed.map(f => [f.key, draft[f.key] ?? ''])) as CampaignFields
                const res = await run('save', () => saveAdCopy(tenantId, runId, body), 'Changes saved.')
                if (res !== undefined) { setFields(f => ({ ...f, ...body })); absorb(res) }
              }}>
              {busy === 'save' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save changes
            </button>
            <button type="button" className="btn btn-primary" disabled={disabled || changed.length > 0 || approved}
              title={changed.length > 0 ? 'Save your changes first' : undefined}
              onClick={async () => {
                const res = await run('approve', () => approveAdCopy(tenantId, runId), 'Ad copy approved.')
                if (res !== undefined) { setApproved(true); absorb(res) }
              }}>
              {busy === 'approve' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approve the copy
            </button>
            <button type="button" className="btn btn-ghost" disabled={disabled}
              onClick={() => void write('Ad copy rewritten.')}>
              {busy === 'gen' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Write it again
            </button>
          </div>
        </div>
      )}
      <OutcomeLine outcome={outcome} />
    </div>
  )
}
