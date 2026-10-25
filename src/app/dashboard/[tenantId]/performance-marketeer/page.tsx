import type { Metadata } from 'next'
import { PerformanceMarketeer } from '@/components/performance-marketeer/PerformanceMarketeer'
import { parsePmView } from '@/lib/performance-marketeer-api'
import { istYesterday } from '@/lib/performance-marketeer-dates'

export const metadata: Metadata = {
  title: 'Performance Marketeer',
  description: 'Meta ad performance joined with first-party website visits and confirmed orders.',
}

interface PageProps {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}


/**
 * Server component (like the Brain page) so the URL state arrives as props and
 * the first render needs no Suspense. The client keeps the URL in sync with
 * history.replaceState (shareable views) and re-reads it when it changes from
 * outside, e.g. a sidebar click back to the bare route.
 */
export default async function PerformanceMarketeerPage({ params, searchParams }: PageProps) {
  const { tenantId } = await params
  const sp = await searchParams
  const yesterday = istYesterday()
  const initial = parsePmView((k) => {
    const v = sp[k]
    return Array.isArray(v) ? v[0] : v
  }, yesterday)

  return <PerformanceMarketeer tenantId={tenantId} initial={initial} yesterday={yesterday} />
}
