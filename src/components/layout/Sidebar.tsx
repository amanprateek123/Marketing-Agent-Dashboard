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

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

export function Sidebar({ tenantId }: SidebarProps) {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    { href: `/dashboard/${tenantId}`, label: 'Overview', icon: LayoutDashboard },
    { href: `/dashboard/${tenantId}/runs`, label: 'Pipeline Runs', icon: Activity },
    { href: `/dashboard/${tenantId}/campaigns`, label: 'Campaigns', icon: Megaphone },
    { href: `/dashboard/${tenantId}/learnings`, label: 'Learnings', icon: BookOpen },
    { href: `/dashboard/${tenantId}/settings`, label: 'Settings', icon: Settings },
  ]

  return (
    <aside
      className="w-[220px] shrink-0 flex flex-col h-screen sticky top-0"
      style={{
        background: '#ffffff',
        borderRight: '1px solid #e4e4e7',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid #f0f0f1' }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: '#0284c7' }}
          >
            <Zap size={15} className="text-white" fill="currentColor" />
          </div>
          <span className="text-[15px] font-bold tracking-tight" style={{ color: '#18181b' }}>
            BriefOS
          </span>
        </div>
        <div
          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono"
          style={{
            background: '#f4f4f5',
            color: '#71717a',
            border: '1px solid #e4e4e7',
          }}
        >
          {tenantId}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === `/dashboard/${tenantId}`
              ? pathname === item.href
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative',
                isActive
                  ? 'text-sky-700 bg-sky-50'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
              )}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                  style={{ background: '#0284c7' }}
                />
              )}
              <Icon size={15} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid #f0f0f1' }}>
        <p className="text-xs font-medium" style={{ color: '#a1a1aa' }}>BriefOS v0.1</p>
        <p className="text-xs mt-0.5" style={{ color: '#d4d4d8' }}>AI Marketing Intelligence</p>
      </div>
    </aside>
  )
}
