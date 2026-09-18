'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as Tabs from '@radix-ui/react-tabs'
import { ArrowLeft, Loader2, Plus, Image as ImageIcon, Video as VideoIcon, LayoutGrid, Check, Trash2, XCircle, Pencil, X, Expand } from 'lucide-react'
import {
  listGalleryTopics, listGallerySheets, createGallerySheet, listGalleryAssets,
  listAllGallerySheets, moveGalleryAssets, removeGalleryAssets, rejectGalleryAssets,
  deleteGallerySheet, deleteGalleryTopic, renameGalleryTopic, renameGallerySheet,
  getCreativePackage, getCompany,
} from '@/lib/api'
import type { GalleryTopicSummary, GallerySheetSummary, GalleryAssetItem, GallerySheetWithTopic } from '@/lib/api'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CreativePreviewModal } from '@/components/ui/CreativePreviewModal'
import { AddCreativeSheet } from '@/components/creative/AddCreativeSheet'

interface PageProps {
  params: Promise<{ tenantId: string; topicId: string }>
}

type PendingConfirm =
  | { type: 'remove' }
  | { type: 'reject' }
  | { type: 'deleteSheet'; sheetId: string; sheetName: string }
  | { type: 'deleteTopic' }
  | null

export default function GalleryTopicDetailPage({ params }: PageProps) {
  const { tenantId, topicId } = use(params)
  const router = useRouter()

  const [topic, setTopic] = useState<GalleryTopicSummary | null>(null)
  const [sheets, setSheets] = useState<GallerySheetSummary[]>([])
  const [activeSheetId, setActiveSheetId] = useState('')
  const [assets, setAssets] = useState<GalleryAssetItem[]>([])
  const [allSheets, setAllSheets] = useState<GallerySheetWithTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [showNewSheet, setShowNewSheet] = useState(false)
  const [newSheetName, setNewSheetName] = useState('')
  const [creatingSheet, setCreatingSheet] = useState(false)
  const [error, setError] = useState('')

  // Choose-and-act: select any number of asset cards, then move / remove from
  // gallery / reject them together. Selection is scoped to whichever sheet is
  // currently open — switching sheets clears it, so it never silently carries
  // stale IDs from a sheet you've navigated away from.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkTarget, setBulkTarget] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null)
  const [confirming, setConfirming] = useState(false)

  // Inline rename — topic title and per-sheet name, same edit-in-place pattern as the gallery topics list page.
  const [renamingTopic, setRenamingTopic] = useState(false)
  const [topicNameDraft, setTopicNameDraft] = useState('')
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null)
  const [sheetNameDraft, setSheetNameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)

  // Quick-look preview — separate from the select-for-bulk-actions click on
  // the same card, triggered by a small expand icon instead. Fetches the
  // source package on open to show real headline/copy (GalleryAssetItem
  // itself carries no copy text, only the resolved media URL).
  const [previewAsset, setPreviewAsset] = useState<GalleryAssetItem | null>(null)
  const [previewCopy, setPreviewCopy] = useState<{ headline?: string; primaryText?: string; cta?: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Add creative bottom sheet — pick from everything already in the
  // Creatives library, or upload a brand new one. Files directly into
  // whichever sheet this was opened from, skipping the "lands in Unsorted,
  // then move" hop.
  const [products, setProducts] = useState<{ name: string }[]>([])
  const [addSheetOpenFor, setAddSheetOpenFor] = useState<GallerySheetSummary | null>(null)

  async function openPreview(asset: GalleryAssetItem) {
    setPreviewAsset(asset)
    setPreviewCopy(null)
    setPreviewLoading(true)
    try {
      const pkg = await getCreativePackage(tenantId, asset.sourcePackageId)
      const variant = pkg.copyVariants?.[asset.variantIndex] ?? pkg.copyVariants?.[pkg.selectedCopyIndex ?? 0]
      setPreviewCopy(variant ? { headline: variant.headline, primaryText: variant.primaryText, cta: variant.cta } : null)
    } catch {
      setPreviewCopy(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const loadSheets = useCallback(async () => {
    const [topics, sheetList, allSheetList] = await Promise.all([
      listGalleryTopics(tenantId),
      listGallerySheets(tenantId, topicId),
      listAllGallerySheets(tenantId),
    ])
    setTopic(topics.find(t => t._id === topicId) ?? null)
    setSheets(sheetList)
    setAllSheets(allSheetList)
    setActiveSheetId(prev => (prev && sheetList.some(s => s._id === prev)) ? prev : (sheetList[0]?._id ?? ''))
  }, [tenantId, topicId])

  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
      try {
        await loadSheets()
        const company = await getCompany(tenantId).catch(() => null)
        if (!cancelled && company) setProducts(company.products ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load topic')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [loadSheets, tenantId])

  const loadAssets = useCallback(async (sheetId: string) => {
    if (!sheetId) { setAssets([]); return }
    setAssetsLoading(true)
    try {
      const list = await listGalleryAssets(tenantId, sheetId)
      setAssets(list)
    } catch {
      setError('Failed to load assets')
    } finally {
      setAssetsLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    setSelected(new Set())
    setBulkTarget('')
    loadAssets(activeSheetId)
  }, [activeSheetId, loadAssets])

  async function handleCreateSheet() {
    const name = newSheetName.trim()
    if (!name) return
    setCreatingSheet(true)
    try {
      const sheet = await createGallerySheet(tenantId, topicId, name)
      setNewSheetName('')
      setShowNewSheet(false)
      await loadSheets()
      setActiveSheetId(sheet._id)
    } catch {
      setError('Failed to create sheet')
    } finally {
      setCreatingSheet(false)
    }
  }

  function toggleSelect(assetId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(assetId)) next.delete(assetId)
      else next.add(assetId)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(assets.map(a => a._id)))
  }

  function clearSelection() {
    setSelected(new Set())
    setBulkTarget('')
  }

  async function handleBulkMove() {
    if (selected.size === 0 || !bulkTarget) return
    setBulkBusy(true)
    try {
      await moveGalleryAssets(tenantId, [...selected], bulkTarget)
      clearSelection()
      await Promise.all([loadAssets(activeSheetId), loadSheets()])
    } catch {
      setError('Failed to move assets')
    } finally {
      setBulkBusy(false)
    }
  }

  function startRenameTopic() {
    setTopicNameDraft(topic?.name ?? '')
    setRenamingTopic(true)
  }

  async function handleRenameTopic() {
    const name = topicNameDraft.trim()
    if (!name) return
    setRenaming(true)
    try {
      await renameGalleryTopic(tenantId, topicId, name)
      setRenamingTopic(false)
      await loadSheets()
    } catch {
      setError('Failed to rename topic')
    } finally {
      setRenaming(false)
    }
  }

  function startRenameSheet(sheet: GallerySheetSummary) {
    setRenamingSheetId(sheet._id)
    setSheetNameDraft(sheet.name)
  }

  async function handleRenameSheet(sheetId: string) {
    const name = sheetNameDraft.trim()
    if (!name) return
    setRenaming(true)
    try {
      await renameGallerySheet(tenantId, sheetId, name)
      setRenamingSheetId(null)
      await loadSheets()
    } catch {
      setError('Failed to rename sheet')
    } finally {
      setRenaming(false)
    }
  }

  async function handleConfirmedAction() {
    if (!pendingConfirm) return
    setConfirming(true)
    try {
      if (pendingConfirm.type === 'remove') {
        await removeGalleryAssets(tenantId, [...selected])
        clearSelection()
        await Promise.all([loadAssets(activeSheetId), loadSheets()])
      } else if (pendingConfirm.type === 'reject') {
        await rejectGalleryAssets(tenantId, [...selected])
        clearSelection()
        await Promise.all([loadAssets(activeSheetId), loadSheets()])
      } else if (pendingConfirm.type === 'deleteSheet') {
        await deleteGallerySheet(tenantId, pendingConfirm.sheetId)
        await loadSheets()
      } else if (pendingConfirm.type === 'deleteTopic') {
        await deleteGalleryTopic(tenantId, topicId)
        router.push(`/dashboard/${tenantId}/gallery`)
        return
      }
      setPendingConfirm(null)
    } catch {
      setError('Action failed')
      setPendingConfirm(null)
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  // Current topic's own sheets sorted first, so the natural "move within this topic" choice is at the top.
  const orderedMoveDestinations = [...allSheets].sort((a, b) => {
    const aHere = a.topicId === topicId ? 0 : 1
    const bHere = b.topicId === topicId ? 0 : 1
    return aHere - bHere
  })

  const confirmCopy: Record<string, { title: string; description: string; confirmLabel: string; variant: 'default' | 'danger' }> = {
    remove: {
      title: `Remove ${selected.size} asset${selected.size === 1 ? '' : 's'} from gallery?`,
      description: 'This only removes them from this Gallery organization — the underlying creative (copy, image/video) stays fully intact in the Creatives library.',
      confirmLabel: 'Remove',
      variant: 'default',
    },
    reject: {
      title: `Reject ${selected.size} asset${selected.size === 1 ? '' : 's'}?`,
      description: 'Hides them from this sheet until restored — nothing is deleted. Restore any of them later from the Rejected tab on the Creatives page.',
      confirmLabel: 'Reject',
      variant: 'danger',
    },
    deleteSheet: {
      title: `Delete sheet "${pendingConfirm?.type === 'deleteSheet' ? pendingConfirm.sheetName : ''}"?`,
      description: 'Removes this sheet and its asset pointers from the gallery. The underlying creatives are never touched.',
      confirmLabel: 'Delete sheet',
      variant: 'danger',
    },
    deleteTopic: {
      title: `Delete topic "${topic?.name ?? ''}"?`,
      description: 'Removes this topic, all its sheets, and their asset pointers from the gallery. The underlying creatives are never touched — only how they were organized.',
      confirmLabel: 'Delete topic',
      variant: 'danger',
    },
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto stagger">
      <Link href={`/dashboard/${tenantId}/gallery`} className="flex items-center gap-1.5 text-[13px] font-medium mb-4" style={{ color: 'var(--ink-3)' }}>
        <ArrowLeft size={14} /> Asset gallery
      </Link>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="micro-label mb-2">Reusable creative collection</p>
          {renamingTopic ? (
            <div className="flex items-center gap-2">
              <input
                value={topicNameDraft}
                onChange={e => setTopicNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRenameTopic() }}
                className="input"
                style={{ fontSize: '20px', fontWeight: 600, maxWidth: 400 }}
                disabled={renaming}
                autoFocus
              />
              <button onClick={handleRenameTopic} disabled={renaming || !topicNameDraft.trim()} className="p-1.5 rounded-md" style={{ color: 'var(--good)' }}>
                {renaming ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button onClick={() => setRenamingTopic(false)} disabled={renaming} className="p-1.5 rounded-md" style={{ color: 'var(--ink-3)' }}>
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h1 className="page-title">{topic?.name ?? 'Untitled topic'}</h1>
                <button onClick={startRenameTopic} className="p-1.5 rounded-md" style={{ color: 'var(--ink-3)' }} aria-label="Rename topic">
                  <Pencil size={14} />
                </button>
              </div>
              <p className="page-subtitle">Organize approved messages and media into campaign-ready sheets.</p>
            </>
          )}
        </div>
        <button onClick={() => setPendingConfirm({ type: 'deleteTopic' })} className="btn btn-ghost" style={{ fontSize: '12px', color: 'var(--bad)' }}>
          <Trash2 size={12} /> Delete topic
        </button>
      </div>

      {error && <p className="text-[13px] mb-4" style={{ color: 'var(--bad)' }}>{error}</p>}

      <Tabs.Root value={activeSheetId} onValueChange={setActiveSheetId}>
        <Tabs.List className="flex gap-1 mb-6 flex-wrap items-center" style={{ borderBottom: '2px solid var(--border)' }}>
          {sheets.map(sheet => (
            <Tabs.Trigger
              key={sheet._id}
              value={sheet._id}
              className="flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-all -mb-0.5"
              style={activeSheetId === sheet._id
                ? { color: 'var(--accent-strong)', borderBottom: '2px solid var(--accent-strong)' }
                : { color: 'var(--ink-3)', borderBottom: '2px solid transparent' }}
            >
              {sheet.name}
              <span className="text-[10px] font-bold ml-0.5 px-1.5 py-0.5 rounded-md" style={{ background: 'var(--surface-warm)', color: 'var(--ink-3)' }}>
                {sheet.assetCount}
              </span>
              {/* Rejected/orphaned pointers never render in the grid, so
                  without this the sheet silently just looks short by N. */}
              {!!sheet.hiddenCount && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: 'var(--surface-warm)', color: 'var(--ink-4)' }}
                  title={`${sheet.hiddenCount} hidden — rejected, or the source creative was deleted. Rejection is reversible from the creative's package page.`}
                >
                  +{sheet.hiddenCount}
                </span>
              )}
            </Tabs.Trigger>
          ))}
          {showNewSheet ? (
            <div className="flex items-center gap-1.5 px-2">
              <input
                value={newSheetName}
                onChange={e => setNewSheetName(e.target.value)}
                placeholder="Sheet name"
                className="input"
                style={{ fontSize: '12px', width: 140 }}
                disabled={creatingSheet}
                autoFocus
              />
              <button onClick={handleCreateSheet} disabled={creatingSheet || !newSheetName.trim()} className="btn btn-ghost" style={{ fontSize: '12px' }}>
                {creatingSheet ? <Loader2 size={12} className="animate-spin" /> : 'Add'}
              </button>
            </div>
          ) : (
            <button onClick={() => setShowNewSheet(true)} className="flex items-center gap-1 px-3 py-3 text-sm font-semibold" style={{ color: 'var(--ink-3)' }}>
              <Plus size={14} /> Sheet
            </button>
          )}
        </Tabs.List>

        {sheets.map(sheet => (
          <Tabs.Content key={sheet._id} value={sheet._id}>
            <div className="flex justify-end items-center gap-2 mb-3">
              {renamingSheetId === sheet._id ? (
                <>
                  <input
                    value={sheetNameDraft}
                    onChange={e => setSheetNameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameSheet(sheet._id) }}
                    className="input"
                    style={{ fontSize: '12px', width: 160 }}
                    disabled={renaming}
                    autoFocus
                  />
                  <button onClick={() => handleRenameSheet(sheet._id)} disabled={renaming || !sheetNameDraft.trim()} className="p-1.5 rounded-md" style={{ color: 'var(--good)' }}>
                    {renaming ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  </button>
                  <button onClick={() => setRenamingSheetId(null)} disabled={renaming} className="p-1.5 rounded-md" style={{ color: 'var(--ink-3)' }}>
                    <X size={13} />
                  </button>
                </>
              ) : (
                <button onClick={() => startRenameSheet(sheet)} className="btn btn-ghost" style={{ fontSize: '11px' }}>
                  <Pencil size={11} /> Rename this sheet
                </button>
              )}
              <button
                onClick={() => setPendingConfirm({ type: 'deleteSheet', sheetId: sheet._id, sheetName: sheet.name })}
                className="btn btn-ghost"
                style={{ fontSize: '11px', color: 'var(--bad)' }}
              >
                <Trash2 size={11} /> Delete this sheet
              </button>
              <button
                onClick={() => setAddSheetOpenFor(sheet)}
                className="btn btn-primary"
                style={{ fontSize: '11px' }}
              >
                <Plus size={11} /> Add creative
              </button>
            </div>

            {assetsLoading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
              </div>
            ) : assets.length === 0 ? (
              <div className="card px-6 py-14 text-center">
                <LayoutGrid size={22} className="mx-auto mb-2" style={{ color: 'var(--ink-4)' }} />
                <p style={{ color: 'var(--ink-3)' }}>No assets in this sheet yet.</p>
              </div>
            ) : (
              <>
                {/* ── Choose-and-act bar ── */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <button onClick={selectAll} className="btn btn-ghost" style={{ fontSize: '12px' }}>
                    Select all ({assets.length})
                  </button>
                  {selected.size > 0 && (
                    <>
                      <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                        {selected.size} selected
                      </span>
                      <select
                        value={bulkTarget}
                        onChange={e => setBulkTarget(e.target.value)}
                        className="input"
                        style={{ fontSize: '12px', maxWidth: 220 }}
                        disabled={bulkBusy}
                      >
                        <option value="">Move to…</option>
                        {orderedMoveDestinations
                          .filter(d => d.sheetId !== sheet._id)
                          .map(d => (
                            <option key={d.sheetId} value={d.sheetId}>
                              {d.topicId === topicId ? d.sheetName : `${d.topicName} / ${d.sheetName}`}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={handleBulkMove}
                        disabled={bulkBusy || !bulkTarget}
                        className="btn btn-primary"
                        style={{ fontSize: '12px' }}
                      >
                        {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : null}
                        Move {selected.size}
                      </button>
                      <button
                        onClick={() => setPendingConfirm({ type: 'remove' })}
                        disabled={bulkBusy}
                        className="btn btn-ghost"
                        style={{ fontSize: '12px' }}
                      >
                        Remove from gallery
                      </button>
                      <button
                        onClick={() => setPendingConfirm({ type: 'reject' })}
                        disabled={bulkBusy}
                        className="btn btn-ghost"
                        style={{ fontSize: '12px', color: 'var(--bad)' }}
                      >
                        <XCircle size={12} /> Reject
                      </button>
                      <button onClick={clearSelection} disabled={bulkBusy} className="btn btn-ghost" style={{ fontSize: '12px' }}>
                        Clear
                      </button>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {assets.map(asset => {
                    const isSelected = selected.has(asset._id)
                    return (
                      <div
                        key={asset._id}
                        className="card overflow-hidden"
                        style={isSelected ? { border: '2px solid var(--accent-strong)' } : undefined}
                      >
                        <div className="relative w-full" style={{ aspectRatio: '4/5', background: 'var(--surface-warm)' }}>
                          {asset.assetType === 'video' ? (
                            <video src={asset.assetUrl} className="w-full h-full object-cover" muted />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={asset.assetUrl} alt="Creative asset" className="w-full h-full object-cover" />
                          )}
                          <button onClick={() => toggleSelect(asset._id)} className="absolute inset-0" aria-label="Select" />
                          <span
                            className="flex items-center justify-center rounded-md pointer-events-none"
                            style={{
                              position: 'absolute', top: 8, left: 8, width: 22, height: 22,
                              background: isSelected ? 'var(--accent-strong)' : 'rgba(255,255,255,0.85)',
                              border: isSelected ? 'none' : '1px solid var(--border)',
                            }}
                          >
                            {isSelected && <Check size={14} color="#fff" />}
                          </span>
                          <span className="chip chip-neutral pointer-events-none" style={{ position: 'absolute', top: 8, right: 8 }}>
                            {asset.assetType === 'video' ? <VideoIcon size={11} /> : <ImageIcon size={11} />}
                          </span>
                          <button
                            onClick={() => openPreview(asset)}
                            className="flex items-center justify-center rounded-md"
                            style={{ position: 'absolute', bottom: 8, right: 8, width: 26, height: 26, background: 'rgba(255,255,255,0.9)', border: '1px solid var(--border)' }}
                            aria-label="Preview"
                          >
                            <Expand size={13} style={{ color: 'var(--ink-2)' }} />
                          </button>
                        </div>
                        <div className="p-3">
                          <Link
                            href={`/dashboard/${tenantId}/creatives/${asset.sourcePackageId}`}
                            className="text-[11.5px] font-medium block"
                            style={{ color: 'var(--accent-strong)' }}
                          >
                            View source package →
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Tabs.Content>
        ))}
      </Tabs.Root>

      <ConfirmModal
        open={pendingConfirm !== null}
        title={pendingConfirm ? confirmCopy[pendingConfirm.type].title : ''}
        description={pendingConfirm ? confirmCopy[pendingConfirm.type].description : undefined}
        confirmLabel={pendingConfirm ? confirmCopy[pendingConfirm.type].confirmLabel : undefined}
        variant={pendingConfirm ? confirmCopy[pendingConfirm.type].variant : 'default'}
        loading={confirming}
        onConfirm={handleConfirmedAction}
        onCancel={() => setPendingConfirm(null)}
      />

      <CreativePreviewModal
        open={previewAsset !== null}
        onClose={() => setPreviewAsset(null)}
        mediaUrl={previewAsset?.assetUrl ?? ''}
        mediaType={previewAsset?.assetType === 'video' ? 'video' : 'image'}
        headline={previewCopy?.headline}
        primaryText={previewCopy?.primaryText}
        cta={previewCopy?.cta}
        meta={previewAsset ? `${previewAsset.assetType === 'video' ? 'Video' : 'Image'} · variant ${previewAsset.variantIndex + 1}` : undefined}
        tenantId={tenantId}
        packageId={previewAsset?.sourcePackageId}
        loading={previewLoading}
      />

      <AddCreativeSheet
        open={addSheetOpenFor !== null}
        onClose={() => setAddSheetOpenFor(null)}
        tenantId={tenantId}
        products={products}
        targetSheetId={addSheetOpenFor?._id ?? ''}
        targetSheetName={addSheetOpenFor?.name ?? ''}
        targetTopicName={topic?.name}
        onAdded={() => { loadAssets(activeSheetId); loadSheets() }}
      />
    </div>
  )
}
