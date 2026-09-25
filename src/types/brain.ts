/**
 * The Brain console's contract with the Foundry marketing agent.
 *
 * Foundry runs the 91astro marketing organisation as a set of agents. Two
 * things reach this dashboard from it, and they are NOT the same shape:
 *
 *   1. ON-DEMAND — the operator asks an agent to run now. Brain, Competitor
 *      Research, Campaign Report Generator and Performance & Self Data Analyst.
 *      These have inputs and return a run we can follow.
 *   2. AUTONOMOUS — the Brain (or a cron) triggers the core pipeline:
 *      Creative Batch Producer -> Curator -> Campaign Builder -> Launcher.
 *      Nothing in this UI starts those; we render what they push back.
 *
 * Internal agents (the Coding v1/v2/V3 pipeline, Probe, Learning Repair) are
 * deliberately absent from this file. They are not marketing surfaces and must
 * never appear in the console.
 *
 * The transport lives in `lib/brain-api.ts`. These types are the contract the
 * NestJS `foundry-bridge` will have to satisfy — mirroring `pipeline-bridge`,
 * which already proved this shape for the external creative pipeline.
 */

// ── Agents ─────────────────────────────────────────────────────────────────

export type BrainAgentKey =
  | 'brain'
  | 'competitor-research'
  | 'campaign-report'
  | 'performance-analyst'
  | 'creative-producer'
  | 'creative-curator'
  | 'campaign-builder'
  | 'campaign-launcher'

/** Who is allowed to start this agent. `brain_triggered` agents render read-only. */
export type BrainInvocation = 'on_demand' | 'brain_triggered' | 'scheduled'

/** The product story from DESIGN.md §5 — nav and grouping follow it. */
export type BrainStage = 'understand' | 'create' | 'control' | 'improve' | 'prove'

export type BrainAgentStatus = 'live' | 'draft' | 'paused'

export interface BrainAgentInput {
  key: string
  label: string
  hint?: string
  type: 'text' | 'textarea' | 'select' | 'number'
  required: boolean
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  defaultValue?: string
}

/**
 * One schedule or webhook that can start an agent.
 *
 * `enabled` is the only field this console may change. The cron, the name and the kind are
 * read-only here and live in Studio: turning a known schedule back on is recovering from a visible
 * mistake, while changing WHEN something runs is a decision about how the company operates.
 *
 * `id` and `cron` can be null — Foundry's list response does not always carry them, so the toggle
 * addresses a trigger by id when there is one and by a name fragment otherwise.
 */
export interface BrainTrigger {
  id: string | null
  name: string
  /** 'schedule' | 'webhook' | 'app_event' */
  source: string
  cron: string | null
  enabled: boolean
  status: string
}

export interface BrainAgent {
  key: BrainAgentKey
  /** Foundry's own `agt_...` id. Shown as mono metadata, never used for routing. */
  foundryAgentId: string
  name: string
  whatItDoes: string
  invocation: BrainInvocation
  stage: BrainStage
  status: BrainAgentStatus
  /** Human sentence, not a cron expression — operators read this, not machines. */
  schedule: string | null
  nextRunAt: string | null
  lastRun: BrainRunSummary | null
  /** Empty for every agent the operator cannot start. */
  inputs: BrainAgentInput[]
  /**
   * Whether the Foundry run token actually grants this agent.
   *
   * Separate from `status` (what the agent is) and `invocation` (who may start it). An agent can
   * be live, on-demand, and still unrunnable because the run token was never widened to include
   * it — and until this field existed, the only way to find that out was to start a run and read
   * the refusal out of a 502. Optional so the fixtures and any older payload still typecheck;
   * treat a missing value as "assume runnable", since that was the old behaviour.
   */
  runnable?: boolean
}

// ── Runs ───────────────────────────────────────────────────────────────────

export type BrainRunStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_human'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type BrainRunTrigger = 'dashboard' | 'brain' | 'schedule' | 'slack'

export interface BrainRunSummary {
  runId: string
  agentKey: BrainAgentKey
  agentName: string
  status: BrainRunStatus
  trigger: BrainRunTrigger
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  /** Foundry reports run cost; null while a run is still open. */
  costUsd: number | null
  summary: string | null
}

export interface BrainRunStep {
  key: string
  label: string
  state: 'pending' | 'running' | 'done' | 'skipped' | 'failed'
  detail: string | null
}

