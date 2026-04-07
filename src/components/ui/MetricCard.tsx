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
}

export function MetricCard({
  icon: Icon,
  value,
  label,
  trend,
  trendUp,
  className,
  iconColor = '#0284c7',
  iconBg = '#e0f2fe',
}: MetricCardProps) {
  return (
    <div
      className={cn('rounded-xl p-5 flex flex-col gap-4', className)}
      style={{
        background: '#ffffff',
        border: '1px solid #e4e4e7',
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: iconBg }}
        >
          <Icon size={17} style={{ color: iconColor }} />
        </div>
        {trend && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={
              trendUp
                ? { color: '#15803d', background: '#dcfce7' }
                : { color: '#b91c1c', background: '#fee2e2' }
            }
          >
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight" style={{ color: '#18181b' }}>
          {value}
        </p>
        <p className="text-sm mt-0.5" style={{ color: '#71717a' }}>
          {label}
        </p>
      </div>
    </div>
  )
}
