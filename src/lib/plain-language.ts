/**
 * The app's ONE vocabulary: every status, stage, kind and code the dashboard shows, in plain words.
 *
 * Who reads this app: marketers, not engineers. So no enum value, internal id, ISO timestamp or raw
 * number format reaches the screen — it goes through here first.
 *
 * ── Exported API ─────────────────────────────────────────────────────────────────────────────────
 *
 *   plainStatus(domain, code)  → { label, meaning, tone }
 *       Look up a code in a domain. An unknown code (or unknown domain) never renders raw: it falls
 *       back to { label: humanise(code), meaning: '', tone: 'neutral' }.
 *
 *   toneChip(tone)             → 'chip-good' | 'chip-warn' | 'chip-bad' | 'chip-accent' | 'chip-info' | 'chip-neutral'
 *       The existing chip class for a tone (see app/globals.css `.chip-*`).
 *
 *   humanise(code)             'awaiting_clarification' → 'Awaiting clarification'
 *                              'OUTCOME_SALES' → 'Outcome sales'; 'pendingApproval' → 'Pending approval'
 *
 *   formatInr(n, opts?)        142000 → '₹1,42,000'   (en-IN grouping; null/NaN → '—')
 *                              opts.compact: 142000 → '₹1.4L', 2500 → '₹2.5K'
 *                              opts.perDay: 2500 → '₹2,500 a day'
 *
 *   formatWhen(value, now?)    today → 'Today, 3:10 pm' · yesterday → 'Yesterday' · this year →
 *                              '24 Sep' · other years → '24 Sep 2025'. Accepts ISO strings,
 *                              'YYYY-MM-DD' (no time shown) and Date. Invalid/empty → '—'.
 *
 *   formatRelative(value, now?) 'just now' · '5 minutes ago' · '3 hours ago' · '2 days ago' ·
 *                              'in 20 minutes' · 'in 3 days'. Invalid/empty → '—'.
 *
 *   formatDaysLeft(days)       3 → '3 days left' · 1 → '1 day left' · 0 → 'Last day' · <0 → "Time's up"
 *                              null → '—'
 *
 *   shortRef(id)               A short form of an internal id for a collapsed "Details" block ONLY —
 *                              never as content. 'run_01HZX9ABCDEF9K2P' → 'run…9K2P'.
 *
 *   PLAIN_ERROR                "We couldn't load this. Try again." — the sentence to show instead of
 *                              a raw error message (keep the raw one in <Details>).
 *
 *   PLAIN_VOCABULARY           the registry itself, domain → code → PlainStatus.
 *   PlainDomain / PlainTone / PlainStatus  the types.
 *
 * ── Adding a code ────────────────────────────────────────────────────────────────────────────────
 * Add it to the right domain below with a label a marketer would say out loud and a one-line
 * meaning. Label: sentence case, ≤ 4 words where possible. Meaning: one sentence, no jargon.
 */

// ── Types ─────────────────────────────────────────────────────────────────────────────────────

/** Maps 1:1 onto the existing `.chip-*` classes. */
export type PlainTone = 'good' | 'warn' | 'bad' | 'accent' | 'info' | 'neutral'

export interface PlainStatus {
  /** What to print: "Waiting for you". */
  label: string
  /** One plain sentence for a tooltip / Term help. May be '' for a humanised unknown. */
  meaning: string
  tone: PlainTone
}

type Entry = [label: string, meaning: string, tone: PlainTone]
type Table = Record<string, Entry>

// ── The registry ──────────────────────────────────────────────────────────────────────────────
//
// Grouped by where the code comes from. Existing labels in the app were kept where they were
// already plain, so pages switching to this file do not change their wording for no reason.