export interface BrainRunDetail extends BrainRunSummary {
  input: Record<string, string>
  steps: BrainRunStep[]
  output: BrainRunOutput | null
  error: string | null
}

export type BrainEventLevel = 'info' | 'success' | 'warn' | 'error'

export interface BrainRunEvent {
  /** Monotonic within a run — this is the cursor, exactly like pipeline-bridge. */
  seq: number
  at: string
  level: BrainEventLevel
  message: string
}

export interface BrainEventPage {
  events: BrainRunEvent[]
  cursor: number
  done: boolean
}

// ── Evidence ───────────────────────────────────────────────────────────────

/**
 * DESIGN.md §1: "Trust is visible." Every claim the Brain makes carries where
 * it came from and how fresh it is, so a stale input can never masquerade as a
 * measured fact.
 */
export interface BrainEvidence {
  label: string
  value: string
  source: string
  freshness: string | null
  /** `estimate` and `unknown` must render differently from verified values. */
  provenance: 'measured' | 'estimate' | 'unknown'
}

// ── Agent output ───────────────────────────────────────────────────────────

export interface BrainAllocation {
  product: string
  dailyBudget: number
  previousDailyBudget: number | null
  share: number
  reason: string
  health: 'good' | 'watch' | 'bad' | 'unknown'
}

export interface BrainLearning {
  id: string
  statement: string
  confidence: number
  product: string | null
  evidence: BrainEvidence[]
}

export interface BrainIdea {
  id: string
  title: string
  angle: string
  product: string
  rationale: string
  state: 'proposed' | 'briefed' | 'rejected'
}

export interface BrainFinding {
  id: string
  headline: string
  detail: string
  severity: 'good' | 'watch' | 'bad' | 'neutral'
  metric: string | null
}

export interface BrainReportHighlight {
  label: string
  value: string
  delta: string | null
  direction: 'up' | 'down' | 'flat'
}

export type BrainRunOutput =
  | {
      kind: 'answer'
      headline: string
      body: string
      evidence: BrainEvidence[]
    }
  | {
      kind: 'allocation'
      dailyTotal: number
      rationale: string
      allocations: BrainAllocation[]
    }
  | {
      kind: 'report'
      title: string
      period: string
      /** The designed page the Report Generator publishes. */
      href: string | null
      slackPermalink: string | null
      highlights: BrainReportHighlight[]
      summary: string
    }
  | {
      kind: 'research'
      observationsRead: number
      learnings: BrainLearning[]
      ideas: BrainIdea[]
    }
  | {
      kind: 'analysis'
      findings: BrainFinding[]
      learningsWritten: number
      nextBrief: string | null
    }

// ── Decision ledger ────────────────────────────────────────────────────────

export type BrainDecisionKind =
  | 'budget'
  | 'pause'
  | 'scale'
  | 'creative'
  | 'launch'
  | 'hold'

export interface BrainDecision {
  id: string
  at: string
  kind: BrainDecisionKind
  headline: string
  rationale: string
  product: string | null
  confidence: number
  evidence: BrainEvidence[]
  /**
   * Null until the outcome is actually measured. DESIGN.md §5 requires
   * "recommended / approved / executed / measured" to look different — an
   * unmeasured decision must never be styled as a verified result.
   */
  outcome: {
    state: 'executed' | 'measured'
    label: string
    delta: string | null
    direction: 'up' | 'down' | 'flat'
  } | null
  runId: string | null
  /** What the decision expected to happen, as a sentence. Absent from an older bridge. */
  expected?: string | null
}

// ── The core pipeline ──────────────────────────────────────────────────────

export type BrainStageKey = 'producer' | 'curator' | 'builder' | 'launcher'

export type BrainStageState =
  | 'idle'
  | 'running'
  | 'waiting_for_human'
  | 'done'
  | 'blocked'
  | 'failed'

export interface BrainArtifact {
  id: string
  kind: 'creative' | 'campaign' | 'brief' | 'report'
  label: string
  meta: string | null
  thumbUrl: string | null
  href: string | null
}

export interface BrainPipelineStage {
  key: BrainStageKey
  agentKey: BrainAgentKey
  label: string
  description: string
  state: BrainStageState
  runId: string | null
  detail: string | null
  startedAt: string | null
  finishedAt: string | null
  artifacts: BrainArtifact[]
  /** Set when this stage is what's holding the pipeline up. */
  gateId: string | null
}

