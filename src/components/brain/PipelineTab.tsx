'use client'

import React from 'react'
import { ArrowRight, Gavel, ImageIcon, Info, Megaphone, Package } from 'lucide-react'
import { Details } from '@/components/plain/Details'
import { formatRelative, plainStatus } from '@/lib/plain-language'
import type { BrainArtifact, BrainPipelineRun, BrainTabKey } from '@/types/brain'
import { AgentGlyph, BudgetAuthorityNotice, RunStatusChip, SectionCard, STAGE_STATE_META } from './shared'

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
      <SectionCard
        title="How new ads get made"
        description="Make the ads → pick the best → set up the campaign → go live."
      >
        <div className="py-12 text-center">
          <Package size={22} aria-hidden="true" style={{ color: 'var(--ink-4)' }} className="mx-auto" />
          <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
            No new ads are being made right now
          </p>
          <p className="explain mx-auto mt-1 max-w-[46ch]">
            The Brain starts this when it decides on an idea. You can&apos;t start it from here, on
            purpose — so nothing gets made that the Brain hasn&apos;t decided on.
          </p>
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title={<span className="break-words">New ads for {pipeline.product}</span>}
        description={
          <>
            {startedByLabel(pipeline.triggeredBy)} · started {formatRelative(pipeline.startedAt)}
          </>
        }
        action={<RunStatusChip status={pipeline.status} />}
      >
        <p className="insight-quote mb-5 break-words">{pipeline.headline}</p>

        {pipeline.budgetAuthority && (
          <div className="mb-5">
            <BudgetAuthorityNotice authority={pipeline.budgetAuthority} />
          </div>
        )}

        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
        >
          <Info size={16} aria-hidden="true" style={{ color: 'var(--info)', marginTop: 2, flexShrink: 0 }} />
          <p className="explain min-w-0" style={{ color: 'var(--ink-2)' }}>
            The Brain moves these four steps along on its own. The only thing you do here is give
            the go-ahead when a step is waiting for you.
          </p>
        </div>
        <Details className="mt-4" reference={pipeline.pipelineRunId} />
      </SectionCard>

      {/* Stage rail — horizontal on desktop, stacked on narrow screens. */}
      <ol className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {pipeline.stages.map((stage, index) => {
          const meta = STAGE_STATE_META[stage.state] ?? {
            label: plainStatus('stageState', stage.state).label,
            chip: 'chip-neutral',
            dot: 'var(--ink-4)',
          }
          const stageName = plainStatus('stageKey', stage.key)
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
                    <p className="break-words text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                      {stageName.meaning ? stageName.label : stage.label}
                    </p>
                  </div>
                </div>

                <p className="explain mt-2.5 break-words leading-snug">{stage.description}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`chip ${meta.chip}`}
                    title={plainStatus('stageState', stage.state).meaning || undefined}
                  >
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
                    <span className="explain">
                      {stage.finishedAt
                        ? `finished ${formatRelative(stage.finishedAt)}`
                        : `started ${formatRelative(stage.startedAt)}`}
                    </span>
                  )}
                </div>

                {stage.detail && (
                  <p className="mt-2 break-words text-[13px] font-medium" style={{ color: 'var(--ink-2)' }}>
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
                    <Gavel size={14} aria-hidden="true" /> Give your go-ahead
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

/** "brain" / "dashboard" become plain words; a name or sentence passes through. */
function startedByLabel(triggeredBy: string | null | undefined): string {
  if (!triggeredBy) return 'Started by the Brain'
  const known = plainStatus('runTrigger', triggeredBy)
  return known.meaning ? known.label : `Started by ${triggeredBy}`
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
        <span
          className="block truncate text-[12.5px] font-semibold"
          style={{ color: 'var(--ink-2)' }}
          title={artifact.label}
        >
          {artifact.label}
        </span>
        {artifact.meta && (
          <span className="block truncate text-[11px]" style={{ color: 'var(--ink-3)' }} title={artifact.meta}>
            {artifact.meta}
          </span>
        )}
      </span>
    </div>
  )
}