const VOCAB = {
  /** Brain pipeline_runs.stage — where a campaign run has got to. */
  runStage: {
    planned: ['Waiting to start', 'The Brain has planned this campaign; work has not begun.', 'neutral'],
    producing: ['Making the ads', 'Writing and designing a batch of ads for this product.', 'accent'],
    curating: ['Picking the best', 'Scoring every ad and keeping only the ones good enough to run.', 'accent'],
    building: ['Setting up the campaign', 'Creating the campaign, ad sets and ads in Meta, switched off.', 'accent'],
    launching: ['Waiting for your go-ahead', 'Everything is ready; it goes live once someone approves.', 'warn'],
    done: ['Finished', 'This campaign run has completed.', 'good'],
  },

  /** Brain pipeline_runs.status — how a campaign run ended (or that it is still going). */
  runStatus: {
    open: ['In progress', 'This campaign run is still being worked on.', 'accent'],
    done: ['Finished', 'This campaign run completed.', 'good'],
    short: ['Finished with fewer ads', 'It completed, but with fewer ads than planned.', 'warn'],
    failed: ['Stopped — needs a look', 'This stopped before it finished. Someone needs to look at it.', 'bad'],
    abandoned: ['Cancelled', 'This was cancelled and will not go live.', 'neutral'],
    blocked: ['Stuck', 'This cannot move on until something is fixed.', 'bad'],
    awaiting_human: ['Waiting for you', 'This is paused until someone makes a decision.', 'warn'],
  },

  /** A stage's state inside a run (BrainStageState). */
  stageState: {
    idle: ['Not started', 'This step has not begun yet.', 'neutral'],
    running: ['In progress', 'This step is being worked on right now.', 'info'],
    waiting_for_human: ['Waiting for you', 'This step is paused until someone makes a decision.', 'warn'],
    done: ['Done', 'This step is complete.', 'good'],
    blocked: ['Stopped', 'This step cannot continue until something is fixed.', 'bad'],
    failed: ['Failed', 'This step went wrong and did not finish.', 'bad'],
  },

  /** Pipeline step keys (which part of the work), named for what they do. */
  stageKey: {
    producer: ['Making the ads', 'Writing and designing the ads.', 'neutral'],
    curator: ['Picking the best', 'Scoring the ads and keeping the good ones.', 'neutral'],
    builder: ['Setting up the campaign', 'Creating the campaign in Meta, switched off.', 'neutral'],
    launcher: ['Going live', 'Switching the campaign on once approved.', 'neutral'],
  },

  /** An agent run's status (BrainRunStatus, and the Foundry values folded into it). */
  agentRun: {
    queued: ['Queued', 'Waiting for its turn to start.', 'neutral'],
    pending: ['Queued', 'Waiting for its turn to start.', 'neutral'],
    scheduled: ['Scheduled', 'Set to start automatically later.', 'neutral'],
    running: ['Running', 'Working on it right now.', 'info'],
    in_progress: ['Running', 'Working on it right now.', 'info'],
    waiting_for_human: ['Waiting for you', 'Paused until someone answers a question or approves.', 'warn'],
    paused: ['Waiting for you', 'Paused until someone answers a question or approves.', 'warn'],
    succeeded: ['Done', 'Finished successfully.', 'good'],
    success: ['Done', 'Finished successfully.', 'good'],
    completed: ['Done', 'Finished successfully.', 'good'],
    failed: ['Failed', 'Something went wrong and it did not finish.', 'bad'],
    error: ['Failed', 'Something went wrong and it did not finish.', 'bad'],
    cancelled: ['Cancelled', 'Stopped before it finished.', 'neutral'],
    canceled: ['Cancelled', 'Stopped before it finished.', 'neutral'],
    aborted: ['Cancelled', 'Stopped before it finished.', 'neutral'],
  },

  /** One step inside an agent run (BrainRunStep.state). */
  runStep: {
    pending: ['Not started', 'This step has not run yet.', 'neutral'],
    running: ['Running', 'This step is running now.', 'info'],
    done: ['Done', 'This step finished.', 'good'],
    skipped: ['Skipped', 'This step was not needed this time.', 'neutral'],
    failed: ['Failed', 'This step went wrong.', 'bad'],
  },

  /** What started an agent run (BrainRunTrigger). */
  runTrigger: {
    dashboard: ['Started here', 'Someone started this from the dashboard.', 'neutral'],
    brain: ['Started by the Brain', 'The Brain started this as part of its own work.', 'neutral'],
    schedule: ['Scheduled', 'This runs automatically on a timetable.', 'neutral'],
    slack: ['From Slack', 'Someone asked for this in Slack.', 'neutral'],
  },

  /** Agent schedule on/off. */
  triggerState: {
    enabled: ['On', 'This schedule is active and will start the agent on time.', 'good'],
    disabled: ['Paused', 'This schedule is switched off; nothing will start automatically.', 'neutral'],
    unknown: ['Unknown', 'We could not tell whether this schedule is on.', 'neutral'],
  },

  /** Brain run modes. */
  brainMode: {
    decide: ['Answer a question', 'The Brain reviews the account and answers or decides something.', 'neutral'],
    sense: ['Look, change nothing', 'The Brain reads the account and reports without changing anything.', 'neutral'],
    allocate: ['Plan the day', "The Brain plans the day's budget across products.", 'neutral'],
    consolidate: ['Tidy up what it knows', 'The Brain reviews and merges what it has learned.', 'neutral'],
  },

  /** Brain posture / execution labels that appear in brain output. */
  brainLabel: {
    record_and_propose: ['Proposes only', 'The Brain records its decisions and proposes them; people approve before anything changes.', 'info'],
    not_executed: ['Not carried out yet', 'This was decided but nothing has been changed in the ad account.', 'neutral'],
    executed: ['Carried out', 'This was done in the ad account.', 'good'],
    measured: ['Result measured', 'This was done and its effect has been measured.', 'good'],
    dry_run: ['Practice run', 'A trial run that changed nothing.', 'neutral'],
    proposed: ['Proposed', 'Suggested and waiting for a decision.', 'warn'],
    recorded: ['Recorded', 'Written down for the record.', 'neutral'],
  },

  /** Brain's own status (header). */
  brainStatus: {
    thinking: ['Thinking now', 'The Brain is working on something.', 'info'],
    idle: ['Idle — nothing pending', 'The Brain has nothing waiting to do right now.', 'neutral'],
    blocked: ['Waiting on you', 'The Brain needs a decision before it can continue.', 'warn'],
    offline: ['Offline', 'We could not reach the Brain.', 'bad'],
  },

  /** Gate kinds on the Approvals tab. */
  gateKind: {
    creative_craft: ['Ad quality check', 'Confirm which ads are good enough to use.', 'info'],
    idea_selection: ['Pick ideas', 'Choose which proposed ad ideas should be made.', 'accent'],
    campaign_launch: ['Launch approval', 'Approve a campaign before it spends money.', 'warn'],
    plan_approval: ['Day plan', "Approve how today's budget will be spent.", 'warn'],
  },

  /** approvals.gate — which spend decision is being asked for. */
  spendGate: {
    plan: ['Day plan', "Approve today's spending plan before any campaign is made.", 'warn'],
    build: ['Build approval', 'Approve setting up the campaign in Meta (switched off).', 'warn'],
    launch: ['Launch approval', 'Approve switching the campaign on so it starts spending.', 'warn'],
    scale: ['Scale-up approval', 'Approve spending more on something that is working.', 'warn'],
  },

  /** How a gate was answered. */
  gateDecision: {
    pending: ['Waiting for you', 'Nobody has answered this yet.', 'warn'],
    approved: ['Approved', 'Someone said yes.', 'good'],
    rejected: ['Rejected', 'Someone said no.', 'bad'],
    expired: ['Expired', 'Nobody answered in time.', 'neutral'],
  },

  /** The Curator's verdict on a creative. */
  creativeVerdict: {
    fit: ['Good to go', 'Good enough to run as it is.', 'good'],
    near_miss: ['Almost there', 'Close, but something small needs fixing.', 'warn'],
    unfit: ['Not usable', 'Not good enough to run.', 'bad'],
  },

  /** Brain creatives.status. */
  creativeStatus: {
    generating: ['Being made', 'This ad is still being created.', 'accent'],
    preview_ready: ['Ready to review', 'This ad is made and waiting to be judged.', 'warn'],
    approved: ['Chosen', 'This ad was picked to run.', 'good'],
    uploaded: ['Sent to Meta', 'This ad is in Meta, not yet running.', 'good'],
    live: ['Running', 'This ad is live and spending.', 'good'],
    retired: ['Not used', 'This ad was set aside.', 'neutral'],
  },

  /** Dashboard creative packages. */
  creativePackage: {
    pending: ['Producing…', 'The ads in this package are still being made.', 'warn'],
    completed: ['Ready', 'The ads in this package are ready.', 'good'],
    failed: ['Failed', 'Making these ads went wrong.', 'bad'],
    all_rejected: ['All rejected', 'Every ad in this package was turned down.', 'warn'],
    no_assets: ['Nothing made', 'This package finished without producing any ads.', 'bad'],
  },

  /** Brain decision kinds (Decisions tab). */
  decisionKind: {
    budget: ['Budget', 'A change to how much is spent, or where.', 'info'],
    pause: ['Paused something', 'Stopped an ad, ad set or campaign.', 'warn'],
    scale: ['Scaled up', 'Put more money behind something that works.', 'good'],
    creative: ['Ads', 'A decision about which ads to make or run.', 'accent'],
    launch: ['Launch', 'A decision to start a campaign.', 'accent'],
    hold: ['Held steady', 'Decided to change nothing for now.', 'neutral'],
  },

  /** Whether a decision's result is known. */
  decisionOutcome: {
    executed: ['Done, not yet measured', 'It was carried out; we do not know the effect yet.', 'info'],
    measured: ['Result measured', 'It was carried out and the effect has been measured.', 'good'],
  },

  /** Idea states. */
  ideaState: {
    proposed: ['Suggested', 'An idea waiting for someone to pick it or pass.', 'warn'],
    approved: ['Picked', 'Chosen to be made into ads.', 'good'],
    briefed: ['Briefed', 'Turned into a brief for the ad makers.', 'good'],
    rejected: ['Passed on', 'Not chosen.', 'neutral'],
    retired: ['Passed on', 'Not chosen.', 'neutral'],
  },

  /** Evidence provenance. */
  provenance: {
    measured: ['Measured', 'Read from real data.', 'good'],
    estimate: ['Estimate', 'Worked out from other data — not measured directly.', 'warn'],
    unknown: ['Unknown source', 'We do not know where this figure came from.', 'neutral'],
  },

  /** Allocation / product health. */
  health: {
    good: ['Working', 'Earning back more than it costs.', 'good'],
    watch: ['Watch this', 'Borderline — worth keeping an eye on.', 'warn'],
    bad: ['Losing money', 'Costing more than it brings back.', 'bad'],
    unknown: ['No signal yet', 'Not enough data to say.', 'neutral'],
  },

  /** Finding / attention severity. */
  severity: {
    good: ['Working', 'Going well.', 'good'],
    watch: ['Watch this', 'Worth keeping an eye on.', 'warn'],
    bad: ['Problem', 'Needs attention.', 'bad'],
    neutral: ['Note', 'For your information.', 'neutral'],
    critical: ['Urgent', 'Needs attention now.', 'bad'],
    warning: ['Worth a look', 'Not urgent, but worth checking.', 'warn'],
    info: ['For your information', 'Nothing to do.', 'info'],
  },

  /** Dashboard campaign / ad / ad-set status (incl. raw Meta values). */
  campaignStatus: {
    active: ['Running', 'Live and spending.', 'good'],
    paused: ['Paused', 'Switched off; not spending.', 'neutral'],
    pending_approval: ['Waiting for you', 'Ready, but needs approval before it runs.', 'accent'],
    pending: ['Pending', 'Waiting to be processed.', 'warn'],
    completed: ['Finished', 'Ran its course and stopped.', 'good'],
    complete: ['Finished', 'Ran its course and stopped.', 'good'],
    failed: ['Failed', 'Something went wrong.', 'bad'],
    superseded: ['Replaced', 'A newer version took its place.', 'neutral'],
    draft: ['Draft', 'Not finished or not submitted yet.', 'neutral'],
    paused_for_replacement: ['Swapping the ad', 'Paused while a fresh ad replaces a tired one.', 'warn'],
    pending_creative_swap: ['Ad swap waiting', 'A replacement ad is ready and waiting to go in.', 'warn'],
    campaign_launching: ['Launching', 'Being set live right now.', 'accent'],
    needs_attention: ['Needs attention', 'Something here needs a look.', 'warn'],
    archived: ['Archived', 'Put away; no longer running.', 'neutral'],
    deleted: ['Deleted', 'Removed from the ad account.', 'neutral'],
    in_process: ['Being processed', 'Meta is still processing this.', 'info'],
    with_issues: ['Has issues', 'Meta reports a problem with this.', 'bad'],
    disapproved: ['Rejected by Meta', 'Meta would not approve this ad.', 'bad'],
    pending_review: ['In Meta review', 'Meta is reviewing this before it can run.', 'warn'],
    campaign_paused: ['Campaign paused', 'The campaign above this is switched off.', 'neutral'],
    adset_paused: ['Ad set paused', 'The ad set above this is switched off.', 'neutral'],
  },

  /** The 7-phase internal pipeline run (runs pages). */
  pipelineStatus: {
    pending: ['Queued', 'Waiting to start.', 'neutral'],
    scouts_running: ['Gathering signals', 'Scanning for trends and signals.', 'accent'],
    intelligence_running: ['Making sense of it', 'Pulling the signals together.', 'accent'],
    research_running: ['Researching', 'Researching the market and competitors.', 'info'],
    idea_pool_running: ['Coming up with ideas', 'Turning research into ad ideas.', 'accent'],
    digest_running: ['Writing the brief', 'Writing the summary and sending it to Slack.', 'accent'],
    creative_running: ['Making the ads', 'Producing the ads.', 'accent'],
    campaign_launching: ['Launching', 'Setting the campaign live.', 'accent'],
    completed: ['Finished', 'Every step is done.', 'good'],
    failed: ['Failed', 'A step went wrong.', 'bad'],
  },

  /** Custom brief / external creative pipeline statuses. */
  customBrief: {
    queued: ['Queued', 'Waiting to start.', 'neutral'],
    authoring: ['Writing the brief', 'Writing the brief for this ad.', 'accent'],
    generating: ['Making the image', 'Creating the picture.', 'accent'],
    resizing: ['Resizing', 'Making versions for each placement.', 'accent'],
    done: ['Done', 'The ad is ready.', 'good'],
    error: ['Failed', 'Something went wrong.', 'bad'],
    cancelled: ['Cancelled', 'Stopped before it finished.', 'neutral'],
    awaiting_language: ['Needs a language', 'Choose which language the ad should be in.', 'warn'],
    awaiting_image_kind: ['Needs a picture type', 'Choose what kind of picture to use.', 'warn'],
    awaiting_badge_image: ['Needs a badge image', 'Upload or choose the badge image.', 'warn'],
    awaiting_revision: ['Needs your changes', 'Say what to change and it will redo it.', 'warn'],
    awaiting_clarification: ['Awaiting clarification', 'It has a question before it can continue.', 'warn'],
    awaiting_research_confirm: ['Check the research', 'Confirm the research before it continues.', 'warn'],
    awaiting_research_rerun: ['Research needs redoing', 'Decide whether to run the research again.', 'warn'],
    validation_failed: ['Did not pass checks', 'The result failed a quality check.', 'bad'],
  },

  /** Campaign copilot session status. */
  copilotSession: {
    collecting: ['Planning together', 'Still gathering the details for this campaign.', 'info'],
    ready: ['Ready to prepare', 'Has everything it needs to build the campaign.', 'good'],
    build_queued: ['Build queued', 'Waiting to start building the campaign.', 'neutral'],
    building: ['Preparing campaign', 'Building the campaign now.', 'accent'],
    pending_approval: ['Ready for approval', 'Built and waiting for your go-ahead.', 'accent'],
    failed: ['Build needs attention', 'Building the campaign went wrong.', 'bad'],
    cancelled: ['Conversation cancelled', 'This planning session was stopped.', 'neutral'],
  },

  /** Proposed actions / intelligence decisions. */
  reviewStatus: {
    shadow_review: ['Awaiting review', 'Suggested and waiting for someone to review it.', 'warn'],
    approved: ['Approved', 'Someone approved this.', 'good'],
    rejected: ['Rejected', 'Someone turned this down.', 'bad'],
    expired: ['Expired unreviewed', 'Nobody reviewed it before the window closed.', 'neutral'],
    pending: ['Pending', 'Waiting to be processed.', 'warn'],
    completed: ['Finished', 'Done.', 'good'],
    failed: ['Failed', 'Something went wrong.', 'bad'],
  },

  /** Pending campaign actions. */
  actionStatus: {
    pending: ['Waiting', 'Suggested and not done yet.', 'warn'],
    executed: ['Done', 'This change was made.', 'good'],
    overridden: ['Overruled', 'Someone chose not to do this.', 'neutral'],
    queued: ['Queued', 'Waiting its turn.', 'neutral'],
    producing: ['Being made', 'The replacement is being made.', 'accent'],
    complete: ['Done', 'Finished.', 'good'],
    failed: ['Failed', 'Something went wrong.', 'bad'],
  },

  /** Campaign action types. */
  actionType: {
    pause_ad: ['Stop the ad', 'Switch off one ad that is not working.', 'neutral'],
    pause_adset: ['Stop the ad group', 'Switch off a whole ad group.', 'neutral'],
    scale_adset: ['Increase budget', "Put more money into an ad group that's working.", 'neutral'],
    replace_creative: ['Refresh the ad', 'Swap a tired ad for a new one.', 'neutral'],
    add_creative: ['Add a new ad', 'Add another ad to test.', 'neutral'],
    add_adset: ['Try a new ad group', 'Reach a new set of people.', 'neutral'],
    shift_budget_between_adsets: ['Move budget', 'Move money from a weaker ad group to a stronger one.', 'neutral'],
    reduce_total_budget: ['Lower the budget', 'Spend less on this campaign.', 'neutral'],
    narrow_placement: ['Focus placements', 'Stop showing ads where they do poorly.', 'neutral'],
    dayparting: ['Limit the hours', 'Only run ads at the times they work.', 'neutral'],
    refresh_audience: ['Refresh the audience', 'Reach people who have not seen these ads yet.', 'neutral'],
  },

  /** Diagnosis codes. */
  diagnosis: {
    creative_fatigue: ['Ads are getting tired', 'People have seen these ads too often and respond less.', 'warn'],
    audience_saturation: ['Audience is overexposed', 'Most of the audience has already seen the ads.', 'warn'],
    budget_saturation: ['Too much budget for this audience', 'Extra money is not buying extra results.', 'warn'],
    delivery_stalled: ['Ad is not being shown', 'Meta has stopped showing this ad much.', 'bad'],
    frequency_ceiling: ['Seen too often', 'The same people are seeing this ad too many times.', 'warn'],
    ctr_decay: ['Fewer people are clicking', 'The click rate is falling.', 'warn'],
    cvr_collapse: ['Buyers stopped converting', 'People click but no longer buy.', 'bad'],
    placement_leak: ['Money leaking into weak placements', 'Some placements take money and return little.', 'warn'],
    hook_burn: ['This angle is worn out', 'The opening message has stopped working.', 'warn'],
    unprofitable_run: ['Losing money on this campaign', 'It is costing more than it brings back.', 'bad'],
    winner_emerging: ['Starting to work', 'Early signs this ad is a winner.', 'good'],
    winner_confirmed: ['Confirmed winner — scale it', 'This has proven it works; it could take more budget.', 'good'],
    audience_exhaustion: ['Audience is used up', 'There are few new people left to reach.', 'warn'],
    learning_limited_locked: ['Meta stuck in learning mode', 'Meta cannot get enough results to optimise delivery.', 'warn'],
    learning_limited: ['Meta stuck in learning mode', 'Meta cannot get enough results to optimise delivery.', 'warn'],
    chronic_unprofitable: ['Unprofitable', 'Has lost money for a while.', 'bad'],
    data_gap: ['Missing data', 'Some numbers are missing, so this is uncertain.', 'neutral'],
    auction_leak: ['Paying too much', 'Costs to show the ad are unusually high.', 'warn'],
    creative_leak: ['Weak ads', 'The ads themselves are holding results back.', 'warn'],
    audience_lp_leak: ['Audience or page problem', 'The audience or the landing page is losing buyers.', 'warn'],
    creative_diversity_leak: ['Too many similar ads', 'The ads are too alike and wear out together.', 'warn'],
    fragmentation: ['Spread too thin', 'Budget is split across too many small pieces.', 'warn'],
    none: ['Healthy', 'Nothing wrong found.', 'good'],
  },

  /** Risk levels. */
  risk: {
    low: ['Small change', 'Low risk; easy to undo.', 'good'],
    medium: ['Moderate change', 'Some risk; worth a look.', 'warn'],
    high: ['Big change', 'Higher risk; review carefully.', 'bad'],
  },

  /** Urgency. */
  urgency: {
    high: ['Urgent', 'Act soon.', 'bad'],
    medium: ['Soon', 'Act in the next day or two.', 'warn'],
    low: ['When convenient', 'No rush.', 'neutral'],
    immediate: ['Now', 'Act today.', 'bad'],
    '48h': ['Within 2 days', 'Act in the next two days.', 'warn'],
    '7d': ['This week', 'Act within a week.', 'neutral'],
  },

  /** Review verdicts (FounderVerdict, snapshot and eval verdicts). */
  reviewVerdict: {
    support: ['This looks right', 'The review agrees with this suggestion.', 'good'],
    hold: ['Wait before doing this', 'The review suggests waiting for more evidence.', 'warn'],
    reject: ["Don't do this", 'The review advises against it.', 'bad'],
    no_action: ['OK', 'Nothing to do.', 'good'],
    watch: ['Watch', 'Keep an eye on it.', 'warn'],
    act: ['Act', 'Something should be done.', 'bad'],
    improved: ['Improved', 'Results got better.', 'good'],
    regressed: ['Got worse', 'Results got worse.', 'bad'],
    worsened: ['Got worse', 'Results got worse.', 'bad'],
    neutral: ['No change', 'Results stayed about the same.', 'neutral'],
    inconclusive: ['No clear answer', 'Not enough evidence to say.', 'neutral'],
    correct_block: ['Right call', 'Blocking this was correct.', 'good'],
    missed_signal: ['Missed chance', 'Blocking this cost an opportunity.', 'warn'],
  },

  /** Brain hypotheses (Experiments tab) — status. */
  experimentStatus: {
    proposed: ['Planned', 'Written down; the ads that test it have not started yet.', 'warn'],
    active: ['Testing now', 'Ads that test this are running and results are coming in.', 'accent'],
    confirmed: ['Worked', 'The results backed the idea up.', 'good'],
    refuted: ["Didn't work", 'The results went against the idea.', 'bad'],
    inconclusive: ['No clear answer', 'The test ended without enough evidence either way.', 'neutral'],
    retired: ['Dropped', 'Stopped before it was judged.', 'neutral'],
  },

  /** Brain hypotheses — kind. */
  experimentKind: {
    proven: ['Proven idea', 'Something that has already worked, used again.', 'good'],
    variant: ['New twist on a proven idea', 'A proven idea with one thing changed, to see if it does better.', 'accent'],
    seed: ['Exploring', 'A brand-new idea with nothing proven behind it yet.', 'info'],
  },

  /** Campaign objectives (Meta and internal values). */
  objective: {
    outcome_sales: ['Sales', 'Get people to buy.', 'neutral'],
    sales: ['Sales', 'Get people to buy.', 'neutral'],
    sales_purchase: ['Sales', 'Get people to buy.', 'neutral'],
    outcome_leads: ['Leads', 'Collect enquiries or sign-ups.', 'neutral'],
    leads: ['Leads', 'Collect enquiries or sign-ups.', 'neutral'],
    outcome_engagement: ['Engagement', 'Get likes, comments and shares.', 'neutral'],
    engagement: ['Engagement', 'Get likes, comments and shares.', 'neutral'],
    outcome_awareness: ['Awareness', 'Show the ad to as many people as possible.', 'neutral'],
    awareness: ['Awareness', 'Show the ad to as many people as possible.', 'neutral'],
    awareness_reach: ['Awareness', 'Show the ad to as many people as possible.', 'neutral'],
    reach: ['Reach', 'Show the ad to as many people as possible.', 'neutral'],
    outcome_traffic: ['Website visits', 'Send people to the website.', 'neutral'],
    traffic: ['Website visits', 'Send people to the website.', 'neutral'],
    outcome_app_promotion: ['App installs', 'Get people to install the app.', 'neutral'],
    app_promotion: ['App installs', 'Get people to install the app.', 'neutral'],
    app_installs: ['App installs', 'Get people to install the app.', 'neutral'],
    video_views: ['Video views', 'Get people to watch the video.', 'neutral'],
    messages: ['Messages', 'Get people to send a message.', 'neutral'],
    catalog_sales: ['Catalogue sales', 'Sell products from the catalogue.', 'neutral'],
    retargeting: ['Winning back visitors', 'Show ads to people who already visited.', 'neutral'],
  },

  /** Brain pipeline_runs.campaign_type. */
  campaignType: {
    launch: ['New launch', 'Introducing a product to new people.', 'neutral'],
    test: ['Test', 'A small campaign to learn what works.', 'neutral'],
    evergreen: ['Always-on', 'Runs continuously in the background.', 'neutral'],
    seasonal: ['Seasonal', 'Tied to a festival or season.', 'neutral'],
    retargeting: ['Winning back visitors', 'Shown to people who already visited.', 'neutral'],
  },

  /** Audience kinds. */
  audienceKind: {
    lookalike: ['People similar to past buyers', 'Meta finds people like your customers.', 'neutral'],
    interest: ['People with matching interests', 'People whose interests fit the product.', 'neutral'],
    retargeting: ['People who already visited', 'People who have seen the site before.', 'neutral'],
    retarget: ['People who already visited', 'People who have seen the site before.', 'neutral'],
    advantage_plus: ['Meta picks the audience', 'Meta chooses who sees the ad.', 'neutral'],
    custom: ['Custom audience', 'A list of people you provided.', 'neutral'],
    broad: ['Broad audience', 'Few limits on who sees the ad.', 'neutral'],
  },

  /** Meta ad account status. */
  metaAccountStatus: {
    active: ['Active', 'The ad account is working normally.', 'good'],
    disabled: ['Disabled', 'Meta has switched this ad account off.', 'bad'],
    unsettled: ['Payment due', 'There is an unpaid balance on the account.', 'bad'],
    pending_review: ['In Meta review', 'Meta is reviewing the account.', 'warn'],
    in_grace_period: ['Payment grace period', 'A payment is overdue; ads still run for now.', 'warn'],
    pending_closure: ['Closing', 'This ad account is being closed.', 'bad'],
  },

  /** Data coverage / freshness states. */
  coverage: {
    complete: ['Complete', 'All the data is in.', 'good'],
    partial: ['Partial', 'Some data is missing.', 'warn'],
    none: ['No data', 'There is no data for this yet.', 'neutral'],
    unavailable: ['Unavailable', 'This data could not be read.', 'neutral'],
    no_sales_spend: ['No sales spend', 'Nothing was spent on sales campaigns.', 'neutral'],
    not_applicable: ['Not applicable', 'This does not apply here.', 'neutral'],
    fresh: ['Up to date', 'The data is current.', 'good'],
    partially_stale: ['Partly out of date', 'Some of this data is old.', 'warn'],
    unknown: ['Unknown', 'We cannot tell how current this is.', 'neutral'],
    passed: ['Passed', 'Cleared the check.', 'good'],
    held: ['Held back', 'Did not clear the check yet.', 'warn'],
  },

  /** Conversation roles. */
  role: {
    user: ['You', 'Your message.', 'neutral'],
    brain: ['Brain', "The Brain's reply.", 'neutral'],
    assistant: ['Assistant', "The assistant's reply.", 'neutral'],
    system: ['System', 'An automatic note.', 'neutral'],
  },
} satisfies Record<string, Table>

