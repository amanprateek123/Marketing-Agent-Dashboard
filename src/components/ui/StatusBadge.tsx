import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

function getStatusConfig(status: string): {
  label: string
  style: React.CSSProperties
  dot?: string
  pulse?: boolean
} {
  const s = status.toLowerCase()

  if (s === 'active' || s === 'completed') {
    return {
      label: status.replace(/_/g, ' '),
      style: { background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' },
      dot: '#16a34a',
    }
  }
  if (s === 'pending_approval' || s === 'pending') {
    return {
      label: status.replace(/_/g, ' '),
      style: { background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d' },
      dot: '#f59e0b',
    }
  }
  if (s === 'failed') {
    return {
      label: status.replace(/_/g, ' '),
      style: { background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' },
      dot: '#dc2626',
    }
  }
  if (s === 'paused') {
    return {
      label: status.replace(/_/g, ' '),
      style: { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' },
      dot: '#f97316',
    }
  }
  if (
    s === 'running' || s === 'scouts_running' || s === 'intelligence_running' ||
    s === 'idea_pool_running' || s === 'creative_running' || s === 'campaign_launching'
  ) {
    return {
      label: status.replace(/_/g, ' '),
      style: { background: '#dbeafe', color: '#2563eb', border: '1px solid #93c5fd' },
      dot: '#3b82f6',
      pulse: true,
    }
  }
  return {
    label: status.replace(/_/g, ' '),
    style: { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' },
  }
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = getStatusConfig(status)
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize whitespace-nowrap', className)}
      style={config.style}
    >
      {config.dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {config.pulse && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: config.dot }} />
          )}
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: config.dot }} />
        </span>
      )}
      {config.label}
    </span>
  )
}
