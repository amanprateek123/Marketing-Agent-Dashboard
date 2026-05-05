'use client'

import { Star, CheckCircle2, ArrowUpRight } from 'lucide-react'
import { AudienceStageBadge, ExplorationBadge } from '@/components/badges'
import type { IntelligenceBrief } from '@/types'

const SOURCE_META: Record<string, { label: string; icon: string; bg: string; color: string; border: string }> = {
  scout_signal:   { label: 'Scout',   icon: '📡', bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
  viral_trend:    { label: 'Viral',   icon: '🔥', bg: '#fce7f3', color: '#be185d', border: '#fbcfe8' },
  competitor_gap: { label: 'Gap',     icon: '🎯', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  market_insight: { label: 'Insight', icon: '📊', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  meta_ads_gap:   { label: 'Ad Gap',  icon: '🏪', bg: '#faf5ff', color: '#7c3aed', border: '#e9d5ff' },
}

function ScoreRing({ score }: { score?: number }) {
  if (score === undefined || score === null) return null
  const pct = Math.min(100, (score / 10) * 100)
  const circumference = 2 * Math.PI * 18
  const offset = circumference - (pct / 100) * circumference
  const color = score >= 8 ? '#059669' : score >= 6 ? '#d97706' : '#dc2626'

  return (
    <div className="relative w-11 h-11 shrink-0">
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        <circle cx="20" cy="20" r="18" fill="none" stroke="#f3f4f6" strokeWidth="2.5" />
        <circle cx="20" cy="20" r="18" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold font-mono" style={{ color }}>{score.toFixed(1)}</span>
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
      className="w-full text-left rounded-xl overflow-hidden transition-all duration-200 group animate-reveal-up bg-white"
      style={{
        animationDelay: `${index * 50}ms`,
        border: isSelected ? '2px solid #4f46e5'
          : isWinner ? '1px solid #c7d2fe'
          : '1px solid #e5e7eb',
        boxShadow: isSelected ? '0 0 0 3px rgba(79,70,229,0.1)'
          : '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {/* Winner top accent */}
      {isWinner && <div className="h-[2px]" style={{ background: '#4f46e5' }} />}

      <div className="px-4 pt-3.5 pb-3 flex flex-col gap-2.5">
        {/* Status + Score row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {isWinner ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded self-start bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Star size={9} fill="currentColor" /> Strategy Pick
              </span>
            ) : isProduced ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded self-start bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={9} /> Produced
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded self-start bg-gray-50 text-gray-400">
                Draft
              </span>
            )}
            <h4 className="text-[14px] font-semibold leading-snug line-clamp-2" style={{ color: '#111827' }}>
              {brief.topic}
            </h4>
          </div>
          <ScoreRing score={brief.finalScore} />
        </div>

        {/* Hook preview */}
        {brief.hook && (
          <p className="text-xs leading-relaxed line-clamp-2 text-gray-500 italic pl-3 border-l-2 border-gray-200">
            &ldquo;{brief.hook}&rdquo;
          </p>
        )}

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {src && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: src.bg, color: src.color }}>
              {src.icon} {src.label}
            </span>
          )}
          <AudienceStageBadge stage={brief.audienceStage} />
          {brief.explorationArm && <ExplorationBadge />}
          {brief.platform && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">{brief.platform}</span>
          )}
          {brief.format && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{brief.format}</span>
          )}
          {brief.urgencyScore != null && brief.urgencyScore >= 8 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600">Urgent</span>
          )}
        </div>

        {/* Hover hint */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600">
          <span className="text-[10px] font-medium">View details</span>
          <ArrowUpRight size={10} />
        </div>
      </div>
    </button>
  )
}