export type PlainDomain = keyof typeof VOCAB

/** The registry as PlainStatus objects: domain → code → { label, meaning, tone }. */
export const PLAIN_VOCABULARY: Record<PlainDomain, Record<string, PlainStatus>> = Object.fromEntries(
  Object.entries(VOCAB).map(([domain, table]) => [
    domain,
    Object.fromEntries(
      Object.entries(table as Table).map(([code, [label, meaning, tone]]) => [code, { label, meaning, tone }]),
    ),
  ]),
) as Record<PlainDomain, Record<string, PlainStatus>>

// ── Lookups ───────────────────────────────────────────────────────────────────────────────────

/**
 * `code` in plain words. Case-insensitive; `OUTCOME_SALES` and `outcome_sales` both resolve.
 * Unknown code → humanised label, empty meaning, neutral tone. Never the raw code.
 */
export function plainStatus(domain: PlainDomain, code: string | null | undefined): PlainStatus {
  if (code === null || code === undefined || String(code).trim() === '') {
    return { label: '—', meaning: '', tone: 'neutral' }
  }
  const raw = String(code).trim()
  const table = PLAIN_VOCABULARY[domain]
  const hit = table?.[raw] ?? table?.[raw.toLowerCase()]
  return hit ?? { label: humanise(raw), meaning: '', tone: 'neutral' }
}

