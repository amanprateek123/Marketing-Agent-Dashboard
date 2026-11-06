import type { Metadata } from 'next'
import { CampaignReport } from '@/components/performance-marketeer/CampaignReport'

export const metadata: Metadata = {
  title: 'Campaign analysis',
  description: 'The Performance Marketeer’s full analysis of one campaign run.',
}

interface PageProps {
  params: Promise<{ tenantId: string; campaignId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/** /performance-marketeer/report/<campaignId>?date=YYYY-MM-DD (default: the latest run). */
export default async function CampaignReportPage({ params, searchParams }: PageProps) {
  const { tenantId, campaignId } = await params
  const sp = await searchParams
  const date = Array.isArray(sp.date) ? sp.date[0] : sp.date
  return <CampaignReport tenantId={tenantId} campaignId={campaignId} date={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined} />
}
