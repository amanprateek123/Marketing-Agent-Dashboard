'use client'

import { use, useState } from 'react'
import { Loader2, Play, RefreshCw } from 'lucide-react'
import { BrainOnly } from '@/components/inbox/BrainOnly'
import { writeError } from '@/components/inbox/InboxParts'
import { SectionCard } from '@/components/brain/shared'
import { CompetitorEditor } from '@/components/competitors/CompetitorEditor'
import { CompetitorCandidates, CompetitorFindings } from '@/components/competitors/CompetitorResearch'
import { runCompetitorResearch } from '@/lib/brain-api'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

/**
 * Competitors — who we watch, what they are running, and the ideas worth testing from it.
 * Competitor ideas are never treated as proven: accepted ones go in as things to test.
 */
export default function CompetitorsPage({ params }: PageProps) {
  const { tenantId } = use(params)
  return (
    <BrainOnly>
      <Competitors tenantId={tenantId} />
    </BrainOnly>
  )
}

function Competitors({ tenantId }: { tenantId: string }) {
  const [reloadKey, setReloadKey] = useState(0)
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  async function runNow() {
    setRunning(true)
    setNote(null)
    try {
      await runCompetitorResearch(tenantId)
      setNote({ ok: true, text: 'Started. New findings usually show here within half an hour.' })
    } catch (err) {
      setNote({ ok: false, text: writeError(err, "Competitor research didn't start. Try again.") })
    } finally {
      setRunning(false)
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">Competitors</h1>
          <p className="page-subtitle">
            What competitors are running, and ideas worth testing from it. Their ads tell us what
            they try — never how well it works — so every idea here is tested before it counts.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          <button type="button" className="btn btn-ghost" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void runNow()} disabled={running}>
            {running ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            Run now
          </button>
        </div>
      </div>
      {note && (
        <p role={note.ok ? 'status' : 'alert'} className="mt-3 text-sm" style={{ color: note.ok ? 'var(--good)' : 'var(--bad)' }}>
          {note.text}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-5">
        <SectionCard
          title="Ideas to review"
          description="Patterns the research found that could work for us. Keep the ones worth testing."
        >
          <CompetitorCandidates key={reloadKey} tenantId={tenantId} />
        </SectionCard>

        <SectionCard title="What competitors are running" description="Ads and pages seen in the last 30 days.">
          <CompetitorFindings key={reloadKey} tenantId={tenantId} />
        </SectionCard>

        <SectionCard title="Who we watch" description="The competitors the research checks, and which of our products each competes with.">
          <CompetitorEditor tenantId={tenantId} />
        </SectionCard>
      </div>
    </main>
  )
}
