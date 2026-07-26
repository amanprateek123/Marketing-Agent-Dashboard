import Link from 'next/link'
import {
  Activity, CheckCircle2, Image as ImageIcon, Inbox, Link2, RefreshCw,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import type { TenantActivity } from '@/types'

/**
 * Everything else running under this tenant.
 *
 * The dashboard used to answer only "how are the ads doing?", leaving the rest
 * of the system — pipeline runs, creative production, sync freshness, the
 * approval and optimiser queues — invisible unless you navigated to each page
 * and checked. A stalled pipeline or a creative batch that produced nothing is
 * just as much "what's happening today" as spend is.
 */
export function ActivityGrid({
  activity,
  tenantId,
}: {
  activity: TenantActivity
  tenantId: string
}) {
  const base = `/dashboard/${tenantId}`
  const { meta, pipeline, creatives, queue, sync } = activity

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Cell
        icon={Link2}
        title="Meta connection"
        href={`${base}/settings`}
        healthy={meta.connected}
        lines={
          meta.connected
            ? [
                `${meta.accountCount} ad account${meta.accountCount === 1 ? '' : 's'}`,
                meta.pixelId ? 'Pixel connected' : 'No pixel set',
                meta.pageId ? 'Page connected' : 'No page set',
              ]
            : ['Not connected — nothing can sync or launch']
        }
      />

      <Cell
        icon={Activity}
        title="Intelligence pipeline"
        href={`${base}/runs`}
        healthy={pipeline.failedInWindow === 0}
        lines={[
          pipeline.lastRunAt
            ? `Last run ${formatRelativeTime(pipeline.lastRunAt)} · ${pipeline.lastRunStatus ?? '—'}`
            : 'Never run',
          `${pipeline.runsInWindow} run${pipeline.runsInWindow === 1 ? '' : 's'} this period`,
          pipeline.runningNow > 0
            ? `${pipeline.runningNow} running now`
            : pipeline.failedInWindow > 0
              ? `${pipeline.failedInWindow} failed`
              : 'No failures',
        ]}
      />

      <Cell
        icon={ImageIcon}
        title="Creative library"
        href={`${base}/creatives`}
        healthy={creatives.failed === 0}
        lines={[
          `${creatives.ready} ready to use`,
          creatives.producing > 0 ? `${creatives.producing} still producing` : 'None in production',
          creatives.failed > 0
            ? `${creatives.failed} failed`
            : creatives.allRejected > 0
              ? `${creatives.allRejected} fully rejected`
              : 'No failures',
        ]}
      />

      <Cell
        icon={Inbox}
        title="Waiting on you"
        href={`${base}/approvals`}
        healthy={queue.pendingApprovalCampaigns === 0}
        lines={[
          `${queue.pendingApprovalCampaigns} campaign${queue.pendingApprovalCampaigns === 1 ? '' : 's'} to approve`,
          `${queue.pendingActions} suggested change${queue.pendingActions === 1 ? '' : 's'}`,
          `${queue.pendingDecisions} optimiser decision${queue.pendingDecisions === 1 ? '' : 's'}`,
        ]}
      />

      <Cell
        icon={RefreshCw}
        title="Data freshness"
        href={`${base}/campaigns`}
        healthy={sync.staleCampaignCount === 0}
        lines={[
          sync.lastSyncAt ? `Synced ${formatRelativeTime(sync.lastSyncAt)}` : 'Never synced',
          sync.stalestCampaignHours != null
            ? `Oldest numbers ${Math.round(sync.stalestCampaignHours)}h old`
            : 'No live campaigns',
          sync.staleCampaignCount > 0
            ? `${sync.staleCampaignCount} campaign${sync.staleCampaignCount === 1 ? '' : 's'} stale`
            : 'All current',
        ]}
      />

      <Cell
        icon={CheckCircle2}
        title="Optimiser"
        href={`${base}/proposed-actions`}
        healthy
        lines={[
          `${queue.pendingActions + queue.pendingDecisions} proposal${queue.pendingActions + queue.pendingDecisions === 1 ? '' : 's'} open`,
          'Auditing every 6 hours',
          'Learning loop on days 7 / 14 / 30',
        ]}
      />
    </div>
  )
}

function Cell({
  icon: Icon,
  title,
  href,
  lines,
  healthy,
}: {
  icon: typeof Activity
  title: string
  href: string
  lines: string[]
  healthy: boolean
}) {
  return (
    <Link href={href} className="card card-hover px-5 py-4 block">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={15} style={{ color: healthy ? 'var(--ink-3)' : 'var(--warn)' }} />
        <p className="micro-label" style={{ color: 'var(--ink-3)' }}>
          {title}
        </p>
        {!healthy && (
          <span
            className="ml-auto rounded-full"
            style={{ width: 7, height: 7, background: 'var(--warn)' }}
          />
        )}
      </div>
      {lines.map((l, i) => (
        <p
          key={i}
          style={{
            fontSize: 13,
            color: i === 0 ? 'var(--ink)' : 'var(--ink-3)',
            lineHeight: 1.7,
          }}
        >
          {l}
        </p>
      ))}
    </Link>
  )
}
