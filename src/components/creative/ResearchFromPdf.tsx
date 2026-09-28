'use client'

import { useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { uploadCustomBriefImages } from '@/lib/api'
import { startResearchFromPdf } from '@/lib/creative-parity-api'
import type { CustomBriefOffering } from '@/types'
import { OutcomeLine, useParityAction } from './parity-shared'

const MAX_MB = 20

/**
 * Start research from a PDF — a product note, a report sample, a competitor brochure — instead of
 * a typed brief. In Slack this was "drop a PDF in the channel".
 */
export function ResearchFromPdf({
  tenantId,
  offerings,
  onStarted,
}: {
  tenantId: string
  offerings: CustomBriefOffering[]
  onStarted: (runId: number) => void
}) {
  const { busy, outcome, run } = useParityAction()
  const [file, setFile] = useState<File | null>(null)
  const [product, setProduct] = useState('')
  const [tooBig, setTooBig] = useState(false)
  const input = useRef<HTMLInputElement | null>(null)

  const start = async () => {
    if (!file || !product) return
    const res = await run(
      'pdf',
      async () => {
        const { refs } = await uploadCustomBriefImages(tenantId, [file])
        const ref = refs[0] as { filename: string; upload_id?: string } | undefined
        if (!ref) throw new Error('No upload came back')
        return startResearchFromPdf(tenantId, ref.upload_id ?? ref.filename, product)
      },
      'Research has started from your PDF.',
    )
    if (res?.run_id) {
      onStarted(res.run_id)
      setFile(null)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="card-inset mt-4 px-4 py-3 min-w-0">
      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--ink-2)' }}>Or start from a PDF</p>
      <p className="text-[11.5px] mb-2" style={{ color: 'var(--ink-4)' }}>
        Upload a document about the product and the research reads it first. Up to {MAX_MB} MB.
      </p>
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0] ?? null
            const big = !!f && f.size > MAX_MB * 1024 * 1024
            setTooBig(big)
            setFile(big ? null : f)
          }}
        />
        <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()} disabled={busy !== null}>
          <FileUp size={13} /> {file ? 'Choose a different PDF' : 'Choose a PDF'}
        </button>
        {file && (
          <span className="min-w-0 truncate text-[12px]" style={{ color: 'var(--ink-2)', maxWidth: 220 }} title={file.name}>
            {file.name}
          </span>
        )}
        <select className="input" style={{ width: 'auto', minWidth: 0 }} value={product}
          onChange={e => setProduct(e.target.value)} aria-label="Which product is this about">
          <option value="">Which product?</option>
          {offerings.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" disabled={!file || !product || busy !== null} onClick={() => void start()}>
          {busy === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : null} Research this PDF
        </button>
      </div>
      {tooBig && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--warn)' }}>That file is bigger than {MAX_MB} MB. Pick a smaller one.</p>
      )}
      <OutcomeLine outcome={outcome} />
    </div>
  )
}
