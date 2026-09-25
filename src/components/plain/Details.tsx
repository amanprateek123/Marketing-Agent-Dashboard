'use client'

/**
 * <Details> — the ONE place internal ids and technical text may appear on a page.
 *
 * Collapsed by default (reuses components/ui/CollapsibleSection). Support can open it and press
 * "Copy reference"; everyone else never sees an id.
 *
 * Props
 *   title?      string            Header of the collapsed section. Default "Details".
 *   reference?  string | number   An internal id (run id, gate id, creative key…). Shown short
 *                                 (shortRef) with the full value in a tooltip, plus a
 *                                 "Copy reference" button that copies the FULL value.
 *   items?      { label, value }[] Extra technical facts, rendered as a small label/value list.
 *                                 Values wrap (break-words) — never a raw JSON dump.
 *   children?   ReactNode         Anything else technical (e.g. the raw error message).
 *   className?  string
 *
 * Usage
 *   <Details reference={run.runId} items={[{ label: 'Error', value: errorDetail(err) }]} />
 */

import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { shortRef } from '@/lib/plain-language'

export interface DetailsItem {
  label: string
  value: React.ReactNode
}

interface DetailsProps {
  title?: string
  reference?: string | number | null
  items?: DetailsItem[]
  children?: React.ReactNode
  className?: string
}

export function Details({ title = 'Details', reference, items, children, className }: DetailsProps) {
  const [copied, setCopied] = useState(false)
  const ref = reference === null || reference === undefined || reference === '' ? null : String(reference)

  const copy = async () => {
    if (!ref) return
    try {
      await navigator.clipboard.writeText(ref)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard can be blocked (insecure context, permissions). The short form stays visible,
      // and its tooltip carries the full value to select by hand.
      setCopied(false)
    }
  }

  return (
    <CollapsibleSection title={title} className={className}>
      <div className="flex min-w-0 flex-col gap-3 px-1 text-xs" style={{ color: 'var(--ink-3)' }}>
        {ref && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span>Reference</span>
            <code
              className="min-w-0 truncate rounded px-1.5 py-0.5"
              style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}
              title={ref}
            >
              {shortRef(ref)}
            </code>
            <button
              type="button"
              className="btn btn-ghost inline-flex items-center gap-1.5 text-xs"
              onClick={() => void copy()}
              aria-label="Copy reference"
            >
              {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy reference'}
            </button>
          </div>
        )}
        {items && items.length > 0 && (
          <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[max-content_1fr]">
            {items.map((item) => (
              <React.Fragment key={item.label}>
                <dt className="font-medium" style={{ color: 'var(--ink-3)' }}>
                  {item.label}
                </dt>
                <dd className="min-w-0 break-words" style={{ color: 'var(--ink-2)' }}>
                  {item.value}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        )}
        {children && <div className="min-w-0 break-words">{children}</div>}
      </div>
    </CollapsibleSection>
  )
}
