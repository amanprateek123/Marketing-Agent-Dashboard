/**
 * In-browser stand-in for the Foundry bridge.
 *
 * The NestJS `foundry-bridge` does not exist yet, so the console talks to this
 * instead. It is deliberately STATEFUL rather than a static blob: approving a
 * gate has to remove it, starting a run has to produce a run that visibly
 * progresses, and the pipeline has to advance when its gate is cleared.
 * A frozen fixture would let us ship a page that looks right and falls over the
 * moment real data moves.
 *
 * Runs progress on wall-clock: each scripted event carries an offset from the
 * run's start, and `readRun` / `readEvents` derive state from elapsed time. No
 * timers, so nothing leaks if the operator navigates away mid-run.
 *
 * Everything here is swapped out wholesale by flipping NEXT_PUBLIC_BRAIN_MOCK
 * to "false"; no component imports this file.
 */

import type {
  BrainAgent,
  BrainTrigger,
  BrainAgentKey,
  BrainConversation,
  BrainConversationTurn,
  BrainDecision,
  BrainEventPage,
  BrainGate,
  BrainGateDecisionBody,
  BrainPipelineRun,
  BrainRunDetail,
  BrainRunEvent,
  BrainRunOutput,
  BrainRunStatus,
  BrainRunSummary,
  BrainState,
} from '@/types/brain'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

function isoIn(ms: number): string {
  return new Date(Date.now() + ms).toISOString()
}

// ── Scripted runs ──────────────────────────────────────────────────────────

interface ScriptedEvent {
  offsetMs: number
  level: BrainRunEvent['level']
  message: string
}

interface RunScript {
  steps: Array<{ key: string; label: string; atMs: number }>
  events: ScriptedEvent[]
  totalMs: number
  output: (input: Record<string, string>) => BrainRunOutput
}

