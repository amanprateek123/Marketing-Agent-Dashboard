'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  Brain,
  ArrowUpDown,
  Star,
  ChevronDown,
  X,
  Lightbulb,
} from 'lucide-react'
import { DebateLog } from '@/components/ui/DebateLog'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { IdeaCard } from './IdeaCard'
import { IdeaDetailPanel } from './IdeaDetailPanel'
import type {
  IntelligenceBrief,
  PipelineRun,
  CreativeBrief,
  CreativePackage,
  CopyVariant,
  Campaign,
} from '@/types'

type SortKey = 'score' | 'platform' | 'source'

interface StrategyTabProps {
  briefs: IntelligenceBrief[]
  run?: PipelineRun
  tenantId: string
  creativeBrief?: CreativeBrief
  creativePackage?: CreativePackage
  copyVariants: CopyVariant[]
  selectedCopyIndex?: number
  campaign?: Campaign
  siblingCampaigns: Record<string, Campaign>
  producedRuns: Record<string, string>
  producingBrief: string | null
  onProduce: (briefId: string) => void
  onApprove: () => void
  approveState: 'idle' | 'loading' | 'success' | 'error'
  rejectOpen: boolean
  onRejectOpen: () => void
  rejectReason: string
  onRejectReasonChange: (v: string) => void
  onReject: () => void
  rejectState: 'idle' | 'loading' | 'success' | 'error'
  onRejectCancel: () => void
  sectionStyle: React.CSSProperties
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 capitalize"
      style={
        active
          ? { background: '#4f46e5', color: '#ffffff' }
          : { background: '#ffffff', color: '#6b7280', border: '1px solid #e5e7eb' }
      }
    >
      {label}
    </button>
  )
}

