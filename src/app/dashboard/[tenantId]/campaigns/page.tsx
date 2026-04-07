import { apiFetch } from '@/lib/api'
import { Campaign } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Megaphone, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

export default async function CampaignsPage({ params }: PageProps) {
  const { tenantId } = await params

  let campaigns: Campaign[] = []
  let error: string | null = null

  try {
    campaigns = await apiFetch<Campaign[]>(`/campaigns/${tenantId}`)
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load campaigns'
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Megaphone size={18} style={{ color: '#0284c7' }} />
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181b' }}>
            Campaigns
          </h1>
        </div>
        <p className="text-sm" style={{ color: '#71717a' }}>
          All AI-generated and approved campaigns for {tenantId}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm"
          style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: '#ffffff',
          border: '1px solid #e4e4e7',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        {campaigns.length === 0 && !error ? (
          <div className="p-12 text-center">
            <Megaphone size={32} className="mx-auto mb-3" style={{ color: '#d4d4d8' }} />
            <p className="text-sm font-medium" style={{ color: '#a1a1aa' }}>No campaigns yet</p>
            <p className="text-xs mt-1" style={{ color: '#d4d4d8' }}>
              Trigger a pipeline run from the dashboard to create your first campaign
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                  {['Topic / Name', 'Status', 'Budget', 'Spend', 'ROAS', 'CTR', 'CPC', 'Conv.', 'Launch Date', ''].map((h) => (
                    <th
                      key={h}
                      className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider ${h === 'Topic / Name' || h === 'Status' ? 'text-left' : 'text-right'}`}
                      style={{ color: '#a1a1aa' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign, idx) => {
                  const id = campaign._id
                  return (
                    <tr
                      key={id || idx}
                      className="transition-colors hover:bg-zinc-50 group"
                      style={{ borderBottom: '1px solid #f4f4f5' }}
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/${tenantId}/campaigns/${id}`}
                          className="text-sm font-medium transition-colors hover:text-sky-700 line-clamp-2 max-w-[200px] block"
                          style={{ color: '#18181b' }}
                        >
                          {campaign.topic || 'Untitled Campaign'}
                        </Link>
                        {campaign.metaCampaignId && (
                          <p className="text-xs font-mono mt-0.5" style={{ color: '#a1a1aa' }}>
                            {campaign.metaCampaignId}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={campaign.status} />
                      </td>
                      <td className="px-5 py-4 text-right text-sm" style={{ color: '#52525b' }}>
                        {campaign.budget ? formatCurrency(campaign.budget) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right text-sm" style={{ color: '#52525b' }}>
                        {campaign.spend ? formatCurrency(campaign.spend) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right text-sm">
                        {campaign.roas ? (
                          <span className="font-semibold" style={{ color: '#15803d' }}>
                            {campaign.roas.toFixed(2)}x
                          </span>
                        ) : (
                          <span style={{ color: '#d4d4d8' }}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-sm" style={{ color: '#52525b' }}>
                        {campaign.ctr ? `${(campaign.ctr * 100).toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-5 py-4 text-right text-sm" style={{ color: '#52525b' }}>
                        {campaign.cpc ? formatCurrency(campaign.cpc) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right text-sm" style={{ color: '#52525b' }}>
                        {campaign.conversions ?? '—'}
                      </td>
                      <td className="px-5 py-4 text-right text-sm" style={{ color: '#a1a1aa' }}>
                        {formatDate(campaign.launchedAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {id && (
                          <Link
                            href={`/dashboard/${tenantId}/campaigns/${id}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: '#0284c7' }}
                          >
                            <ArrowRight size={15} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {campaigns.length > 0 && (
        <p className="text-xs mt-4 text-center" style={{ color: '#a1a1aa' }}>
          {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total
        </p>
      )}
    </div>
  )
}
