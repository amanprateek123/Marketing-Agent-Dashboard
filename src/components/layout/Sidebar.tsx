'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BookOpen,
  Brain,
  BrainCircuit,
  Home,
  Image as ImageIcon,
  Inbox,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  MessageCircleMore,
  Settings,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCampaigns, getIntelligenceDecisionsSummary } from '@/lib/api'
import { getBrainGates } from '@/lib/brain-api'
import { logout } from '@/lib/auth'
import { MeridianGlyph } from '@/components/ui/MeridianMark'
import styles from './Sidebar.module.css'

interface SidebarProps {
  tenantId: string
}

interface NavItem {
  href: string
  label: string
  hint: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  badge?: number
}

interface NavGroup {
  label: string
  items: NavItem[]
}

function navGroups(
  tenantId: string,
  pendingCount: number,
  proposedCount: number,
  openGateCount: number,
): NavGroup[] {
  const root = `/dashboard/${tenantId}`

  return [
    {
      label: 'Grow',
      items: [
        { href: root, label: 'Command center', hint: 'Growth, risk and opportunity at a glance', icon: Home },
        {
          href: `${root}/campaign-copilot`,
          label: 'Campaign Copilot',
          hint: 'Turn a business goal into a launch-ready plan',
          icon: MessageCircleMore,
        },
        {
          href: `${root}/tool-impact`,
          label: 'Meridian impact',
          hint: 'Measured results from campaigns Meridian owns',
          icon: Zap,
        },
      ],
    },
    {
      label: 'Execute',
      items: [
        {
          href: `${root}/approvals`,
          label: 'Approval center',
          hint: 'Review safeguards and approve launches',
          icon: Inbox,
          badge: pendingCount,
        },
        {
          href: `${root}/campaigns`,
          label: 'Live campaigns',
          hint: 'Follow delivery and campaign health',
          icon: Megaphone,
        },
        {
          href: `${root}/creatives`,
          label: 'Creative studio',
          hint: 'Create, review and reuse campaign assets',
          icon: ImageIcon,
        },
        {
          href: `${root}/gallery`,
          label: 'Asset gallery',
          hint: 'Organize approved source material',
          icon: LayoutGrid,
        },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        {
          href: `${root}/brain`,
          label: 'Brain',
          hint: 'The marketing head: decisions, pipeline and approvals',
          icon: BrainCircuit,
          badge: openGateCount,
        },
        {
          href: `${root}/proposed-actions`,
          label: 'AI recommendations',
          hint: 'Review the next best growth actions',
          icon: Brain,
          badge: proposedCount,
        },
        {
          href: `${root}/learnings`,
          label: 'Winning patterns',
          hint: 'See what audiences and creatives are teaching us',
          icon: BookOpen,
        },
        {
          href: `${root}/intelligence`,
          label: 'Intelligence quality',
          hint: 'Measure how reliably Meridian is deciding',
          icon: Sparkles,
        },
        {
          href: `${root}/runs`,
          label: 'Activity & audit',
          hint: 'Trace every automated step and decision',
          icon: Activity,
        },
      ],
    },
  ]
}

function isItemActive(pathname: string, href: string, root: string): boolean {
  return href === root ? pathname === href : pathname.startsWith(href)
}

function MeridianBrand({ tenantId, onNavigate }: { tenantId: string; onNavigate?: () => void }) {
  return (
    <Link
      href={`/dashboard/${tenantId}`}
      className={styles.brand}
      onClick={onNavigate}
      aria-label="Meridian command center"
    >
      <span className={styles.brandMark} aria-hidden="true">
        <MeridianGlyph size={22} />
      </span>
      <span className={styles.brandCopy}>
        <span className={styles.wordmark}>Meridian</span>
        <span className={styles.productLabel}>AI Growth OS</span>
      </span>
    </Link>
  )
}

interface SidebarContentProps {
  tenantId: string
  pathname: string
  pendingCount: number
  proposedCount: number
  openGateCount: number
  reachable: boolean | null
  onNavigate?: () => void
  onClose?: () => void
}

