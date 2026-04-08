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
  { href: `/dashboard/${tenantId}`,          label: 'Overview',      icon: LayoutDashboard },
  { href: `/dashboard/${tenantId}/runs`,      label: 'Pipeline Runs', icon: Activity        },
  { href: `/dashboard/${tenantId}/campaigns`, label: 'Campaigns',     icon: Megaphone       },
  { href: `/dashboard/${tenantId}/learnings`, label: 'Learnings',     icon: BookOpen        },
  { href: `/dashboard/${tenantId}/settings`,  label: 'Settings',      icon: Settings        },
]

export function Sidebar({ tenantId }: SidebarProps) {
  const pathname = usePathname()
  const items = navItems(tenantId)

  return (
    <aside
      className="w-[220px] shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: '#ffffff', borderRight: '1px solid #e2e8f0' }}
    >
      {/* Brand */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid #f1f5f9' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              boxShadow: '0 2px 8px rgba(14,165,233,0.35)',
            }}
          >
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <div>
            <p className="text-[14px] font-bold tracking-tight" style={{ color: '#0f172a' }}>BriefOS</p>
            <p className="text-[10px] leading-none mt-0.5" style={{ color: '#94a3b8' }}>Marketing Intelligence</p>
          </div>
        </div>

        {/* Workspace pill */}
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: '#22c55e', boxShadow: '0 0 0 2px #dcfce7' }}
          />
          <span className="text-[11px] font-mono truncate" style={{ color: '#64748b' }}>{tenantId}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest px-2.5 pb-2"
          style={{ color: '#cbd5e1' }}
        >
          Menu
        </p>
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
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 relative',
                !isActive && 'hover:bg-slate-50 hover:text-slate-800'
              )}
              style={
                isActive
                  ? {
                      background: '#f0f9ff',
                      color: '#0284c7',
                      borderLeft: '3px solid #0ea5e9',
                      paddingLeft: '9px',
                    }
                  : { color: '#64748b' }
              }
            >
              <Icon
                size={15}
                style={{ color: isActive ? '#0ea5e9' : '#94a3b8' }}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3.5" style={{ borderTop: '1px solid #f1f5f9' }}>
        <p className="text-[11px]" style={{ color: '#cbd5e1' }}>v0.1.0 · AI Pipeline</p>
      </div>
    </aside>
  )
}
