'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import {
  X, Star, CheckCircle2, Sparkles, ArrowRight, Loader2, ThumbsUp, XCircle,
  Image as ImageIcon, Video, Copy, ExternalLink,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  AudienceStageBadge,
  ExplorationBadge,
  FormatBadge,
  HookStyleChip,
} from '@/components/badges'
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
  const color = score >= 8 ? 'var(--good)' : score >= 6 ? 'var(--warn)' : 'var(--bad)'
  const pct = Math.min(100, (score / 10) * 100)
  return (
    <div className="flex items-center gap-4">
      <div>
        <span className="display-num text-4xl" style={{ color }}>{score.toFixed(1)}</span>
        <span className="text-sm font-medium ml-0.5" style={{ color: 'var(--ink-3)' }}>/10</span>
      </div>
      <div className="flex-1">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.8s ease' }} />
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="micro-label">{label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--hairline-light)' }} />
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
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(28,25,23,0.32)', animation: 'backdropIn 0.2s ease' }} onClick={onClose} />

      <div className="relative w-full max-w-[580px] h-full flex flex-col"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-overlay)', animation: 'panelSlideIn 0.3s cubic-bezier(0.22,1,0.36,1) forwards' }}>

        {/* Header — LIGHT */}
        <div style={{ borderBottom: '1px solid var(--hairline-light)' }}>
          {isWinner && <div className="h-[2px]" style={{ background: 'var(--accent)' }} />}
          <div className="px-6 pt-5 pb-5">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg transition-colors" style={{ color: 'var(--ink-3)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--muted)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 flex-wrap mb-3">
              {isWinner ? (
                <span className="chip chip-accent">
                  <Star size={9} fill="currentColor" /> Strategy Pick
                </span>
              ) : isProduced ? (
                <span className="chip chip-good">
                  <CheckCircle2 size={9} /> Produced
                </span>
              ) : (
                <span className="chip chip-neutral">Draft</span>
              )}
              {activeCampaign && <StatusBadge status={activeCampaign.status} />}
              {src && <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}>{src.icon} {src.label}</span>}
            </div>

            <h2 className="font-display text-xl leading-snug mb-4 pr-10" style={{ color: 'var(--ink)' }}>{brief.topic}</h2>
            <LargeScore score={brief.finalScore} />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 flex flex-col gap-6">

            {/* Tags */}
            <div className="flex items-center gap-2 flex-wrap">
              <AudienceStageBadge stage={brief.audienceStage} />
              {brief.explorationArm && <ExplorationBadge />}
              {brief.platform && <span className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: 'var(--muted)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>{brief.platform}</span>}
              {brief.format && <span className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>{brief.format}</span>}
              {brief.urgencyScore != null && brief.urgencyScore >= 8 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }}>Urgent</span>
              )}
              {brief.sourcePlatforms?.map((p) => (
                <span key={p} className="text-[11px] px-2 py-0.5 rounded capitalize" style={{ background: 'var(--muted)', color: 'var(--ink-3)' }}>{p}</span>
              ))}
            </div>

            {/* Source signals — the specific coordinator signals that inspired
                this brief (signal→outcome traceability). */}
            {brief.sourceSignals && brief.sourceSignals.length > 0 && (
              <section>
                <SectionLabel label="Inspired By" />
                <div className="flex flex-col gap-1.5">
                  {brief.sourceSignals.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg px-3 py-2"
                      style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
                    >
                      <span className="mono text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--surface)', color: 'var(--info)', border: '1px solid var(--info-border)' }}>
                        {Number(s.compositeScore).toFixed(1)}
                      </span>
                      <p className="text-xs leading-snug min-w-0 truncate" style={{ color: 'var(--ink)' }} title={s.topic}>{s.topic}</p>
                      <span className="ml-auto text-[10px] capitalize shrink-0" style={{ color: 'var(--info)' }}>
                        {(s.platforms ?? []).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Strategy Brief */}
            <section>
              <SectionLabel label="Strategy Brief" />
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
                {brief.angle && (
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline-light)' }}>
                    <p className="micro-label mb-1">Angle</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>{brief.angle}</p>
                  </div>
                )}
                {brief.hook && (
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline-light)', background: 'var(--accent-bg)' }}>
                    <p className="micro-label mb-1">Hook</p>
                    <p className="text-sm leading-relaxed italic" style={{ color: 'var(--accent-strong)' }}>&ldquo;{brief.hook}&rdquo;</p>
                  </div>
                )}
                {brief.keyMessage && (
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline-light)' }}>
                    <p className="micro-label mb-1">Key Message</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>{brief.keyMessage}</p>
                  </div>
                )}
                {brief.conversionBridge && (
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline-light)' }}>
                    <p className="micro-label mb-1">Conversion Bridge</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>{brief.conversionBridge}</p>
                  </div>
                )}
                <div className="grid grid-cols-3" style={{ background: 'var(--surface-warm)' }}>
                  <div className="px-4 py-3" style={{ borderRight: '1px solid var(--hairline-light)' }}>
                    <p className="micro-label text-[9px] mb-0.5">Audience</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>{brief.audience || '—'}</p>
                  </div>
                  <div className="px-4 py-3" style={{ borderRight: '1px solid var(--hairline-light)' }}>
                    <p className="micro-label text-[9px] mb-0.5">Product</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>{brief.product || '—'}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="micro-label text-[9px] mb-0.5">Budget</p>
                    <p className="mono text-xs font-medium" style={{ color: 'var(--ink-2)' }}>{brief.suggestedBudget ? formatCurrency(brief.suggestedBudget) : '—'}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Per-Ad-Set Performance — populated after Day 7/14/30 captures */}
            {brief.adSetPerformance && brief.adSetPerformance.length > 0 && (
              <section>
                <SectionLabel label="Ad-Set Performance" />
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ad Set</th>
                        <th>Day</th>
                        <th className="num">Spend</th>
                        <th className="num">Conv.</th>
                        <th className="num">CTR</th>
                        <th className="num">CPA</th>
                        <th className="num">ROAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brief.adSetPerformance.map((p, i) => {
                        const roasColor = p.roas >= 2 ? 'var(--good)' : p.roas >= 1 ? 'var(--warn)' : 'var(--bad)'
                        return (
                          <tr key={`${p.adSetId}-${p.capturedAtDay}-${i}`}>
                            <td className="px-3 py-2.5">
                              <p className="text-xs font-semibold truncate" style={{ color: 'var(--ink)' }} title={p.name}>{p.name}</p>
                              <div className="flex items-center gap-1 flex-wrap mt-1">
                                {p.audienceType && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize" style={{ background: 'var(--muted)', color: 'var(--ink-3)' }}>
                                    {p.audienceType.replace(/_/g, ' ')}
                                  </span>
                                )}
                                {p.formats?.map((f) => <FormatBadge key={f} format={f} />)}
                                {p.hookStyles?.slice(0, 2).map((h) => <HookStyleChip key={h} style={h} />)}
                                {p.hookStyles && p.hookStyles.length > 2 && (
                                  <span className="text-[10px]" style={{ color: 'var(--ink-3)' }}>+{p.hookStyles.length - 2}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}>D{p.capturedAtDay}</span>
                            </td>
                            <td className="num mono text-xs">{formatCurrency(p.spend)}</td>
                            <td className="num mono text-xs font-medium" style={{ color: 'var(--ink)' }}>{p.conversions}</td>
                            <td className="num mono text-xs">{p.ctr.toFixed(2)}%</td>
                            <td className="num mono text-xs">{formatCurrency(p.cpa)}</td>
                            <td className="num mono text-xs font-bold" style={{ color: roasColor }}>
                              {p.roas.toFixed(2)}x
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Creative Output */}
            {creativePackage && copyVariants && copyVariants.length > 0 && (
              <section>
                <SectionLabel label="Creative Output" />
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>Copy Variants ({copyVariants.length})</p>
                  {copyVariants.map((v, idx) => {
                    const isSel = idx === selectedCopyIndex
                    return (
                      <div key={idx} className="rounded-lg p-3.5" style={{
                        background: isSel ? 'var(--accent-bg)' : 'var(--surface-warm)',
                        border: isSel ? '1.5px solid var(--accent)' : '1px solid var(--hairline)',
                      }}>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          {isSel && <span className="chip chip-accent">Selected</span>}
                          {v.hookStyle && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-3)' }}>{v.hookStyle}</span>}
                          {v.cta && <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>{v.cta}</span>}
                        </div>
                        {v.headline && <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{v.headline}</p>}
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>{v.primaryText}</p>
                      </div>
                    )
                  })}

                  {creativePackage.images?.[selectedCopyIndex ?? 0]?.imageUrl && (
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--ink-3)' }}>Generated Image</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={creativePackage.images[selectedCopyIndex ?? 0]!.imageUrl} alt="Creative" className="rounded-lg w-full" style={{ border: '1px solid var(--hairline)' }} />
                    </div>
                  )}
                  {creativePackage.imagePrompt && !creativePackage.images?.[selectedCopyIndex ?? 0]?.imageUrl && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}><ImageIcon size={11} className="inline mr-1" />Image Prompt</p>
                        <button onClick={() => navigator.clipboard.writeText(creativePackage.imagePrompt || '')} className="text-[10px] transition-colors" style={{ color: 'var(--ink-3)' }}><Copy size={10} className="inline mr-0.5" />Copy</button>
                      </div>
                      <div className="card-inset rounded-lg p-3"><p className="mono text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>{creativePackage.imagePrompt}</p></div>
                    </div>
                  )}
                  {creativePackage.video?.videoUrl && (
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--ink-3)' }}><Video size={11} className="inline mr-1" />Video</p>
                      <video controls className="rounded-lg w-full" style={{ maxHeight: 260, border: '1px solid var(--hairline)' }}><source src={creativePackage.video.videoUrl} type="video/mp4" /></video>
                    </div>
                  )}
                  {creativePackage.complianceNotes && (
                    <div className="rounded-lg p-3" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
                      <p className="micro-label mb-1" style={{ color: 'var(--warn)' }}>Compliance</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--warn)' }}>{creativePackage.complianceNotes}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Campaign */}
            {activeCampaign && (
              <section>
                <SectionLabel label="Campaign" />
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
                  <div className="grid grid-cols-3" style={{ background: 'var(--surface-warm)' }}>
                    <div className="px-4 py-3" style={{ borderRight: '1px solid var(--hairline-light)' }}>
                      <p className="micro-label text-[9px] mb-1">Status</p>
                      <StatusBadge status={activeCampaign.status} />
                    </div>
                    <div className="px-4 py-3" style={{ borderRight: '1px solid var(--hairline-light)' }}>
                      <p className="micro-label text-[9px] mb-1">Budget</p>
                      <p className="display-num text-base" style={{ color: 'var(--ink)' }}>{activeCampaign.budget ? formatCurrency(activeCampaign.budget) : '—'}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="micro-label text-[9px] mb-1">Objective</p>
                      <p className="text-xs" style={{ color: 'var(--ink-2)' }}>{activeCampaign.objective || '—'}</p>
                    </div>
                  </div>

                  {isWinner && activeCampaign.status === 'pending_approval' && onApprove && onRejectOpen && (
                    <div className="p-4" style={{ borderTop: '1px solid var(--hairline)' }}>
                      <p className="text-sm font-semibold text-center mb-3" style={{ color: 'var(--ink-2)' }}>Awaiting your approval</p>
                      <div className="flex gap-2">
                        <button onClick={onApprove} disabled={approveState !== 'idle'}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-bold transition-all disabled:opacity-60"
                          style={{ background: 'var(--good)', color: '#fff' }}>
                          {approveState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                          {approveState === 'loading' ? 'Approving...' : approveState === 'success' ? 'Approved!' : 'Approve'}
                        </button>
                        <button onClick={onRejectOpen} className="btn btn-danger flex-1">
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                      {rejectOpen && (
                        <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}>
                          <p className="text-xs font-bold mb-1" style={{ color: 'var(--bad)' }}>Reason</p>
                          <textarea value={rejectReason} onChange={(e) => onRejectReasonChange?.(e.target.value)}
                            placeholder="Describe why..." rows={2}
                            className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
                            style={{ background: 'var(--surface)', border: '1px solid var(--bad-border)', color: 'var(--ink)' }} />
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={onReject} disabled={rejectState === 'loading' || !(rejectReason ?? '').trim()}
                              className="btn btn-danger px-3 py-1.5 text-xs">
                              {rejectState === 'loading' ? 'Rejecting...' : 'Confirm'}
                            </button>
                            <button onClick={onRejectCancel} className="text-xs" style={{ color: 'var(--ink-3)' }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeCampaign._id && activeCampaign.status !== 'pending_approval' && (
                    <Link href={`/dashboard/${tenantId}/campaigns/${activeCampaign._id}`}
                      className="flex items-center justify-between px-4 py-3 text-xs font-semibold no-underline transition-colors"
                      style={{ borderTop: '1px solid var(--hairline)', color: 'var(--accent)' }}>
                      View full campaign <ExternalLink size={12} />
                    </Link>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderTop: '1px solid var(--hairline-light)', background: 'var(--surface-warm)' }}>
          {!isProduced && onProduce && (
            <button onClick={onProduce} disabled={producing}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-[10px] text-sm font-bold transition-all disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {producing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {producing ? 'Starting...' : 'Produce This Idea'}
            </button>
          )}
          {isProduced && activeCampaign?._id && (
            <Link href={`/dashboard/${tenantId}/campaigns/${activeCampaign._id}`}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-[10px] text-sm font-bold no-underline"
              style={{ background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)' }}>
              View Campaign <ArrowRight size={14} />
            </Link>
          )}
          {isProduced && !activeCampaign && (
            <div className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-[10px] text-sm font-medium"
              style={{ background: 'var(--muted)', color: 'var(--ink-3)' }}>
              <Loader2 size={14} className="animate-spin" /> Preparing...
            </div>
          )}
          <button onClick={onClose} className="btn btn-ghost px-4 py-3">Close</button>
        </div>
      </div>
    </div>
  )
}
