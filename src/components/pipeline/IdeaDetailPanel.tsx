'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import {
  X, Star, CheckCircle2, Sparkles, ArrowRight, Loader2, ThumbsUp, XCircle,
  Image as ImageIcon, Video, Copy, Users, DollarSign, Target, Package, ExternalLink,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency } from '@/lib/utils'
import type { IntelligenceBrief, CreativePackage, CopyVariant, Campaign } from '@/types'

const SOURCE_META: Record<string, { label: string; icon: string }> = {
  scout_signal: { label: 'Scout Signal', icon: '📡' },
  viral_trend: { label: 'Viral Trend', icon: '🔥' },
  competitor_gap: { label: 'Competitor Gap', icon: '🎯' },
  market_insight: { label: 'Market Insight', icon: '📊' },
  meta_ads_gap: { label: 'Meta Ads Gap', icon: '🏪' },
}

function LargeScore({ score }: { score?: number }) {
  if (score === undefined || score === null) return null
  const color = score >= 8 ? '#059669' : score >= 6 ? '#d97706' : '#dc2626'
  const pct = Math.min(100, (score / 10) * 100)
  return (
    <div className="flex items-center gap-4">
      <div>
        <span className="text-3xl font-black font-mono tracking-tight" style={{ color }}>{score.toFixed(1)}</span>
        <span className="text-sm font-medium ml-0.5 text-gray-400">/10</span>
      </div>
      <div className="flex-1">
        <div className="h-1.5 rounded-full overflow-hidden bg-gray-100">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.8s ease' }} />
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

interface IdeaDetailPanelProps {
  brief: IntelligenceBrief
  isWinner: boolean
  isProduced: boolean
  tenantId: string
  creativePackage?: CreativePackage
  copyVariants?: CopyVariant[]
  selectedCopyIndex?: number
  campaign?: Campaign
  producedCampaign?: Campaign
  onProduce?: () => void
  producing?: boolean
  onApprove?: () => void
  approveState?: 'idle' | 'loading' | 'success' | 'error'
  onRejectOpen?: () => void
  rejectOpen?: boolean
  rejectReason?: string
  onRejectReasonChange?: (v: string) => void
  onReject?: () => void
  rejectState?: 'idle' | 'loading' | 'success' | 'error'
  onRejectCancel?: () => void
  onClose: () => void
}

export function IdeaDetailPanel({
  brief, isWinner, isProduced, tenantId, creativePackage, copyVariants, selectedCopyIndex,
  campaign, producedCampaign, onProduce, producing, onApprove, approveState,
  onRejectOpen, rejectOpen, rejectReason, onRejectReasonChange, onReject, rejectState, onRejectCancel, onClose,
}: IdeaDetailPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const activeCampaign = campaign ?? producedCampaign
  const src = brief.ideaSource ? SOURCE_META[brief.ideaSource] : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" style={{ animation: 'backdropIn 0.2s ease' }} onClick={onClose} />

      <div className="relative w-full max-w-[580px] h-full flex flex-col bg-white shadow-2xl"
        style={{ animation: 'panelSlideIn 0.3s cubic-bezier(0.22,1,0.36,1) forwards' }}>

        {/* Header — LIGHT */}
        <div className="border-b border-gray-100">
          {isWinner && <div className="h-[2px] bg-indigo-500" />}
          <div className="px-6 pt-5 pb-5">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 flex-wrap mb-3">
              {isWinner ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Star size={9} fill="currentColor" /> Strategy Pick
                </span>
              ) : isProduced ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={9} /> Produced
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-50 text-gray-400">Draft</span>
              )}
              {activeCampaign && <StatusBadge status={activeCampaign.status} />}
              {src && <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-50 text-gray-500">{src.icon} {src.label}</span>}
            </div>

            <h2 className="text-lg font-bold leading-snug mb-4 pr-10" style={{ color: '#111827' }}>{brief.topic}</h2>
            <LargeScore score={brief.finalScore} />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 flex flex-col gap-6">

            {/* Tags */}
            <div className="flex items-center gap-2 flex-wrap">
              {brief.platform && <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-50 text-gray-600 border border-gray-200">{brief.platform}</span>}
              {brief.format && <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">{brief.format}</span>}
              {brief.urgencyScore != null && brief.urgencyScore >= 8 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200">Urgent</span>
              )}
              {brief.sourcePlatforms?.map((p) => (
                <span key={p} className="text-[11px] px-2 py-0.5 rounded bg-gray-50 text-gray-500 capitalize">{p}</span>
              ))}
            </div>

            {/* Strategy Brief */}
            <section>
              <SectionLabel label="Strategy Brief" />
              <div className="rounded-xl overflow-hidden border border-gray-200">
                {brief.angle && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Angle</p>
                    <p className="text-sm leading-relaxed text-gray-700">{brief.angle}</p>
                  </div>
                )}
                {brief.hook && (
                  <div className="px-4 py-3 border-b border-gray-100 bg-indigo-50/30">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Hook</p>
                    <p className="text-sm leading-relaxed text-indigo-900 italic">&ldquo;{brief.hook}&rdquo;</p>
                  </div>
                )}
                {brief.keyMessage && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Key Message</p>
                    <p className="text-sm leading-relaxed text-gray-700">{brief.keyMessage}</p>
                  </div>
                )}
                {brief.conversionBridge && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Conversion Bridge</p>
                    <p className="text-sm leading-relaxed text-gray-700">{brief.conversionBridge}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 bg-gray-50">
                  <div className="px-4 py-3 border-r border-gray-100">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Audience</p>
                    <p className="text-xs font-medium text-gray-700">{brief.audience || '\u2014'}</p>
                  </div>
                  <div className="px-4 py-3 border-r border-gray-100">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Product</p>
                    <p className="text-xs font-medium text-gray-700">{brief.product || '\u2014'}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Budget</p>
                    <p className="text-xs font-medium text-gray-700">{brief.suggestedBudget ? formatCurrency(brief.suggestedBudget) : '\u2014'}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Creative Output */}
            {creativePackage && copyVariants && copyVariants.length > 0 && (
              <section>
                <SectionLabel label="Creative Output" />
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium text-gray-500">Copy Variants ({copyVariants.length})</p>
                  {copyVariants.map((v, idx) => {
                    const isSel = idx === selectedCopyIndex
                    return (
                      <div key={idx} className="rounded-lg p-3.5" style={{
                        background: isSel ? '#eef2ff' : '#f9fafb',
                        border: isSel ? '1.5px solid #4f46e5' : '1px solid #e5e7eb',
                      }}>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          {isSel && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Selected</span>}
                          {v.hookStyle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{v.hookStyle}</span>}
                          {v.cta && <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">{v.cta}</span>}
                        </div>
                        {v.headline && <p className="text-sm font-semibold text-gray-900 mb-1">{v.headline}</p>}
                        <p className="text-xs leading-relaxed text-gray-600">{v.primaryText}</p>
                      </div>
                    )
                  })}

                  {creativePackage.imageUrl && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Generated Image</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={creativePackage.imageUrl} alt="Creative" className="rounded-lg w-full border border-gray-200" />
                    </div>
                  )}
                  {creativePackage.imagePrompt && !creativePackage.imageUrl && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-500"><ImageIcon size={11} className="inline mr-1" />Image Prompt</p>
                        <button onClick={() => navigator.clipboard.writeText(creativePackage.imagePrompt || '')} className="text-[10px] text-gray-400 hover:text-gray-600"><Copy size={10} className="inline mr-0.5" />Copy</button>
                      </div>
                      <div className="rounded-lg p-3 bg-gray-900"><p className="text-xs font-mono leading-relaxed text-gray-400">{creativePackage.imagePrompt}</p></div>
                    </div>
                  )}
                  {creativePackage.videoUrl && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2"><Video size={11} className="inline mr-1" />Video</p>
                      <video controls className="rounded-lg w-full border border-gray-200" style={{ maxHeight: 260 }}><source src={creativePackage.videoUrl} type="video/mp4" /></video>
                    </div>
                  )}
                  {creativePackage.complianceNotes && (
                    <div className="rounded-lg p-3 bg-amber-50 border border-amber-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Compliance</p>
                      <p className="text-xs leading-relaxed text-amber-800">{creativePackage.complianceNotes}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Campaign */}
            {activeCampaign && (
              <section>
                <SectionLabel label="Campaign" />
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <div className="grid grid-cols-3 bg-gray-50">
                    <div className="px-4 py-3 border-r border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Status</p>
                      <StatusBadge status={activeCampaign.status} />
                    </div>
                    <div className="px-4 py-3 border-r border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Budget</p>
                      <p className="text-sm font-bold text-gray-900">{activeCampaign.budget ? formatCurrency(activeCampaign.budget) : '\u2014'}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Objective</p>
                      <p className="text-xs text-gray-600">{activeCampaign.objective || '\u2014'}</p>
                    </div>
                  </div>

                  {isWinner && activeCampaign.status === 'pending_approval' && onApprove && onRejectOpen && (
                    <div className="p-4 border-t border-gray-200">
                      <p className="text-sm font-semibold text-center mb-3 text-gray-700">Awaiting your approval</p>
                      <div className="flex gap-2">
                        <button onClick={onApprove} disabled={approveState !== 'idle'}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-60 bg-emerald-600 text-white hover:bg-emerald-700">
                          {approveState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                          {approveState === 'loading' ? 'Approving...' : approveState === 'success' ? 'Approved!' : 'Approve'}
                        </button>
                        <button onClick={onRejectOpen} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                      {rejectOpen && (
                        <div className="mt-3 rounded-lg p-3 bg-red-50 border border-red-200">
                          <p className="text-xs font-bold text-red-700 mb-1">Reason</p>
                          <textarea value={rejectReason} onChange={(e) => onRejectReasonChange?.(e.target.value)}
                            placeholder="Describe why..." rows={2}
                            className="w-full rounded-lg px-3 py-2 text-xs resize-none bg-white border border-red-200 text-gray-900 outline-none" />
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={onReject} disabled={rejectState === 'loading' || !(rejectReason ?? '').trim()}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 disabled:opacity-50">
                              {rejectState === 'loading' ? 'Rejecting...' : 'Confirm'}
                            </button>
                            <button onClick={onRejectCancel} className="text-xs text-gray-400">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeCampaign._id && activeCampaign.status !== 'pending_approval' && (
                    <Link href={`/dashboard/${tenantId}/campaigns/${activeCampaign._id}`}
                      className="flex items-center justify-between px-4 py-3 text-xs font-semibold border-t border-gray-200 text-indigo-600 hover:bg-gray-50 no-underline">
                      View full campaign <ExternalLink size={12} />
                    </Link>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="px-6 py-4 flex items-center gap-3 border-t border-gray-100 bg-gray-50/50">
          {!isProduced && onProduce && (
            <button onClick={onProduce} disabled={producing}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60 bg-indigo-600 text-white hover:bg-indigo-700">
              {producing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {producing ? 'Starting...' : 'Produce This Idea'}
            </button>
          )}
          {isProduced && activeCampaign?._id && (
            <Link href={`/dashboard/${tenantId}/campaigns/${activeCampaign._id}`}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 no-underline">
              View Campaign <ArrowRight size={14} />
            </Link>
          )}
          {isProduced && !activeCampaign && (
            <div className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium bg-gray-50 text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Preparing...
            </div>
          )}
          <button onClick={onClose} className="px-4 py-3 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  )
}
