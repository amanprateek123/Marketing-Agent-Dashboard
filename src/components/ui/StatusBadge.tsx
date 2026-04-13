import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

function getStatusConfig(status: string): {
  label: string
  bg: string
  color: string
  dot?: string
  pulse?: boolean
} {
  const s = status.toLowerCase()

  if (s === 'active') return { label: 'Active', bg: '#ecfdf5', color: '#059669', dot: '#059669' }
  if (s === 'completed') return { label: 'Completed', bg: '#ecfdf5', color: '#059669', dot: '#059669' }
  if (s === 'pending_approval') return { label: 'Pending Approval', bg: '#eef2ff', color: '#4338ca', dot: '#4f46e5' }
  if (s === 'pending') return { label: 'Pending', bg: '#eef2ff', color: '#4338ca', dot: '#4f46e5' }
  if (s === 'failed') return { label: 'Failed', bg: '#fef2f2', color: '#dc2626', dot: '#dc2626' }
  if (s === 'paused') return { label: 'Paused', bg: '#fffbeb', color: '#d97706', dot: '#d97706' }

  if (s.includes('running') || s === 'campaign_launching') {
    return {
      label: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      bg: '#eef2ff',
      color: '#4f46e5',
      dot: '#4f46e5',
      pulse: true,
    }
  }

  return { label: status.replace(/_/g, ' '), bg: '#f3f4f6', color: '#6b7280' }
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = getStatusConfig(status)
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap', className)}
      style={{ background: config.bg, color: config.color }}
    >
      {config.dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {config.pulse && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: config.dot }} />
          )}
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: config.dot }} />
        </span>
      )}
      {config.label}
    </span>
  )
}
