'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

// One refresh per ad per page load, shared by the row thumbnail and the lightbox.
const fresh = new Map<string, Promise<string | null>>()

/**
 * Meta thumbnail URLs are signed fbcdn links that expire after a few days, and
 * paused campaigns are never re-synced. When the stored image fails to load,
 * ask the backend to fetch a fresh one from Meta (it also persists it).
 */
export function useAdThumbnail(adId: string | undefined, storedUrl: string | undefined) {
  const { tenantId, campaignId } = useParams<{ tenantId: string; campaignId?: string }>()
  // Keyed on storedUrl so a re-synced ad resets without a setState-in-effect.
  const [st, setSt] = useState<{ base?: string; url?: string; failed?: boolean }>({})
  const cur = st.base === storedUrl ? st : { base: storedUrl }

  const onError = () => {
    // Already on the refreshed URL (or nothing to refresh with) → give up.
    if (!adId || !campaignId || cur.url) return setSt({ base: storedUrl, failed: true })
    if (!fresh.has(adId)) {
      fresh.set(adId, fetch(`${API}/campaigns/${tenantId}/${campaignId}/ads/${adId}/thumbnail`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => d?.thumbnailUrl ?? null)
        .catch(() => null))
    }
    fresh.get(adId)!.then(url =>
      setSt(url && url !== storedUrl ? { base: storedUrl, url } : { base: storedUrl, failed: true }))
  }

  return { src: cur.failed ? undefined : (cur.url ?? storedUrl), onError }
}
