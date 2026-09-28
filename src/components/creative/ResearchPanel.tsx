'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Hammer, Loader2, Maximize2, RefreshCw, Recycle, Trash2 } from 'lucide-react'
import {
  buildDirection,
  chooseResearchRerun,
  confirmResearchSources,
  discardIdea,
  expandConcept,
  getResearchDirections,
  getResearchSources,
  ParityError,
  type ResearchDirectionsResult,
  type ResearchSourcesResult,
} from '@/lib/creative-parity-api'
import { formatWhen } from '@/lib/plain-language'
import { OutcomeLine, useParityAction } from './parity-shared'

type Load<T> =
  | { state: 'loading' }
  | { state: 'ready'; data: T }
  | { state: 'unavailable' }
  | { state: 'error' }

function toLoad<T>(e: unknown): Load<T> {
  return e instanceof ParityError && e.notAvailable ? { state: 'unavailable' } : { state: 'error' }
}

interface Pool {
  directions: NonNullable<ResearchDirectionsResult['directions']>
  concepts: NonNullable<ResearchDirectionsResult['concepts']>
}

function toPool(res: ResearchDirectionsResult | null): Pool {
  return { directions: res?.directions ?? [], concepts: res?.concepts ?? [] }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The research half of a run, in the order Slack asked it:
 *  1. if this product was researched before — reuse that, or research again;
 *  2. the sources it plans to read — confirm them, or give your own;
 *  3. the directions it came back with — make ads from one (or drop its idea), and develop any
 *     idea from the pool that did not make the cut.
 */
export function ResearchPanel({
  tenantId,
  researchId,
  status,
  onChanged,
}: {
  tenantId: string
  researchId: number
  status: string
  onChanged?: () => void
}) {
  const { busy, outcome, run } = useParityAction()
  const [sources, setSources] = useState<Load<ResearchSourcesResult> | null>(null)
  const [override, setOverride] = useState(false)
  const [urls, setUrls] = useState('')
  const [directions, setDirections] = useState<Load<Pool> | null>(null)
  const [discarding, setDiscarding] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [gone, setGone] = useState<Set<string>>(new Set())

  const askingSources = status === 'awaiting_research_confirm'
  const askingRerun = status === 'awaiting_research_rerun'
  const hasDirections = status === 'research_ready' || status === 'done'

  // Retry paths. The first load happens in the effects below; the render treats a not-yet-answered
  // request (null) as loading.
  const loadSources = useCallback(async () => {
    setSources({ state: 'loading' })
    try {
      setSources({ state: 'ready', data: (await getResearchSources(tenantId, researchId)) ?? {} })
    } catch (e) {
      setSources(toLoad(e))
    }
  }, [tenantId, researchId])

  const loadDirections = useCallback(async () => {
    setDirections({ state: 'loading' })
    try {
      const res = await getResearchDirections(tenantId, researchId)
      setDirections({ state: 'ready', data: toPool(res) })
    } catch (e) {
      setDirections(toLoad(e))
    }
  }, [tenantId, researchId])

  useEffect(() => {
    if (!askingSources) return
    let live = true
    getResearchSources(tenantId, researchId).then(
      data => { if (live) setSources({ state: 'ready', data: data ?? {} }) },
      e => { if (live) setSources(toLoad(e)) },
    )
    return () => { live = false }
  }, [askingSources, tenantId, researchId])

  useEffect(() => {
    if (!hasDirections) return
    let live = true
    getResearchDirections(tenantId, researchId).then(
      res => { if (live) setDirections({ state: 'ready', data: toPool(res) }) },
      e => { if (live) setDirections(toLoad(e)) },
    )
    return () => { live = false }
  }, [hasDirections, tenantId, researchId])

  const after = (res: unknown) => {
    if (res !== undefined) onChanged?.()
  }
  const spin = (key: string, icon: React.ReactNode) =>
    busy === key ? <Loader2 size={13} className="animate-spin" /> : icon
  const disabled = busy !== null

  const typedUrls = urls
    .split(/[\s,]+/)
    .map(u => u.trim())
    .filter(u => /^https?:\/\//i.test(u))

  return (
    <div className="card-inset mt-3 px-4 py-3 min-w-0">
      <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Research</p>

      {askingRerun && (
        <div className="mb-3">
          <p className="text-[12px] mb-1.5" style={{ color: 'var(--ink-2)' }}>
            This product was researched before. Use that research again, or start fresh?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" disabled={disabled}
              onClick={async () => after(await run('reuse', () => chooseResearchRerun(tenantId, researchId, 'reuse'), 'Using the earlier research.'))}>
              {spin('reuse', <Recycle size={13} />)} Use the earlier research
            </button>
            <button type="button" className="btn btn-primary" disabled={disabled}
              onClick={async () => after(await run('rerun', () => chooseResearchRerun(tenantId, researchId, 'rerun'), 'Researching again.'))}>
              {spin('rerun', <RefreshCw size={13} />)} Research again
            </button>
          </div>
        </div>
      )}

      {askingSources && (
        <div className="mb-3">
          <p className="text-[12px] mb-1.5" style={{ color: 'var(--ink-2)' }}>
            These are the places it plans to read. Go ahead with them, or give your own?
          </p>
          {(sources === null || sources.state === 'loading') && (
            <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>Loading the sources…</p>
          )}
          {sources?.state === 'unavailable' && (
            <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>Seeing the sources here is not available yet.</p>
          )}
          {sources?.state === 'error' && (
            <p className="text-[12px]" style={{ color: 'var(--warn)' }}>
              We couldn&rsquo;t load the sources.{' '}
              <button type="button" className="underline" onClick={() => void loadSources()}>Try again</button>
            </p>
          )}
          {sources?.state === 'ready' && (
            <>
              {sources.data.previous?.when && (
                <p className="text-[11.5px] mb-1" style={{ color: 'var(--ink-3)' }}>
                  Last researched {formatWhen(sources.data.previous.when)}.
                </p>
              )}
              {(sources.data.sources ?? []).length === 0 ? (
                <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>No sources were suggested.</p>
              ) : (
                <ul className="mb-2 grid gap-1">
                  {(sources.data.sources ?? []).map(s => (
                    <li key={s.url} className="flex min-w-0 items-center gap-1.5 text-[12px]">
                      <ExternalLink size={11} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
                      <a href={s.url} target="_blank" rel="noreferrer" className="truncate underline" title={s.url}
                        style={{ color: 'var(--ink-2)' }}>
                        {s.title?.trim() || hostOf(s.url)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {override && (
            <label className="block mb-2">
              <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--ink-2)' }}>
                Your sources — one web address per line
              </span>
              <textarea className="input" rows={3} value={urls} onChange={e => setUrls(e.target.value)}
                placeholder="https://www.example.com/page" />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {!override ? (
              <>
                <button type="button" className="btn btn-primary" disabled={disabled}
                  onClick={async () => after(await run('confirm', () => confirmResearchSources(tenantId, researchId, true), 'Sources confirmed — research is under way.'))}>
                  {spin('confirm', <CheckCircle2 size={13} />)} Go ahead with these
                </button>
                <button type="button" className="btn btn-ghost" disabled={disabled} onClick={() => setOverride(true)}>
                  Use my own sources
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-primary" disabled={disabled || typedUrls.length === 0}
                  onClick={async () => after(await run('override', () => confirmResearchSources(tenantId, researchId, false, typedUrls), 'Using your sources.'))}>
                  {spin('override', <CheckCircle2 size={13} />)} Use these {typedUrls.length || ''} source{typedUrls.length === 1 ? '' : 's'}
                </button>
                <button type="button" className="btn btn-ghost" disabled={disabled} onClick={() => setOverride(false)}>
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {!hasDirections && !askingSources && !askingRerun && directions === null && (
        <button type="button" className="btn btn-ghost" onClick={() => void loadDirections()}>
          Show the directions so far
        </button>
      )}

      {((directions === null && hasDirections) || directions?.state === 'loading') && (
        <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>Loading the directions…</p>
      )}
      {directions?.state === 'unavailable' && (
        <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>Seeing the directions here is not available yet.</p>
      )}
      {directions?.state === 'error' && (
        <p className="text-[12px]" style={{ color: 'var(--warn)' }}>
          We couldn&rsquo;t load the directions.{' '}
          <button type="button" className="underline" onClick={() => void loadDirections()}>Try again</button>
        </p>
      )}
      {directions?.state === 'ready' && (
        directions.data.directions.length === 0 && directions.data.concepts.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>No directions yet.</p>
        ) : (
          <>
            {directions.data.directions.length > 0 && (
              <>
                <p className="micro-label mt-1 mb-1.5">Directions ready to make</p>
                <ol className="grid gap-2">
                  {directions.data.directions
                    .filter(d => !gone.has(String(d.id)))
                    .map((d, i) => {
                      const key = String(d.id)
                      // Dropping an idea is addressed by the run that shows it; a direction nobody
                      // has made ads from yet has no such run, so it cannot be dropped from here.
                      const shownBy = d.used_by_run_id ?? null
                      return (
                        <li key={key} className="card px-3 py-2.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 flex-1 text-[12.5px] font-semibold break-words" style={{ color: 'var(--ink)' }}>
                              {i + 1}. {d.title?.trim() || `Direction ${i + 1}`}
                            </p>
                            {d.status === 'used' && <span className="chip">Ads made</span>}
                          </div>
                          {d.summary && (
                            <p className="text-[12px] mt-0.5 break-words" style={{ color: 'var(--ink-3)' }}>{d.summary}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" className="btn btn-primary" disabled={disabled}
                              onClick={async () => after(await run(`build:${key}`, () => buildDirection(tenantId, researchId, d.id), 'Making ads from this direction.'))}>
                              {spin(`build:${key}`, <Hammer size={13} />)} Make ads from this
                            </button>
                            {shownBy !== null && discarding !== key && (
                              <button type="button" className="btn btn-ghost" disabled={disabled}
                                onClick={() => { setDiscarding(key); setReason('') }}>
                                <Trash2 size={13} /> Drop this idea
                              </button>
                            )}
                          </div>
                          {shownBy !== null && discarding === key && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 min-w-0">
                              <input className="input min-w-0 flex-1" value={reason} onChange={e => setReason(e.target.value)}
                                placeholder="Why drop it? e.g. off brand" aria-label="Why drop this idea" />
                              <button type="button" className="btn btn-danger" disabled={disabled}
                                onClick={async () => {
                                  const res = await run(`discard:${key}`, () => discardIdea(tenantId, shownBy, reason.trim()), 'Idea dropped — it will not be suggested again.')
                                  if (res !== undefined) { setGone(g => new Set(g).add(key)); setDiscarding(null) }
                                }}>
                                {spin(`discard:${key}`, null)} Drop it
                              </button>
                              <button type="button" className="btn btn-ghost" onClick={() => setDiscarding(null)}>Keep it</button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                </ol>
              </>
            )}
            {directions.data.concepts.length > 0 && (
              <>
                <p className="micro-label mt-3 mb-1">Other ideas in the pool</p>
                <p className="text-[11.5px] mb-1.5" style={{ color: 'var(--ink-4)' }}>
                  These didn&rsquo;t make the cut. Develop one to turn it into a direction you can make ads from.
                </p>
                <ul className="grid gap-2">
                  {directions.data.concepts.map(c => {
                    const key = `c${c.index}`
                    return (
                      <li key={key} className="card-inset flex flex-wrap items-center gap-2 px-3 py-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold break-words" style={{ color: 'var(--ink)' }}>
                            {c.title?.trim() || `Idea ${c.index + 1}`}
                          </p>
                          {c.summary && (
                            <p className="text-[12px] break-words" style={{ color: 'var(--ink-3)' }}>{c.summary}</p>
                          )}
                        </div>
                        {c.expanded ? (
                          <span className="chip chip-good">Developed</span>
                        ) : (
                          <button type="button" className="btn btn-ghost" disabled={disabled}
                            onClick={async () => after(await run(`expand:${key}`, () => expandConcept(tenantId, researchId, c.index), 'Developing this idea into a direction.'))}>
                            {spin(`expand:${key}`, <Maximize2 size={13} />)} Develop
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </>
        )
      )}
      <OutcomeLine outcome={outcome} />
    </div>
  )
}