function SidebarContent({
  tenantId,
  pathname,
  pendingCount,
  proposedCount,
  openGateCount,
  reachable,
  onNavigate,
  onClose,
}: SidebarContentProps) {
  const root = `/dashboard/${tenantId}`
  const groups = navGroups(tenantId, pendingCount, proposedCount, openGateCount)
  const status = reachable === null
    ? { label: 'Checking data', className: styles.statusConnecting }
    : reachable
      ? { label: 'Workspace data online', className: styles.statusOnline }
      : { label: 'Data connection interrupted', className: styles.statusOffline }

  return (
    <>
      <div className={styles.sidebarHeader}>
        <div className={styles.brandRow}>
          <MeridianBrand tenantId={tenantId} onNavigate={onNavigate} />
          {onClose && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close navigation"
              autoFocus
            >
              <X size={19} />
            </button>
          )}
        </div>

      </div>

      <nav className={styles.navigation} aria-label="Product navigation">
        {groups.map((group) => (
          <div className={styles.navGroup} key={group.label}>
            <p className={styles.groupLabel}>{group.label}</p>
            <div className={styles.navList}>
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isItemActive(pathname, item.href, root)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(styles.navItem, active && styles.navItemActive)}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className={styles.navIcon} aria-hidden="true">
                      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                    </span>
                    <span className={styles.navCopy}>
                      <span className={styles.navLabel}>{item.label}</span>
                      <span className={styles.navHint}>{item.hint}</span>
                    </span>
                    {item.badge != null && item.badge > 0 && (
                      <span className={styles.badge} aria-label={`${item.badge} waiting`}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={cn(styles.systemStatus, styles.footerStatus, status.className)} role="status" aria-live="polite">
          <span className={styles.statusDot} aria-hidden="true" />
          <span>{status.label}</span>
        </div>
        <div className={styles.footerControls}>
          <Link
            href={`${root}/settings`}
            className={cn(styles.workspace, pathname.startsWith(`${root}/settings`) && styles.workspaceActive)}
            onClick={onNavigate}
            aria-current={pathname.startsWith(`${root}/settings`) ? 'page' : undefined}
          >
            <span className={styles.workspaceAvatar} aria-hidden="true">
              {tenantId.slice(0, 1).toUpperCase()}
            </span>
            <span className={styles.workspaceCopy}>
              <span className={styles.workspaceLabel}>Workspace</span>
              <span className={styles.workspaceName}>{tenantId}</span>
            </span>
            <Settings size={16} aria-hidden="true" />
          </Link>
          <button type="button" onClick={logout} className={styles.logoutButton} aria-label="Sign out" title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </>
  )
}

export function Sidebar({ tenantId }: SidebarProps) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [proposedCount, setProposedCount] = useState(0)
  const [openGateCount, setOpenGateCount] = useState(0)
  const [reachable, setReachable] = useState<boolean | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileDrawerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let cancelled = false

    async function tick() {
      try {
        const [list, summary] = await Promise.all([
          getCampaigns(tenantId),
          getIntelligenceDecisionsSummary(tenantId).catch(() => null),
        ])
        if (!cancelled) {
          setPendingCount(list.filter((campaign) => campaign.status === 'pending_approval').length)
          setProposedCount(summary?.counts?.shadow_review ?? 0)
          setReachable(true)
        }
      } catch {
        if (!cancelled) setReachable(false)
      }
    }

    void tick()
    const id = window.setInterval(tick, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [tenantId])

  // Foundry is reached through its own bridge, not the dashboard API, so it
  // polls separately: one being down must not blank the other's badge, and an
  // unreachable Foundry must not report the whole workspace as offline.
  useEffect(() => {
    let cancelled = false

    async function tick() {
      try {
        const gates = await getBrainGates(tenantId)
        if (!cancelled) setOpenGateCount(gates.length)
      } catch {
        if (!cancelled) setOpenGateCount(0)
      }
    }

    void tick()
    const id = window.setInterval(tick, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [tenantId])

  useEffect(() => {
    if (!mobileOpen) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        window.requestAnimationFrame(() => menuButtonRef.current?.focus())
        return
      }

      if (event.key !== 'Tab') return
      const focusable = Array.from(
        mobileDrawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
      )
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen])

  const sharedProps = {
    tenantId,
    pathname,
    pendingCount,
    proposedCount,
    openGateCount,
    reachable,
  }

  return (
    <>
      <aside className={styles.desktopSidebar} aria-label="Meridian workspace">
        <SidebarContent {...sharedProps} />
      </aside>

      <header className={styles.mobileHeader}>
        <MeridianBrand tenantId={tenantId} />
        <div className={styles.mobileActions}>
          <span
            className={cn(
              styles.mobileStatus,
              reachable === true && styles.mobileStatusOnline,
              reachable === false && styles.mobileStatusOffline,
            )}
            role="status"
            aria-label={
              reachable === null ? 'Checking data' : reachable ? 'Workspace data online' : 'Data connection interrupted'
            }
            title={reachable === null ? 'Checking data' : reachable ? 'Workspace data online' : 'Data connection interrupted'}
          />
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            <Menu size={21} />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className={styles.mobileLayer}>
          <button
            type="button"
            className={styles.mobileBackdrop}
            aria-label="Close navigation"
            onClick={() => {
              setMobileOpen(false)
              window.requestAnimationFrame(() => menuButtonRef.current?.focus())
            }}
          />
          <aside
            ref={mobileDrawerRef}
            id="mobile-navigation"
            className={styles.mobileDrawer}
            role="dialog"
            aria-modal="true"
            aria-label="Meridian navigation"
          >
            <SidebarContent
              {...sharedProps}
              onNavigate={() => setMobileOpen(false)}
              onClose={() => {
                setMobileOpen(false)
                window.requestAnimationFrame(() => menuButtonRef.current?.focus())
              }}
            />
          </aside>
        </div>
      )}
    </>
  )
}