const SCRIPTS: Record<string, RunScript> = {
  brain: {
    totalMs: 14_000,
    steps: [
      { key: 'context', label: 'Loading product context and ledger', atMs: 0 },
      { key: 'evidence', label: 'Reading campaign evidence', atMs: 3_500 },
      { key: 'reason', label: 'Reasoning over the question', atMs: 7_000 },
      { key: 'answer', label: 'Writing the answer with its evidence', atMs: 11_000 },
    ],
    events: [
      { offsetMs: 400, level: 'info', message: 'Run accepted by Foundry · Brain — Marketing Head (91astro)' },
      { offsetMs: 1_800, level: 'info', message: 'Loaded 4 product contexts and 312 ledger entries' },
      { offsetMs: 4_200, level: 'info', message: 'Read 18 campaigns, 61 snapshots, 44 learnings' },
      { offsetMs: 7_600, level: 'warn', message: 'Kundli Report purchase value is Meta-attributed only — flagged as estimate' },
      { offsetMs: 10_400, level: 'info', message: 'Composed answer from 6 pieces of evidence' },
      { offsetMs: 13_400, level: 'success', message: 'Answer written to the decision ledger' },
    ],
    output: (input) => ({
      kind: 'answer',
      headline: 'Hold Kundli Report flat and move ₹1,800/day into Matchmaking.',
      body:
        (input.question ? `You asked: “${input.question}”\n\n` : '') +
        'Matchmaking has been the only product clearing breakeven for eleven straight days, on a cost per lead that has fallen 22% while volume held. Kundli Report is still converting, but its cost per lead has drifted up for six days and the last two creative batches were curated as near-misses rather than fits — that is a creative problem, not a budget problem, so more spend would buy more of the same result.\n\n' +
        'I am holding Kundli Report at its current ₹4,200/day and moving ₹1,800/day of the unallocated headroom into Matchmaking, where the evidence supports it. I have briefed a fresh creative batch for Kundli Report on a new angle; if it curates as a fit I will revisit the split.',
      evidence: [
        { label: 'Matchmaking cost per lead', value: '₹186 (−22% over 11d)', source: 'Meta Ads · deep sync', freshness: '2h ago', provenance: 'measured' },
        { label: 'Matchmaking days above breakeven', value: '11 consecutive', source: 'Brain ledger', freshness: '2h ago', provenance: 'measured' },
        { label: 'Kundli Report cost per lead', value: '₹341 (+17% over 6d)', source: 'Meta Ads · deep sync', freshness: '2h ago', provenance: 'measured' },
        { label: 'Kundli Report purchase value', value: '₹1.84L', source: 'Meta attribution', freshness: '2h ago', provenance: 'estimate' },
        { label: 'Last 2 Kundli creative batches', value: 'Curated near-miss', source: 'Creative Curator', freshness: '1d ago', provenance: 'measured' },
        { label: 'Unallocated daily headroom', value: '₹1,800', source: 'Budget guard', freshness: 'live', provenance: 'measured' },
      ],
    }),
  },
  'competitor-research': {
    totalMs: 18_000,
    steps: [
      { key: 'intake', label: 'Reading supplied observations', atMs: 0 },
      { key: 'structure', label: 'Structuring into evidence', atMs: 4_000 },
      { key: 'learnings', label: 'Writing learnings into the brain', atMs: 9_500 },
      { key: 'ideas', label: 'Proposing product-specific ideas', atMs: 14_000 },
    ],
    events: [
      { offsetMs: 500, level: 'info', message: 'Run accepted by Foundry · Competitor Research (91astro)' },
      { offsetMs: 2_400, level: 'info', message: 'Parsed 9 competitor observations' },
      { offsetMs: 5_600, level: 'warn', message: '2 observations had no dated source — recorded as unknown provenance' },
      { offsetMs: 10_200, level: 'success', message: 'Wrote 3 learnings to the 91astro brain' },
      { offsetMs: 15_100, level: 'success', message: 'Proposed 4 product-specific ideas' },
      { offsetMs: 17_500, level: 'success', message: 'Run complete' },
    ],
    output: () => ({
      kind: 'research',
      observationsRead: 9,
      learnings: [
        {
          id: 'lrn-c-1',
          statement: 'Competitors are leading with a free sample reading rather than a price point; every ad in the set opens on the artefact, not the offer.',
          confidence: 0.82,
          product: 'Kundli Report',
          evidence: [
            { label: 'Ads observed', value: '6 of 9 open on a sample artefact', source: 'Meta Ads Library', freshness: '1d ago', provenance: 'measured' },
            { label: 'Longest-running variant', value: '74 days live', source: 'Meta Ads Library', freshness: '1d ago', provenance: 'measured' },
          ],
        },
        {
          id: 'lrn-c-2',
          statement: 'Hindi-first creative is running unpaired with English in the same ad set, suggesting they let Meta arbitrate language rather than splitting the budget.',
          confidence: 0.61,
          product: null,
          evidence: [
            { label: 'Language pairs seen', value: '4 ad sets, mixed', source: 'Meta Ads Library', freshness: '1d ago', provenance: 'estimate' },
          ],
        },
        {
          id: 'lrn-c-3',
          statement: 'Nobody in the observed set is running video. The entire category is static-image right now.',
          confidence: 0.74,
          product: null,
          evidence: [
            { label: 'Video ads observed', value: '0 of 9', source: 'Meta Ads Library', freshness: '1d ago', provenance: 'measured' },
          ],
        },
      ],
      ideas: [
        { id: 'idea-c-1', title: 'Sample-first Kundli hook', angle: 'Artefact reveal', product: 'Kundli Report', rationale: 'Mirror the category opener but with our own chart art, which is stronger than anything in the observed set.', state: 'proposed' },
        { id: 'idea-c-2', title: 'Motion in a static category', angle: 'Movement', product: 'Kundli Report', rationale: 'Zero observed competitors run video — a 6s motion ad would be the only moving thing in the feed.', state: 'proposed' },
        { id: 'idea-c-3', title: 'Hindi-dedicated ad set', angle: 'Language split', product: 'Matchmaking', rationale: 'Split rather than arbitrate; our own data already shows Hindi converting at a different cost per lead.', state: 'proposed' },
        { id: 'idea-c-4', title: 'Compatibility score teaser', angle: 'Curiosity gap', product: 'Matchmaking', rationale: 'Nothing in the observed set teases a number. A score withheld is a strong hook.', state: 'proposed' },
      ],
    }),
  },
  'campaign-report': {
    totalMs: 12_000,
    steps: [
      { key: 'read', label: 'Reading the Monitor’s latest findings', atMs: 0 },
      { key: 'compose', label: 'Composing the report page', atMs: 4_500 },
      { key: 'publish', label: 'Publishing and posting to Slack', atMs: 9_000 },
    ],
    events: [
      { offsetMs: 400, level: 'info', message: 'Run accepted by Foundry · Campaign Report Generator (91astro)' },
      { offsetMs: 1_900, level: 'info', message: 'Read campaigns, snapshots, ledger and learnings from the brain' },
      { offsetMs: 3_100, level: 'info', message: 'No Meta calls made — zero cost against the ad account rate limit' },
      { offsetMs: 7_400, level: 'info', message: 'Rendered the report page' },
      { offsetMs: 11_300, level: 'success', message: 'Posted summary to #91astro-marketing' },
    ],
    output: () => ({
      kind: 'report',
      title: 'Weekly performance readout',
      period: 'Last 7 days',
      href: null,
      slackPermalink: null,
      summary:
        'Spend held steady while cost per lead fell 12% overall, carried almost entirely by Matchmaking. Kundli Report is the drag: its cost per lead rose for a sixth day and two creative batches failed the craft gate. One campaign was paused by the Spend Guard for breaching its threshold.',
      highlights: [
        { label: 'Spend', value: '₹58,400', delta: '+2%', direction: 'flat' },
        { label: 'Leads', value: '241', delta: '+16%', direction: 'up' },
        { label: 'Cost per lead', value: '₹242', delta: '−12%', direction: 'up' },
        { label: 'Campaigns paused', value: '1', delta: 'by Spend Guard', direction: 'down' },
      ],
    }),
  },
  'performance-analyst': {
    totalMs: 20_000,
    steps: [
      { key: 'live', label: 'Reading what actually went live', atMs: 0 },
      { key: 'vision', label: 'Inspecting the creative images', atMs: 5_000 },
      { key: 'history', label: 'Cross-reading accumulated history', atMs: 10_500 },
      { key: 'brief', label: 'Authoring the next creative brief', atMs: 15_500 },
    ],
    events: [
      { offsetMs: 500, level: 'info', message: 'Run accepted by Foundry · Performance and Self Data Analyst (91astro)' },
      { offsetMs: 2_700, level: 'info', message: 'Loaded 14 live ads with CTR, CPL and spend' },
      { offsetMs: 6_300, level: 'info', message: 'Vision pass over 14 creative images complete' },
      { offsetMs: 9_100, level: 'warn', message: '3 ads share the same hook and are competing with each other' },
      { offsetMs: 13_800, level: 'success', message: 'Wrote 5 learnings' },
      { offsetMs: 18_900, level: 'success', message: 'Authored the next creative brief' },
    ],
    output: () => ({
      kind: 'analysis',
      learningsWritten: 5,
      nextBrief:
        'Kundli Report, Hindi, static 4:5. Open on the chart artefact itself rather than a person. Withhold the reading — the hook is the artefact plus a question, not an answer. Avoid the "know your future" phrasing; three live ads already share it and are splitting the same audience.',
      findings: [
        { id: 'f1', headline: 'Three ads are competing for the same audience', detail: 'Ads 4, 7 and 11 all run the "know your future" hook against overlapping interests. Combined they spend ₹9,100/day and none has broken out.', severity: 'bad', metric: 'Hook overlap' },
        { id: 'f2', headline: 'The chart-artefact visual outperforms the portrait visual', detail: 'Across 6 matched pairs, artefact-led creative holds a 1.7x CTR advantage at comparable spend.', severity: 'good', metric: 'CTR 2.4% vs 1.4%' },
        { id: 'f3', headline: 'Hindi cost per lead is 31% below English', detail: 'Consistent across both products and four weeks. The budget split does not reflect this yet.', severity: 'good', metric: '₹181 vs ₹263' },
        { id: 'f4', headline: 'Purchase value for Kundli Report is Meta-attributed only', detail: 'No server-side confirmation, so every ROAS figure for this product is an estimate, not a measurement.', severity: 'watch', metric: 'Provenance' },
        { id: 'f5', headline: 'Creative refresh cadence has slipped to 19 days', detail: 'Past winners decayed after roughly 12 days. The current cadence is running ads past their useful life.', severity: 'watch', metric: '19d vs 12d' },
      ],
    }),
  },
}

// ── Seed data ──────────────────────────────────────────────────────────────

