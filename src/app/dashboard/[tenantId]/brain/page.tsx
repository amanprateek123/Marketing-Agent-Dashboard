import type { Metadata } from 'next'
import { BrainGatekeeper } from '@/components/brain/BrainGatekeeper'
import { isBrainTabKey } from '@/types/brain'

export const metadata: Metadata = {
  title: 'Brain',
  description:
    'Your AI marketing head in one place — what it decided, the ads it is making, what needs your go-ahead, and the helpers you can ask yourself.',
}

/**
 * Server component on purpose, even though every other page in this dashboard
 * is `'use client'`.
 *
 * Reading `searchParams` here opts the route into dynamic rendering, which is
 * what we want anyway, and it keeps `useSearchParams` out of the client tree —
 * a production build fails on a prerendered client page that calls it without a
 * Suspense boundary. The tab arrives as a plain prop instead.
 */
interface BrainPageProps {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function BrainPage({ params, searchParams }: BrainPageProps) {
  const { tenantId } = await params
  const { tab } = await searchParams

  const requested = Array.isArray(tab) ? tab[0] : tab

  return (
    <BrainGatekeeper
      tenantId={tenantId}
      initialTab={isBrainTabKey(requested) ? requested : 'pulse'}
    />
  )
}