export interface BrainPipelineRun {
  pipelineRunId: string
  product: string
  triggeredBy: string
  startedAt: string
  status: BrainRunStatus
  headline: string
  stages: BrainPipelineStage[]
  /** Which budget governs this run, from the brain. Absent/null from an older bridge or brain. */
  budgetAuthority?: BrainBudgetAuthority | null
  /** Every bet this run carries. Absent from an older bridge. */
  bets?: BrainBet[]
}

/**
 * Which budget governs a pipeline run, as the brain states it (`pipeline_run_read` →
 * `budget_authority`). The console shows this rather than adding up the audience plan: the sum is
 * only one of the numbers, and the brain is the one place that compares them.
 */
export interface BrainBudgetAuthority {
  authorisedDailyBudgetInr: number | null
  /** `approval:<id>` or `daily_plan:<date>`, or null when nothing authorises it. */
  source: string | null
  /** The same in words: "The amount approved on gate 48". */
  sourceLabel: string | null
  contractTotalInr: number | null
  /** False: the contract and the authority disagree, and the Builder will not build it. */
  consistent: boolean
  why: string | null
}

// ── Human-in-the-loop gates (the Slack gates, on the platform) ─────────────

/**
 * `plan_approval` was added when the bridge was wired to the real brain, and it is not an
 * invention: `approvals.gate` allows plan | build | launch | scale, and a `plan` gate is the day's
 * spend plan with no campaign attached. Forcing it into `campaign_launch` would have meant
 * rendering a campaign name, budget and placements for something that has none.
 */
export type BrainGateKind =
  | 'creative_craft'
  | 'idea_selection'
  | 'campaign_launch'
  | 'plan_approval'

export interface BrainGateCreative {
  id: string
  label: string
  imageUrl: string | null
  copy: string
  format: string
  language: string
  verdict: 'fit' | 'near_miss' | 'unfit'
  rubric: Array<{ criterion: string; score: number; note: string | null }>
}

export interface BrainGateCampaignLevel {
  label: string
  value: string
  note: string | null
}

export interface BrainGatePlan {
  planDate: string | null
  budgetInr: number | null
  /** The whole review the Brain wrote for a person to read. Presented verbatim, not parsed. */
  summary: string
  /** False means the gate has not reached Slack yet — this console is seeing it first. */
  posted: boolean
}

export interface BrainGateCampaign {
  name: string
  objective: string
  dailyBudget: number
  audience: string
  placements: string
  creatives: BrainGateCreative[]
  levels: BrainGateCampaignLevel[]
  /** Safety checks the Builder ran before asking. */
  checks: Array<{ label: string; passed: boolean; note: string | null }>
}

export type BrainGatePayload =
  | { kind: 'creative_craft'; creatives: BrainGateCreative[] }
  | { kind: 'idea_selection'; ideas: BrainIdea[] }
  | { kind: 'campaign_launch'; campaign: BrainGateCampaign }
  | { kind: 'plan_approval'; plan: BrainGatePlan }

export type BrainGateActionKey = 'approve' | 'reject' | 'revise'

export interface BrainGateAction {
  key: BrainGateActionKey
  label: string
  tone: 'primary' | 'danger' | 'ghost'
  /** `revise` always needs an instruction — that text is what goes back to the agent. */
  requiresNote: boolean
}

export interface BrainGate {
  gateId: string
  kind: BrainGateKind
  title: string
  summary: string
  askedBy: string
  askedAt: string
  product: string | null
  /** The same gate still lives in Slack; we show where, so the two never diverge silently. */
  slackChannel: string | null
  slackPermalink: string | null
  expiresAt: string | null
  runId: string | null
  payload: BrainGatePayload
  actions: BrainGateAction[]
  /** Which selections the agent expects back, for gates that pick from a set. */
  selection: 'none' | 'single' | 'multiple'
  /**
   * The brain's own gate type for a spend gate. `kind` folds build, launch and scale into
   * `campaign_launch`, but what "approve at <amount>" does differs per type.
   */
  spendGate?: BrainSpendGate | null
  /** The pipeline run this gate names, when it names one. A plan gate usually does not. */
  pipelineRunId?: string | null
  /**
   * A PLAN gate's day plan as facts read from the brain (never parsed from the Slack text). Null or
   * absent on other gates and from an older bridge. `structured: false` → render `summaryText`.
   */
  plan?: BrainPlanView | null
  /** A build / launch / scale gate's bets: what the run it releases is testing. */
  bets?: BrainBet[] | null
}

