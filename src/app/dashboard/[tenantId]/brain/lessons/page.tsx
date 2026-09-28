import type { Metadata } from 'next'
import { LearnProposalsReview } from '@/components/brain/LearnProposalsReview'

export const metadata: Metadata = {
  title: 'Lessons to review',
  description: 'Lessons the ad maker wants to remember, waiting for the Brain login to approve, fix or turn down.',
}

/** Brain login only — the component shows the Brain sign-in card to anyone else. */
export default async function LessonsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params
  return <LearnProposalsReview tenantId={tenantId} />
}
