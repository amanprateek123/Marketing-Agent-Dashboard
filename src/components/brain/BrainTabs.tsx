'use client'

import React from 'react'
import { Activity, Gavel, Gauge, MessagesSquare, Megaphone, ScrollText, Workflow } from 'lucide-react'
import type { BrainTabKey } from '@/types/brain'

interface TabDef {
  key: BrainTabKey
  label: string
  description: string
  Icon: React.ComponentType<{ size?: number }>
}

const TABS: TabDef[] = [
  { key: 'pulse', label: 'Pulse', description: 'What the Brain is doing right now', Icon: Gauge },
  { key: 'decisions', label: 'Decisions', description: 'Every call it made, with its evidence', Icon: ScrollText },
  { key: 'pipeline', label: 'Pipeline', description: 'Producer → Curator → Builder → Launcher', Icon: Workflow },
  { key: 'campaign-run', label: 'Campaigns', description: 'What is being built, and the ads going out', Icon: Megaphone },
  { key: 'approvals', label: 'Approvals', description: 'The gates that need a human', Icon: Gavel },
  { key: 'agents', label: 'Agents', description: 'Run an agent and read its output', Icon: Activity },
  { key: 'conversation', label: 'Conversation', description: 'Ask it something and keep the thread', Icon: MessagesSquare },
]

interface BrainTabsProps {
  active: BrainTabKey
  onChange: (tab: BrainTabKey) => void
  /** Per-tab counts, e.g. open gates on Approvals. Zero and null both render nothing. */
  badges?: Partial<Record<BrainTabKey, number | null>>
}

/**
 * Buttons rather than links on purpose. These tabs sync to `?tab=` with
 * `router.replace`, so the URL stays shareable, but switching tabs must not
 * remount the console — a run being polled on the Agents tab has to survive a
 * detour to Approvals and back.
 */
export function BrainTabs({ active, onChange, badges }: BrainTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Brain console sections"
      className="grid grid-cols-2 gap-2 rounded-2xl p-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
      style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}
    >
      {TABS.map(({ key, label, description, Icon }, index) => {
        const isActive = active === key
        const badge = badges?.[key]

        return (
          <button
            key={key}
            type="button"
            role="tab"
            id={`brain-tab-${key}`}
            aria-selected={isActive}
            aria-controls={`brain-panel-${key}`}
            onClick={() => onChange(key)}
            className="group flex min-h-16 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none"
            style={
              isActive
                ? {
                    background: 'var(--surface)',
                    border: '1px solid var(--accent-border)',
                    boxShadow: 'var(--shadow-soft)',
                  }
                : { border: '1px solid transparent' }
            }
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: isActive ? 'var(--accent-bg)' : 'var(--muted)',
                color: isActive ? 'var(--accent-strong)' : 'var(--ink-3)',
              }}
            >
              <Icon size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span
                  className="text-sm font-semibold"
                  style={{ color: isActive ? 'var(--ink)' : 'var(--ink-2)' }}
                >
                  {label}
                </span>
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--ink-4)' }}>
                  0{index + 1}
                </span>
              </span>
              <span
                className="mt-0.5 hidden text-[11px] leading-snug lg:block"
                style={{ color: 'var(--ink-3)' }}
              >
                {description}
              </span>
            </span>
            {badge != null && badge > 0 && (
              <span
                className="chip chip-warn shrink-0 tabular-nums"
                aria-label={`${badge} waiting`}
              >
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