export type BrainSpendGate = 'plan' | 'build' | 'launch' | 'scale'

export interface BrainGateDecisionBody {
  action: BrainGateActionKey
  note?: string
  selectedIds?: string[]
  /**
   * "Approve, but at this daily amount" — the console's equivalent of Slack's `approve at <n>`.
   *
   * Recorded on the approval row as `amount_override_inr`, and on an approved decision the brain
   * ACTS on it, per gate type:
   *   - build gate: the open run's audience budgets are rescaled to sum to this amount, and the
   *     Builder builds from that contract;
   *   - plan gate: the same, but ONLY when the gate names exactly one pipeline run — otherwise
   *     nothing is rescaled and the reason comes back as `budgetRescaleSkipped`;
   *   - launch gate: the Launcher applies it to the live Meta ad-set budget when it activates.
   * What actually happened comes back on `BrainGateDecisionResult`.
   */
  amountOverrideInr?: number
}

/** One contract the brain rescaled because an approval carried an amount. */
export interface BrainBudgetRescale {
  pipelineRunId: string
  source: string | null
  authorisedDailyBudgetInr: number | null
  contractTotalBeforeInr: number | null
  contractTotalInr: number | null
  rescaled: boolean
  why: string | null
  /** Set when a rescaled audience is over Meta's per-ad-set daily cap — Meta will refuse it. */
  exceedsAdsetCap: { capInr: number | null; entries: string[]; note: string | null } | null
}

/**
 * What a decision did beyond being recorded. `budgetRescale` null = the brain said nothing about
 * budgets (no amount, or an older bridge); an empty list = it considered the amount and touched no
 * contract, which is when `budgetRescaleSkipped` says why.
 */
export interface BrainGateDecisionResult {
  ok: true
  budgetRescale?: BrainBudgetRescale[] | null
  budgetRescaleSkipped?: string | null
}

// ── Pulse ──────────────────────────────────────────────────────────────────

export interface BrainAttentionItem {
  id: string
  label: string
  detail: string
  severity: 'good' | 'watch' | 'bad' | 'neutral'
  tab: BrainTabKey | null
}

export interface BrainState {
  generatedAt: string
  /** False means the bridge could not reach Foundry — a designed state, not a blank page. */
  connected: boolean
  brain: {
    status: 'thinking' | 'idle' | 'blocked' | 'offline'
    headline: string
    posture: string
    lastCycleAt: string | null
    nextCycleAt: string | null
    version: string
  }
  budget: {
    dailyTotal: number
    changedAt: string | null
    allocations: BrainAllocation[]
  }
  pipeline: BrainPipelineRun | null
  openGates: number
  agentsLive: number
  agentsTotal: number
  attention: BrainAttentionItem[]
}

// ── Conversation ───────────────────────────────────────────────────────────

/**
 * One turn of a thread with the Brain.
 *
 * A turn is an EXCHANGE, not a message: the user turn and the brain turn answering it carry the
 * same `turnIndex`. That is the brain's own shape (`conversation_turns` is unique on session, turn
 * and role) and flattening it into a message list here would lose which answer belongs to which
 * question the moment two questions are asked in quick succession.
 *
 * A brain turn always carries the run that produced it. An answer that cannot be traced back to
 * what it was read from is the untraceable claim this system refuses, and a conversation is the
 * easiest place for one to hide.
 */
export interface BrainConversationTurn {
  turnIndex: number
  role: 'user' | 'brain'
  content: string
  /** True when the stored turn is longer than what was returned. */
  contentClipped: boolean
  evidenceRefs: string[]
  runId: string | null
}

export interface BrainConversation {
  sessionId: string
  turns: BrainConversationTurn[]
  /** How many older turns exist beyond the ones returned. */
  omittedOlder: number
  lastTurn: number
}

// ── Console navigation ─────────────────────────────────────────────────────

