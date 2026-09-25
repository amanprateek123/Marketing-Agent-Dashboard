import { cn } from '@/lib/utils'
import { humanise, plainStatus, toneChip, type PlainDomain } from '@/lib/plain-language'

interface StatusBadgeProps {
  status: string
  className?: string
  /**
   * The vocabulary domain in `@/lib/plain-language` to read the label from. With it, the chip
   * shows the plain label and its one-line meaning as a tooltip. Without it, the legacy table
   * below is used — prefer passing a domain in new code.
   */
  domain?: PlainDomain
}

function getStatusConfig(status: string): {
  label: string
  chip: string
  dot?: boolean
  pulse?: boolean
} {
  const s = status.toLowerCase()

  if (s === 'active') return { label: 'Active', chip: 'chip-good', dot: true }
  if (s === 'completed' || s === 'complete') return { label: s === 'complete' ? 'Complete' : 'Completed', chip: 'chip-good', dot: true }
  if (s === 'pending_approval') return { label: 'Pending Approval', chip: 'chip-accent', dot: true }
  if (s === 'pending') return { label: 'Pending', chip: 'chip-warn', dot: true }
  if (s === 'executed') return { label: 'Executed', chip: 'chip-good', dot: true }
  if (s === 'overridden') return { label: 'Overridden', chip: 'chip-neutral', dot: true }
  if (s === 'failed') return { label: 'Failed', chip: 'chip-bad', dot: true }
  if (s === 'paused') return { label: 'Paused', chip: 'chip-neutral', dot: true }
  if (s === 'paused_for_replacement') return { label: 'Replacing Creative', chip: 'chip-warn', dot: true, pulse: true }
  if (s === 'pending_creative_swap') return { label: 'Swap Pending', chip: 'chip-warn', dot: true }

  if (s === 'research_running')
    return { label: 'Researching market & competitors', chip: 'chip-info', dot: true, pulse: true }
  if (s === 'digest_running')
    return { label: 'Writing digest & sending Slack', chip: 'chip-accent', dot: true, pulse: true }

  if (s.includes('running') || s === 'campaign_launching') {
    return {
      label: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      chip: 'chip-accent',
      dot: true,
      pulse: true,
    }
  }

  return { label: humanise(status), chip: 'chip-neutral' }
}

export function StatusBadge({ status, className, domain }: StatusBadgeProps) {
  const plain = domain ? plainStatus(domain, status) : null
  const config = plain
    ? {
        label: plain.label,
        chip: toneChip(plain.tone),
        dot: true,
        pulse: plain.tone === 'accent' && /running|launching|producing|generating/.test(status),
      }
    : getStatusConfig(status)
  return (
    <span className={cn('chip', config.chip, className)} title={plain?.meaning || undefined}>
      {config.dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {config.pulse && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: 'currentColor' }} />
          )}
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'currentColor' }} />
        </span>
      )}
      {config.label}
    </span>
  )
}
