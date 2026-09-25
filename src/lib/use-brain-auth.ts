'use client'

import { useSyncExternalStore } from 'react'
import { getBrainToken, subscribeBrainAuth } from './auth'
import { BRAIN_MOCK } from './brain-api'

/**
 * Whether this browser may see the Brain: `true` unlocked, `false` locked, `null` not known yet
 * (server render and the first client pass — storage is only readable after hydration, and a
 * guess either way would flash the wrong card).
 *
 * Example-data mode (NEXT_PUBLIC_BRAIN_MOCK=true) is always unlocked: nothing real is behind it.
 */
export function useBrainUnlocked(): boolean | null {
  return useSyncExternalStore(
    subscribeBrainAuth,
    () => BRAIN_MOCK || getBrainToken() !== null,
    () => null,
  )
}
