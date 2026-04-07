'use client'

import { useState } from 'react'
import { Play, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

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
      const res = await fetch(`http://localhost:8082/api/v1/pipeline/${tenantId}/trigger`, {
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
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200',
          state === 'loading' && 'bg-indigo-500/50 text-white/60 cursor-not-allowed',
          state === 'success' && 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
          state === 'error' && 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
          state === 'idle' && 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30'
        )}
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
        <span className={cn('text-xs', state === 'success' ? 'text-emerald-400' : 'text-rose-400')}>
          {message}
        </span>
      )}
    </div>
  )
}
