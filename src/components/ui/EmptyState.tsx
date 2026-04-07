import { type LucideIcon } from 'lucide-react'
import React from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
  iconSize?: number
}

export function EmptyState({ icon: Icon, title, subtitle, action, iconSize = 32 }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
      <Icon size={iconSize} style={{ color: '#d4d4d8' }} />
      <div>
        <p className="text-sm font-medium" style={{ color: '#a1a1aa' }}>{title}</p>
        {subtitle && (
          <p className="text-xs mt-1" style={{ color: '#d4d4d8' }}>{subtitle}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
