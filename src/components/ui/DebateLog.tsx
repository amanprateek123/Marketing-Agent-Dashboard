'use client'

import { cn } from '@/lib/utils'

type DebateEntry = { round: number; from: string; summary: string }

interface DebateLogProps {
  rounds: DebateEntry[]
  rationale?: string
}

function getRoleConfig(from: string): {
  label: string
  bubbleStyle: React.CSSProperties
  align: 'left' | 'right' | 'center'
  avatarBg: string
  avatarColor: string
} {
  const r = from.toLowerCase()
  if (r === 'strategist') {
    return {
      label: 'Strategist',
      bubbleStyle: { background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--ink)' },
      align: 'left',
      avatarBg: 'var(--accent)',
      avatarColor: '#fff',
    }
  }
  if (r === 'contrarian') {
    return {
      label: 'Contrarian',
      bubbleStyle: { background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--ink)' },
      align: 'right',
      avatarBg: 'var(--bad)',
      avatarColor: '#fff',
    }
  }
  if (r === 'reviewer') {
    return {
      label: 'Reviewer',
      bubbleStyle: { background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--ink)' },
      align: 'center',
      avatarBg: 'var(--warn)',
      avatarColor: '#fff',
    }
  }
  return {
    label: from,
    bubbleStyle: { background: 'var(--muted)', border: '1px solid var(--hairline)', color: 'var(--ink)' },
    align: 'center',
    avatarBg: 'var(--ink-2)',
    avatarColor: '#fff',
  }
}

export function DebateLog({ rounds, rationale }: DebateLogProps) {
  if (!rounds || rounds.length === 0) {
    return (
      <div className="text-sm italic py-6 text-center" style={{ color: 'var(--ink-3)' }}>
        No debate rounds recorded.
      </div>
    )
  }

  const groupMap = new Map<number, DebateEntry[]>()
  for (const entry of rounds) {
    const existing = groupMap.get(entry.round) || []
    existing.push(entry)
    groupMap.set(entry.round, existing)
  }
  const sortedRounds = Array.from(groupMap.entries()).sort(([a], [b]) => a - b)

  return (
    <div className="flex flex-col gap-4">
      {sortedRounds.map(([roundNum, entries]) => (
        <div key={roundNum} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ background: 'var(--hairline-light)' }} />
            <span className="micro-label px-2">
              Round {roundNum}
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--hairline-light)' }} />
          </div>
          {entries.map((entry, ei) => {
            const config = getRoleConfig(entry.from)
            return (
              <div
                key={ei}
                className={cn(
                  'flex gap-2.5',
                  config.align === 'right' && 'flex-row-reverse',
                  config.align === 'center' && 'justify-center'
                )}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                  style={{ background: config.avatarBg, color: config.avatarColor }}
                >
                  {entry.from.charAt(0).toUpperCase()}
                </div>
                <div
                  className={cn(
                    'max-w-[75%] rounded-xl px-4 py-3',
                    config.align === 'center' && 'max-w-[85%]'
                  )}
                  style={config.bubbleStyle}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-50">
                    {config.label}
                  </div>
                  <p className="text-[13px] leading-relaxed">{entry.summary}</p>
                </div>
              </div>
            )
          })}
        </div>
      ))}
      {rationale && (
        <p className="text-xs italic mt-2 px-1 leading-relaxed font-display" style={{ color: 'var(--ink-2)' }}>
          {rationale}
        </p>
      )}
    </div>
  )
}
