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
  Lock,
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
import { useBrainUnlocked } from '@/lib/use-brain-auth'
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
  /** Drawn with a small lock: still reachable, but needs its own sign-in first. */
  locked?: boolean
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
  brainLocked: boolean,
): NavGroup[] {
  const root = `/dashboard/${tenantId}`

  return [
    {
      label: 'Grow',
      items: [
        { href: root, label: 'Overview', hint: 'Your spend, results and what needs a decision', icon: Home },
        {
          href: `${root}/campaign-copilot`,
          label: 'Plan a campaign',
          hint: 'Describe a goal and get a ready-to-launch plan',
          icon: MessageCircleMore,
        },
        {
          href: `${root}/tool-impact`,
          label: 'Results we delivered',
          hint: 'What the campaigns we launched for you have earned',
          icon: Zap,
        },
      ],
    },
    {
      label: 'Execute',
      items: [
        {
          href: `${root}/approvals`,
          label: 'Approvals',
          hint: 'Check and approve campaigns before they go live',
          icon: Inbox,
          badge: pendingCount,
        },
        {
          href: `${root}/campaigns`,
          label: 'Live campaigns',
          hint: 'How each running campaign is doing',
          icon: Megaphone,
        },
        {
          href: `${root}/creatives`,
          label: 'Ads',
          hint: 'Make, review and reuse your ads',
          icon: ImageIcon,
        },
        {
          href: `${root}/gallery`,
          label: 'Photos & logos',
          hint: 'Your approved photos, logos and brand material',
          icon: LayoutGrid,
        },
      ],
    },
    {
      label: 'Insights',
      items: [
        {
          href: `${root}/brain`,
          label: 'Brain',
          hint: 'The AI marketing lead: its plans, decisions and questions for you',
          icon: BrainCircuit,
          badge: brainLocked ? undefined : openGateCount,
          locked: brainLocked,
        },
        {
          href: `${root}/proposed-actions`,
          label: 'Suggested changes',
          hint: 'Budget, pause and ad changes the AI suggests',
          icon: Brain,
          badge: proposedCount,
        },
        {
          href: `${root}/learnings`,
          label: 'Winning patterns',
          hint: 'Which audiences and ads work best, and why',
          icon: BookOpen,
        },
        {
          href: `${root}/intelligence`,
          label: 'Suggestion accuracy',
          hint: 'Whether the AI\'s past suggestions turned out right',
          icon: Sparkles,
        },
        {
          href: `${root}/runs`,
          label: 'Activity',
          hint: 'Everything the AI has done, step by step',
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
      aria-label="Meridian overview"
    >
      <span className={styles.brandMark} aria-hidden="true">
        <MeridianGlyph size={22} />
      </span>
      <span className={styles.brandCopy}>
        <span className={styles.wordmark}>Meridian</span>
        <span className={styles.productLabel}>AI marketing assistant</span>
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
  brainLocked: boolean
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
  brainLocked,
  reachable,
  onNavigate,
  onClose,
}: SidebarContentProps) {
  const root = `/dashboard/${tenantId}`
  const groups = navGroups(tenantId, pendingCount, proposedCount, openGateCount, brainLocked)
  const status = reachable === null
    ? { label: 'Checking data', className: styles.statusConnecting }
    : reachable
      ? { label: 'Connected', className: styles.statusOnline }
      : { label: 'Connection lost', className: styles.statusOffline }

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
                    {item.locked && (
                      <span
                        className="shrink-0"
                        style={{ color: 'var(--ink-3)' }}
                        title="Needs its own sign-in"
                        aria-label="Locked — needs its own sign-in"
                      >
                        <Lock size={13} aria-hidden="true" />
                      </span>
                    )}
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
              <span className={styles.workspaceName} title={tenantId}>{tenantId}</span>
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
  // Unknown (before hydration) draws as unlocked, so the lock never flickers on for a Brain that is open.
  const brainLocked = useBrainUnlocked() === false
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
    // A locked Brain has no badge to show — and asking would only be refused.
    if (brainLocked) return
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
  }, [tenantId, brainLocked])

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
    brainLocked,
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
              reachable === null ? 'Checking data' : reachable ? 'Connected' : 'Connection lost'
            }
            title={reachable === null ? 'Checking data' : reachable ? 'Connected' : 'Connection lost'}
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