function seedAgents(): BrainAgent[] {
  return [
    {
      key: 'brain',
      // Brain **v2**, and that is a correction: this said `agt_01a06ffb…` — v1 — which is the
      // Brain that records no goal, reason or evidence with a decision and cannot hold a thread.
      // The bridge targets v2; a fixture pointing elsewhere would make mock and live disagree
      // about which Brain this console is even for.
      foundryAgentId: 'agt_01a08a637be471038bba2efa34cb8c92',
      name: 'Brain — Marketing Head',
      whatItDoes:
        'The autonomous marketing head. Allocates the daily budget across products, consolidates results into product context, records every decision with its evidence, and answers questions about strategy.',
      invocation: 'on_demand',
      stage: 'understand',
      status: 'live',
      schedule: 'Every day at 06:00 IST, and after each deep sync',
      nextRunAt: isoIn(4 * HOUR + 12 * MINUTE),
      lastRun: null,
      inputs: [
        {
          key: 'question',
          label: 'What do you want to ask the Brain?',
          hint: 'Strategy questions it can answer from the ledger, product context and campaign evidence.',
          type: 'textarea',
          required: true,
          placeholder: 'Should we keep spending on Kundli Report, or move that budget to Matchmaking?',
        },
        {
          key: 'scope',
          label: 'Scope',
          type: 'select',
          required: false,
          defaultValue: 'all',
          options: [
            { value: 'all', label: 'All products' },
            { value: 'kundli', label: 'Kundli Report' },
            { value: 'matchmaking', label: 'Matchmaking' },
            { value: 'consultation', label: 'Consultation' },
          ],
        },
      ],
    },
    {
      key: 'competitor-research',
      foundryAgentId: 'agt_01a06ca170ae7050a4a76a9638a3c99d',
      name: 'Competitor Research',
      whatItDoes:
        'Structures supplied competitor observations into evidence-backed learnings and proposed product-specific ideas. Reports missing observations as partial rather than inventing them.',
      invocation: 'on_demand',
      stage: 'understand',
      status: 'live',
      schedule: null,
      nextRunAt: null,
      lastRun: null,
      inputs: [
        {
          key: 'observations',
          label: 'Competitor observations',
          hint: 'One per line. Ad copy, a screenshot description, an Ads Library link — whatever you actually saw.',
          type: 'textarea',
          required: true,
          placeholder: 'AstroTalk — carousel, Hindi, opens on a sample kundli chart, 74 days live\nGaneshaSpeaks — static 1:1, English, price-led (₹99 first reading)',
        },
        {
          key: 'product',
          label: 'Product to focus on',
          type: 'select',
          required: false,
          defaultValue: 'all',
          options: [
            { value: 'all', label: 'All products' },
            { value: 'kundli', label: 'Kundli Report' },
            { value: 'matchmaking', label: 'Matchmaking' },
          ],
        },
      ],
    },
    {
      key: 'performance-analyst',
      foundryAgentId: 'agt_01a06cab76527a52b8e5c1563d3665ae',
      name: 'Performance & Self Data Analyst',
      whatItDoes:
        'Analyses what actually went live and how it performed — CTR, CPL, spend and the creative image itself — alongside the brain’s accumulated history, then writes learnings and authors the next creative brief.',
      invocation: 'on_demand',
      stage: 'improve',
      status: 'live',
      schedule: 'Every day at 07:00 IST',
      nextRunAt: isoIn(5 * HOUR + 12 * MINUTE),
      lastRun: null,
      inputs: [
        {
          key: 'window',
          label: 'Window to analyse',
          type: 'select',
          required: false,
          defaultValue: '7',
          options: [
            { value: '7', label: 'Last 7 days' },
            { value: '14', label: 'Last 14 days' },
            { value: '30', label: 'Last 30 days' },
          ],
        },
        {
          key: 'focus',
          label: 'Anything specific to look at?',
          hint: 'Optional. Left blank, it analyses everything that went live in the window.',
          type: 'text',
          required: false,
          placeholder: 'Why did the Hindi ad set stall?',
        },
      ],
    },
    {
      key: 'campaign-report',
      foundryAgentId: 'agt_01a06cab88347d609c3c5d8233ae2545',
      name: 'Campaign Report Generator',
      whatItDoes:
        'Turns the Campaign Monitor’s latest findings into a shareable performance report — a designed page for the team, plus a short summary posted to Slack. Reads the brain rather than Meta, so it costs nothing against the ad account’s rate limit.',
      invocation: 'on_demand',
      stage: 'prove',
      status: 'live',
      schedule: 'Every Monday at 09:00 IST',
      nextRunAt: isoIn(2 * 24 * HOUR),
      lastRun: null,
      inputs: [
        {
          key: 'period',
          label: 'Reporting period',
          type: 'select',
          required: false,
          defaultValue: '7',
          options: [
            { value: '7', label: 'Last 7 days' },
            { value: '30', label: 'Last 30 days' },
            { value: '90', label: 'Last 90 days' },
          ],
        },
        {
          key: 'audience',
          label: 'Who is this for?',
          hint: 'Changes how much mechanism the report explains.',
          type: 'select',
          required: false,
          defaultValue: 'team',
          options: [
            { value: 'team', label: 'The marketing team' },
            { value: 'founder', label: 'Founders — outcomes only' },
          ],
        },
      ],
    },
    {
      key: 'creative-producer',
      foundryAgentId: 'agt_01a06cab057578d391774dd3b5d505d2',
      name: 'Creative Batch Producer',
      whatItDoes:
        'Turns a briefed idea into a batch of finished creatives via the creative MCP, choosing the research or direct route and the raw or polished track, and records every creative in the brain.',
      invocation: 'brain_triggered',
      stage: 'create',
      status: 'live',
      schedule: null,
      nextRunAt: null,
      lastRun: null,
      inputs: [],
    },
    {
      key: 'creative-curator',
      foundryAgentId: 'agt_01a06cab17a2711188d3271c904a52ce',
      name: 'Creative Curator',
      whatItDoes:
        'Judges a finished batch of creatives against a quality rubric, decides which are fit to go live, sends near-misses back for revision, and writes a sequential creative quality report into the brain.',
      invocation: 'brain_triggered',
      stage: 'create',
      status: 'live',
      schedule: null,
      nextRunAt: null,
      lastRun: null,
      inputs: [],
    },
    {
      key: 'campaign-builder',
      foundryAgentId: 'agt_01a06cab3042723089ba8b9184682cd1',
      name: 'Campaign Builder',
      whatItDoes:
        'Builds a complete Meta lead-gen campaign for an approved creative — campaign, ad set and ad — leaving everything PAUSED, and records it in the brain for a separate human-gated launch.',
      invocation: 'brain_triggered',
      stage: 'control',
      status: 'live',
      schedule: null,
      nextRunAt: null,
      lastRun: null,
      inputs: [],
    },
    {
      key: 'campaign-launcher',
      foundryAgentId: 'agt_01a06cab48557860a97f5ceac20acdba',
      name: 'Campaign Launcher',
      whatItDoes:
        'Presents a fully-built paused campaign for human approval with its creative, copy, audiences and budget, then activates every level in Meta and records who approved it.',
      invocation: 'brain_triggered',
      stage: 'control',
      status: 'live',
      schedule: null,
      nextRunAt: null,
      lastRun: null,
      inputs: [],
    },
  ]
}