export function StrategyTab({
  briefs, run, tenantId, creativeBrief, creativePackage, copyVariants, selectedCopyIndex,
  campaign, siblingCampaigns, producedRuns, producingBrief, onProduce, onApprove, approveState,
  rejectOpen, onRejectOpen, rejectReason, onRejectReasonChange, onReject, rejectState, onRejectCancel,
  sectionStyle,
}: StrategyTabProps) {
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [showDebate, setShowDebate] = useState(false)
  const [confirmProduceBrief, setConfirmProduceBrief] = useState<string | null>(null)

  const winnerBriefId = run?.selectedBriefId
  const isWinner = (b: IntelligenceBrief) => b.selected === true || b.briefId === winnerBriefId
  const isProduced = (b: IntelligenceBrief) => isWinner(b) || !!producedRuns[b.briefId]

  const platforms = useMemo(() => [...new Set(briefs.map((b) => b.platform).filter(Boolean))] as string[], [briefs])
  const sources = useMemo(() => [...new Set(briefs.map((b) => b.ideaSource).filter(Boolean))] as string[], [briefs])

  const filteredBriefs = useMemo(() => {
    let result = [...briefs]
    if (filterPlatform !== 'all') result = result.filter((b) => b.platform === filterPlatform)
    if (filterSource !== 'all') result = result.filter((b) => b.ideaSource === filterSource)
    result.sort((a, b) => {
      if (isWinner(a) && !isWinner(b)) return -1
      if (!isWinner(a) && isWinner(b)) return 1
      switch (sortKey) {
        case 'score': return (b.finalScore ?? 0) - (a.finalScore ?? 0)
        case 'platform': return (a.platform ?? '').localeCompare(b.platform ?? '')
        case 'source': return (a.ideaSource ?? '').localeCompare(b.ideaSource ?? '')
        default: return 0
      }
    })
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefs, filterPlatform, filterSource, sortKey, winnerBriefId])

  const selectedBrief = briefs.find((b) => b.briefId === selectedBriefId)
  const winnerBrief = briefs.find((b) => isWinner(b))
  const ideasCount = run?.briefsGenerated ?? briefs.length

  return (
    <div className="rounded-2xl overflow-hidden" style={sectionStyle}>
      {/* Header */}
      <div className="px-6 pt-6 pb-3">
        <div className="flex items-center gap-3">
          <Sparkles size={16} style={{ color: '#4f46e5' }} />
          <h2 className="text-base font-bold" style={{ color: '#111827' }}>Strategy</h2>
          <span className="text-sm text-gray-400 font-mono">{ideasCount} idea{ideasCount !== 1 ? 's' : ''}</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
      </div>

      {briefs.length === 0 ? (
        <div className="px-6 pb-6">
          <div className="rounded-xl p-10 text-center bg-gray-50 border border-dashed border-gray-200">
            <Lightbulb size={28} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-400">No intelligence briefs available yet.</p>
            <p className="text-xs mt-1 text-gray-300">Briefs will appear once the intelligence phase completes.</p>
          </div>
        </div>
      ) : (
        <div className="px-6 pb-6 flex flex-col gap-5">

          {/* AI Decision Summary — LIGHT */}
          {(creativeBrief?.debateRationale || creativeBrief?.selectionReason) && winnerBrief && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5 animate-fade-up">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-100">
                  <Brain size={16} style={{ color: '#4f46e5' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#4f46e5' }}>AI Decision</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white border border-indigo-200" style={{ color: '#4338ca' }}>
                      <Star size={8} fill="currentColor" /> {winnerBrief.topic}
                    </span>
                    {winnerBrief.finalScore !== undefined && (
                      <span className="text-xs font-mono font-bold" style={{ color: winnerBrief.finalScore >= 8 ? '#059669' : winnerBrief.finalScore >= 6 ? '#d97706' : '#dc2626' }}>
                        {winnerBrief.finalScore.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#4b5563' }}>
                    {creativeBrief?.debateRationale || creativeBrief?.selectionReason}
                  </p>
                  {creativeBrief?.debateLog && creativeBrief.debateLog.length > 0 && (
                    <button
                      onClick={() => setShowDebate(!showDebate)}
                      className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold transition-all"
                      style={{ color: '#4f46e5' }}
                    >
                      {showDebate ? 'Hide debate' : `View debate \u2014 ${creativeBrief.debateLog.length} rounds`}
                      <ChevronDown size={12} className="transition-transform duration-200" style={{ transform: showDebate ? 'rotate(180deg)' : 'rotate(0)' }} />
                    </button>
                  )}
                </div>
              </div>
              {showDebate && creativeBrief?.debateLog && (
                <div className="mt-4 pt-4 border-t border-indigo-100">
                  <DebateLog rounds={creativeBrief.debateLog} rationale={creativeBrief.debateRationale} />
                </div>
              )}
            </div>
          )}

          {/* Filter bar */}
          {briefs.length > 2 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown size={11} className="text-gray-400" />
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg cursor-pointer bg-white border border-gray-200 text-gray-600 outline-none"
                >
                  <option value="score">By Score</option>
                  <option value="platform">By Platform</option>
                  <option value="source">By Source</option>
                </select>
              </div>

              {platforms.length > 1 && (
                <>
                  <div className="w-px h-4 bg-gray-200" />
                  <FilterPill label="All" active={filterPlatform === 'all'} onClick={() => setFilterPlatform('all')} />
                  {platforms.map((p) => (
                    <FilterPill key={p} label={p} active={filterPlatform === p} onClick={() => setFilterPlatform(p)} />
                  ))}
                </>
              )}

              {sources.length > 1 && (
                <>
                  <div className="w-px h-4 bg-gray-200" />
                  {sources.map((s) => (
                    <FilterPill key={s} label={s.replace(/_/g, ' ')} active={filterSource === s} onClick={() => setFilterSource(filterSource === s ? 'all' : s)} />
                  ))}
                </>
              )}

              {(filterPlatform !== 'all' || filterSource !== 'all') && (
                <button onClick={() => { setFilterPlatform('all'); setFilterSource('all') }} className="text-[10px] font-semibold px-2 py-1 rounded-full text-red-500 hover:bg-red-50">
                  <X size={10} className="inline mr-0.5" /> Clear
                </button>
              )}

              <span className="text-[11px] font-mono ml-auto text-gray-400">{filteredBriefs.length}/{briefs.length}</span>
            </div>
          )}

          {/* Ideas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredBriefs.map((brief, idx) => (
              <IdeaCard
                key={brief.briefId}
                brief={brief}
                isWinner={isWinner(brief)}
                isProduced={isProduced(brief)}
                isSelected={selectedBriefId === brief.briefId}
                onClick={() => setSelectedBriefId(brief.briefId)}
                index={idx}
              />
            ))}
          </div>

          {/* Productions list */}
          {Object.keys(siblingCampaigns).length > 0 && (
            <div className="rounded-xl p-4 bg-indigo-50 border border-indigo-100">
              <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#4338ca' }}>Productions from this run</p>
              <div className="flex flex-col gap-2">
                {Object.entries(siblingCampaigns).map(([briefId, camp]) => {
                  const matchedBrief = briefs.find((b) => b.briefId === briefId)
                  return (
                    <div key={briefId} className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium truncate flex-1 text-gray-600">{matchedBrief?.topic || briefId}</span>
                      <Link href={`/dashboard/${tenantId}/campaigns/${camp._id}`} className="flex items-center gap-1 text-xs font-semibold shrink-0 text-indigo-600 hover:underline no-underline">
                        View <ArrowRight size={11} />
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedBrief && (
        <IdeaDetailPanel
          brief={selectedBrief} isWinner={isWinner(selectedBrief)} isProduced={isProduced(selectedBrief)} tenantId={tenantId}
          creativePackage={isWinner(selectedBrief) ? creativePackage : undefined}
          copyVariants={isWinner(selectedBrief) ? copyVariants : undefined}
          selectedCopyIndex={isWinner(selectedBrief) ? selectedCopyIndex : undefined}
          campaign={isWinner(selectedBrief) ? campaign : undefined}
          producedCampaign={siblingCampaigns[selectedBrief.briefId]}
          onProduce={!isProduced(selectedBrief) ? () => setConfirmProduceBrief(selectedBrief.briefId) : undefined}
          producing={producingBrief === selectedBrief.briefId}
          onApprove={isWinner(selectedBrief) ? onApprove : undefined} approveState={approveState}
          onRejectOpen={isWinner(selectedBrief) ? onRejectOpen : undefined} rejectOpen={rejectOpen}
          rejectReason={rejectReason} onRejectReasonChange={onRejectReasonChange}
          onReject={onReject} rejectState={rejectState} onRejectCancel={onRejectCancel}
          onClose={() => setSelectedBriefId(null)}
        />
      )}

      <ConfirmModal
        open={!!confirmProduceBrief}
        title="Produce this idea?"
        description={`This will start an AI pipeline to generate creative assets and build a campaign for "${briefs.find((b) => b.briefId === confirmProduceBrief)?.topic ?? 'this idea'}".`}
        confirmLabel="Start Production" cancelLabel="Cancel" loading={!!producingBrief}
        onConfirm={() => { if (confirmProduceBrief) { onProduce(confirmProduceBrief); setConfirmProduceBrief(null) } }}
        onCancel={() => setConfirmProduceBrief(null)}
      />
    </div>
  )
}
