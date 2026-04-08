import { type LucideIcon } from 'lucide-react'
import React from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
  iconSize?: number
}

export function EmptyState({ icon: Icon, title, subtitle, action, iconSize = 28 }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-4 text-center px-6">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: '#f4f4f5', border: '1px solid #e8e8ec' }}
      >
        <Icon size={iconSize * 0.6} style={{ color: '#c4c4cc' }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: '#71717a' }}>{title}</p>
        {subtitle && (
          <p className="text-xs mt-1.5 max-w-xs" style={{ color: '#b4b4bc' }}>{subtitle}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
