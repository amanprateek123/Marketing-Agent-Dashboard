import type { Metadata } from 'next'
import { BrainOnly } from '@/components/inbox/BrainOnly'
import { ReportsView } from '@/components/inbox/ReportsView'

export const metadata: Metadata = {
  title: 'Reports',
  description: 'Daily briefs, performance reports, spend watch and incidents from the Brain.',
}

interface ReportsPageProps {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/** Server component so `?open=` arrives as a prop (no useSearchParams in a prerendered client page). */
export default async function ReportsPage({ params, searchParams }: ReportsPageProps) {
  const { tenantId } = await params
  const { open } = await searchParams
  const initialOpen = Array.isArray(open) ? (open[0] ?? null) : (open ?? null)
  return (
    <BrainOnly>
      <ReportsView tenantId={tenantId} initialOpen={initialOpen} />
    </BrainOnly>
  )
}
