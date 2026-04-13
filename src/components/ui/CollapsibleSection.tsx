'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: string | number
  className?: string
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  badge,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className={className}>
      <Collapsible.Trigger
        className="flex w-full items-center justify-between py-2.5 px-4 rounded-lg transition-colors cursor-pointer group"
        style={{ background: open ? '#f3f4f6' : '#fafafa' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f3f4f6' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = open ? '#f3f4f6' : '#fafafa' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: '#18181b' }}>
            {title}
          </span>
          {badge !== undefined && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#e0e7ff', color: '#1d4ed8' }}
            >
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={cn('transition-transform duration-200', open && 'rotate-180')}
          style={{ color: '#a1a1aa' }}
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-none">
        <div className="pt-3 pb-1">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
