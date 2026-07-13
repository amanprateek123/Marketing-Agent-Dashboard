'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Activity,
  Megaphone,
  BookOpen,
  Sparkles,
  Settings,
  Inbox,
  Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCampaigns, getIntelligenceDecisionsSummary } from '@/lib/api'

interface SidebarProps {
  tenantId: string
}

interface NavItem {
  href: string
  label: string
  hint: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; strokeWidth?: number }>
  badge?: number
}

const navItems = (
  tenantId: string,
  pendingCount: number,
  proposedCount: number,
): NavItem[] => [
  { href: `/dashboard/${tenantId}`,                    label: 'Home',            hint: 'Today at a glance',                       icon: Home },
  { href: `/dashboard/${tenantId}/approvals`,          label: 'Ads to approve',  hint: 'New ads waiting for your OK',            icon: Inbox, badge: pendingCount },
  { href: `/dashboard/${tenantId}/proposed-actions`,   label: 'Suggestions',     hint: 'Changes it wants to make to your ads',   icon: Brain, badge: proposedCount },
  { href: `/dashboard/${tenantId}/campaigns`,          label: 'Your ads',        hint: 'Ads currently running on Facebook & Instagram', icon: Megaphone },
  { href: `/dashboard/${tenantId}/runs`,               label: 'Activity log',    hint: "See what the agent's been doing",        icon: Activity },
  { href: `/dashboard/${tenantId}/learnings`,          label: 'What worked',     hint: 'Your best-performing ads and audiences', icon: BookOpen },
  { href: `/dashboard/${tenantId}/intelligence`,       label: 'Report card',     hint: 'Is the agent actually getting it right?', icon: Sparkles },
  { href: `/dashboard/${tenantId}/settings`,           label: 'Settings',        hint: 'Your business info & ad account',        icon: Settings },
]

export function Sidebar({ tenantId }: SidebarProps) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [proposedCount, setProposedCount] = useState(0)
  const [reachable, setReachable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const [list, summary] = await Promise.all([
          getCampaigns(tenantId),
          getIntelligenceDecisionsSummary(tenantId).catch(() => null),
        ])
        if (!cancelled) {
          setPendingCount(list.filter((c) => c.status === 'pending_approval').length)
          setProposedCount(summary?.counts?.shadow_review ?? 0)
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

  const items = navItems(tenantId, pendingCount, proposedCount)

  return (
    <aside
      className="w-[248px] shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--hairline)' }}
    >
      {/* Wordmark */}
      <div className="px-6 pt-7 pb-5">
        <Link href={`/dashboard/${tenantId}`} className="block">
          <p className="font-display italic text-[28px] leading-none" style={{ color: 'var(--ink)' }}>
            Merid<span style={{ color: 'var(--accent)' }}>i</span>an
          </p>
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
            Your marketing co-pilot
          </p>
        </Link>
        {/* Live status line */}
        <div
          className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}
        >
          <span className={cn('beacon', reachable === false && 'beacon-bad')} />
          <span className="text-[12px] font-medium" style={{ color: reachable === false ? 'var(--bad)' : 'var(--good)' }}>
            {reachable === false ? "Can't connect right now" : 'Connected and running'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = item.href === `/dashboard/${tenantId}`
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-120"
              style={
                isActive
                  ? { background: 'var(--accent-bg)', color: 'var(--ink)', border: '1px solid var(--accent-border)' }
                  : { color: 'var(--ink-2)', border: '1px solid transparent' }
              }
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2.2 : 1.7}
                style={{ color: isActive ? 'var(--accent-strong)' : 'var(--ink-3)', marginTop: 1 }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: isActive ? 'var(--ink)' : 'var(--ink-2)' }}>
                  {item.label}
                </p>
                <p className="text-[11.5px] mt-0.5 leading-tight" style={{ color: 'var(--ink-3)' }}>
                  {item.hint}
                </p>
              </div>
              {item.badge != null && item.badge > 0 && (
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full leading-none tabular-nums shrink-0"
                  style={{ background: 'var(--warn)', color: '#fff' }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-6 py-4" style={{ borderTop: '1px solid var(--hairline-light)' }}>
        <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
          Working on{' '}
          <span className="font-semibold" style={{ color: 'var(--ink-2)' }}>
            {tenantId}
          </span>
        </p>
      </div>
    </aside>
  )
}
