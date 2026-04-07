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
  avatarStyle: React.CSSProperties
} {
  const r = from.toLowerCase()
  if (r === 'strategist') {
    return {
      label: 'Strategist',
      bubbleStyle: { background: '#dbeafe', border: '1px solid #bfdbfe', color: '#1e3a5f' },
      align: 'left',
      avatarStyle: { background: '#1d4ed8', color: '#fff' },
    }
  }
  if (r === 'contrarian') {
    return {
      label: 'Contrarian',
      bubbleStyle: { background: '#fee2e2', border: '1px solid #fecaca', color: '#5f1010' },
      align: 'right',
      avatarStyle: { background: '#b91c1c', color: '#fff' },
    }
  }
  if (r === 'reviewer') {
    return {
      label: 'Reviewer',
      bubbleStyle: { background: '#fef3c7', border: '1px solid #fde68a', color: '#5a3e0a' },
      align: 'center',
      avatarStyle: { background: '#b45309', color: '#fff' },
    }
  }
  return {
    label: from,
    bubbleStyle: { background: '#f4f4f5', border: '1px solid #e4e4e7', color: '#18181b' },
    align: 'center',
    avatarStyle: { background: '#71717a', color: '#fff' },
  }
}

export function DebateLog({ rounds, rationale }: DebateLogProps) {
  if (!rounds || rounds.length === 0) {
    return (
      <div className="text-sm italic py-4 text-center" style={{ color: '#a1a1aa' }}>
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
    <div className="flex flex-col gap-3">
      {sortedRounds.map(([roundNum, entries]) => (
        <div key={roundNum} className="flex flex-col gap-2">
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ background: '#e4e4e7' }} />
            <span className="text-xs font-semibold px-2" style={{ color: '#a1a1aa' }}>
              Round {roundNum}
            </span>
            <div className="flex-1 h-px" style={{ background: '#e4e4e7' }} />
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
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={config.avatarStyle}
                >
                  {entry.from.charAt(0).toUpperCase()}
                </div>
                <div
                  className={cn(
                    'max-w-[75%] rounded-xl px-3.5 py-2.5',
                    config.align === 'center' && 'max-w-[85%]'
                  )}
                  style={config.bubbleStyle}
                >
                  <div className="text-xs font-semibold mb-1 opacity-60 capitalize">
                    {config.label}
                  </div>
                  <p className="text-sm leading-relaxed">{entry.summary}</p>
                </div>
              </div>
            )
          })}
        </div>
      ))}
      {rationale && (
        <p className="text-xs italic mt-2 px-1 leading-relaxed" style={{ color: '#71717a' }}>
          {rationale}
        </p>
      )}
    </div>
  )
}
