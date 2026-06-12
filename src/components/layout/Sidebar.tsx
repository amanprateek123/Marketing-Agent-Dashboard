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
  code: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; strokeWidth?: number }>
  badge?: number
}

const navItems = (tenantId: string, pendingCount: number): NavItem[] => [
  { href: `/dashboard/${tenantId}`,              label: 'Overview',     code: '01', icon: LayoutDashboard },
  { href: `/dashboard/${tenantId}/approvals`,    label: 'Approvals',    code: '02', icon: Inbox, badge: pendingCount },
  { href: `/dashboard/${tenantId}/runs`,         label: 'Pipeline',     code: '03', icon: Activity },
  { href: `/dashboard/${tenantId}/campaigns`,    label: 'Campaigns',    code: '04', icon: Megaphone },
  { href: `/dashboard/${tenantId}/learnings`,    label: 'Learnings',    code: '05', icon: BookOpen },
  { href: `/dashboard/${tenantId}/intelligence`, label: 'Intelligence', code: '06', icon: Brain },
  { href: `/dashboard/${tenantId}/settings`,     label: 'Config',       code: '07', icon: Settings },
]

export function Sidebar({ tenantId }: SidebarProps) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [reachable, setReachable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const list = await getCampaigns(tenantId)
        if (!cancelled) {
          setPendingCount(list.filter((c) => c.status === 'pending_approval').length)
          setReachable(true)
        }
      } catch {
        if (!cancelled) setReachable(false)
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
      className="w-[218px] shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--hairline)' }}
    >
      {/* Wordmark — the serif italic is the one human voice in the console */}
      <div className="px-5 pt-6 pb-4">
        <Link href={`/dashboard/${tenantId}`} className="block">
          <p className="font-display italic text-[24px] leading-none" style={{ color: 'var(--ink)' }}>
            Brief<span style={{ color: 'var(--accent)' }}>OS</span>
          </p>
        </Link>
        {/* System status line */}
        <div
          className="mt-3.5 flex items-center gap-2 rounded-md px-2.5 py-2"
          style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}
        >
          <span className={cn('beacon', reachable === false && 'beacon-bad')} />
          <span className="mono text-[10px] tracking-wider" style={{ color: reachable === false ? 'var(--bad)' : 'var(--good)' }}>
            {reachable === false ? 'API OFFLINE' : 'OPERATIONAL'}
          </span>
          <span className="mono text-[10px] ml-auto truncate" style={{ color: 'var(--ink-4)' }}>
            {tenantId.slice(0, 10)}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-px overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = item.href === `/dashboard/${tenantId}`
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex items-center gap-2.5 px-3 py-[8px] rounded-lg text-[12.5px] transition-all duration-120"
              style={
                isActive
                  ? { background: 'var(--accent-bg)', color: 'var(--ink)', fontWeight: 650, border: '1px solid var(--accent-border)' }
                  : { color: 'var(--ink-2)', fontWeight: 500, border: '1px solid transparent' }
              }
            >
              <span className="mono text-[9px] w-4 shrink-0" style={{ color: isActive ? 'var(--accent)' : 'var(--ink-4)' }}>
                {item.code}
              </span>
              <Icon
                size={14}
                strokeWidth={isActive ? 2.1 : 1.6}
                style={{ color: isActive ? 'var(--accent-strong)' : 'var(--ink-3)' }}
              />
              <span className="flex-1">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span
                  className="mono text-[10px] font-bold px-1.5 py-0.5 rounded leading-none tabular-nums"
                  style={{ background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-5 py-3.5" style={{ borderTop: '1px solid var(--hairline-light)' }}>
        <p className="mono text-[9px] tracking-widest" style={{ color: 'var(--ink-4)' }}>
          BRIEFOS v0.3 · MISSION CONTROL
        </p>
      </div>
    </aside>
  )
}
