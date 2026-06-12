'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Activity,
  Megaphone,
  BookOpen,
  Brain,
  Settings,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCampaigns } from '@/lib/api'

interface SidebarProps {
  tenantId: string
}

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; strokeWidth?: number }>
  badge?: number
}

const navItems = (tenantId: string, pendingCount: number): NavItem[] => [
  { href: `/dashboard/${tenantId}`,              label: 'Overview',      icon: LayoutDashboard },
  { href: `/dashboard/${tenantId}/approvals`,    label: 'Approvals',     icon: Inbox, badge: pendingCount },
  { href: `/dashboard/${tenantId}/runs`,         label: 'Pipeline Runs', icon: Activity },
  { href: `/dashboard/${tenantId}/campaigns`,    label: 'Campaigns',     icon: Megaphone },
  { href: `/dashboard/${tenantId}/learnings`,    label: 'Learnings',     icon: BookOpen },
  { href: `/dashboard/${tenantId}/intelligence`, label: 'Intelligence',  icon: Brain },
  { href: `/dashboard/${tenantId}/settings`,     label: 'Settings',      icon: Settings },
]

export function Sidebar({ tenantId }: SidebarProps) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const list = await getCampaigns(tenantId)
        if (!cancelled) {
          setPendingCount(list.filter((c) => c.status === 'pending_approval').length)
        }
      } catch {
        /* silent — sidebar shouldn't break on a fetch failure */
      }
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [tenantId])

  const items = navItems(tenantId, pendingCount)

  return (
    <aside
      className="w-[236px] shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: 'var(--surface-warm)', borderRight: '1px solid var(--hairline)' }}
    >
      {/* Wordmark — the serif IS the brand */}
      <div className="px-6 pt-7 pb-5">
        <Link href={`/dashboard/${tenantId}`} className="block group">
          <p
            className="font-display text-[26px] leading-none tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            Brief<span style={{ color: 'var(--accent)' }}>OS</span>
            <span className="font-display italic" style={{ color: 'var(--ink-4)' }}>.</span>
          </p>
          <p className="micro-label mt-2">Marketing Intelligence</p>
        </Link>
      </div>

      <hr className="rule mx-6" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-px overflow-y-auto">
        <p className="micro-label px-3 pb-2">Workspace</p>
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
                'relative flex items-center gap-2.5 px-3 py-[9px] rounded-lg text-[13px] transition-all duration-150',
              )}
              style={
                isActive
                  ? { background: 'var(--surface)', color: 'var(--ink)', fontWeight: 650, boxShadow: 'var(--shadow-soft)', border: '1px solid var(--hairline)' }
                  : { color: 'var(--ink-2)', fontWeight: 500, border: '1px solid transparent' }
              }
            >
              {/* Active indicator — hairline accent bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[16px] rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <Icon
                size={15}
                strokeWidth={isActive ? 2.1 : 1.6}
                style={{ color: isActive ? 'var(--accent)' : 'var(--ink-3)' }}
              />
              <span className="flex-1">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none tabular-nums"
                  style={{ background: 'var(--warn)', color: '#fff' }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Tenant footer */}
      <div className="px-6 py-4" style={{ borderTop: '1px solid var(--hairline-light)' }}>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: 'var(--good)', boxShadow: '0 0 0 3px var(--good-bg)' }}
          />
          <span className="mono text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
            {tenantId}
          </span>
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: 'var(--ink-4)' }}>v0.2 · editorial console</p>
      </div>
    </aside>
  )
}