function seedHistory(): BrainRunSummary[] {
  return [
    {
      runId: 'run_h_9f21',
      agentKey: 'brain',
      agentName: 'Brain — Marketing Head',
      status: 'succeeded',
      trigger: 'schedule',
      startedAt: isoAgo(2 * HOUR + 4 * MINUTE),
      finishedAt: isoAgo(2 * HOUR),
      durationMs: 4 * MINUTE,
      costUsd: 0.42,
      summary: 'Daily allocation set. ₹1,800/day moved into Matchmaking; Kundli Report held flat pending a fresh creative batch.',
    },
    {
      runId: 'run_h_8c04',
      agentKey: 'performance-analyst',
      agentName: 'Performance & Self Data Analyst',
      status: 'succeeded',
      trigger: 'schedule',
      startedAt: isoAgo(3 * HOUR + 11 * MINUTE),
      finishedAt: isoAgo(3 * HOUR),
      durationMs: 11 * MINUTE,
      costUsd: 1.18,
      summary: '5 learnings written. Flagged three live ads sharing one hook and competing for the same audience.',
    },
    {
      runId: 'run_h_7b55',
      agentKey: 'creative-producer',
      agentName: 'Creative Batch Producer',
      status: 'succeeded',
      trigger: 'brain',
      startedAt: isoAgo(5 * HOUR + 26 * MINUTE),
      finishedAt: isoAgo(5 * HOUR),
      durationMs: 26 * MINUTE,
      costUsd: 3.94,
      summary: '6 creatives produced on the polished track for Kundli Report, Hindi.',
    },
    {
      runId: 'run_h_6a18',
      agentKey: 'campaign-report',
      agentName: 'Campaign Report Generator',
      status: 'succeeded',
      trigger: 'schedule',
      startedAt: isoAgo(26 * HOUR),
      finishedAt: isoAgo(26 * HOUR - 3 * MINUTE),
      durationMs: 3 * MINUTE,
      costUsd: 0.21,
      summary: 'Weekly readout published and posted to #91astro-marketing.',
    },
    {
      runId: 'run_h_5d72',
      agentKey: 'competitor-research',
      agentName: 'Competitor Research',
      status: 'failed',
      trigger: 'dashboard',
      startedAt: isoAgo(2 * 24 * HOUR),
      finishedAt: isoAgo(2 * 24 * HOUR - 90_000),
      durationMs: 90_000,
      costUsd: 0.08,
      summary: 'No observations supplied — returned partial without writing, as designed.',
    },
  ]
}

function seedDecisions(): BrainDecision[] {
  return [
    {
      id: 'dec_1',
      at: isoAgo(2 * HOUR),
      kind: 'budget',
      headline: 'Moved ₹1,800/day from unallocated headroom into Matchmaking',
      rationale:
        'Eleven consecutive days above breakeven on a falling cost per lead. The headroom was doing nothing and this is the only product with evidence to absorb it.',
      product: 'Matchmaking',
      confidence: 0.86,
      evidence: [
        { label: 'Days above breakeven', value: '11 consecutive', source: 'Brain ledger', freshness: '2h ago', provenance: 'measured' },
        { label: 'Cost per lead trend', value: '−22% over 11d', source: 'Meta Ads · deep sync', freshness: '2h ago', provenance: 'measured' },
      ],
      outcome: { state: 'measured', label: 'Cost per lead held after the increase', delta: '−4%', direction: 'up' },
      runId: 'run_h_9f21',
    },
    {
      id: 'dec_2',
      at: isoAgo(2 * HOUR + 1 * MINUTE),
      kind: 'hold',
      headline: 'Held Kundli Report flat rather than cutting it',
      rationale:
        'Cost per lead is drifting up, but the last two creative batches were curated as near-misses. That is a creative problem — cutting budget would hide it rather than fix it. Briefed a fresh batch on a new angle instead.',
      product: 'Kundli Report',
      confidence: 0.71,
      evidence: [
        { label: 'Cost per lead trend', value: '+17% over 6d', source: 'Meta Ads · deep sync', freshness: '2h ago', provenance: 'measured' },
        { label: 'Last 2 batches', value: 'Curated near-miss', source: 'Creative Curator', freshness: '1d ago', provenance: 'measured' },
        { label: 'Purchase value', value: '₹1.84L', source: 'Meta attribution', freshness: '2h ago', provenance: 'estimate' },
      ],
      outcome: { state: 'executed', label: 'Fresh batch briefed, awaiting the craft gate', delta: null, direction: 'flat' },
      runId: 'run_h_9f21',
    },
    {
      id: 'dec_3',
      at: isoAgo(9 * HOUR),
      kind: 'pause',
      headline: 'Paused “Kundli · Hindi · Portrait v3” for breaching its CPL threshold',
      rationale:
        'Cost per lead reached ₹512 against a ₹380 threshold with 2,100 impressions of delivery. Past that volume the signal is real, not noise.',
      product: 'Kundli Report',
      confidence: 0.94,
      evidence: [
        { label: 'Cost per lead', value: '₹512 vs ₹380 threshold', source: 'Campaign Monitor', freshness: '9h ago', provenance: 'measured' },
        { label: 'Impressions at pause', value: '2,100', source: 'Meta Ads', freshness: '9h ago', provenance: 'measured' },
      ],
      outcome: { state: 'measured', label: 'Spend avoided since pause', delta: '₹4,300', direction: 'up' },
      runId: null,
    },
    {
      id: 'dec_4',
      at: isoAgo(28 * HOUR),
      kind: 'creative',
      headline: 'Sent 4 of 6 creatives back for revision at the craft gate',
      rationale:
        'Copy and image disagreed on the offer in all four. The rubric treats image-copy incoherence as a hard fail because it survives into the ad and reads as carelessness.',
      product: 'Kundli Report',
      confidence: 0.88,
      evidence: [
        { label: 'Rubric failures', value: '4 of 6 on coherence', source: 'Creative Curator', freshness: '1d ago', provenance: 'measured' },
      ],
      outcome: { state: 'measured', label: 'Revised batch scored', delta: '+1.4 avg', direction: 'up' },
      runId: null,
    },
    {
      id: 'dec_5',
      at: isoAgo(3 * 24 * HOUR),
      kind: 'scale',
      headline: 'Doubled the Matchmaking Hindi ad set from ₹2,000 to ₹4,000/day',
      rationale:
        'Hindi cost per lead ran 31% below English for four straight weeks across both products. The split did not reflect that.',
      product: 'Matchmaking',
      confidence: 0.79,
      evidence: [
        { label: 'Hindi vs English CPL', value: '₹181 vs ₹263', source: 'Performance Analyst', freshness: '3d ago', provenance: 'measured' },
        { label: 'Weeks consistent', value: '4', source: 'Brain ledger', freshness: '3d ago', provenance: 'measured' },
      ],
      outcome: { state: 'measured', label: 'Cost per lead after scaling', delta: '₹192 (+6%)', direction: 'flat' },
      runId: null,
    },
  ]
}

