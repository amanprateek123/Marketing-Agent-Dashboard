import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

function getStatusConfig(status: string): {
  label: string
  style: React.CSSProperties
  pulse?: boolean
} {
  const s = status.toLowerCase()

  if (s === 'active' || s === 'completed') {
    return {
      label: status.replace(/_/g, ' '),
      style: {
        background: '#dcfce7',
        color: '#15803d',
        border: '1px solid #bbf7d0',
      },
    }
  }

  if (s === 'pending_approval' || s === 'pending') {
    return {
      label: status.replace(/_/g, ' '),
      style: {
        background: '#fef3c7',
        color: '#b45309',
        border: '1px solid #fde68a',
      },
    }
  }

  if (s === 'failed') {
    return {
      label: status.replace(/_/g, ' '),
      style: {
        background: '#fee2e2',
        color: '#b91c1c',
        border: '1px solid #fecaca',
      },
    }
  }

  if (s === 'paused') {
    return {
      label: status.replace(/_/g, ' '),
      style: {
        background: '#fff7ed',
        color: '#c2410c',
        border: '1px solid #fed7aa',
      },
    }
  }

  if (
    s === 'running' ||
    s === 'scouts_running' ||
    s === 'intelligence_running' ||
    s === 'idea_pool_running' ||
    s === 'creative_running' ||
    s === 'campaign_launching'
  ) {
    return {
      label: status.replace(/_/g, ' '),
      style: {
        background: '#dbeafe',
        color: '#1d4ed8',
        border: '1px solid #bfdbfe',
      },
      pulse: true,
    }
  }

  return {
    label: status.replace(/_/g, ' '),
    style: {
      background: '#f4f4f5',
      color: '#71717a',
      border: '1px solid #e4e4e7',
    },
  }
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = getStatusConfig(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium capitalize',
        className
      )}
      style={config.style}
    >
      {config.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600" />
        </span>
      )}
      {config.label}
    </span>
  )
}
