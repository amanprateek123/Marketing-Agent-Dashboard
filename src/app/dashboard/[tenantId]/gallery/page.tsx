'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import {
  LayoutGrid,
  Loader2,
  Plus,
  Image as ImageIcon,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowRight,
  FolderOpen,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { listGalleryTopics, createGalleryTopic, renameGalleryTopic, deleteGalleryTopic } from '@/lib/api'
import type { GalleryTopicSummary } from '@/lib/api'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

export default function GalleryTopicsPage({ params }: PageProps) {
  const { tenantId } = use(params)

  const [topics, setTopics] = useState<GalleryTopicSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewTopic, setShowNewTopic] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Inline rename — click the pencil on a card, edit in place, Enter/check to save.
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<GalleryTopicSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await listGalleryTopics(tenantId)
      setTopics(list)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gallery')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function handleCreateTopic() {
    const name = newTopicName.trim()
    if (!name) return
    setCreating(true)
    try {
      await createGalleryTopic(tenantId, name)
      setError('')
      setNewTopicName('')
      setShowNewTopic(false)
      await load()
    } catch {
      setError('Failed to create topic')
    } finally {
      setCreating(false)
    }
  }

  function startRename(topic: GalleryTopicSummary, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setRenamingId(topic._id)
    setRenameDraft(topic.name)
  }

  async function handleRename(topicId: string) {
    const name = renameDraft.trim()
    if (!name) return
    setRenaming(true)
    try {
      await renameGalleryTopic(tenantId, topicId, name)
      setError('')
      setRenamingId(null)
      await load()
    } catch {
      setError('Failed to rename topic')
    } finally {
      setRenaming(false)
    }
  }

  async function handleDeleteTopic() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteGalleryTopic(tenantId, deleteTarget._id)
      setError('')
      setDeleteTarget(null)
      await load()
    } catch {
      setError('Failed to delete topic')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto" role="status" aria-label="Loading Gallery">
        <div className="skeleton h-9 w-56 mb-3" />
        <div className="skeleton h-5 w-full max-w-2xl mb-8" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-44" />)}
        </div>
        <span className="sr-only">Loading Gallery…</span>
      </div>
    )
  }

  const totalAssets = topics.reduce((sum, topic) => sum + topic.assetCount, 0)
  const totalSheets = topics.reduce((sum, topic) => sum + topic.sheetCount, 0)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto stagger">
      <div className="flex items-start justify-between gap-5 mb-6 flex-wrap">
        <div className="max-w-2xl">
          <p className="micro-label mb-2">Creative Studio · Gallery</p>
          <h1 className="page-title">Organize creative for reuse</h1>
          <p className="page-subtitle">Group generated and uploaded assets by product, idea or campaign so reusable work is ready for the next launch.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/dashboard/${tenantId}/creatives`} className="btn btn-ghost">
            <Sparkles size={14} /> Creative Studio
          </Link>
          <button type="button" onClick={() => setShowNewTopic(s => !s)} className="btn btn-primary" aria-expanded={showNewTopic}>
            <Plus size={14} /> New topic
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Topics', value: topics.length, icon: FolderOpen, color: 'var(--accent)', background: 'var(--accent-bg)' },
          { label: 'Sheets', value: totalSheets, icon: LayoutGrid, color: 'var(--info)', background: 'var(--info-bg)' },
          { label: 'Assets organized', value: totalAssets, icon: ImageIcon, color: 'var(--good)', background: 'var(--good-bg)' },
        ].map(({ label, value, icon: Icon, color, background }) => (
          <div key={label} className="card p-3.5 sm:p-4 flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center shrink-0" style={{ color, background }}><Icon size={16} /></div>
            <div className="min-w-0">
              <p className="micro-label truncate">{label}</p>
              <p className="display-num text-[21px] mt-1" style={{ color: 'var(--ink)' }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {showNewTopic && (
        <div className="card p-5 mb-6">
          <p className="micro-label mb-1">New collection</p>
          <h2 className="section-title mb-4">Create a topic</h2>
          <div className="flex items-end gap-2 flex-wrap">
            <label className="flex-1 min-w-[240px]">
              <span className="text-[12px] font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Topic name</span>
              <input
                value={newTopicName}
                onChange={e => setNewTopicName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleCreateTopic() }}
                placeholder="e.g. Awareness campaign · Nadi report"
                className="input"
                disabled={creating}
                autoFocus
              />
            </label>
            <button type="button" onClick={handleCreateTopic} disabled={creating || !newTopicName.trim()} className="btn btn-primary">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create topic
            </button>
            <button type="button" onClick={() => { setShowNewTopic(false); setNewTopicName('') }} disabled={creating} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 mb-5 flex items-center justify-between gap-3 text-[13px]" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => { setLoading(true); void load() }} className="btn btn-ghost shrink-0"><RefreshCw size={13} /> Retry</button>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-bg)', color: 'var(--accent-strong)' }}><LayoutGrid size={22} /></div>
          <h2 className="section-title">Build your first reusable collection</h2>
          <p className="text-[13px] mt-2 mx-auto max-w-md" style={{ color: 'var(--ink-3)' }}>Generated creative arrives here automatically, or you can create a topic now to organize work before production begins.</p>
          <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
            <button type="button" onClick={() => setShowNewTopic(true)} className="btn btn-primary"><Plus size={14} /> Create topic</button>
            <Link href={`/dashboard/${tenantId}/creatives`} className="btn btn-ghost"><Sparkles size={14} /> Generate creative</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {topics.map(topic => {
            const isRenaming = renamingId === topic._id
            return (
              <article key={topic._id} className="card p-4 min-h-44 flex flex-col">
                {isRenaming ? (
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg p-2 shrink-0" style={{ background: 'var(--accent-bg)' }}><LayoutGrid size={16} style={{ color: 'var(--accent-strong)' }} /></div>
                    <input
                      value={renameDraft}
                      onChange={e => setRenameDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void handleRename(topic._id)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      className="input flex-1"
                      disabled={renaming}
                      aria-label={`Rename ${topic.name}`}
                      autoFocus
                    />
                    <button type="button" onClick={() => void handleRename(topic._id)} disabled={renaming || !renameDraft.trim()} className="w-10 h-10 rounded-lg inline-flex items-center justify-center" style={{ color: 'var(--good)', background: 'var(--good-bg)' }} aria-label="Save topic name">
                      {renaming ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button type="button" onClick={() => setRenamingId(null)} disabled={renaming} className="w-10 h-10 rounded-lg inline-flex items-center justify-center" style={{ color: 'var(--ink-3)', background: 'var(--surface-warm)' }} aria-label="Cancel rename"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/dashboard/${tenantId}/gallery/${topic._id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                        <div className="rounded-xl p-2.5 shrink-0" style={{ background: 'var(--accent-bg)' }}><FolderOpen size={17} style={{ color: 'var(--accent-strong)' }} /></div>
                        <div className="min-w-0">
                          <h2 className="text-[14px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{topic.name}</h2>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>Creative topic</p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={e => startRename(topic, e)} className="w-10 h-10 rounded-lg inline-flex items-center justify-center hover:bg-[var(--surface-warm)]" style={{ color: 'var(--ink-3)' }} aria-label={`Rename ${topic.name}`}><Pencil size={14} /></button>
                        <button type="button" onClick={() => setDeleteTarget(topic)} className="w-10 h-10 rounded-lg inline-flex items-center justify-center hover:bg-[var(--bad-bg)]" style={{ color: 'var(--bad)' }} aria-label={`Delete ${topic.name}`}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <Link href={`/dashboard/${tenantId}/gallery/${topic._id}`} className="mt-auto pt-6 block group">
                      <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                        <span>{topic.sheetCount} sheet{topic.sheetCount === 1 ? '' : 's'}</span>
                        <span className="flex items-center gap-1"><ImageIcon size={12} /> {topic.assetCount} asset{topic.assetCount === 1 ? '' : 's'}</span>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 text-[12px] font-semibold" style={{ borderTop: '1px solid var(--hairline-light)', color: 'var(--accent-strong)' }}>
                        Open topic <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </>
                )}
              </article>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title={`Delete topic "${deleteTarget?.name ?? ''}"?`}
        description="Removes this topic, all its sheets, and their asset pointers from the gallery. The underlying creatives are never touched — only how they were organized."
        confirmLabel="Delete topic"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteTopic}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
