'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'
import { uploadCreativeFile } from '@/lib/api'
import { ExistingCreativePicker, type PickedCreative } from './ExistingCreativePicker'

export interface CreativeSourceValue {
  assetType: 'image' | 'video'
  mediaUrl: string
  primaryText: string
  headline: string
  cta: string
}

const CTA_OPTIONS = ['Shop Now', 'Learn More', 'Sign Up', 'Book Now', 'Download', 'Subscribe', 'Contact Us']

const EMPTY: CreativeSourceValue = { assetType: 'image', mediaUrl: '', primaryText: '', headline: '', cta: 'Shop Now' }

/**
 * The "pick a creative for this new ad" building block shared by Add
 * Creative (existing ad set) and Add Ad Set (new ad set) — same two ways in
 * from either: pick from the Creatives library (Gallery), or upload fresh.
 * Picking pre-fills copy from the source variant; both stay fully editable
 * either way, since the operator may want to reuse an image with new copy.
 */
export function CreativeSourceFields({ tenantId, onChange }: { tenantId: string; onChange: (v: CreativeSourceValue) => void }) {
  const [sourceMode, setSourceMode] = useState<'gallery' | 'upload'>('gallery')
  const [value, setValue] = useState<CreativeSourceValue>(EMPTY)
  const [fileName, setFileName] = useState('')
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [pickedLabel, setPickedLabel] = useState('')

  useEffect(() => { onChange(value) }, [value, onChange])

  async function handleFile(f: File) {
    setFileName(f.name)
    setValue((v) => ({ ...v, mediaUrl: '' }))
    setPickedLabel('')
    setUploadState('uploading')
    try {
      const res = await uploadCreativeFile(tenantId, f)
      setValue((v) => ({ ...v, mediaUrl: res.url }))
      setUploadState('idle')
    } catch {
      setUploadState('error')
    }
  }

  function handlePick(asset: PickedCreative) {
    setFileName('')
    setUploadState('idle')
    setPickedLabel(asset.headline || 'Selected from Gallery')
    setValue((v) => ({
      assetType: asset.assetType,
      mediaUrl: asset.assetUrl,
      // Picking a fresh asset resets copy to its own — still fully editable below.
      primaryText: asset.primaryText || v.primaryText,
      headline: asset.headline || v.headline,
      cta: asset.cta || v.cta,
    }))
  }

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        {([{ v: 'gallery', l: 'Existing creatives' }, { v: 'upload', l: 'Upload new' }] as const).map(({ v, l }) => (
          <button
            key={v}
            type="button"
            onClick={() => { setSourceMode(v); setValue((s) => ({ ...s, mediaUrl: '' })); setPickedLabel(''); setFileName(''); setUploadState('idle') }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={sourceMode === v ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }}
          >
            {l}
          </button>
        ))}
      </div>
      {sourceMode === 'gallery' ? (
        <div>
          <ExistingCreativePicker tenantId={tenantId} onPick={handlePick} />
          {pickedLabel && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--good)' }}>
              <CheckCircle size={10} className="inline mr-1" />Selected: {pickedLabel} ({value.assetType})
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            {(['image', 'video'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setValue((v) => ({ ...v, assetType: t, mediaUrl: '' })); setFileName(''); setUploadState('idle') }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={value.assetType === t ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }}
              >
                {t === 'image' ? 'Image' : 'Video'}
              </button>
            ))}
          </div>
          <div>
            <p className="micro-label mb-1">{value.assetType === 'image' ? 'Image file' : 'Video file'}</p>
            <input
              type="file"
              accept={value.assetType === 'image' ? 'image/*' : 'video/*'}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              className="text-xs w-full"
            />
            {uploadState === 'uploading' && <p className="text-[11px] mt-1" style={{ color: 'var(--ink-3)' }}><Loader2 size={10} className="inline animate-spin mr-1" />Uploading {fileName}…</p>}
            {uploadState === 'error' && <p className="text-[11px] mt-1" style={{ color: 'var(--bad)' }}>Upload failed — try again</p>}
            {value.mediaUrl && uploadState === 'idle' && <p className="text-[11px] mt-1" style={{ color: 'var(--good)' }}><CheckCircle size={10} className="inline mr-1" />Uploaded</p>}
          </div>
        </>
      )}
      <div>
        <p className="micro-label mb-1">Primary text</p>
        <textarea value={value.primaryText} onChange={(e) => setValue((v) => ({ ...v, primaryText: e.target.value }))} rows={3} className="input text-sm w-full resize-none" placeholder="The main ad copy…" />
      </div>
      <div>
        <p className="micro-label mb-1">Headline</p>
        <input value={value.headline} onChange={(e) => setValue((v) => ({ ...v, headline: e.target.value }))} className="input text-sm w-full" placeholder="Short hook line" />
      </div>
      <div>
        <p className="micro-label mb-1">Button label</p>
        <select value={value.cta} onChange={(e) => setValue((v) => ({ ...v, cta: e.target.value }))} className="input text-sm w-full">
          {CTA_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}
