import {
  Snowflake,
  Flame,
  Sun,
  FlaskConical,
  Video,
  Image as ImageIcon,
  Layers,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Users,
  Sparkles,
  TrendingDown,
  Activity,
  Database,
  Scissors,
  Target,
} from 'lucide-react'
import type {
  AudienceStage,
  CreativeFormat,
  HookStyle,
  LeakDiagnosis,
} from '@/types'

// ── AudienceStageBadge ────────────────────────────────────────────────────
const AUDIENCE_STAGE_CONFIG: Record<
  AudienceStage,
  { label: string; bg: string; fg: string; border: string; icon: React.ElementType }
> = {
  cold: { label: 'Cold',  bg: 'var(--info-bg)', fg: 'var(--info)', border: 'var(--info-border)', icon: Snowflake },
  warm: { label: 'Warm',  bg: 'var(--warn-bg)', fg: 'var(--warn)', border: 'var(--warn-border)', icon: Sun },
  hot:  { label: 'Hot',   bg: 'var(--bad-bg)',  fg: 'var(--bad)',  border: 'var(--bad-border)',  icon: Flame },
}

export function AudienceStageBadge({ stage }: { stage?: AudienceStage }) {
  if (!stage) return null
  const c = AUDIENCE_STAGE_CONFIG[stage]
  const Icon = c.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <Icon size={10} /> {c.label}
    </span>
  )
}

// ── ExplorationBadge ──────────────────────────────────────────────────────
export function ExplorationBadge({ active = true }: { active?: boolean }) {
  if (!active) return null
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
      title="Exploration arm — testing a non-greedy variant"
    >
      <FlaskConical size={10} /> Exploration
    </span>
  )
}

// ── FormatBadge ───────────────────────────────────────────────────────────
const FORMAT_CONFIG: Record<
  string,
  { label: string; bg: string; fg: string; border: string; icon: React.ElementType }
> = {
  video: { label: 'Video', bg: 'var(--accent-bg)', fg: 'var(--accent)', border: 'var(--accent-border)', icon: Video },
  image: { label: 'Image', bg: 'var(--good-bg)',   fg: 'var(--good)',   border: 'var(--good-border)',   icon: ImageIcon },
  mixed: { label: 'Mixed', bg: 'var(--info-bg)',   fg: 'var(--info)',   border: 'var(--info-border)',   icon: Layers },
}

export function FormatBadge({ format }: { format?: string | CreativeFormat }) {
  if (!format) return null
  const key = format.toLowerCase()
  const c = FORMAT_CONFIG[key] ?? {
    label: format,
    bg: 'var(--muted)',
    fg: 'var(--ink-2)',
    border: 'var(--hairline)',
    icon: Layers,
  }
  const Icon = c.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <Icon size={10} /> {c.label}
    </span>
  )
}

// ── PromptsVersionBadge ───────────────────────────────────────────────────
export function PromptsVersionBadge({ version }: { version?: number }) {
  if (version == null) return null
  return (
    <span
      className="mono inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
      style={{ background: 'var(--muted)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }}
      title={`Generated using prompts v${version}`}
    >
      prompts v{version}
    </span>
  )
}

// ── HookStyleChip ─────────────────────────────────────────────────────────
const DR_HOOKS = new Set<string>([
  'pain_point', 'bold_claim', 'price_shock', 'social_proof',
  'curiosity_gap', 'before_after', 'urgency',
])

export function HookStyleChip({ style }: { style?: HookStyle | string }) {
  if (!style) return null
  const isMeme = !DR_HOOKS.has(style)
  const palette = isMeme
    ? { bg: 'var(--warn-bg)', fg: 'var(--warn)', border: 'var(--warn-border)' }
    : { bg: 'var(--accent-bg)', fg: 'var(--accent-strong)', border: 'var(--accent-border)' }
  const label = style.replace(/_/g, ' ')
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium capitalize whitespace-nowrap"
      style={{ background: palette.bg, color: palette.fg, border: `1px solid ${palette.border}` }}
    >
      {label}
    </span>
  )
}

// ── UrgencyDot ────────────────────────────────────────────────────────────
const URGENCY_COLORS: Record<string, string> = {
  high:   'var(--bad)',
  medium: 'var(--warn)',
  low:    'var(--ink-3)',
}

export function UrgencyDot({ urgency }: { urgency?: 'high' | 'medium' | 'low' | string }) {
  if (!urgency) return null
  const color = URGENCY_COLORS[urgency] ?? 'var(--ink-4)'
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium capitalize whitespace-nowrap"
      style={{ color: 'var(--ink-2)' }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {urgency}
    </span>
  )
}

// ── LeakDiagnosisBadge ────────────────────────────────────────────────────
// Maps the audit agent's diagnosed primary leak to a badge with:
//   - color (severity tier: bad=urgent stop, warn=fix this cycle / schedule, good=healthy)
//   - icon (visual category cue)
//   - tooltip explaining what the leak means + what action follows
// 'none' renders a green "Healthy" pill; null renders nothing (synthetic skip).
const LEAK_DIAGNOSIS_CONFIG: Record<
  LeakDiagnosis,
  { label: string; bg: string; fg: string; border: string; icon: React.ElementType; tooltip: string }
> = {
  chronic_unprofitable: {
    label: 'Unprofitable',
    bg: 'var(--bad-bg)', fg: 'var(--bad)', border: 'var(--bad-border)', icon: TrendingDown,
    tooltip: 'Shrunken + upper-95% ROAS both below breakeven with ≥3 conversions. Action: pause worst-ROAS ad set.',
  },
  data_gap: {
    label: 'Data Gap',
    bg: 'var(--bad-bg)', fg: 'var(--bad)', border: 'var(--bad-border)', icon: Database,
    tooltip: 'conversionValue missing on the active product — ROAS uncomputable. Fix the product config before any pause/scale.',
  },
  auction_leak: {
    label: 'Auction Leak',
    bg: 'var(--warn-bg)', fg: 'var(--warn)', border: 'var(--warn-border)', icon: Activity,
    tooltip: 'Account-wide CPMs spiking while your campaign is stable. Action: reduce_total_budget / dayparting — not creative.',
  },
  creative_leak: {
    label: 'Creative Leak',
    bg: 'var(--warn-bg)', fg: 'var(--warn)', border: 'var(--warn-border)', icon: AlertTriangle,
    tooltip: 'CTR below benchmark or fatigued. Action: replace_creative on the worst ads.',
  },
  audience_lp_leak: {
    label: 'Audience / LP',
    bg: 'var(--warn-bg)', fg: 'var(--warn)', border: 'var(--warn-border)', icon: Users,
    tooltip: 'CTR healthy but CVR collapsed — audience or landing page leaks. Action: refresh_audience, investigate LP funnel. Do NOT replace_creative.',
  },
  creative_diversity_leak: {
    label: 'Hook Saturation',
    bg: 'var(--warn-bg)', fg: 'var(--warn)', border: 'var(--warn-border)', icon: Sparkles,
    tooltip: 'One hookStyle monopolises this audience (≥70% impressions). Action: add_creative with a different hookStyle.',
  },
  fragmentation: {
    label: 'Fragmented',
    bg: 'var(--warn-bg)', fg: 'var(--warn)', border: 'var(--warn-border)', icon: Scissors,
    tooltip: 'Too many overlapping ad sets, none past learning phase. Action: consolidate via shift_budget_between_adsets.',
  },
  none: {
    label: 'Healthy',
    bg: 'var(--good-bg)', fg: 'var(--good)', border: 'var(--good-border)', icon: CheckCircle2,
    tooltip: 'No leak identified by the auditor. Check INSUFFICIENT EVIDENCE in contextInsight if this is a young campaign.',
  },
}

export function LeakDiagnosisBadge({ leak }: { leak?: LeakDiagnosis | null }) {
  if (!leak) return null
  const c = LEAK_DIAGNOSIS_CONFIG[leak]
  if (!c) return null
  const Icon = c.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
      title={c.tooltip}
    >
      <Icon size={11} /> {c.label}
    </span>
  )
}