function creativeSet(): BrainGate['payload'] {
  return {
    kind: 'creative_craft',
    creatives: [
      {
        id: 'cr_1',
        label: 'Chart artefact · Hindi · 4:5',
        imageUrl: null,
        copy: 'आपकी कुंडली क्या कहती है? पूरी रिपोर्ट, आज ही।',
        format: 'Static 4:5',
        language: 'Hindi',
        verdict: 'fit',
        rubric: [
          { criterion: 'Image-copy coherence', score: 5, note: 'Chart art and the question agree.' },
          { criterion: 'Hook strength', score: 4, note: null },
          { criterion: 'Brand fit', score: 5, note: null },
          { criterion: 'Legibility at feed size', score: 4, note: null },
        ],
      },
      {
        id: 'cr_2',
        label: 'Chart artefact · Hindi · 1:1',
        imageUrl: null,
        copy: 'कुंडली में छिपा है आपका जवाब।',
        format: 'Static 1:1',
        language: 'Hindi',
        verdict: 'fit',
        rubric: [
          { criterion: 'Image-copy coherence', score: 5, note: null },
          { criterion: 'Hook strength', score: 5, note: 'Withholds the answer — strongest of the batch.' },
          { criterion: 'Brand fit', score: 4, note: null },
          { criterion: 'Legibility at feed size', score: 5, note: null },
        ],
      },
      {
        id: 'cr_3',
        label: 'Portrait · Hindi · 4:5',
        imageUrl: null,
        copy: 'जानिए अपना भविष्य — विशेषज्ञ ज्योतिषी से।',
        format: 'Static 4:5',
        language: 'Hindi',
        verdict: 'near_miss',
        rubric: [
          { criterion: 'Image-copy coherence', score: 3, note: 'Copy promises an expert; the image shows no one.' },
          { criterion: 'Hook strength', score: 2, note: 'Three live ads already run this phrasing.' },
          { criterion: 'Brand fit', score: 4, note: null },
          { criterion: 'Legibility at feed size', score: 4, note: null },
        ],
      },
    ],
  }
}

function seedGates(): BrainGate[] {
  return [
    {
      gateId: 'gate_launch_1',
      kind: 'campaign_launch',
      title: 'Launch “Kundli · Hindi · Artefact v1”?',
      summary:
        'Built and paused in Meta. Every level is ready; nothing spends until you approve. Two creatives passed the craft gate.',
      askedBy: 'Campaign Launcher',
      askedAt: isoAgo(38 * MINUTE),
      product: 'Kundli Report',
      slackChannel: '#91astro-marketing',
      slackPermalink: null,
      expiresAt: isoIn(22 * HOUR),
      runId: null,
      selection: 'none',
      payload: {
        kind: 'campaign_launch',
        campaign: {
          name: '91astro · Kundli · Hindi · Artefact · lead-gen',
          objective: 'OUTCOME_LEADS',
          dailyBudget: 3_000,
          audience: 'India · 25–44 · Hindi · astrology & spirituality interests · excl. purchasers 90d',
          placements: 'Feed, Reels, Explore (automatic within Instagram + Facebook)',
          creatives: [
            {
              id: 'cr_1',
              label: 'Chart artefact · Hindi · 4:5',
              imageUrl: null,
              copy: 'आपकी कुंडली क्या कहती है? पूरी रिपोर्ट, आज ही।',
              format: 'Static 4:5',
              language: 'Hindi',
              verdict: 'fit',
              rubric: [],
            },
            {
              id: 'cr_2',
              label: 'Chart artefact · Hindi · 1:1',
              imageUrl: null,
              copy: 'कुंडली में छिपा है आपका जवाब।',
              format: 'Static 1:1',
              language: 'Hindi',
              verdict: 'fit',
              rubric: [],
            },
          ],
          levels: [
            { label: 'Campaign', value: 'Created · PAUSED', note: 'Lead generation, CBO off' },
            { label: 'Ad set', value: 'Created · PAUSED', note: '₹3,000/day, 7-day click attribution' },
            { label: 'Ads', value: '2 created · PAUSED', note: 'One per approved creative' },
          ],
          checks: [
            { label: 'Daily budget within the guard’s ceiling', passed: true, note: '₹3,000 of ₹6,000 headroom' },
            { label: 'Targeting validated before reaching Meta', passed: true, note: null },
            { label: 'UTM tagging applied to ad links', passed: true, note: null },
            { label: 'Server-side purchase confirmation', passed: false, note: 'Not wired for this product — ROAS will be Meta-attributed only' },
          ],
        },
      },
      actions: [
        { key: 'approve', label: 'Approve and launch', tone: 'primary', requiresNote: false },
        { key: 'revise', label: 'Send back with a note', tone: 'ghost', requiresNote: true },
        { key: 'reject', label: 'Reject', tone: 'danger', requiresNote: true },
      ],
    },
    {
      gateId: 'gate_craft_1',
      kind: 'creative_craft',
      title: 'Craft gate — Kundli Report batch of 3',
      summary:
        'The Curator judged this batch against the rubric. Two are fit to go live; one is a near-miss it would send back for revision.',
      askedBy: 'Creative Curator',
      askedAt: isoAgo(1 * HOUR + 14 * MINUTE),
      product: 'Kundli Report',
      slackChannel: '#91astro-creative',
      slackPermalink: null,
      expiresAt: isoIn(11 * HOUR),
      runId: null,
      selection: 'multiple',
      payload: creativeSet(),
      actions: [
        { key: 'approve', label: 'Approve selected', tone: 'primary', requiresNote: false },
        { key: 'revise', label: 'Send back for revision', tone: 'ghost', requiresNote: true },
        { key: 'reject', label: 'Discard batch', tone: 'danger', requiresNote: true },
      ],
    },
    {
      gateId: 'gate_idea_1',
      kind: 'idea_selection',
      title: 'Which ideas should the Producer build?',
      summary:
        'Proposed by Competitor Research and the Analyst. Nothing is generated until you pick — the Producer only builds briefed ideas.',
      askedBy: 'Brain — Marketing Head',
      askedAt: isoAgo(4 * HOUR + 40 * MINUTE),
      product: null,
      slackChannel: '#91astro-marketing',
      slackPermalink: null,
      expiresAt: null,
      runId: null,
      selection: 'multiple',
      payload: {
        kind: 'idea_selection',
        ideas: [
          { id: 'idea_a', title: 'Sample-first Kundli hook', angle: 'Artefact reveal', product: 'Kundli Report', rationale: 'The category opens on a sample artefact and our chart art is stronger than anything observed.', state: 'proposed' },
          { id: 'idea_b', title: 'Motion in a static category', angle: 'Movement', product: 'Kundli Report', rationale: 'Zero observed competitors run video. A 6s motion ad would be the only moving thing in the feed.', state: 'proposed' },
          { id: 'idea_c', title: 'Compatibility score teaser', angle: 'Curiosity gap', product: 'Matchmaking', rationale: 'Nothing in the observed set teases a number. A score withheld is a strong hook.', state: 'proposed' },
          { id: 'idea_d', title: 'Hindi-dedicated ad set', angle: 'Language split', product: 'Matchmaking', rationale: 'Hindi runs 31% below English on cost per lead; the split does not reflect it.', state: 'proposed' },
        ],
      },
      actions: [
        { key: 'approve', label: 'Brief selected ideas', tone: 'primary', requiresNote: false },
        { key: 'reject', label: 'Reject all', tone: 'danger', requiresNote: true },
      ],
    },
  ]
}

