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
  cold: { label: 'Cold',  bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe', icon: Snowflake },
  warm: { label: 'Warm',  bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa', icon: Sun },
  hot:  { label: 'Hot',   bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca', icon: Flame },
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
      style={{ background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' }}
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
  video: { label: 'Video', bg: '#eef2ff', fg: '#4338ca', border: '#c7d2fe', icon: Video },
  image: { label: 'Image', bg: '#f0fdf4', fg: '#166534', border: '#bbf7d0', icon: ImageIcon },
  mixed: { label: 'Mixed', bg: '#f5f3ff', fg: '#6d28d9', border: '#ddd6fe', icon: Layers },
}

export function FormatBadge({ format }: { format?: string | CreativeFormat }) {
  if (!format) return null
  const key = format.toLowerCase()
  const c = FORMAT_CONFIG[key] ?? {
    label: format,
    bg: '#f3f4f6',
    fg: '#4b5563',
    border: '#e5e7eb',
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
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold whitespace-nowrap"
      style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }}
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
    ? { bg: '#fef3c7', fg: '#92400e', border: '#fde68a' }
    : { bg: '#e0e7ff', fg: '#3730a3', border: '#c7d2fe' }
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
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#9ca3af',
}

export function UrgencyDot({ urgency }: { urgency?: 'high' | 'medium' | 'low' | string }) {
  if (!urgency) return null
  const color = URGENCY_COLORS[urgency] ?? '#d1d5db'
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium capitalize whitespace-nowrap"
      style={{ color: '#4b5563' }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {urgency}
    </span>
  )
}

// ── LeakDiagnosisBadge ────────────────────────────────────────────────────
// Maps the audit agent's diagnosed primary leak to a badge with:
//   - color (severity tier: red=urgent stop, orange=fix this cycle, yellow=schedule, gray=healthy)
//   - icon (visual category cue)
//   - tooltip explaining what the leak means + what action follows
// 'none' renders a green "Healthy" pill; null renders nothing (synthetic skip).
const LEAK_DIAGNOSIS_CONFIG: Record<
  LeakDiagnosis,
  { label: string; bg: string; fg: string; border: string; icon: React.ElementType; tooltip: string }
> = {
  chronic_unprofitable: {
    label: 'Unprofitable',
    bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca', icon: TrendingDown,
    tooltip: 'Shrunken + upper-95% ROAS both below breakeven with ≥3 conversions. Action: pause worst-ROAS ad set.',
  },
  data_gap: {
    label: 'Data Gap',
    bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca', icon: Database,
    tooltip: 'conversionValue missing on the active product — ROAS uncomputable. Fix the product config before any pause/scale.',
  },
  auction_leak: {
    label: 'Auction Leak',
    bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa', icon: Activity,
    tooltip: 'Account-wide CPMs spiking while your campaign is stable. Action: reduce_total_budget / dayparting — not creative.',
  },
  creative_leak: {
    label: 'Creative Leak',
    bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa', icon: AlertTriangle,
    tooltip: 'CTR below benchmark or fatigued. Action: replace_creative on the worst ads.',
  },
  audience_lp_leak: {
    label: 'Audience / LP',
    bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa', icon: Users,
    tooltip: 'CTR healthy but CVR collapsed — audience or landing page leaks. Action: refresh_audience, investigate LP funnel. Do NOT replace_creative.',
  },
  creative_diversity_leak: {
    label: 'Hook Saturation',
    bg: '#fefce8', fg: '#a16207', border: '#fde68a', icon: Sparkles,
    tooltip: 'One hookStyle monopolises this audience (≥70% impressions). Action: add_creative with a different hookStyle.',
  },
  fragmentation: {
    label: 'Fragmented',
    bg: '#fefce8', fg: '#a16207', border: '#fde68a', icon: Scissors,
    tooltip: 'Too many overlapping ad sets, none past learning phase. Action: consolidate via shift_budget_between_adsets.',
  },
  none: {
    label: 'Healthy',
    bg: '#f0fdf4', fg: '#166534', border: '#bbf7d0', icon: CheckCircle2,
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
    ? { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' }
    : ratio < 1.5
      ? { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' }
      : { bg: '#f0fdf4', fg: '#166534', border: '#bbf7d0' }
  const sourceLabel = source
    ? source === 'product' ? 'product-set margin' : source === 'vertical' ? 'vertical default' : 'fallback margin (0.50)'
    : null
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap font-mono"
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
  correct_block:  { label: 'Correct block',  bg: '#f0fdf4', fg: '#166534', border: '#bbf7d0', icon: CheckCircle2 },
  missed_signal:  { label: 'Missed signal',  bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca', icon: XCircle },
  inconclusive:   { label: 'Inconclusive',   bg: '#f9fafb', fg: '#6b7280', border: '#e5e7eb', icon: HelpCircle },
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
