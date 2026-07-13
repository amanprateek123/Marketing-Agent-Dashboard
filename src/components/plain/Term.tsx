import { HelpCircle } from 'lucide-react'

/** Shared plain-English definitions so wording stays consistent everywhere the term appears. */
export const GLOSSARY = {
  roas: 'Return on ad spend — for every ₹1 you spend, how many ₹ came back. 2.00x means you doubled your money; below 1.00x means you’re losing money.',
  ctr: 'Click-through rate — the percentage of people who saw the ad and clicked on it. Higher usually means the ad is more interesting to them.',
  cpa: 'Cost per acquisition — how much you paid, on average, for each purchase or signup this drove.',
  cpc: 'Cost per click — how much you pay, on average, each time someone clicks the ad.',
  cpm: 'Cost per 1,000 impressions — what it costs to show the ad to 1,000 people, regardless of clicks.',
  cvr: 'Conversion rate — the percentage of clicks that turned into an actual purchase or signup.',
  freq: 'Frequency — the average number of times one person has seen this ad. Above ~4-5, people usually start tuning it out.',
  conv: 'Conversions — the number of purchases or signups counted from this ad.',
  breakeven: 'Breakeven ROAS — the minimum return needed just to cover costs (product cost, fees, refunds). Below this line, you’re losing money on every sale.',
  targetRoas: 'Target ROAS — the return we’re aiming for once healthy, not just breaking even. Set higher than breakeven so campaigns are actually profitable, not just paying for themselves.',
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