// ── BreakevenBadge ────────────────────────────────────────────────────────
// Renders ROAS in context of its margin-aware breakeven. The numbers in
// isolation are misleading — ROAS 1.2x looks fine until you know the
// product needs 5x to break even. Color flips red below breakeven, amber
// below 1.5×, green at/above 1.5×. Tooltip surfaces the resolution source
// (product / vertical / default) so you can tell if margin is configured.
export function BreakevenBadge({
  roas,
  breakeven,
  source,
}: {
  roas?: number | null
  breakeven?: number | null
  source?: 'product' | 'vertical' | 'default' | null
}) {
  if (roas == null || breakeven == null || breakeven <= 0) return null
  const ratio = roas / breakeven
  const palette = ratio < 1
    ? { bg: 'var(--bad-bg)', fg: 'var(--bad)', border: 'var(--bad-border)' }
    : ratio < 1.5
      ? { bg: 'var(--warn-bg)', fg: 'var(--warn)', border: 'var(--warn-border)' }
      : { bg: 'var(--good-bg)', fg: 'var(--good)', border: 'var(--good-border)' }
  const sourceLabel = source
    ? source === 'product' ? 'product-set margin' : source === 'vertical' ? 'vertical default' : 'fallback margin (0.50)'
    : null
  return (
    <span
      className="mono inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap"
      style={{ background: palette.bg, color: palette.fg, border: `1px solid ${palette.border}` }}
      title={`Breakeven ROAS ${breakeven.toFixed(2)}x${sourceLabel ? ` (${sourceLabel})` : ''}. ROAS below breakeven = losing money after COGS/fees.`}
    >
      <Target size={10} /> Breakeven {breakeven.toFixed(2)}x
    </span>
  )
}

// ── RegretLabel ───────────────────────────────────────────────────────────
const REGRET_CONFIG: Record<
  string,
  { label: string; bg: string; fg: string; border: string; icon: React.ElementType }
> = {
  correct_block:  { label: 'Correct block',  bg: 'var(--good-bg)', fg: 'var(--good)', border: 'var(--good-border)', icon: CheckCircle2 },
  missed_signal:  { label: 'Missed signal',  bg: 'var(--bad-bg)',  fg: 'var(--bad)',  border: 'var(--bad-border)',  icon: XCircle },
  inconclusive:   { label: 'Inconclusive',   bg: 'var(--muted)',   fg: 'var(--ink-2)', border: 'var(--hairline)',   icon: HelpCircle },
}

export function RegretLabel({
  label,
}: {
  label?: 'correct_block' | 'missed_signal' | 'inconclusive' | string
}) {
  if (!label) return null
  const c = REGRET_CONFIG[label] ?? REGRET_CONFIG.inconclusive
  const Icon = c.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <Icon size={10} /> {c.label}
    </span>
  )
}
