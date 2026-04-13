'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Activity,
  Megaphone,
  BookOpen,
  Settings,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  tenantId: string
}

const navItems = (tenantId: string) => [
  { href: `/dashboard/${tenantId}`,          label: 'Overview',       icon: LayoutDashboard },
  { href: `/dashboard/${tenantId}/runs`,      label: 'Pipeline Runs',  icon: Activity        },
  { href: `/dashboard/${tenantId}/campaigns`, label: 'Campaigns',      icon: Megaphone       },
  { href: `/dashboard/${tenantId}/learnings`, label: 'Learnings',      icon: BookOpen        },
  { href: `/dashboard/${tenantId}/settings`,  label: 'Settings',       icon: Settings        },
]

export function Sidebar({ tenantId }: SidebarProps) {
  const pathname = usePathname()
  const items = navItems(tenantId)

  return (
    <aside
      className="w-[240px] shrink-0 flex flex-col h-screen sticky top-0 bg-white"
      style={{ borderRight: '1px solid #e5e7eb' }}
    >
      {/* Brand */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#4f46e5' }}>
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <div>
            <p className="text-[14px] font-bold tracking-tight" style={{ color: '#111827' }}>BriefOS</p>
            <p className="text-[10px] leading-none mt-0.5" style={{ color: '#9ca3af' }}>Marketing Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#059669' }} />
          <span className="text-[11px] font-mono truncate" style={{ color: '#6b7280' }}>{tenantId}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = item.href === `/dashboard/${tenantId}`
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                !isActive && 'hover:bg-gray-50'
              )}
              style={isActive ? { background: '#eef2ff', color: '#4338ca' } : { color: '#6b7280' }}
            >
              <Icon size={16} style={{ color: isActive ? '#4f46e5' : '#9ca3af' }} strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-5 py-3" style={{ borderTop: '1px solid #f3f4f6' }}>
        <p className="text-[10px]" style={{ color: '#d1d5db' }}>v0.1.0</p>
      </div>
    </aside>
  )
}
