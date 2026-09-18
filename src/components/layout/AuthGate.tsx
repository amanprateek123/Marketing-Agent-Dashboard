'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LockKeyhole } from 'lucide-react'
import { MeridianMark } from '@/components/ui/MeridianMark'
import { getToken } from '@/lib/auth'
import { installAuthFetchInterceptor } from '@/lib/auth-fetch'
import styles from './AuthGate.module.css'

/**
 * Installs the authenticated-fetch behavior and performs the browser-only
 * token-presence gate. The backend remains the authority for token validity.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(pathname === '/login')

  useEffect(() => {
    installAuthFetchInterceptor()

    if (pathname === '/login') {
      setChecked(true) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }

    try {
      if (!getToken()) {
        router.replace('/login')
        return
      }
    } catch {
      router.replace('/login')
      return
    }

    setChecked(true)
  }, [pathname, router])

  if (!checked) {
    return (
      <div className={styles.shell}>
        <div className={styles.panel} role="status" aria-live="polite" aria-label="Verifying workspace access">
          <MeridianMark compact />
          <div className={styles.indicator} aria-hidden="true">
            <LockKeyhole size={20} />
          </div>
          <p className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>Securing your workspace</p>
          <p className="mx-auto mt-2 max-w-[290px] text-xs leading-5" style={{ color: 'var(--ink-3)' }}>
            Verifying operator access before loading business and campaign data.
          </p>
          <div className={styles.progress} aria-hidden="true" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
