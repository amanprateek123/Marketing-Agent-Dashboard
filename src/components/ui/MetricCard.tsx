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
  iconColor = '#4f46e5',
  iconBg = '#e0e7ff',
  accentColor,
  sublabel,
}: MetricCardProps) {
  return (
    <div
      className={cn('rounded-2xl overflow-hidden relative', className)}
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
      }}
    >
      {accentColor && (
        <div className="h-[2px] w-full" style={{ background: accentColor }} />
      )}

      <div className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.1em] leading-tight"
            style={{ color: '#d1d5db' }}
          >
            {label}
          </p>
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: iconBg }}
          >
            <Icon size={15} style={{ color: iconColor }} strokeWidth={2} />
          </div>
        </div>

        <p
          className="text-[28px] font-black leading-none tracking-tight truncate font-mono"
          style={{ color: '#111827', fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </p>

        {(trend || sublabel) && (
          <div className="flex items-center gap-2 mt-3">
            {trend && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg"
                style={
                  trendUp
                    ? { color: '#15803d', background: '#f0fdf4' }
                    : { color: '#dc2626', background: '#fef2f2' }
                }
              >
                {trendUp ? '\u2191' : '\u2193'} {trend}
              </span>
            )}
            {sublabel && (
              <p className="text-xs truncate" style={{ color: '#9ca3af' }}>{sublabel}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
