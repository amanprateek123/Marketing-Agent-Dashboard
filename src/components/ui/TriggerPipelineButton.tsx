'use client'

import { useState } from 'react'
import { Play, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

interface TriggerPipelineButtonProps {
  tenantId: string
}

export function TriggerPipelineButton({ tenantId }: TriggerPipelineButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleTrigger() {
    setState('loading')
    setMessage('')
    try {
      const res = await fetch(`${API_BASE}/pipeline/${tenantId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setState('success')
      setMessage(data?.runId ? `Run started: ${data.runId.slice(0, 8)}...` : 'Pipeline triggered!')
      setTimeout(() => setState('idle'), 5000)
    } catch (err) {
      setState('error')
      setMessage(err instanceof Error ? err.message : 'Failed to trigger pipeline')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleTrigger}
        disabled={state === 'loading'}
        className={cn('btn', state === 'idle' && 'btn-accent')}
        style={
          state === 'loading'
            ? { background: 'var(--accent-bg)', color: 'var(--accent-strong)', border: '1px solid var(--accent-border)', cursor: 'not-allowed' }
            : state === 'success'
            ? { background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)' }
            : state === 'error'
            ? { background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }
            : undefined
        }
      >
        {state === 'loading' ? (
          <Loader2 size={15} className="animate-spin" />
        ) : state === 'success' ? (
          <CheckCircle size={15} />
        ) : (
          <Play size={15} fill="currentColor" />
        )}
        {state === 'loading' ? 'Triggering...' : state === 'success' ? 'Triggered!' : state === 'error' ? 'Retry' : 'Trigger Pipeline'}
      </button>
      {message && (
        <span className="text-xs" style={{ color: state === 'success' ? 'var(--good)' : 'var(--bad)' }}>
          {message}
        </span>
      )}
    </div>
  )
}
