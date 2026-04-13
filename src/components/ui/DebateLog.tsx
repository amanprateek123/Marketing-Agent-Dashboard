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
      bubbleStyle: { background: '#eff6ff', border: '1px solid #e0e7ff', color: '#1e3a5f' },
      align: 'left',
      avatarBg: '#1d4ed8',
      avatarColor: '#ffffff',
    }
  }
  if (r === 'contrarian') {
    return {
      label: 'Contrarian',
      bubbleStyle: { background: '#fef2f2', border: '1px solid #fecaca', color: '#5f1010' },
      align: 'right',
      avatarBg: '#dc2626',
      avatarColor: '#ffffff',
    }
  }
  if (r === 'reviewer') {
    return {
      label: 'Reviewer',
      bubbleStyle: { background: '#fffbeb', border: '1px solid #fde68a', color: '#5a3e0a' },
      align: 'center',
      avatarBg: '#d97706',
      avatarColor: '#ffffff',
    }
  }
  return {
    label: from,
    bubbleStyle: { background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#1e293b' },
    align: 'center',
    avatarBg: '#4b5563',
    avatarColor: '#ffffff',
  }
}

export function DebateLog({ rounds, rationale }: DebateLogProps) {
  if (!rounds || rounds.length === 0) {
    return (
      <div className="text-sm italic py-6 text-center" style={{ color: '#9ca3af' }}>
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
            <div className="flex-1 h-px" style={{ background: '#f3f4f6' }} />
            <span className="text-[10px] font-bold uppercase tracking-widest px-2" style={{ color: '#9ca3af', letterSpacing: '0.1em' }}>
              Round {roundNum}
            </span>
            <div className="flex-1 h-px" style={{ background: '#f3f4f6' }} />
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
                    'max-w-[75%] rounded-2xl px-4 py-3',
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
        <p className="text-xs italic mt-2 px-1 leading-relaxed font-display" style={{ color: '#4b5563' }}>
          {rationale}
        </p>
      )}
    </div>
  )
}
