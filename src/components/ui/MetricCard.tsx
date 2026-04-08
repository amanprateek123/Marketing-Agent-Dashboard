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
  iconColor = '#0ea5e9',
  iconBg = '#e0f2fe',
  accentColor,
  sublabel,
}: MetricCardProps) {
  return (
    <div
      className={cn('rounded-xl overflow-hidden relative', className)}
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
      }}
    >
      {accentColor && (
        <div className="h-[3px] w-full" style={{ background: accentColor }} />
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-4">
          <p
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: '#94a3b8' }}
          >
            {label}
          </p>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: iconBg }}
          >
            <Icon size={17} style={{ color: iconColor }} strokeWidth={2} />
          </div>
        </div>

        <p
          className="text-[32px] font-bold leading-none tracking-tight"
          style={{ color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </p>

        {(trend || sublabel) && (
          <div className="flex items-center gap-2 mt-3">
            {trend && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={
                  trendUp
                    ? { color: '#16a34a', background: '#dcfce7' }
                    : { color: '#dc2626', background: '#fee2e2' }
                }
              >
                {trendUp ? '↑' : '↓'} {trend}
              </span>
            )}
            {sublabel && (
              <p className="text-xs" style={{ color: '#94a3b8' }}>{sublabel}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