function seedPipeline(): BrainPipelineRun {
  return {
    pipelineRunId: 'pl_4417',
    product: 'Kundli Report',
    triggeredBy: 'Brain — Marketing Head',
    startedAt: isoAgo(5 * HOUR + 26 * MINUTE),
    status: 'waiting_for_human',
    headline: 'Built and paused in Meta. Waiting on your launch approval.',
    stages: [
      {
        key: 'producer',
        agentKey: 'creative-producer',
        label: 'Creative Batch Producer',
        description: 'Builds the batch from a briefed idea via the creative MCP',
        state: 'done',
        runId: 'run_h_7b55',
        detail: '6 creatives on the polished track · Hindi',
        startedAt: isoAgo(5 * HOUR + 26 * MINUTE),
        finishedAt: isoAgo(5 * HOUR),
        gateId: null,
        artifacts: [
          { id: 'cr_1', kind: 'creative', label: 'Chart artefact · 4:5', meta: 'Hindi · polished', thumbUrl: null, href: null },
          { id: 'cr_2', kind: 'creative', label: 'Chart artefact · 1:1', meta: 'Hindi · polished', thumbUrl: null, href: null },
          { id: 'cr_3', kind: 'creative', label: 'Portrait · 4:5', meta: 'Hindi · polished', thumbUrl: null, href: null },
        ],
      },
      {
        key: 'curator',
        agentKey: 'creative-curator',
        label: 'Creative Curator',
        description: 'Judges the batch against the craft rubric',
        state: 'waiting_for_human',
        runId: null,
        detail: '2 fit · 1 near-miss · craft gate open',
        startedAt: isoAgo(4 * HOUR + 50 * MINUTE),
        finishedAt: null,
        gateId: 'gate_craft_1',
        artifacts: [],
      },
      {
        key: 'builder',
        agentKey: 'campaign-builder',
        label: 'Campaign Builder',
        description: 'Builds campaign, ad set and ad — everything left PAUSED',
        state: 'done',
        runId: null,
        detail: 'Campaign, 1 ad set, 2 ads — all paused',
        startedAt: isoAgo(1 * HOUR + 10 * MINUTE),
        finishedAt: isoAgo(44 * MINUTE),
        gateId: null,
        artifacts: [
          { id: 'cmp_1', kind: 'campaign', label: '91astro · Kundli · Hindi · Artefact', meta: '₹3,000/day · PAUSED', thumbUrl: null, href: null },
        ],
      },
      {
        key: 'launcher',
        agentKey: 'campaign-launcher',
        label: 'Campaign Launcher',
        description: 'Human-gated. Activates every level in Meta and records who approved',
        state: 'waiting_for_human',
        runId: null,
        detail: 'Launch approval open for 38 minutes',
        startedAt: isoAgo(38 * MINUTE),
        finishedAt: null,
        gateId: 'gate_launch_1',
        artifacts: [],
      },
    ],
  }
}

// ── Mutable store ──────────────────────────────────────────────────────────

interface Store {
  agents: BrainAgent[]
  history: BrainRunSummary[]
  decisions: BrainDecision[]
  gates: BrainGate[]
  pipeline: BrainPipelineRun
  live: Map<string, LiveRun>
}

interface LiveRun {
  runId: string
  agentKey: BrainAgentKey
  agentName: string
  input: Record<string, string>
  startedAt: number
  cancelled: boolean
}

let store: Store | null = null

function db(): Store {
  if (!store) {
    store = {
      agents: seedAgents(),
      history: seedHistory(),
      decisions: seedDecisions(),
      gates: seedGates(),
      pipeline: seedPipeline(),
      live: new Map(),
    }
    // Attach the seeded history to its agent so the roster is not blank on load.
    for (const agent of store.agents) {
      agent.lastRun = store.history.find((run) => run.agentKey === agent.key) ?? null
    }
  }
  return store
}

function scriptFor(agentKey: BrainAgentKey): RunScript {
  return SCRIPTS[agentKey] ?? SCRIPTS.brain
}

function liveStatus(run: LiveRun): BrainRunStatus {
  if (run.cancelled) return 'cancelled'
  const elapsed = Date.now() - run.startedAt
  return elapsed >= scriptFor(run.agentKey).totalMs ? 'succeeded' : 'running'
}

function liveDetail(run: LiveRun): BrainRunDetail {
  const script = scriptFor(run.agentKey)
  const elapsed = Date.now() - run.startedAt
  const status = liveStatus(run)
  const done = status === 'succeeded'

  return {
    runId: run.runId,
    agentKey: run.agentKey,
    agentName: run.agentName,
    status,
    trigger: 'dashboard',
    startedAt: new Date(run.startedAt).toISOString(),
    finishedAt: done ? new Date(run.startedAt + script.totalMs).toISOString() : null,
    durationMs: done ? script.totalMs : null,
    costUsd: done ? Math.round((script.totalMs / 1000) * 7) / 100 : null,
    summary: done ? summarise(script.output(run.input)) : null,
    input: run.input,
    error: null,
    steps: script.steps.map((step, index) => {
      const next = script.steps[index + 1]
      const started = elapsed >= step.atMs
      const finished = next ? elapsed >= next.atMs : done
      return {
        key: step.key,
        label: step.label,
        state: !started ? ('pending' as const) : finished ? ('done' as const) : ('running' as const),
        detail: null,
      }
    }),
    output: done ? script.output(run.input) : null,
  }
}