export type BrainTabKey =
  | 'pulse'
  | 'decisions'
  | 'pipeline'
  | 'campaign-run'
  | 'experiments'
  | 'approvals'
  | 'agents'
  | 'conversation'

export const BRAIN_TAB_KEYS: BrainTabKey[] = [
  'pulse',
  'decisions',
  'pipeline',
  'campaign-run',
  'experiments',
  'approvals',
  'agents',
  'conversation',
]

export function isBrainTabKey(value: string | undefined): value is BrainTabKey {
  return !!value && (BRAIN_TAB_KEYS as string[]).includes(value)
}

/* ── The campaign run, in plain language ────────────────────────────────────────
 *
 * The mirror of the same block in the API's `src/foundry-bridge/brain.types.ts`.
 *
 * These shapes exist so this page can show a campaign being built WITHOUT showing how it is
 * built. There is no Foundry run id here, no agent id, no stage-dispatch row and no raw JSON,
 * because none of that helps the person deciding whether to spend the money — and a page that
 * renders `{"ads_wanted":6}` has not explained anything to anyone. Every string below arrives
 * ready to print: the bridge did the translating.
 *
 * The usual rule still holds. A missing score is null, not zero. An unjudged creative has no
 * verdict. Nothing here is padded out to look complete.
 */

/** Colour/urgency for a chip, decided by the bridge so the page never re-derives it. */
export type BrainRunTone = 'progress' | 'waiting' | 'good' | 'bad' | 'idle'

/** One row in the run list. */
export interface BrainCampaignRunSummary {
  runId: string
  product: string
  campaignType: string
  stageLabel: string
  statusLabel: string
  tone: BrainRunTone
  startedOn: string
  updatedAt: string | null
  creativesChosen: number | null
  creativesPlanned: number | null
  isLive: boolean
}

/** One labelled fact from the brief. The page prints label and value, and nothing else. */
export interface BrainBriefField {
  label: string
  value: string
  hint: string | null
}

/** An audience the campaign will run against, described the way a person would say it. */
export interface BrainCampaignAudience {
  name: string
  budget: string | null
  adsPlanned: number | null
  excludes: string | null
  why: string | null
  /** The audience bet this ad set tests. Absent from an older bridge. */
  bet?: BrainBet | null
}

/** One finished creative: the picture, and the words that ship with it. */
export interface BrainCampaignCreative {
  id: string
  /** A short-lived signed link, or null when we hold no key for its bucket. Never a raw S3 URL. */
  imageUrl: string | null
  headline: string | null
  caption: string | null
  description: string | null
  callToAction: string | null
  language: string | null
  statusLabel: string
  tone: BrainRunTone
  score: number | null
  note: string | null
  style: string | null
  /** The idea this ad is testing. Absent from an older bridge. */
  bet?: BrainBet | null
}

/** One of the four steps, named for what it does rather than which agent does it. */
export interface BrainCampaignStep {
  key: BrainStageKey
  label: string
  what: string
  state: BrainStageState
  gateId: string | null
}

export interface BrainCampaignRun extends BrainCampaignRunSummary {
  headline: string
  steps: BrainCampaignStep[]
  brief: BrainBriefField[]
  audiences: BrainCampaignAudience[]
  whatHappened: string | null
  needsYou: string | null
  /** Which budget governs this run and whether its contract agrees. Absent from an older bridge. */
  budgetAuthority?: BrainBudgetAuthority | null
}

/* ── Experiments (the brain's hypotheses), in plain language ─────────────────────
 *
 * Mirrors marketing-agent src/foundry-bridge/brain.types.ts. Every string is already the sentence
 * a marketer reads; the page never re-derives a label. `ref` and `productKey` are opaque — `ref`
 * belongs in <Details> only, `productKey` is only a filter value.
 */

/** testing = planned + testing now · learned = worked + didn't work · dropped = dropped + no clear answer. */
export type BrainExperimentView = 'testing' | 'learned' | 'dropped'

export type BrainExperimentTone = 'progress' | 'waiting' | 'good' | 'bad' | 'idle'

export interface BrainExperimentProgress {
  spentInr: number
  neededInr: number | null
  impressions: number
  neededImpressions: number | null
  /** Days until the test's time is up; 0 once passed; null before it has started. */
  daysLeft: number | null
  /** "Still collecting results." or null. */
  note: string | null
}

