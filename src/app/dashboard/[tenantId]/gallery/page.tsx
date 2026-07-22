'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { LayoutGrid, Loader2, Plus, Image as ImageIcon, Pencil, Trash2, Check, X } from 'lucide-react'
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-[1600px] mx-auto stagger">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="micro-label mb-2">Gallery</p>
          <h1 className="page-title">Topics</h1>
          <p className="page-subtitle">
            Every topic you generate creatives under lands here automatically, in an "Unsorted" sheet — move individual images/videos into whichever sheet (segment, campaign, etc.) they actually belong in.
          </p>
        </div>
        <button onClick={() => setShowNewTopic(s => !s)} className="btn btn-primary">
          <Plus size={14} /> New topic
        </button>
      </div>

      {showNewTopic && (
        <div className="card p-4 mb-6 flex items-center gap-2">
          <input
            value={newTopicName}
            onChange={e => setNewTopicName(e.target.value)}
            placeholder="Topic name — e.g. 91Astrology Awareness Campaign"
            className="input flex-1"
            disabled={creating}
          />
          <button onClick={handleCreateTopic} disabled={creating || !newTopicName.trim()} className="btn btn-primary">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create
          </button>
        </div>
      )}

      {error && <p className="text-[13px] mb-4" style={{ color: 'var(--bad)' }}>{error}</p>}

      {topics.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <LayoutGrid size={22} className="mx-auto mb-2" style={{ color: 'var(--ink-4)' }} />
          <p style={{ color: 'var(--ink-3)' }}>No topics yet.</p>
          <p className="text-[13px] mt-1.5" style={{ color: 'var(--ink-4)' }}>
            Generate a creative from the Creatives page, or click <b>New topic</b> above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {topics.map(topic => {
            const isRenaming = renamingId === topic._id
            return (
              <Link
                key={topic._id}
                href={isRenaming ? '#' : `/dashboard/${tenantId}/gallery/${topic._id}`}
                onClick={e => { if (isRenaming) e.preventDefault() }}
                className="card p-4 block"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="rounded-lg p-2" style={{ background: 'var(--accent-bg)' }}>
                    <LayoutGrid size={16} style={{ color: 'var(--accent-strong)' }} />
                  </div>
                  {isRenaming ? (
                    <input
                      value={renameDraft}
                      onChange={e => setRenameDraft(e.target.value)}
                      onClick={e => e.preventDefault()}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(topic._id) }}
                      className="input flex-1"
                      style={{ fontSize: '13px', padding: '4px 8px' }}
                      disabled={renaming}
                      autoFocus
                    />
                  ) : (
                    <p className="text-[14px] font-semibold truncate flex-1" style={{ color: 'var(--ink)' }}>{topic.name}</p>
                  )}
                  {isRenaming ? (
                    <>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); handleRename(topic._id) }}
                        disabled={renaming || !renameDraft.trim()}
                        className="p-1.5 rounded-md"
                        style={{ color: 'var(--good)' }}
                      >
                        {renaming ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); setRenamingId(null) }}
                        disabled={renaming}
                        className="p-1.5 rounded-md"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={e => startRename(topic, e)} className="p-1.5 rounded-md" style={{ color: 'var(--ink-3)' }}>
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(topic) }}
                        className="p-1.5 rounded-md"
                        style={{ color: 'var(--bad)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  <span>{topic.sheetCount} sheet{topic.sheetCount === 1 ? '' : 's'}</span>
                  <span className="flex items-center gap-1"><ImageIcon size={12} /> {topic.assetCount} asset{topic.assetCount === 1 ? '' : 's'}</span>
                </div>
              </Link>
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
