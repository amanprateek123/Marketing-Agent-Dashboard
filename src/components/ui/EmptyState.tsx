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
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center"
        style={{ background: 'var(--surface-warm)', border: '1px dashed var(--ink-4)' }}
      >
        <Icon size={iconSize * 0.6} style={{ color: 'var(--ink-4)' }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>{title}</p>
        {subtitle && (
          <p className="text-xs mt-1.5 max-w-xs leading-relaxed" style={{ color: 'var(--ink-3)' }}>{subtitle}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