export interface BrainExperimentResult {
  /** "It worked: 2.1% vs 1.4% click rate." */
  sentence: string
  /** "Early signal" | "Fairly sure" | "Confident" | null. */
  confidenceLabel: string | null
}

export interface BrainExperiment {
  ref: string
  productKey: string | null
  product: string | null
  levelLabel: string
  claim: string
  kindLabel: string
  kind: 'proven' | 'variant' | 'seed' | 'other'
  statusLabel: string
  statusMeaning: string
  tone: BrainExperimentTone
  progress: BrainExperimentProgress | null
  result: BrainExperimentResult | null
  /** Human date ("Today", "24 Sep"). */
  since: string | null
  /** ISO — sorting only, never displayed. */
  sinceAt: string | null
  /** A new twist: what it changes from the idea it builds on. */
  change?: string | null
  /** How many ads / ad sets / live campaigns carry it; null when nothing is attached yet. */
  carriedBy?: BrainBetCarriers | null
}

export interface BrainBetCarriers {
  ads: number
  adSets: number
  campaigns: number
  /** "Carried by 3 ads and 1 live campaign." */
  sentence: string
}

/** A bet shown beside whatever tests it — a creative, an ad set, a gate, a decision, a campaign. */
export interface BrainBet {
  /** Opaque — <Details> only. */
  ref: string
  claim: string
  kind: 'proven' | 'variant' | 'seed' | 'other'
  kindLabel: string
  levelLabel: string
  statusLabel: string
  statusMeaning: string
  tone: BrainExperimentTone
  product: string | null
  change: string | null
  carriedBy: BrainBetCarriers | null
  result: BrainExperimentResult | null
}

export interface BrainExperimentPage {
  experiments: BrainExperiment[]
  /** The brain had more than it could return; the list is the newest part. */
  truncated: boolean
}

export interface BrainProvenIdea {
  ref: string
  productKey: string | null
  product: string | null
  levelLabel: string
  /** "Ads that open with a question." */
  idea: string
  /** "Proven" | "Promising" | "Didn't work". */
  tierLabel: string
  tone: BrainExperimentTone
  /** "Worked in 3 tests, failed in 1." */
  evidence: string
  confirmations: number
  refutations: number
}

export interface BrainProvenCatalogue {
  proven: BrainProvenIdea[]
  refuted: BrainProvenIdea[]
  empty: boolean
  truncated: boolean
}

export interface BrainCampaignBets {
  found: boolean
  bets: BrainBet[]
  /** "Friday, 2 Oct" or null. */
  protectedUntil: string | null
  protectedUntilAt: string | null
  note: string | null
}

export interface BrainDecisionBets {
  expected: string | null
  bets: BrainBet[]
}

export interface BrainExperimentProductCount {
  productKey: string
  product: string
  testing: number
  learned: number
  dropped: number
}

export interface BrainExperimentSummary {
  views: Record<BrainExperimentView, number>
  products: BrainExperimentProductCount[]
  /** True when a count is a floor because the brain cut a read short. */
  partial: boolean
  /** Tests that got an answer in the last 7 days; null/absent when unknown. */
  learnedThisWeek?: number | null
}

/* ── A plan gate, as facts ─────────────────────────────────────────────────────── */

export interface BrainPlanAudience {
  name: string
  budgetInr: number | null
  /** The ad set's audience bet as a sentence, or null. */
  bet: string | null
}

export interface BrainPlanRun {
  product: string
  /** Absent from an older bridge. */
  bets?: BrainPlanClaim[]
  audiences?: BrainPlanAudience[]
  typeLabel: string
  dailyBudgetInr: number | null
  creatives: number | null
  adSets: number | null
}

export interface BrainPlanClaim {
  claim: string
  kindLabel: string
  levelLabel: string
  product: string | null
}

export interface BrainPlanView {
  /** "Friday, 25 Sep". */
  dateLabel: string | null
  totalDailyInr: number | null
  budgetInr: number | null
  unspentInr: number | null
  runs: BrainPlanRun[]
  testing: BrainPlanClaim[]
  /** "4 proven ideas, 2 new twists". */
  mix: string | null
  why: string | null
  /** False → the brain rows were unreadable; render `summaryText`. */
  structured: boolean
  /** The gate text without the Slack reply line or internal ids. Always present. */
  summaryText: string
}