function summarise(output: BrainRunOutput): string {
  switch (output.kind) {
    case 'answer':
      return output.headline
    case 'allocation':
      return output.rationale
    case 'report':
      return output.summary
    case 'research':
      return `${output.learnings.length} learnings and ${output.ideas.length} ideas from ${output.observationsRead} observations.`
    case 'analysis':
      return `${output.findings.length} findings, ${output.learningsWritten} learnings written.`
  }
}

// ── Read API ───────────────────────────────────────────────────────────────

export function readState(): BrainState {
  const s = db()
  const openGates = s.gates.length
  const running = [...s.live.values()].filter((r) => liveStatus(r) === 'running').length

  return {
    generatedAt: new Date().toISOString(),
    connected: true,
    brain: {
      status: running > 0 ? 'thinking' : openGates > 0 ? 'blocked' : 'idle',
      headline:
        openGates > 0
          ? `${openGates} ${openGates === 1 ? 'decision needs' : 'decisions need'} you before the pipeline can move.`
          : 'Everything the Brain can do without you is done.',
      posture:
        'Holding Kundli Report flat on a creative problem, pushing Matchmaking on eleven days of evidence.',
      lastCycleAt: isoAgo(2 * HOUR),
      nextCycleAt: isoIn(4 * HOUR + 12 * MINUTE),
      version: 'v1 · live',
    },
    budget: {
      dailyTotal: 12_000,
      changedAt: isoAgo(2 * HOUR),
      allocations: [
        { product: 'Matchmaking', dailyBudget: 5_800, previousDailyBudget: 4_000, share: 0.483, reason: 'Eleven days above breakeven on a falling cost per lead.', health: 'good' },
        { product: 'Kundli Report', dailyBudget: 4_200, previousDailyBudget: 4_200, share: 0.35, reason: 'Held flat — the problem is creative, not budget.', health: 'watch' },
        { product: 'Consultation', dailyBudget: 2_000, previousDailyBudget: 2_000, share: 0.167, reason: 'Steady. No signal either way this week.', health: 'unknown' },
      ],
    },
    pipeline: s.pipeline,
    openGates,
    agentsLive: s.agents.filter((a) => a.status === 'live').length,
    agentsTotal: s.agents.length,
    attention: [
      ...s.gates.map((gate) => ({
        id: gate.gateId,
        label: gate.title,
        detail: `${gate.askedBy} · asked ${relative(gate.askedAt)}`,
        severity: gate.kind === 'campaign_launch' ? ('watch' as const) : ('neutral' as const),
        tab: 'approvals' as const,
      })),
      {
        id: 'att_provenance',
        label: 'Kundli Report ROAS is Meta-attributed only',
        detail: 'No server-side confirmation, so every return figure for this product is an estimate.',
        severity: 'watch' as const,
        tab: 'decisions' as const,
      },
    ],
  }
}

function relative(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / MINUTE))
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function readAgents(): BrainAgent[] {
  const s = db()
  return s.agents.map((agent) => {
    const latestLive = [...s.live.values()]
      .filter((r) => r.agentKey === agent.key)
      .sort((a, b) => b.startedAt - a.startedAt)[0]
    return latestLive ? { ...agent, lastRun: toSummary(liveDetail(latestLive)) } : agent
  })
}

function toSummary(detail: BrainRunDetail): BrainRunSummary {
  const { runId, agentKey, agentName, status, trigger, startedAt, finishedAt, durationMs, costUsd, summary } = detail
  return { runId, agentKey, agentName, status, trigger, startedAt, finishedAt, durationMs, costUsd, summary }
}

export function readRuns(): BrainRunSummary[] {
  const s = db()
  const live = [...s.live.values()].map((r) => toSummary(liveDetail(r)))
  return [...live, ...s.history].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )
}

export function readRun(runId: string): BrainRunDetail | null {
  const s = db()
  const live = s.live.get(runId)
  if (live) return liveDetail(live)

  const historic = s.history.find((r) => r.runId === runId)
  if (!historic) return null
  const script = scriptFor(historic.agentKey)
  return {
    ...historic,
    input: {},
    error: historic.status === 'failed' ? 'No observations supplied.' : null,
    steps: script.steps.map((step) => ({
      key: step.key,
      label: step.label,
      state: historic.status === 'failed' ? ('skipped' as const) : ('done' as const),
      detail: null,
    })),
    output: historic.status === 'succeeded' ? script.output({}) : null,
  }
}

export function readEvents(runId: string, after: number): BrainEventPage {
  const s = db()
  const live = s.live.get(runId)
  if (!live) return { events: [], cursor: after, done: true }

  const script = scriptFor(live.agentKey)
  const elapsed = Date.now() - live.startedAt
  const events: BrainRunEvent[] = script.events
    .map((event, index) => ({ event, seq: index + 1 }))
    .filter(({ event, seq }) => seq > after && elapsed >= event.offsetMs)
    .map(({ event, seq }) => ({
      seq,
      at: new Date(live.startedAt + event.offsetMs).toISOString(),
      level: event.level,
      message: event.message,
    }))

  const cursor = events.length ? events[events.length - 1].seq : after
  return { events, cursor, done: liveStatus(live) !== 'running' && cursor >= script.events.length }
}

export function readDecisions(): BrainDecision[] {
  return db().decisions
}

export function readGates(): BrainGate[] {
  return db().gates
}

export function readPipeline(): BrainPipelineRun {
  return db().pipeline
}

// ── Write API ──────────────────────────────────────────────────────────────

let runSeq = 0

export function writeRunStart(
  agentKey: BrainAgentKey,
  input: Record<string, string>,
): { runId: string } {
  const s = db()
  const agent = s.agents.find((a) => a.key === agentKey)
  if (!agent) throw new Error(`Unknown agent: ${agentKey}`)
  if (agent.invocation !== 'on_demand') {
    throw new Error(`${agent.name} is triggered by the Brain and cannot be started from here.`)
  }

  runSeq += 1
  const runId = `run_live_${Date.now().toString(36)}_${runSeq}`
  s.live.set(runId, {
    runId,
    agentKey,
    agentName: agent.name,
    input,
    startedAt: Date.now(),
    cancelled: false,
  })
  return { runId }
}

export function writeRunCancel(runId: string): void {
  const run = db().live.get(runId)
  if (run) run.cancelled = true
}

/**
 * Clearing a gate is the only thing in this console that moves the pipeline,
 * so the mock models that rather than just deleting a row: approving the launch
 * gate has to turn the Launcher stage green, or the Pipeline tab would
 * contradict the Approvals tab.
 */
