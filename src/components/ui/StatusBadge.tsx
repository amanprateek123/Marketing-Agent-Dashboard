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
  if (s === 'completed' || s === 'complete') return { label: s === 'complete' ? 'Complete' : 'Completed', bg: '#ecfdf5', color: '#059669', dot: '#059669' }
  if (s === 'pending_approval') return { label: 'Pending Approval', bg: '#eef2ff', color: '#4338ca', dot: '#4f46e5' }
  if (s === 'pending') return { label: 'Pending', bg: '#fffbeb', color: '#d97706', dot: '#d97706' }
  if (s === 'executed') return { label: 'Executed', bg: '#ecfdf5', color: '#059669', dot: '#059669' }
  if (s === 'overridden') return { label: 'Overridden', bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' }
  if (s === 'failed') return { label: 'Failed', bg: '#fef2f2', color: '#dc2626', dot: '#dc2626' }
  if (s === 'paused') return { label: 'Paused', bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' }
  if (s === 'paused_for_replacement') return { label: 'Replacing Creative', bg: '#fff7ed', color: '#ea580c', dot: '#ea580c', pulse: true }
  if (s === 'pending_creative_swap') return { label: 'Swap Pending', bg: '#fffbeb', color: '#d97706', dot: '#d97706' }

  if (s === 'research_running')
    return { label: 'Researching market & competitors', bg: '#eff6ff', color: '#1d4ed8', dot: '#1d4ed8', pulse: true }
  if (s === 'digest_running')
    return { label: 'Writing digest & sending Slack',     bg: '#faf5ff', color: '#7e22ce', dot: '#7e22ce', pulse: true }

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
