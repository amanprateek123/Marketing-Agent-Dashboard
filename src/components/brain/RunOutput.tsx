'use client'

import React from 'react'
import {
  ExternalLink,
  Lightbulb,
  MessageSquare,
  Minus,
  ScrollText,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { formatPercent } from '@/lib/utils'
import { formatInr, plainStatus } from '@/lib/plain-language'
import type { BrainRunOutput } from '@/types/brain'
import { EvidenceList, plainCode } from './shared'

const SEVERITY_META: Record<string, { chip: string; label: string }> = {
  good: { chip: 'chip-good', label: 'Working' },
  watch: { chip: 'chip-warn', label: 'Watch this' },
  bad: { chip: 'chip-bad', label: 'Problem' },
  neutral: { chip: 'chip-neutral', label: 'Note' },
}


/**
 * One renderer per output shape. The union is closed, so adding a new agent
 * output forces a case here rather than silently rendering nothing — which is
 * exactly what we want when Foundry starts returning something new.
 */
export function RunOutputView({ output }: { output: BrainRunOutput }) {
  switch (output.kind) {
    case 'answer':
      return (
        <div className="flex flex-col gap-4">
          <p className="insight-quote break-words">{output.headline}</p>
          {output.body.split('\n\n').map((paragraph, index) => (
            <p key={index} className="break-words text-[14.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {paragraph}
            </p>
          ))}
          <div>
            <p className="micro-label mb-2">What it answered this on</p>
            <EvidenceList evidence={output.evidence} />
          </div>
        </div>
      )

    case 'allocation':
      return (
        <div className="flex flex-col gap-4">
          <p className="break-words text-[14.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {output.rationale}
          </p>
          <ul className="flex flex-col gap-2">
            {output.allocations.map((allocation) => (
              <li
                key={allocation.product}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl px-3.5 py-3"
                style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}
              >
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {allocation.product}
                  </span>
                  <span className="explain block break-words">{allocation.reason}</span>
                </span>
                <span className="text-right">
                  <span className="display-num block text-[17px]" style={{ color: 'var(--ink)' }}>
                    {formatInr(allocation.dailyBudget, { perDay: true })}
                  </span>
                  <span className="explain block">{formatPercent(allocation.share)} of the day&apos;s budget</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )

    case 'report':
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip chip-accent">
              <ScrollText size={11} aria-hidden="true" /> {output.period}
            </span>
            {output.slackPermalink && (
              <a href={output.slackPermalink} className="chip chip-neutral" target="_blank" rel="noreferrer">
                <MessageSquare size={11} aria-hidden="true" /> Posted to Slack
              </a>
            )}
          </div>

          <h3 className="section-title break-words">{output.title}</h3>
          <p className="break-words text-[14.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {output.summary}
          </p>

          <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {output.highlights.map((highlight) => {
              const Arrow =
                highlight.direction === 'up' ? TrendingUp : highlight.direction === 'down' ? TrendingDown : Minus
              const color =
                highlight.direction === 'up'
                  ? 'var(--good)'
                  : highlight.direction === 'down'
                    ? 'var(--bad)'
                    : 'var(--ink-3)'

              return (
                <li key={highlight.label} className="card-inset min-w-0 px-3.5 py-3">
                  <p className="micro-label">{highlight.label}</p>
                  <p className="display-num mt-1 text-[22px]" style={{ color: 'var(--ink)' }}>
                    {highlight.value}
                  </p>
                  {highlight.delta && (
                    <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold" style={{ color }}>
                      <Arrow size={12} aria-hidden="true" /> {highlight.delta}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>

          {output.href ? (
            <a href={output.href} className="btn btn-ghost self-start" target="_blank" rel="noreferrer">
              <ExternalLink size={14} aria-hidden="true" /> Open the full report
            </a>
          ) : (
            <p className="explain">
              The full report will have its own page. A link appears here as soon as it is ready.
            </p>
          )}
        </div>
      )

    case 'research':
      return (
        <div className="flex flex-col gap-5">
          <p className="explain">
            Looked at {output.observationsRead} things · learned {output.learnings.length} ·
            suggested {output.ideas.length} ideas
          </p>

          <div>
            <p className="micro-label mb-2">What it learned</p>
            <ul className="flex flex-col gap-3">
              {output.learnings.map((learning) => (
                <li
                  key={learning.id}
                  className="rounded-xl px-4 py-3.5"
                  style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 max-w-[72ch] break-words text-[14px] leading-snug" style={{ color: 'var(--ink)' }}>
                      {learning.statement}
                    </p>
                    <span className="chip chip-neutral shrink-0">
                      {formatPercent(learning.confidence)} confident
                    </span>
                  </div>
                  {learning.product && (
                    <span className="chip chip-accent mt-2">{learning.product}</span>
                  )}
                  <div className="mt-2.5">
                    <EvidenceList evidence={learning.evidence} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="micro-label mb-2">Ideas it suggests — nothing is made until someone picks one</p>
            <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              {output.ideas.map((idea) => (
                <li
                  key={idea.id}
                  className="flex gap-3 rounded-xl px-3.5 py-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
                >
                  <Lightbulb size={15} aria-hidden="true" style={{ color: 'var(--accent-strong)', marginTop: 2, flexShrink: 0 }} />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {idea.title}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="chip chip-neutral">{idea.product}</span>
                      <span className="chip chip-accent">{plainCode(idea.angle)}</span>
                    </div>
                    <p className="explain mt-1.5 break-words">{idea.rationale}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )

    case 'analysis':
      return (
        <div className="flex flex-col gap-5">
          <ul className="flex flex-col gap-2.5">
            {output.findings.map((finding) => {
              const severity = SEVERITY_META[finding.severity] ?? {
                chip: 'chip-neutral',
                label: plainStatus('severity', finding.severity).label,
              }
              return (
                <li
                  key={finding.id}
                  className="rounded-xl px-4 py-3.5"
                  style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`chip ${severity.chip}`}>{severity.label}</span>
                    {finding.metric && (
                      <span className="chip chip-neutral max-w-full break-words">{finding.metric}</span>
                    )}
                  </div>
                  <p className="mt-1.5 break-words text-[14.5px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                    {finding.headline}
                  </p>
                  <p className="explain mt-1 max-w-[76ch] break-words">{finding.detail}</p>
                </li>
              )
            })}
          </ul>

          {output.nextBrief && (
            <div
              className="rounded-xl px-4 py-4"
              style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
            >
              <p className="micro-label" style={{ color: 'var(--accent-strong)' }}>
                The next ad brief it wrote
              </p>
              <p className="mt-1.5 break-words text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {output.nextBrief}
              </p>
              <p className="explain mt-2">
                The Brain decides whether to have ads made from this. Nothing starts from here.
              </p>
            </div>
          )}

          <p className="explain">
            The Brain learned {output.learningsWritten} {output.learningsWritten === 1 ? 'thing' : 'things'} from this.
          </p>
        </div>
      )
  }
}
