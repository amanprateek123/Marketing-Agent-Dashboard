'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getToken } from '@/lib/auth'
import { installAuthFetchInterceptor } from '@/lib/auth-fetch'

/**
 * Mounted once in the root layout, wrapping the whole app. Installs the
 * auth fetch interceptor and gates every route except /login behind having
 * a token in localStorage. This is a presence check only, not a validity
 * check — an expired/forged token still renders the page, but the first
 * API call it makes will 401 and the interceptor bounces to /login from
 * there. Good enough for a single-operator dashboard; not a substitute for
 * the backend's own verification, which is what actually enforces this.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    installAuthFetchInterceptor()

    // Genuinely can't be computed at render time: localStorage doesn't
    // exist during SSR, so whether we're authorized is unknowable until
    // after mount. This is the actual auth check, not a value mirrored
    // from props/state that a memo could replace.
    if (pathname === '/login') {
      setChecked(true) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }
    if (!getToken()) {
      router.replace('/login')
      return
    }
    setChecked(true)
  }, [pathname, router])

  if (!checked) return null
  return <>{children}</>
}
