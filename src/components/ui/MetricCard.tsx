import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface MetricCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  trend?: string
  trendUp?: boolean
  className?: string
  iconColor?: string
  iconBg?: string
  accentColor?: string
  sublabel?: string
}

export function MetricCard({
  icon: Icon,
  value,
  label,
  trend,
  trendUp,
  className,
  iconColor = 'var(--accent)',
  iconBg = 'var(--accent-bg)',
  accentColor,
  sublabel,
}: MetricCardProps) {
  return (
    <div className={cn('card overflow-hidden relative', className)}>
      {accentColor && (
        <div className="h-[2px] w-full" style={{ background: accentColor }} />
      )}

      <div className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="micro-label leading-tight">
            {label}
          </p>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: iconBg }}
          >
            <Icon size={15} style={{ color: iconColor }} strokeWidth={2} />
          </div>
        </div>

        <p
          className="display-num text-[30px] truncate"
          style={{ color: 'var(--ink)' }}
        >
          {value}
        </p>

        {(trend || sublabel) && (
          <div className="flex items-center gap-2 mt-3">
            {trend && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md"
                style={
                  trendUp
                    ? { color: 'var(--good)', background: 'var(--good-bg)' }
                    : { color: 'var(--bad)', background: 'var(--bad-bg)' }
                }
              >
                {trendUp ? '↑' : '↓'} {trend}
              </span>
            )}
            {sublabel && (
              <p className="text-xs truncate" style={{ color: 'var(--ink-3)' }}>{sublabel}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
