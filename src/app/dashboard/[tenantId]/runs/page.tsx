import Link from 'next/link'
import { Activity } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDateTime } from '@/lib/utils'
import type { PipelineRun } from '@/types'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

export default async function RunsPage({ params }: PageProps) {
  const { tenantId } = await params

  let runs: PipelineRun[] = []
  let error: string | null = null

  try {
    const res = await fetch(`http://localhost:8082/api/v1/pipeline/${tenantId}/runs`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    runs = await res.json()
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load runs'
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Activity size={18} style={{ color: '#0284c7' }} />
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181b' }}>
            Pipeline Runs
          </h1>
        </div>
        <p className="text-sm" style={{ color: '#71717a' }}>
          Monitor AI pipeline execution and phase progress
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm"
          style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
        >
          {error}
        </div>
      )}

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: '#ffffff',
          border: '1px solid #e4e4e7',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <div
          className="px-5 py-3.5"
          style={{ borderBottom: '1px solid #f0f0f1' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>All Pipeline Runs</h2>
        </div>

        {runs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Activity size={28} className="mx-auto mb-3" style={{ color: '#d4d4d8' }} />
            <p className="text-sm font-medium" style={{ color: '#a1a1aa' }}>No pipeline runs yet</p>
            <p className="text-xs mt-1" style={{ color: '#d4d4d8' }}>
              Trigger a pipeline run from the dashboard to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                  {['Run ID', 'Status', 'Phase', 'Started', 'Completed', 'Actions'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider ${i < 3 ? 'text-left' : 'text-right'}`}
                      style={{ color: '#a1a1aa' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.runId}
                    className="transition-colors hover:bg-zinc-50"
                    style={{ borderBottom: '1px solid #f4f4f5' }}
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono" style={{ color: '#71717a' }}>
                        {run.runId.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: '#71717a' }}>
                      {run.phase || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#a1a1aa' }}>
                      {formatDateTime(run.startedAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#a1a1aa' }}>
                      {formatDateTime(run.completedAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/dashboard/${tenantId}/runs/${run.runId}`}
                        className="text-xs font-medium transition-colors hover:opacity-80"
                        style={{ color: '#0284c7' }}
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
