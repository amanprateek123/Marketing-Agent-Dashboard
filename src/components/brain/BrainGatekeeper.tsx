'use client'

import { clearBrainToken } from '@/lib/auth'
import { BRAIN_MOCK } from '@/lib/brain-api'
import { useBrainUnlocked } from '@/lib/use-brain-auth'
import type { BrainTabKey } from '@/types/brain'
import { BrainConsole } from './BrainConsole'
import { BrainSignIn } from './BrainSignIn'
import { BrainSkeleton } from './shared'

/**
 * The Brain page's lock: the sign-in card until this browser holds a Brain token, the console
 * after. A Brain 401/403/503 clears the token inside brain-api, which flips this back to the card
 * without the console having to know anything about sign-in.
 */
export function BrainGatekeeper({ tenantId, initialTab }: { tenantId: string; initialTab: BrainTabKey }) {
  const unlocked = useBrainUnlocked()

  if (unlocked === null) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <BrainSkeleton rows={2} />
      </main>
    )
  }
  if (!unlocked) return <BrainSignIn />

  return (
    <BrainConsole
      tenantId={tenantId}
      initialTab={initialTab}
      onLock={BRAIN_MOCK ? undefined : () => clearBrainToken('signed_out')}
    />
  )
}
