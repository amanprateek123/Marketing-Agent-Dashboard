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
        className="flex w-full items-center justify-between py-2.5 px-4 rounded-[var(--radius-sm)] transition-colors cursor-pointer group"
        style={{
          background: open ? 'var(--muted)' : 'var(--surface-warm)',
          border: '1px solid var(--hairline-light)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--muted)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = open ? 'var(--muted)' : 'var(--surface-warm)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {title}
          </span>
          {badge !== undefined && (
            <span className="chip chip-accent">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={cn('transition-transform duration-200', open && 'rotate-180')}
          style={{ color: 'var(--ink-3)' }}
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-none">
        <div className="pt-3 pb-1">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
