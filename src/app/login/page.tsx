'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { MeridianMark } from '@/components/ui/MeridianMark'
import { getToken, login } from '@/lib/auth'
import styles from './login.module.css'

const DEFAULT_TENANT = '91astrology'

const GROWTH_LOOP = [
  { icon: BrainCircuit, title: 'Decide', detail: 'Build the strategy from your business goal.' },
  { icon: Sparkles, title: 'Execute', detail: 'Prepare campaigns with human control.' },
  { icon: BarChart3, title: 'Learn', detail: 'Measure outcomes and improve the next move.' },
]

function SessionCheck() {
  return (
    <main className="flex min-h-screen min-h-dvh items-center justify-center px-5" style={{ background: 'var(--paper)' }}>
      <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
        <MeridianMark />
        <Loader2 className="mt-8 animate-spin" size={22} style={{ color: 'var(--accent)' }} aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>Opening your growth workspace</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--ink-3)' }}>Verifying this device securely&hellip;</p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    try {
      if (getToken()) {
        router.replace(`/dashboard/${DEFAULT_TENANT}`)
        return
      }
    } catch {
      // Treat unavailable browser storage as a signed-out session.
    }
    setCheckingSession(false) // eslint-disable-line react-hooks/set-state-in-effect
  }, [router])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      router.replace(`/dashboard/${DEFAULT_TENANT}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in was unsuccessful. Please try again.')
      setLoading(false)
    }
  }

  if (checkingSession) return <SessionCheck />

  return (
    <main className={styles.shell}>
      <section className={styles.story} aria-label="Meridian product overview">
        <MeridianMark inverse />

        <div className={styles.storyBody}>
          <div className={styles.eyebrow}>
            <Sparkles size={13} aria-hidden="true" />
            Autonomous growth, responsibly controlled
          </div>
          <h1 className={styles.headline}>Turn every business goal into a measurable growth loop.</h1>
          <p className={styles.description}>
            Meridian helps teams plan, launch, diagnose, and improve campaigns from one intelligent workspace—while people retain approval and budget control.
          </p>

          <div className={styles.loop} aria-label="Meridian growth loop">
            {GROWTH_LOOP.map(({ icon: Icon, title, detail }) => (
              <div className={styles.loopStep} key={title}>
                <Icon size={18} aria-hidden="true" />
                <strong>{title}</strong>
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.trustRow} aria-label="Product safeguards">
          {['Human approval', 'Budget safeguards', 'Evidence-backed decisions'].map((item) => (
            <span className={styles.trustItem} key={item}>
              <CheckCircle2 size={13} aria-hidden="true" /> {item}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.formPanel} aria-labelledby="sign-in-title">
        <div className={styles.formWrap}>
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold" style={{ borderColor: 'var(--good-border)', background: 'var(--good-bg)', color: 'var(--good)' }}>
            <ShieldCheck size={13} aria-hidden="true" /> Secure operator access
          </div>
          <h2 id="sign-in-title" className="mt-5 text-[30px] font-bold tracking-[-0.035em]" style={{ color: 'var(--ink)' }}>
            Welcome back
          </h2>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--ink-3)' }}>
            Sign in to continue to your Meridian workspace.
          </p>

          <form onSubmit={handleSubmit} className={styles.formCard} aria-busy={loading}>
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                <LockKeyhole size={18} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Sign in to Meridian</p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--ink-3)' }}>Your credentials stay private.</p>
              </div>
            </div>

            <div>
              <label className="micro-label mb-2 block" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input w-full"
                placeholder="you@company.com"
                disabled={loading}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            <div className="mt-5">
              <label className="micro-label mb-2 block" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input w-full"
                placeholder="Enter your password"
                disabled={loading}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            {error && (
              <div
                id="login-error"
                className="mt-5 rounded-xl px-3.5 py-3 text-[13px] leading-5"
                style={{ background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }}
                role="alert"
              >
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-accent btn-lg mt-6 w-full" disabled={loading}>
              {loading ? (
                <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> Signing in&hellip;</>
              ) : (
                <>Continue to workspace <ArrowRight size={17} aria-hidden="true" /></>
              )}
            </button>
          </form>

          <p className={styles.secureNote}>
            <ShieldCheck size={15} className="shrink-0" aria-hidden="true" />
            Protected access for authorized growth operators. Meridian never displays stored platform credentials here.
          </p>
        </div>
      </section>
    </main>
  )
}