export function writeGateDecision(gateId: string, body: BrainGateDecisionBody): { ok: true } {
  const s = db()
  const gate = s.gates.find((g) => g.gateId === gateId)
  if (!gate) throw new Error('That decision has already been handled.')

  s.gates = s.gates.filter((g) => g.gateId !== gateId)

  const stage = s.pipeline.stages.find((st) => st.gateId === gateId)
  if (stage) {
    stage.gateId = null
    stage.finishedAt = new Date().toISOString()
    if (body.action === 'approve') {
      stage.state = 'done'
      stage.detail = stage.key === 'launcher' ? 'Launched in Meta — every level active' : 'Approved'
    } else if (body.action === 'revise') {
      stage.state = 'running'
      stage.finishedAt = null
      stage.detail = 'Sent back for revision'
    } else {
      stage.state = 'blocked'
      stage.detail = 'Rejected'
    }
  }

  const stillWaiting = s.pipeline.stages.some((st) => st.state === 'waiting_for_human')
  const anyBlocked = s.pipeline.stages.some((st) => st.state === 'blocked')
  const anyRunning = s.pipeline.stages.some((st) => st.state === 'running')
  s.pipeline.status = stillWaiting
    ? 'waiting_for_human'
    : anyBlocked
      ? 'cancelled'
      : anyRunning
        ? 'running'
        : 'succeeded'
  s.pipeline.headline = stillWaiting
    ? 'Still waiting on you before the pipeline can move.'
    : anyBlocked
      ? 'Stopped — a gate was rejected.'
      : anyRunning
        ? 'Revision in progress.'
        : 'Live in Meta. Nothing is waiting on you.'

  s.decisions = [
    {
      id: `dec_${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      kind: gate.kind === 'campaign_launch' ? 'launch' : gate.kind === 'idea_selection' ? 'creative' : 'creative',
      headline:
        body.action === 'approve'
          ? `Approved: ${gate.title.replace(/\?$/, '')}`
          : body.action === 'revise'
            ? `Sent back for revision: ${gate.title.replace(/\?$/, '')}`
            : `Rejected: ${gate.title.replace(/\?$/, '')}`,
      rationale: body.note?.trim()
        ? body.note.trim()
        : 'Approved from the Brain console with no note.',
      product: gate.product,
      confidence: 1,
      evidence: [
        { label: 'Decided by', value: 'You, in the Brain console', source: 'Dashboard', freshness: 'just now', provenance: 'measured' },
        ...(body.selectedIds?.length
          ? [{ label: 'Selected', value: `${body.selectedIds.length} of ${countSelectable(gate)}`, source: 'Dashboard', freshness: 'just now', provenance: 'measured' as const }]
          : []),
      ],
      outcome: { state: 'executed', label: 'Handed back to the agent', delta: null, direction: 'flat' },
      runId: gate.runId,
    },
    ...s.decisions,
  ]

  return { ok: true }
}

function countSelectable(gate: BrainGate): number {
  switch (gate.payload.kind) {
    case 'creative_craft':
      return gate.payload.creatives.length
    case 'idea_selection':
      return gate.payload.ideas.length
    default:
      return 0
  }
}

// ── Conversation ───────────────────────────────────────────────────────────

interface ConversationSeed {
  turns: BrainConversationTurn[]
}

/**
 * Threads are per-session and kept in module state, exactly like the rest of this file: the mock is
 * stateful so that sending a message and re-reading the thread behaves the way the real one does.
 *
 * The stand-in reply is written as one, and says so. A fixture that answered like the Brain —
 * confident, sourced, specific — would be the most misleading thing in this file, because the whole
 * value of the real answer is that its evidence can be chased.
 */
const conversations = new Map<string, ConversationSeed>()

export function readConversation(sessionId: string, limit = 20): BrainConversation {
  const seed = conversations.get(sessionId) ?? { turns: [] }
  const turns = seed.turns.slice(-limit)
  return {
    sessionId,
    turns,
    omittedOlder: Math.max(0, seed.turns.length - turns.length),
    lastTurn: seed.turns.length ? seed.turns[seed.turns.length - 1].turnIndex : 0,
  }
}

export function writeConversationMessage(
  sessionId: string,
  message: string,
): { runId: string; sessionId: string } {
  const seed = conversations.get(sessionId) ?? { turns: [] }
  const turnIndex = (seed.turns.length ? seed.turns[seed.turns.length - 1].turnIndex : 0) + 1
  const runId = `run_mock_${Math.random().toString(36).slice(2, 10)}`
  seed.turns.push({ turnIndex, role: 'user', content: message, contentClipped: false, evidenceRefs: [], runId: null })
  seed.turns.push({
    turnIndex,
    role: 'brain',
    content:
      'Sample data — the bridge is not connected, so this is a stand-in, not the Brain. With ' +
      'NEXT_PUBLIC_BRAIN_MOCK=false this turn is answered by a real run that reads the account, ' +
      'the accepted learnings and the company wiki, and the answer arrives here carrying the ' +
      'sources it was read from.',
    contentClipped: false,
    evidenceRefs: [],
    runId,
  })
  conversations.set(sessionId, seed)
  return { runId, sessionId }
}

// ── Schedules ──────────────────────────────────────────────────────────────

/**
 * Stand-in schedules, stateful like the rest of this file so a toggle in the demo behaves the way
 * the real one does. The shapes mirror what Foundry actually returns — including that `id` and
 * `cron` are often absent from a list response, which is why the real toggle can address a trigger
 * by name fragment.
 */
const triggerSeed: Record<string, BrainTrigger[]> = {
  brain: [
    { id: null, name: 'Daily at 00:00 UTC — the morning allocation', source: 'schedule', cron: '0 0 * * *', enabled: true, status: 'active' },
    { id: null, name: 'Once a day, a full portfolio review — 10:00 IST', source: 'schedule', cron: '30 4 * * *', enabled: true, status: 'active' },
    { id: null, name: 'Daily at 06:00 UTC — the consolidate pass', source: 'schedule', cron: '0 6 * * *', enabled: true, status: 'active' },
  ],
  'creative-producer': [
    { id: null, name: 'Scheduled run — every ten minutes', source: 'schedule', cron: '*/10 * * * *', enabled: false, status: 'paused' },
    { id: null, name: "Incoming webhook — fired by the Brain's pipeline_advance", source: 'webhook', cron: null, enabled: true, status: 'active' },
  ],
}

export function readAgentTriggers(agentKey: string): BrainTrigger[] {
  return triggerSeed[agentKey] ?? []
}

export function writeAgentTriggerEnabled(
  agentKey: string,
  trigger: string,
  enabled: boolean,
): BrainTrigger | null {
  const list = triggerSeed[agentKey]
  if (!list) return null
  const hit = list.find((t) => t.id === trigger || t.name.includes(trigger))
  if (!hit) return null
  hit.enabled = enabled
  hit.status = enabled ? 'active' : 'paused'
  return hit
}
