'use client'

import { useState } from 'react'
import { Loader2, LockKeyhole, ServerCog } from 'lucide-react'
import { brainLogin, getBrainLockReason } from '@/lib/auth'

/**
 * Shown in place of the Brain console until this browser has unlocked it.
 *
 * The workspace session is untouched: this is a second, separate sign-in with the Brain account,
 * and its token is used only for the Brain's own calls.
 */
export function BrainSignIn() {
  const reason = getBrainLockReason()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await brainLogin(username.trim(), password)
      // The gate re-renders on its own once the token is stored.
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't sign you in just now. Try again.")
      setBusy(false)
    }
  }

  const notice =
    reason === 'not_configured'
      ? "The Brain login hasn't been set up on the server yet."
      : reason === 'expired'
        ? 'Your Brain sign-in has ended. Sign in again to continue.'
        : null

  return (
    <main className="mx-auto flex max-w-[1600px] justify-center px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <form
        onSubmit={handleSubmit}
        className="card w-full max-w-md px-5 py-6 sm:px-7 sm:py-7"
        aria-busy={busy}
        aria-labelledby="brain-sign-in-title"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
          >
            <LockKeyhole size={18} />
          </span>
          <div className="min-w-0">
            <h1 id="brain-sign-in-title" className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
              Sign in to the Brain
            </h1>
            <p className="explain mt-0.5">
              The Brain has its own login. You stay signed in to the rest of the workspace.
            </p>
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className="mt-5 flex items-start gap-2 rounded-xl px-3.5 py-3 text-[13px] leading-5"
            style={{ background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }}
          >
            {reason === 'not_configured' && <ServerCog size={15} className="mt-0.5 shrink-0" aria-hidden="true" />}
            <span className="min-w-0 break-words">{notice}</span>
          </div>
        )}

        <div className="mt-5">
          <label className="micro-label mb-2 block" htmlFor="brain-username">Username</label>
          <input
            id="brain-username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="input w-full"
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'brain-sign-in-error' : undefined}
          />
        </div>

        <div className="mt-4">
          <label className="micro-label mb-2 block" htmlFor="brain-password">Password</label>
          <input
            id="brain-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input w-full"
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'brain-sign-in-error' : undefined}
          />
        </div>

        {error && (
          <div
            id="brain-sign-in-error"
            role="alert"
            className="mt-4 rounded-xl px-3.5 py-3 text-[13px] leading-5"
            style={{ background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }}
          >
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-accent mt-6 w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Signing in&hellip;
            </>
          ) : (
            'Unlock the Brain'
          )}
        </button>
      </form>
    </main>
  )
}
