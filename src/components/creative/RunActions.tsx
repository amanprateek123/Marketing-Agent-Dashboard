'use client'

import { useRef, useState } from 'react'
import { Ban, CheckCircle2, Eye, ImagePlus, Loader2, Play, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react'
import { uploadCustomBriefImages } from '@/lib/api'
import {
  approveRunStage,
  discardIdea,
  OVERRIDE_MODELS,
  setRunDisclaimer,
  setRunImageKind,
  setRunLanguage,
  setRunOffering,
  type ImageKind,
  cancelRun,
  retryRun,
  runAnyway,
  setRunBadge,
  setRunLogo,
  setRunModel,
} from '@/lib/creative-parity-api'
import type { CustomBriefOptions } from '@/types'
import { OutcomeLine, useParityAction } from './parity-shared'

/**
 * The buttons Slack used to put under a run, now on the run itself.
 *
 * Which ones show follows the run's status, mirroring where the Slack handlers accept them:
 * `brief_ready` is the brief check (preview the layout first, or make it in full), `layout_ready`
 * is the go-ahead to make the final image (and the only point a model can be chosen),
 * `validation_failed` can be overridden, `error`/`cancelled` can be retried, and anything still
 * moving can be cancelled.
 */

const TERMINAL = new Set(['done', 'error', 'cancelled'])
const LOGO_CHOICE = new Set(['awaiting_logo_choice', 'awaiting_automotive_gates'])

const IMAGE_KINDS: { kind: ImageKind; label: string; hint: string }[] = [
  { kind: 'overlay', label: 'Words over a picture', hint: 'A picture with the message written on it.' },
  { kind: 'product', label: 'Product photo', hint: 'The product itself is the picture.' },
  { kind: 'imitate', label: 'Copy the look', hint: 'Match the style of your reference image.' },
  { kind: 'imitate_text', label: 'Copy the look, with my words', hint: 'Match the style, using the words below.' },
]

/** Used when the pipeline's options have not loaded; creativebot refuses anything else with the list. */
const ASTRO_SMALL_PRINT = [
  { value: 'none', label: 'No small print' },
  { value: 'guidance', label: '“For guidance only”' },
  { value: 'tnc', label: '“T&C apply”' },
  { value: 'guidance_tnc', label: '“For guidance only. T&C apply”' },
  { value: 'results_vary', label: '“Results may vary”' },
]

export function RunActions({
  tenantId,
  runId,
  status,
  options,
  label,
  gates = true,
  onChanged,
}: {
  tenantId: string
  runId: number
  status: string
  /** The pipeline's options — languages, products and small-print wording for the questions a run asks. */
  options?: CustomBriefOptions | null
  /** "Ad 2" on a batch tile; omitted on a single run. */
  label?: string
  /** False for a batch parent: it sits at `brief_ready` for good, so its gate buttons would lie. */
  gates?: boolean
  onChanged?: () => void
}) {
  const { busy, outcome, run } = useParityAction()
  const [model, setModel] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [reason, setReason] = useState('')
  const [disclaimer, setDisclaimer] = useState('')
  const [langs, setLangs] = useState<string[]>([])
  const [langText, setLangText] = useState('')
  const [kindText, setKindText] = useState('')
  const [offering, setOffering] = useState('')
  const [astroNote, setAstroNote] = useState('')
  const badgeInput = useRef<HTMLInputElement | null>(null)

  const act = async <T,>(key: string, fn: () => Promise<T>, ok: string) => {
    const res = await run(key, fn, ok)
    if (res !== undefined) onChanged?.()
  }

  const onBadge = async (file: File | undefined) => {
    if (!file) return
    await act(
      'badge',
      async () => {
        const { refs } = await uploadCustomBriefImages(tenantId, [file])
        const uploadId = refs[0]?.upload_id
        if (!uploadId) throw new Error('The upload did not come back with a reference')
        return setRunBadge(tenantId, runId, uploadId)
      },
      'Badge image added — it will continue from here.',
    )
    if (badgeInput.current) badgeInput.current.value = ''
  }

  const terminal = TERMINAL.has(status)
  const spin = (key: string) => (busy === key ? <Loader2 size={13} className="animate-spin" /> : null)
  const disabled = busy !== null

  return (
    <div className="mt-3 min-w-0" aria-label={label ? `${label} actions` : 'Run actions'}>
      {gates && status === 'brief_ready' && (
        <div className="mb-2">
          <p className="text-[12px] mb-1.5" style={{ color: 'var(--ink-2)' }}>
            The brief is written. Look at the layout first, or go straight to the finished ad?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" disabled={disabled}
              onClick={() => void act('preview', () => approveRunStage(tenantId, runId, 'preview'), 'Making a layout preview.')}>
              {spin('preview') ?? <Eye size={13} />} Preview the layout
            </button>
            <button type="button" className="btn btn-primary" disabled={disabled}
              onClick={() => void act('full', () => approveRunStage(tenantId, runId, 'full'), 'Making the finished ad.')}>
              {spin('full') ?? <Play size={13} />} Make it in full
            </button>
          </div>
        </div>
      )}

      {gates && status === 'layout_ready' && (
        <div className="mb-2">
          <p className="text-[12px] mb-1.5" style={{ color: 'var(--ink-2)' }}>
            The layout is ready. Happy with it? Approve to make the final image.
          </p>
          <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-w-0 items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                Image model
                <select
                  className="input"
                  style={{ width: 'auto', minWidth: 0 }}
                  value={model}
                  disabled={disabled}
                  onChange={e => {
                    const next = e.target.value
                    setModel(next)
                    const choice = OVERRIDE_MODELS.find(m => `${m.model}|${m.quality}` === next)
                    if (choice) {
                      void act('model', () => setRunModel(tenantId, runId, choice.model, choice.quality), `Will be made with ${choice.label}.`)
                    }
                  }}
                >
                  <option value="">Keep its choice</option>
                  {OVERRIDE_MODELS.map(m => (
                    <option key={`${m.model}|${m.quality}`} value={`${m.model}|${m.quality}`}>{m.label}</option>
                  ))}
                </select>
              </label>
            <button type="button" className="btn btn-primary" disabled={disabled}
              onClick={() => void act('approve', () => approveRunStage(tenantId, runId, 'full'), 'Approved — making the final image.')}>
              {spin('approve') ?? <CheckCircle2 size={13} />} Approve and make it
            </button>
            {!dropping && (
              <button type="button" className="btn btn-ghost" disabled={disabled} onClick={() => { setDropping(true); setReason('') }}>
                <Trash2 size={13} /> Drop this idea
              </button>
            )}
          </div>
          {dropping && (
            <div className="mt-2 flex flex-wrap items-center gap-2 min-w-0">
              <input className="input min-w-0 flex-1" value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Why drop it? It won't be suggested again" aria-label="Why drop this idea" />
              <button type="button" className="btn btn-danger" disabled={disabled}
                onClick={() => { setDropping(false); void act('discard', () => discardIdea(tenantId, runId, reason.trim()), 'Idea dropped — it will not be suggested again.') }}>
                {spin('discard')} Drop it
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setDropping(false)}>Keep it</button>
            </div>
          )}
        </div>
      )}

      {gates && status === 'awaiting_language' && (
        <div className="mb-2">
          <p className="text-[12px] mb-1.5" style={{ color: 'var(--ink-2)' }}>
            Which language should the ad be in? Pick more than one to get one ad per language.
          </p>
          {(options?.languages ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(options?.languages ?? []).map(l => {
                const on = langs.includes(l)
                return (
                  <button key={l} type="button" aria-pressed={on} className={`chip ${on ? 'chip-accent' : ''}`}
                    onClick={() => setLangs(v => (on ? v.filter(x => x !== l) : [...v, l]))}>
                    {l}
                  </button>
                )
              })}
            </div>
          ) : (
            <input className="input mb-2" value={langText} onChange={e => setLangText(e.target.value)}
              placeholder="e.g. Hindi, English" aria-label="Languages" />
          )}
          {(() => {
            const chosen = langs.length ? langs : langText.split(',').map(l => l.trim()).filter(Boolean)
            return (
              <button type="button" className="btn btn-primary" disabled={disabled || chosen.length === 0}
                onClick={() => void act('language', () => setRunLanguage(tenantId, runId, chosen), 'Language set — carrying on.')}>
                {spin('language')} Continue{chosen.length > 1 ? ` in ${chosen.length} languages` : ''}
              </button>
            )
          })()}
        </div>
      )}

      {gates && status === 'awaiting_image_kind' && (
        <div className="mb-2">
          <p className="text-[12px] mb-1.5" style={{ color: 'var(--ink-2)' }}>What kind of picture should it use?</p>
          <input className="input mb-2" value={kindText} onChange={e => setKindText(e.target.value)}
            placeholder="Words to use (optional)" aria-label="Words to use" />
          <div className="grid gap-2 sm:grid-cols-2">
            {IMAGE_KINDS.map(k => (
              <button key={k.kind} type="button" className="btn btn-ghost justify-start text-left" disabled={disabled}
                title={k.hint}
                onClick={() => void act(`kind:${k.kind}`, () => setRunImageKind(tenantId, runId, k.kind, kindText.trim() || undefined), `${k.label} — carrying on.`)}>
                {spin(`kind:${k.kind}`)} {k.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {gates && status === 'awaiting_offering' && (
        <div className="mb-2">
          <p className="text-[12px] mb-1.5" style={{ color: 'var(--ink-2)' }}>
            Which product is this ad for, and what small print should it carry?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input" style={{ width: 'auto', minWidth: 0 }} value={offering} disabled={disabled}
              onChange={e => setOffering(e.target.value)} aria-label="Product">
              <option value="">Which product?</option>
              {(options?.offerings ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="input" style={{ width: 'auto', minWidth: 0 }} value={astroNote} disabled={disabled}
              onChange={e => setAstroNote(e.target.value)} aria-label="Small print">
              <option value="">Small print…</option>
              {(options?.disclaimers?.astro?.length ? options.disclaimers.astro : ASTRO_SMALL_PRINT).map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" disabled={disabled || (!offering && !astroNote)}
              onClick={() => void act('offering', async () => {
                // One gate on creativebot's side: it holds until both are answered and says which is missing.
                let last: unknown = null
                if (offering) last = await setRunOffering(tenantId, runId, offering)
                if (astroNote) last = await setRunDisclaimer(tenantId, runId, astroNote)
                return last
              }, 'Saved — carrying on.')}>
              {spin('offering')} Continue
            </button>
          </div>
        </div>
      )}

      {gates && LOGO_CHOICE.has(status) && (
        <div className="mb-2">
          <p className="text-[12px] mb-1.5" style={{ color: 'var(--ink-2)' }}>Should the ad carry the logo?</p>
          <div className="flex flex-wrap items-center gap-2">
            {status === 'awaiting_automotive_gates' && (
              <select className="input" style={{ width: 'auto', minWidth: 0 }} value={disclaimer} disabled={disabled}
                onChange={e => setDisclaimer(e.target.value)} aria-label="Small print">
                <option value="">No small print</option>
                <option value="tnc">&ldquo;T&amp;C apply&rdquo;</option>
                <option value="ex_showroom">&ldquo;Ex-showroom price&rdquo;</option>
              </select>
            )}
            <button type="button" className="btn btn-ghost" disabled={disabled}
              onClick={() => void act('logo-on', () => setRunLogo(tenantId, runId, true, disclaimer || undefined), 'The logo will be included.')}>
              {spin('logo-on')} Include the logo
            </button>
            <button type="button" className="btn btn-ghost" disabled={disabled}
              onClick={() => void act('logo-off', () => setRunLogo(tenantId, runId, false, disclaimer || undefined), 'The logo will be left off.')}>
              {spin('logo-off')} Leave it off
            </button>
          </div>
        </div>
      )}

      {gates && status === 'awaiting_badge_image' && (
        <div className="mb-2">
          <p className="text-[12px] mb-1.5" style={{ color: 'var(--ink-2)' }}>
            This ad needs a badge image. Upload one to continue.
          </p>
          <input
            ref={badgeInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => void onBadge(e.target.files?.[0])}
          />
          <button type="button" className="btn btn-ghost" disabled={disabled}
            onClick={() => badgeInput.current?.click()}>
            {spin('badge') ?? <ImagePlus size={13} />} Upload a badge image
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'validation_failed' && (
          <button type="button" className="btn btn-ghost" disabled={disabled}
            onClick={() => void act('anyway', () => runAnyway(tenantId, runId), 'Going ahead despite the quality check.')}>
            {spin('anyway') ?? <ShieldAlert size={13} />} Run it anyway
          </button>
        )}
        {(status === 'error' || status === 'cancelled') && (
          <button type="button" className="btn btn-ghost" disabled={disabled}
            onClick={() => void act('retry', () => retryRun(tenantId, runId, 'preview'), 'Trying again with a layout preview.')}>
            {spin('retry') ?? <RotateCcw size={13} />} Try again
          </button>
        )}
        {(status === 'error' || status === 'cancelled') && (
          <button type="button" className="btn btn-ghost" disabled={disabled}
            onClick={() => void act('retry-full', () => retryRun(tenantId, runId, 'full'), 'Trying the full ad again.')}>
            {spin('retry-full') ?? <Play size={13} />} Try again in full
          </button>
        )}
        {!terminal && !confirmCancel && (
          <button type="button" className="btn btn-ghost" disabled={disabled} onClick={() => setConfirmCancel(true)}>
            <Ban size={13} /> Cancel
          </button>
        )}
        {!terminal && confirmCancel && (
          <span className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: 'var(--ink-2)' }}>
            Stop this{label ? ` (${label})` : ''}?
            <button type="button" className="btn btn-danger" disabled={disabled}
              onClick={() => { setConfirmCancel(false); void act('cancel', () => cancelRun(tenantId, runId), 'Stopped.') }}>
              {spin('cancel')} Yes, stop it
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmCancel(false)}>Keep going</button>
          </span>
        )}
      </div>
      <OutcomeLine outcome={outcome} />
    </div>
  )
}
