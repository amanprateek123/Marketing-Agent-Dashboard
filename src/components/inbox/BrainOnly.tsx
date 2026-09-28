'use client'

import { useBrainUnlocked } from '@/lib/use-brain-auth'
import { BrainSignIn } from '@/components/brain/BrainSignIn'
import { BrainSkeleton } from '@/components/brain/shared'

/**
 * A page that reads the Brain: the Brain sign-in card until this browser holds a Brain token.
 * Every route behind these pages is Brain-login only on the server; this just says so first.
 */
export function BrainOnly({ children }: { children: React.ReactNode }) {
  const unlocked = useBrainUnlocked()
  if (unlocked === null) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <BrainSkeleton rows={2} />
      </main>
    )
  }
  if (!unlocked) return <BrainSignIn />
  return <>{children}</>
}
