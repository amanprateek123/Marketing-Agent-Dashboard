'use client'

import { Star, CheckCircle2, ArrowUpRight } from 'lucide-react'
import { AudienceStageBadge, ExplorationBadge } from '@/components/badges'
import { humanise } from '@/lib/plain-language'
import type { IntelligenceBrief } from '@/types'

const SOURCE_META: Record<string, { label: string; icon: string; bg: string; color: string; border: string }> = {
  scout_signal:   { label: 'Trend spotted',   icon: '📡', bg: 'var(--accent-bg)', color: 'var(--accent)', border: 'var(--accent-border)' },
  viral_trend:    { label: 'Going viral',   icon: '🔥', bg: 'var(--warn-bg)',   color: 'var(--warn)',   border: 'var(--warn-border)' },
  competitor_gap: { label: 'Competitor gap',     icon: '🎯', bg: 'var(--bad-bg)',    color: 'var(--bad)',    border: 'var(--bad-border)' },
  market_insight: { label: 'Market insight', icon: '📊', bg: 'var(--good-bg)',   color: 'var(--good)',   border: 'var(--good-border)' },
  meta_ads_gap:   { label: 'Gap in ads',  icon: '🏪', bg: 'var(--info-bg)',   color: 'var(--info)',   border: 'var(--info-border)' },
}

function ScoreRing({ score }: { score?: number }) {
  if (score === undefined || score === null) return null
  const pct = Math.min(100, (score / 10) * 100)
  const circumference = 2 * Math.PI * 18
  const offset = circumference - (pct / 100) * circumference
  const color = score >= 8 ? 'var(--good)' : score >= 6 ? 'var(--warn)' : 'var(--bad)'

  return (
    <div className="relative w-11 h-11 shrink-0" title={`Score: ${score.toFixed(1)} out of 10`}>
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        <circle cx="20" cy="20" r="18" fill="none" stroke="var(--hairline-light)" strokeWidth="2.5" />
        <circle cx="20" cy="20" r="18" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="display-num text-[12px] font-semibold" style={{ color }}>{score.toFixed(1)}</span>
      </div>
    </div>
  )
}

interface IdeaCardProps {
  brief: IntelligenceBrief
  isWinner: boolean
  isProduced: boolean
  isSelected: boolean
  onClick: () => void
  index: number
}

export function IdeaCard({ brief, isWinner, isProduced, isSelected, onClick, index }: IdeaCardProps) {
  const src = brief.ideaSource ? SOURCE_META[brief.ideaSource] : null

  return (
    <button
      onClick={onClick}
      className="card-hover w-full text-left overflow-hidden transition-all duration-200 group animate-reveal-up"
      style={{
        animationDelay: `${index * 50}ms`,
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: isSelected ? '2px solid var(--accent)'
          : isWinner ? '1px solid var(--accent-border)'
          : '1px solid var(--hairline)',
        boxShadow: isSelected ? '0 0 0 3px rgba(67,56,202,0.1)'
          : 'var(--shadow-soft)',
      }}
    >
      {/* Winner top accent */}
      {isWinner && <div className="h-[2px]" style={{ background: 'var(--accent)' }} />}

      <div className="px-4 pt-3.5 pb-3 flex flex-col gap-2.5">
        {/* Status + Score row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {isWinner ? (
              <span className="chip chip-accent self-start">
                <Star size={9} fill="currentColor" /> Top pick
              </span>
            ) : isProduced ? (
              <span className="chip chip-good self-start">
                <CheckCircle2 size={9} /> Ads made
              </span>
            ) : (
              <span className="chip chip-neutral self-start">
                Idea only
              </span>
            )}
            <h4 className="text-[14px] font-semibold leading-snug line-clamp-2 break-words" style={{ color: 'var(--ink)' }} title={brief.topic}>
              {brief.topic}
            </h4>
          </div>
          <ScoreRing score={brief.finalScore} />
        </div>

        {/* Hook preview */}
        {brief.hook && (
          <p className="text-xs leading-relaxed line-clamp-2 italic pl-3"
            style={{ color: 'var(--ink-3)', borderLeft: '2px solid var(--hairline)' }}>
            &ldquo;{brief.hook}&rdquo;
          </p>
        )}

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {src ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: src.bg, color: src.color }}>
              {src.icon} {src.label}
            </span>
          ) : brief.ideaSource ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}>{humanise(brief.ideaSource)}</span>
          ) : null}
          <AudienceStageBadge stage={brief.audienceStage} />
          {brief.explorationArm && <ExplorationBadge />}
          {brief.platform && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}>{humanise(brief.platform)}</span>
          )}
          {brief.format && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>{humanise(brief.format)}</span>
          )}
          {brief.urgencyScore != null && brief.urgencyScore >= 8 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}>Urgent</span>
          )}
        </div>

        {/* Hover hint */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }}>
          <span className="text-[10px] font-medium">View details</span>
          <ArrowUpRight size={10} />
        </div>
      </div>
    </button>
  )
}
