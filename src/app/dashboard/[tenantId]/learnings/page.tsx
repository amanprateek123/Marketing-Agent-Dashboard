'use client'

import { useState, useEffect, use } from 'react'
import {
  BookOpen,
  Loader2,
  Download,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Search,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import type { Company, CaseStudy } from '@/types'

const API_BASE = 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

function CaseStudyCard({ study }: { study: CaseStudy }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: '#ffffff',
        border: '1px solid #e4e4e7',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 transition-colors text-left"
        style={{ background: expanded ? '#fafafa' : '#ffffff' }}
      >
        <div className="flex items-center gap-4 flex-wrap min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: '#18181b' }}>
              {study.campaignName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
              {study.product}
            </p>
          </div>
          {study.dateRange && (
            <span className="text-xs shrink-0" style={{ color: '#a1a1aa' }}>
              {study.dateRange}
            </span>
          )}
          {study.totalSpend !== undefined && (
            <span className="text-xs font-semibold shrink-0" style={{ color: '#15803d' }}>
              {formatCurrency(study.totalSpend)}
            </span>
          )}
          {study.totalConversions !== undefined && (
            <span className="text-xs shrink-0" style={{ color: '#71717a' }}>
              {study.totalConversions} conv.
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={cn('transition-transform shrink-0', expanded && 'rotate-180')}
          style={{ color: '#a1a1aa' }}
        />
      </button>

      {expanded && (
        <div
          className="px-5 pb-5 flex flex-col gap-4"
          style={{ borderTop: '1px solid #f0f0f1' }}
        >
          {study.context && (
            <p className="text-sm leading-relaxed mt-4" style={{ color: '#71717a' }}>
              {study.context}
            </p>
          )}

          {study.whatWorked && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#15803d' }}>
                ✅ What Worked
              </p>
              <div className="flex flex-col gap-1.5">
                {study.whatWorked.hooks && study.whatWorked.hooks.length > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Hooks</p>
                    <div className="flex flex-wrap gap-1.5">
                      {study.whatWorked.hooks.map((h, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' }}
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {study.whatWorked.audiences && study.whatWorked.audiences.length > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Audiences</p>
                    <div className="flex flex-wrap gap-1.5">
                      {study.whatWorked.audiences.map((a, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#dbeafe', border: '1px solid #bfdbfe', color: '#1d4ed8' }}
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {study.whatWorked.formats && study.whatWorked.formats.length > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Formats</p>
                    <div className="flex flex-wrap gap-1.5">
                      {study.whatWorked.formats.map((f, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309' }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-3 flex-wrap mt-1">
                  {study.whatWorked.bestCPA !== undefined && (
                    <div
                      className="rounded-lg px-3 py-1.5"
                      style={{ background: '#f4f4f5', border: '1px solid #e4e4e7' }}
                    >
                      <p className="text-xs" style={{ color: '#a1a1aa' }}>Best CPA</p>
                      <p className="text-xs font-semibold" style={{ color: '#18181b' }}>
                        {formatCurrency(study.whatWorked.bestCPA)}
                      </p>
                    </div>
                  )}
                  {study.whatWorked.bestROAS !== undefined && (
                    <div
                      className="rounded-lg px-3 py-1.5"
                      style={{ background: '#f4f4f5', border: '1px solid #e4e4e7' }}
                    >
                      <p className="text-xs" style={{ color: '#a1a1aa' }}>Best ROAS</p>
                      <p className="text-xs font-semibold" style={{ color: '#15803d' }}>
                        {study.whatWorked.bestROAS.toFixed(2)}x
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {study.whatFailed &&
            (study.whatFailed.hooks?.length ||
              study.whatFailed.audiences?.length ||
              study.whatFailed.reason) && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#b91c1c' }}>
                  ❌ What Failed
                </p>
                <div className="flex flex-col gap-1.5">
                  {study.whatFailed.hooks && study.whatFailed.hooks.length > 0 && (
                    <div>
                      <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Hooks</p>
                      <div className="flex flex-wrap gap-1.5">
                        {study.whatFailed.hooks.map((h, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {study.whatFailed.audiences && study.whatFailed.audiences.length > 0 && (
                    <div>
                      <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Audiences</p>
                      <div className="flex flex-wrap gap-1.5">
                        {study.whatFailed.audiences.map((a, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {study.whatFailed.reason && (
                    <p className="text-xs italic" style={{ color: '#a1a1aa' }}>
                      {study.whatFailed.reason}
                    </p>
                  )}
                </div>
              </div>
            )}

          {study.lesson && (
            <div
              className="rounded-xl p-3"
              style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: '#0284c7' }}>
                💡 Lesson
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#0369a1' }}>
                {study.lesson}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function LearningsPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const { tenantId } = resolvedParams

  const [company, setCompany] = useState<Company | null>(null)
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importPhase, setImportPhase] = useState<'idle' | 'importing' | 'completed' | 'failed'>('idle')
  const [importProgress, setImportProgress] = useState<{
    status: string
    progress: number
    completedBatches: number
    totalBatches: number
    enrichedCount: number
    caseStudyCount: number
  } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function fetchData() {
    try {
      const [companyRes, studiesRes] = await Promise.all([
        fetch(`${API_BASE}/companies/${tenantId}`),
        fetch(`${API_BASE}/companies/${tenantId}/case-studies`),
      ])
      if (!companyRes.ok) throw new Error(`HTTP ${companyRes.status}`)
      const companyData: Company = await companyRes.json()
      setCompany(companyData)
      if (studiesRes.ok) {
        const studies: CaseStudy[] = await studiesRes.json()
        setCaseStudies(studies)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learnings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function handleImport() {
    setImportPhase('importing')
    setImportProgress(null)
    setImportError(null)
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}/import-learnings`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/companies/${tenantId}/import-status`)
          if (!statusRes.ok) return
          const data = await statusRes.json()
          setImportProgress(data)
          if (data.status === 'completed') {
            clearInterval(poll)
            setImportPhase('completed')
            await fetchData()
          } else if (data.status === 'failed') {
            clearInterval(poll)
            setImportPhase('failed')
            setImportError('Import failed on the server.')
          }
        } catch {
          // keep polling on transient errors
        }
      }, 5000)
    } catch (err) {
      setImportPhase('failed')
      setImportError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f4f4f5' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: '#0284c7' }} />
          <p className="text-sm" style={{ color: '#71717a' }}>Loading learnings...</p>
        </div>
      </div>
    )
  }

  const creativeLearnings = company?.learnings?.creative
  const campaignLearnings = company?.learnings?.campaign

  const filteredStudies = caseStudies
    .filter((s) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return s.campaignName.toLowerCase().includes(q) || s.product.toLowerCase().includes(q)
    })
    .sort((a, b) => (b.whatWorked?.bestROAS ?? 0) - (a.whatWorked?.bestROAS ?? 0))

  const tableStyle = {
    background: '#ffffff',
    border: '1px solid #e4e4e7',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <BookOpen size={18} style={{ color: '#0284c7' }} />
              <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181b' }}>
                Learnings
              </h1>
            </div>
            <p className="text-sm" style={{ color: '#71717a' }}>
              AI-synthesized insights from past campaign performance
            </p>
          </div>
          <button
            onClick={handleImport}
            disabled={importPhase === 'importing'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={
              importPhase === 'importing'
                ? { background: '#f4f4f5', color: '#a1a1aa', cursor: 'not-allowed' }
                : importPhase === 'completed'
                ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
                : importPhase === 'failed'
                ? { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
                : { background: '#0284c7', color: '#ffffff' }
            }
          >
            {importPhase === 'importing' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : importPhase === 'completed' ? (
              <CheckCircle size={14} />
            ) : importPhase === 'failed' ? (
              <AlertCircle size={14} />
            ) : (
              <Download size={14} />
            )}
            {importPhase === 'importing'
              ? 'Importing...'
              : importPhase === 'completed'
              ? 'Done!'
              : importPhase === 'failed'
              ? 'Retry'
              : 'Import from Meta'}
          </button>
        </div>

        {/* Progress bar */}
        {(importPhase === 'importing' || importPhase === 'completed') && importProgress && (
          <div
            className="mt-4 rounded-xl p-4 flex flex-col gap-3"
            style={{ background: '#ffffff', border: '1px solid #e4e4e7' }}
          >
            <div className="flex items-center justify-between text-xs">
              <span
                className="font-medium capitalize"
                style={{
                  color:
                    importProgress.status === 'completed'
                      ? '#15803d'
                      : '#0284c7',
                }}
              >
                {importProgress.status === 'completed'
                  ? '✓ Completed'
                  : importProgress.status === 'failed'
                  ? '✗ Failed'
                  : `${importProgress.status}…`}
              </span>
              <span style={{ color: '#71717a' }}>
                {importProgress.completedBatches}/{importProgress.totalBatches} batches
                {importProgress.caseStudyCount > 0 &&
                  ` · ${importProgress.caseStudyCount} case studies`}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#e4e4e7' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${importProgress.progress}%`,
                  background: importProgress.status === 'completed' ? '#15803d' : '#0284c7',
                }}
              />
            </div>
          </div>
        )}
        {importPhase === 'failed' && importError && (
          <p className="text-xs mt-2" style={{ color: '#b91c1c' }}>
            {importError}
          </p>
        )}
      </div>

      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm"
          style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
        >
          {error}
        </div>
      )}

      {/* ===== SECTION A: PATTERN MEMORY ===== */}
      <div className="mb-8">
        <h2 className="text-base font-semibold mb-4" style={{ color: '#18181b' }}>
          Pattern Memory
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Winning hooks */}
          <div className="rounded-xl p-5" style={tableStyle}>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: '#15803d' }}
            >
              Winning Hooks
            </h3>
            {!creativeLearnings?.winningHooks || creativeLearnings.winningHooks.length === 0 ? (
              <p className="text-xs italic py-2" style={{ color: '#a1a1aa' }}>
                No winning hooks recorded yet.
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f1' }}>
                    <th className="pb-2 text-left text-xs font-semibold" style={{ color: '#a1a1aa' }}>Hook Style</th>
                    <th className="pb-2 text-right text-xs font-semibold" style={{ color: '#a1a1aa' }}>Avg CTR</th>
                    <th className="pb-2 text-right text-xs font-semibold" style={{ color: '#a1a1aa' }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {creativeLearnings.winningHooks.map((hook, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f4f4f5' }}>
                      <td className="py-2 text-sm" style={{ color: '#18181b' }}>{hook.hookStyle}</td>
                      <td className="py-2 text-right text-sm font-semibold" style={{ color: '#15803d' }}>
                        {(hook.avgCTR * 100).toFixed(2)}%
                      </td>
                      <td className="py-2 text-right text-xs" style={{ color: '#a1a1aa' }}>{hook.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Losing hooks */}
          {creativeLearnings?.losingHooks && creativeLearnings.losingHooks.length > 0 && (
            <div className="rounded-xl p-5" style={tableStyle}>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: '#b91c1c' }}
              >
                Losing Hooks
              </h3>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f1' }}>
                    <th className="pb-2 text-left text-xs font-semibold" style={{ color: '#a1a1aa' }}>Hook Style</th>
                    <th className="pb-2 text-right text-xs font-semibold" style={{ color: '#a1a1aa' }}>Avg CTR</th>
                    <th className="pb-2 text-right text-xs font-semibold" style={{ color: '#a1a1aa' }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {creativeLearnings.losingHooks.map((hook, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f4f4f5' }}>
                      <td className="py-2 text-sm" style={{ color: '#18181b' }}>{hook.hookStyle}</td>
                      <td className="py-2 text-right text-sm font-semibold" style={{ color: '#b91c1c' }}>
                        {(hook.avgCTR * 100).toFixed(2)}%
                      </td>
                      <td className="py-2 text-right text-xs" style={{ color: '#a1a1aa' }}>{hook.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Best formats */}
          {creativeLearnings?.bestFormats && creativeLearnings.bestFormats.length > 0 && (
            <div className="rounded-xl p-5" style={tableStyle}>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: '#b45309' }}
              >
                Best Formats
              </h3>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f1' }}>
                    <th className="pb-2 text-left text-xs font-semibold" style={{ color: '#a1a1aa' }}>Format</th>
                    <th className="pb-2 text-right text-xs font-semibold" style={{ color: '#a1a1aa' }}>Conversion Share</th>
                  </tr>
                </thead>
                <tbody>
                  {creativeLearnings.bestFormats.map((fmt, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f4f4f5' }}>
                      <td className="py-2 text-sm" style={{ color: '#18181b' }}>{fmt.format}</td>
                      <td className="py-2 text-right text-sm font-semibold" style={{ color: '#b45309' }}>
                        {(fmt.conversionShare * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Audience ROAS */}
          {campaignLearnings?.audiencePerformance && campaignLearnings.audiencePerformance.length > 0 && (
            <div className="rounded-xl p-5" style={tableStyle}>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: '#0284c7' }}
              >
                Audience ROAS
              </h3>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f1' }}>
                    <th className="pb-2 text-left text-xs font-semibold" style={{ color: '#a1a1aa' }}>Audience Type</th>
                    <th className="pb-2 text-right text-xs font-semibold" style={{ color: '#a1a1aa' }}>ROAS</th>
                    <th className="pb-2 text-right text-xs font-semibold" style={{ color: '#a1a1aa' }}>Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignLearnings.audiencePerformance.map((aud, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f4f4f5' }}>
                      <td className="py-2 text-sm" style={{ color: '#18181b' }}>{aud.audienceType}</td>
                      <td className="py-2 text-right text-sm font-semibold" style={{ color: '#15803d' }}>
                        {aud.roas.toFixed(2)}x
                      </td>
                      <td className="py-2 text-right text-xs" style={{ color: '#71717a' }}>{aud.conversions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Budget insights */}
        {campaignLearnings?.budgetInsights && campaignLearnings.budgetInsights.length > 0 && (
          <div className="rounded-xl p-5 mb-4" style={tableStyle}>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: '#a1a1aa' }}
            >
              Budget Insights
            </h3>
            <ul className="flex flex-col gap-1.5">
              {campaignLearnings.budgetInsights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: '#52525b' }}>
                  <span className="mt-0.5 shrink-0" style={{ color: '#0284c7' }}>•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Seasonal peaks */}
        {campaignLearnings?.seasonalPeaks && campaignLearnings.seasonalPeaks.length > 0 && (
          <div className="rounded-xl p-5 mb-4" style={tableStyle}>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: '#a1a1aa' }}
            >
              Seasonal Peaks
            </h3>
            <ul className="flex flex-col gap-1.5">
              {campaignLearnings.seasonalPeaks.map((peak, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: '#52525b' }}>
                  <span className="mt-0.5 shrink-0" style={{ color: '#b45309' }}>•</span>
                  {peak}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ===== SECTION B: CASE STUDIES ===== */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h2 className="text-base font-semibold" style={{ color: '#18181b' }}>
            Case Studies
          </h2>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a1a1aa' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by campaign or product..."
              className="rounded-lg pl-8 pr-4 py-2 text-sm w-72"
              style={{
                background: '#ffffff',
                border: '1px solid #e4e4e7',
                color: '#18181b',
              }}
            />
          </div>
        </div>

        {filteredStudies.length === 0 ? (
          <div
            className="rounded-xl py-12 text-center"
            style={{ background: '#ffffff', border: '1px solid #e4e4e7' }}
          >
            <BookOpen size={28} className="mx-auto mb-3" style={{ color: '#d4d4d8' }} />
            <p className="text-sm font-medium" style={{ color: '#a1a1aa' }}>
              {search ? 'No case studies match your search' : 'No case studies yet'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#d4d4d8' }}>
              {search
                ? 'Try a different search term'
                : 'Case studies are created automatically as campaigns complete'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredStudies.map((study, idx) => (
              <CaseStudyCard key={study._id || idx} study={study} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
