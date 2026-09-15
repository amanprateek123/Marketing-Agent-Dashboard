'use client'

import React from 'react'
import { ArrowRight, Gavel, ImageIcon, Info, Megaphone, Package } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import type { BrainArtifact, BrainPipelineRun, BrainTabKey } from '@/types/brain'
import { AgentGlyph, RunStatusChip, SectionCard, STAGE_STATE_META } from './shared'

interface PipelineTabProps {
  pipeline: BrainPipelineRun | null
  onGoToTab: (tab: BrainTabKey) => void
}

/**
 * Read-only by design. The Producer, Curator, Builder and Launcher are
 * triggered by the Brain, never from here — so this tab has exactly one kind of
 * action on it: jumping to the gate that is holding a stage up.
 */
export function PipelineTab({ pipeline, onGoToTab }: PipelineTabProps) {
  if (!pipeline) {
    return (
      <SectionCard title="The core pipeline" description="Producer → Curator → Builder → Launcher.">
        <div className="py-12 text-center">
          <Package size={22} aria-hidden="true" style={{ color: 'var(--ink-4)' }} className="mx-auto" />
          <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
            No batch in flight
          </p>
          <p className="explain mx-auto mt-1 max-w-[46ch]">
            The Brain starts this chain when it briefs an idea. You cannot start it from here —
            that is deliberate, so nothing gets built that the Brain has not decided on.
          </p>
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title={`Current batch · ${pipeline.product}`}
        description={
          <>
            Triggered by {pipeline.triggeredBy} · started {formatRelativeTime(pipeline.startedAt)} ·{' '}
            <span className="mono">{pipeline.pipelineRunId}</span>
          </>
        }
        action={<RunStatusChip status={pipeline.status} />}
      >
        <p className="insight-quote mb-5">{pipeline.headline}</p>

        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
        >
          <Info size={16} aria-hidden="true" style={{ color: 'var(--info)', marginTop: 2 }} />
          <p className="explain" style={{ color: 'var(--ink-2)' }}>
            These four agents are triggered by the Brain, not by you. This view is read-only apart
            from the gates — if a stage is waiting, answering its gate is what moves it on.
          </p>
        </div>
      </SectionCard>

      {/* Stage rail — horizontal on desktop, stacked on narrow screens. */}
      <ol className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {pipeline.stages.map((stage, index) => {
          const meta = STAGE_STATE_META[stage.state]
          const isLast = index === pipeline.stages.length - 1

          return (
            <li key={stage.key} className="relative flex flex-col">
              {/* Connector, desktop only — the stacked layout reads as a sequence already. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute right-[-14px] top-[46px] hidden lg:block"
                  style={{ color: 'var(--ink-4)' }}
                >
                  <ArrowRight size={16} />
                </span>
              )}

              <div
                className="card flex h-full flex-col p-4"
                style={
                  stage.state === 'waiting_for_human'
                    ? { borderColor: 'var(--warn-border)', background: 'var(--warn-bg)' }
                    : undefined
                }
              >
                <div className="flex items-start gap-3">
                  <AgentGlyph
                    agentKey={stage.agentKey}
                    size={36}
                    tone={stage.state === 'done' ? 'teal' : stage.state === 'idle' ? 'neutral' : 'accent'}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--ink-4)' }}>
                      Step {index + 1}
                    </p>
                    <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                      {stage.label}
                    </p>
                  </div>
                </div>

                <p className="explain mt-2.5 leading-snug">{stage.description}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`chip ${meta.chip}`}>
                    <span
                      aria-hidden="true"
                      className={stage.state === 'running' ? 'beacon' : undefined}
                      style={
                        stage.state === 'running'
                          ? { background: meta.dot }
                          : { width: 7, height: 7, borderRadius: 999, background: meta.dot, display: 'inline-block' }
                      }
                    />
                    {meta.label}
                  </span>
                  {stage.startedAt && (
                    <span className="explain mono">
                      {stage.finishedAt
                        ? `finished ${formatRelativeTime(stage.finishedAt)}`
                        : `started ${formatRelativeTime(stage.startedAt)}`}
                    </span>
                  )}
                </div>

                {stage.detail && (
                  <p className="mt-2 text-[13px] font-medium" style={{ color: 'var(--ink-2)' }}>
                    {stage.detail}
                  </p>
                )}

                {stage.artifacts.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {stage.artifacts.map((artifact) => (
                      <li key={artifact.id}>
                        <ArtifactRow artifact={artifact} />
                      </li>
                    ))}
                  </ul>
                )}

                {stage.gateId && (
                  <button
                    type="button"
                    onClick={() => onGoToTab('approvals')}
                    className="btn btn-accent mt-auto w-full"
                    style={{ marginTop: 16 }}
                  >
                    <Gavel size={14} aria-hidden="true" /> Answer this gate
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ArtifactRow({ artifact }: { artifact: BrainArtifact }) {
  const Icon = artifact.kind === 'campaign' ? Megaphone : artifact.kind === 'creative' ? ImageIcon : Package

  return (
    <div
      className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2"
      style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}
    >
      <Icon size={14} aria-hidden="true" style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          {artifact.label}
        </span>
        {artifact.meta && (
          <span className="block truncate text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {artifact.meta}
          </span>
        )}
      </span>
    </div>
  )
}
