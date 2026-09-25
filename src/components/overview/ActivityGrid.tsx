import Link from 'next/link'
import {
  Activity, CheckCircle2, Image as ImageIcon, Inbox, Link2, RefreshCw,
} from 'lucide-react'
import { formatRelative, plainStatus } from '@/lib/plain-language'
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
        title="Meta ad account"
        href={`${base}/settings`}
        healthy={meta.connected}
        lines={
          meta.connected
            ? [
                `${meta.accountCount} ad account${meta.accountCount === 1 ? '' : 's'}`,
                meta.pixelId ? 'Sales tracking connected' : 'Sales tracking not set up',
                meta.pageId ? 'Facebook Page connected' : 'No Facebook Page chosen',
              ]
            : ['Not connected — we cannot read results or launch ads']
        }
      />

      <Cell
        icon={Activity}
        title="Ad idea research"
        href={`${base}/runs`}
        healthy={pipeline.failedInWindow === 0}
        lines={[
          pipeline.lastRunAt
            ? `Last ran ${formatRelative(pipeline.lastRunAt)}${pipeline.lastRunStatus ? ` · ${plainStatus('pipelineStatus', pipeline.lastRunStatus).label}` : ''}`
            : 'Has not run yet',
          `Ran ${pipeline.runsInWindow} time${pipeline.runsInWindow === 1 ? '' : 's'} in this period`,
          pipeline.runningNow > 0
            ? `${pipeline.runningNow} running now`
            : pipeline.failedInWindow > 0
              ? `${pipeline.failedInWindow} did not finish`
              : 'Nothing went wrong',
        ]}
      />

      <Cell
        icon={ImageIcon}
        title="Your ads"
        href={`${base}/creatives`}
        healthy={creatives.failed === 0}
        lines={[
          `${creatives.ready} ready to use`,
          creatives.producing > 0 ? `${creatives.producing} being made` : 'None being made right now',
          creatives.failed > 0
            ? `${creatives.failed} could not be made`
            : creatives.allRejected > 0
              ? `${creatives.allRejected} batch${creatives.allRejected === 1 ? '' : 'es'} with every ad turned down`
              : 'Nothing went wrong',
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
          `${queue.pendingDecisions} budget or pause suggestion${queue.pendingDecisions === 1 ? '' : 's'}`,
        ]}
      />

      <Cell
        icon={RefreshCw}
        title="How fresh the numbers are"
        href={`${base}/campaigns`}
        healthy={sync.staleCampaignCount === 0}
        lines={[
          sync.lastSyncAt ? `Refreshed from Meta ${formatRelative(sync.lastSyncAt)}` : 'Not refreshed from Meta yet',
          sync.stalestCampaignHours != null
            ? `Oldest numbers are ${Math.round(sync.stalestCampaignHours)} hour${Math.round(sync.stalestCampaignHours) === 1 ? '' : 's'} old`
            : 'No campaigns running',
          sync.staleCampaignCount > 0
            ? `${sync.staleCampaignCount} campaign${sync.staleCampaignCount === 1 ? '' : 's'} out of date`
            : 'All up to date',
        ]}
      />

      <Cell
        icon={CheckCircle2}
        title="Automatic check-ups"
        href={`${base}/proposed-actions`}
        healthy
        lines={[
          `${queue.pendingActions + queue.pendingDecisions} suggestion${queue.pendingActions + queue.pendingDecisions === 1 ? '' : 's'} waiting`,
          'Checks your campaigns every 6 hours',
          'Looks back at results after 7, 14 and 30 days',
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
    <Link href={href} className="card card-hover block min-w-0 px-5 py-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={15} className="shrink-0" style={{ color: healthy ? 'var(--ink-3)' : 'var(--warn)' }} aria-hidden="true" />
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
          className="break-words"
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
