'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import { getToken, login } from '@/lib/auth'

const DEFAULT_TENANT = '91astrology'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Already have a token (e.g. navigated back here manually) — skip the
  // form. Not a validity check, just presence; if the token is actually
  // stale, the dashboard's own first API call will 401 and bounce back.
  useEffect(() => {
    if (getToken()) router.replace(`/dashboard/${DEFAULT_TENANT}`)
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      router.replace(`/dashboard/${DEFAULT_TENANT}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--paper)' }}
    >
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-8">
          <p className="font-display italic text-[34px] leading-none" style={{ color: 'var(--ink)' }}>
            Merid<span style={{ color: 'var(--accent)' }}>i</span>an
          </p>
          <p className="text-[13px] mt-2" style={{ color: 'var(--ink-3)' }}>
            Your marketing co-pilot
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 flex flex-col gap-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Lock size={15} style={{ color: 'var(--ink-3)' }} />
            <p className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              Sign in
            </p>
          </div>

          <div>
            <label className="micro-label mb-1.5 block" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="micro-label mb-1.5 block" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && (
            <div
              className="rounded-lg px-3 py-2 text-[13px]"
              style={{ background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }}
            >
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-accent btn-lg w-full mt-1" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