const TONE_CHIP: Record<PlainTone, string> = {
  good: 'chip-good',
  warn: 'chip-warn',
  bad: 'chip-bad',
  accent: 'chip-accent',
  info: 'chip-info',
  neutral: 'chip-neutral',
}

/** Tone → existing chip class. */
export function toneChip(tone: PlainTone): string {
  return TONE_CHIP[tone] ?? 'chip-neutral'
}

/**
 * A code as sentence-case words: 'awaiting_clarification' → 'Awaiting clarification',
 * 'OUTCOME_SALES' → 'Outcome sales', 'pendingApproval' → 'Pending approval'. Empty → ''.
 */
export function humanise(code: string | null | undefined): string {
  if (!code) return ''
  const words = String(code)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// ── Numbers ───────────────────────────────────────────────────────────────────────────────────

export interface FormatInrOptions {
  /** ₹1.4L / ₹2.5K / ₹1.2Cr instead of full digits. */
  compact?: boolean
  /** Append " a day". */
  perDay?: boolean
  /** Decimal places for the full form (default 0). */
  decimals?: number
}

/** 142000 → '₹1,42,000'. Negative → '-₹500'. null / NaN → '—'. */
export function formatInr(n: number | string | null | undefined, opts: FormatInrOptions = {}): string {
  const value = typeof n === 'string' ? Number(n) : n
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  let body: string
  if (opts.compact && abs >= 1e7) body = `₹${trim1(abs / 1e7)}Cr`
  else if (opts.compact && abs >= 1e5) body = `₹${trim1(abs / 1e5)}L`
  else if (opts.compact && abs >= 1e3) body = `₹${trim1(abs / 1e3)}K`
  else {
    const dp = opts.decimals ?? 0
    body = `₹${abs.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
  }
  return `${sign}${body}${opts.perDay ? ' a day' : ''}`
}

function trim1(v: number): string {
  const s = v.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

// ── Time ──────────────────────────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_MS = 86_400_000

/** A Date from an ISO string / 'YYYY-MM-DD' / Date, plus whether it carried a time of day. */
function toDate(value: string | Date | null | undefined): { date: Date; hasTime: boolean } | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? { date: value, hasTime: true } : null
  const s = String(value).trim()
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    return Number.isFinite(d.getTime()) ? { date: d, hasTime: false } : null
  }
  const d = new Date(s)
  return Number.isFinite(d.getTime()) ? { date: d, hasTime: true } : null
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** '3:10 pm' */
function clock(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

/**
 * 'Today, 3:10 pm' · 'Yesterday' · '24 Sep' · '24 Sep 2025'. A date-only value never shows a
 * time ('Today'). Local time zone — the reader's. Invalid/empty → '—'.
 */
export function formatWhen(value: string | Date | null | undefined, now: Date = new Date()): string {
  const parsed = toDate(value)
  if (!parsed) return '—'
  const { date, hasTime } = parsed
  if (sameDay(date, now)) return hasTime ? `Today, ${clock(date)}` : 'Today'
  const yesterday = new Date(now.getTime() - DAY_MS)
  if (sameDay(date, yesterday)) return 'Yesterday'
  const tomorrow = new Date(now.getTime() + DAY_MS)
  if (sameDay(date, tomorrow)) return hasTime ? `Tomorrow, ${clock(date)}` : 'Tomorrow'
  const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

/** 'just now' · '5 minutes ago' · '3 hours ago' · '2 days ago' · 'in 20 minutes' · 'in 3 days'. */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  const parsed = toDate(value)
  if (!parsed) return '—'
  const diff = parsed.date.getTime() - now.getTime()
  const future = diff > 0
  const abs = Math.abs(diff)
  const minutes = Math.round(abs / 60_000)
  if (minutes < 1) return 'just now'
  let text: string
  if (minutes < 60) text = plural(minutes, 'minute')
  else if (minutes < 60 * 24) text = plural(Math.round(minutes / 60), 'hour')
  else if (minutes < 60 * 24 * 60) text = plural(Math.round(minutes / (60 * 24)), 'day')
  else text = plural(Math.round(minutes / (60 * 24 * 30)), 'month')
  return future ? `in ${text}` : `${text} ago`
}

/** 3 → '3 days left' · 1 → '1 day left' · 0 → 'Last day' · negative → "Time's up" · null → '—'. */
export function formatDaysLeft(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return '—'
  if (days < 0) return "Time's up"
  if (days === 0) return 'Last day'
  return `${plural(Math.ceil(days), 'day')} left`
}

// ── References (Details only) ─────────────────────────────────────────────────────────────────

/**
 * A short, recognisable form of an internal id for a collapsed Details block — never content.
 * 'run_01HZX9ABCDEF9K2P' → 'run…9K2P' · 'agt_7f3e…' → 'agt…' + last 4 · short ids unchanged.
 */
export function shortRef(id: string | number | null | undefined): string {
  if (id === null || id === undefined) return '—'
  const s = String(id).trim()
  if (s.length <= 10) return s
  const prefix = /^([a-z]{2,8})[_:-]/i.exec(s)?.[1] ?? s.slice(0, 4)
  return `${prefix}…${s.slice(-4)}`
}

// ── Errors ────────────────────────────────────────────────────────────────────────────────────

/** Shown instead of a raw error message. Keep the raw message inside <Details>. */
export const PLAIN_ERROR = "We couldn't load this. Try again."

/** The raw message of an unknown thrown value, for <Details> only. */
export function errorDetail(err: unknown): string {
  if (err instanceof Error) return err.message
  return typeof err === 'string' ? err : ''
}
