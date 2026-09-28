'use client'

import { useRef, useState } from 'react'
import { Ban, CheckCircle2, Eye, ImagePlus, Loader2, Play, RotateCcw, ShieldAlert } from 'lucide-react'
import { uploadCustomBriefImages } from '@/lib/api'
import {
  approveRunStage,
  cancelRun,
  retryRun,
  runAnyway,
  setRunBadge,
  setRunLogo,
  setRunModel,
} from '@/lib/creative-parity-api'
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

export function RunActions({
  tenantId,
  runId,
  status,
  models,
  label,
  gates = true,
  onChanged,
}: {
  tenantId: string
  runId: number
  status: string
  /** `models` from the pipeline's options — what the final image can be made with. */
  models?: { model: string; quality: string }[]
  /** "Ad 2" on a batch tile; omitted on a single run. */
  label?: string
  /** False for a batch parent: it sits at `brief_ready` for good, so its gate buttons would lie. */
  gates?: boolean
  onChanged?: () => void
}) {
  const { busy, outcome, run } = useParityAction()
  const [model, setModel] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
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
        const ref = refs[0] as { filename: string; upload_id?: string } | undefined
        if (!ref) throw new Error('No upload came back')
        return setRunBadge(tenantId, runId, ref.upload_id ?? ref.filename)
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
            {models && models.length > 0 && (
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
                    if (next) void act('model', () => setRunModel(tenantId, runId, next), 'Model changed.')
                  }}
                >
                  <option value="">Let it choose</option>
                  {models.map(m => (
                    <option key={`${m.model}:${m.quality}`} value={m.model}>
                      {m.model}{m.quality ? ` (${m.quality})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" className="btn btn-primary" disabled={disabled}
              onClick={() => void act('approve', () => approveRunStage(tenantId, runId, 'full'), 'Approved — making the final image.')}>
              {spin('approve') ?? <CheckCircle2 size={13} />} Approve and make it
            </button>
          </div>
        </div>
      )}

      {gates && LOGO_CHOICE.has(status) && (
        <div className="mb-2">
          <p className="text-[12px] mb-1.5" style={{ color: 'var(--ink-2)' }}>Should the ad carry the logo?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" disabled={disabled}
              onClick={() => void act('logo-on', () => setRunLogo(tenantId, runId, true), 'The logo will be included.')}>
              {spin('logo-on')} Include the logo
            </button>
            <button type="button" className="btn btn-ghost" disabled={disabled}
              onClick={() => void act('logo-off', () => setRunLogo(tenantId, runId, false), 'The logo will be left off.')}>
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
            onClick={() => void act('retry', () => retryRun(tenantId, runId), 'Trying again.')}>
            {spin('retry') ?? <RotateCcw size={13} />} Try again
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
