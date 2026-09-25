import { HelpCircle } from 'lucide-react'
import { plainStatus, type PlainDomain } from '@/lib/plain-language'

/** Shared plain-English definitions so wording stays consistent everywhere the term appears. */
export const GLOSSARY = {
  roas: 'Recorded action value per ₹1 of ad spend. Depending on the row, the value can come from Meta attribution or a configured estimate. 1.00x means recorded action value equals spend; it does not prove cash collected or profit after product costs.',
  ctr: 'Click-through rate — the percentage of people who saw the ad and clicked on it. Higher usually means the ad is more interesting to them.',
  cpa: 'Cost per acquisition — how much you paid, on average, for each purchase or signup this drove.',
  cpc: 'Cost per click — how much you pay, on average, each time someone clicks the ad.',
  cpm: 'Cost per 1,000 impressions — what it costs to show the ad to 1,000 people, regardless of clicks.',
  cvr: 'Conversion rate — the percentage of clicks that turned into an actual purchase or signup.',
  freq: 'Frequency — the average number of times one person has seen this ad. Above ~4-5, people usually start tuning it out.',
  conv: 'Conversions — the number of purchases or signups counted from this ad.',
  breakeven: 'Modeled breakeven ROAS based on configured product economics. Treat it as directional until the return and refund basis are fully reconciled.',
  targetRoas: 'Target ROAS — the recorded action-value return the campaign is aiming for. It is an operating target, not proof of collected cash or contribution profit.',
} as const

interface Props {
  /** The abbreviation or jargon word itself — e.g. "ROAS" */
  children: string
  /** Plain-English explanation shown on hover/tap. */
  help: string
}

/**
 * Wraps a jargon word/abbreviation (ROAS, CTR, CPA...) with a small "?" so a
 * non-technical reader can hover to learn what it means, without every table
 * header needing to spell the term out in full.
 */
export function Term({ children, help }: Props) {
  return (
    <span className="inline-flex items-center gap-1" title={help}>
      {children}
      <HelpCircle size={11} style={{ color: 'var(--ink-4)' }} />
    </span>
  )
}

/**
 * A code from the shared vocabulary as plain words with its meaning on hover:
 * <PlainTerm domain="runStage" code="curating" /> → "Picking the best" (?) "Scoring every ad…".
 * An unknown code renders humanised, without the help icon (there is no meaning to show).
 */
export function PlainTerm({ domain, code }: { domain: PlainDomain; code: string | null | undefined }) {
  const plain = plainStatus(domain, code)
  if (!plain.meaning) return <span>{plain.label}</span>
  return <Term help={plain.meaning}>{plain.label}</Term>
}
