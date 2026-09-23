/**
 * Custom brief — the external creative pipeline.
 *
 * These mirror what the backend's `pipeline-bridge` proxies back from the
 * pipeline's own `/v1/options`, `/v1/runs` and `/v1/runs/:id/events`. Option
 * lists are fetched rather than hardcoded, so adding a raw visual direction to
 * the pipeline's guide shows up in the form without a deploy here.
 *
 * Named `CustomBrief*` rather than `Pipeline*` on purpose: `PipelineRun` in
 * types/index.ts already means a run of THIS system's internal 7-phase pipeline,
 * which is a completely different object.
 */

export interface CustomBriefChoice {
  value: string
  label: string
  hint?: string
  /** For methods only: what the "how many?" field produces. 'creative' fans out
   *  into one run each; 'idea' means research runs ONCE and adds that many ideas
   *  to the board. Labelling both "creatives" would promise a fan-out research
   *  does not do. */
  count_noun?: string
}

/** A format or angle. `direction` is set only where the pipeline has an exact
 *  structured counterpart; the rest carry their instruction text alone. */
export interface CustomBriefMappedChoice extends CustomBriefChoice {
  direction: string | null
  instruction: string | null
}

/** One sellable 91Astrology product. `landing_url` is where its copy should drive traffic. */
export interface CustomBriefOffering {
  value: string
  label: string
  landing_url?: string | null
}

export interface CustomBriefOptions {
  methods: CustomBriefChoice[]
  tracks: CustomBriefChoice[]
  formats: CustomBriefMappedChoice[]
  angles: CustomBriefMappedChoice[]
  /**
   * The 91Astrology products a creative can be made for — `active`/`pilot` entries from the
   * pipeline's offerings manifest, newest list served on every load because it is hand-edited.
   *
   * The form MUST make the operator choose one. Until it did, no product was sent, the pipeline
   * stamped none, and it fell back to its manifest default — so every dashboard astro creative was
   * written from the Nadi research pack, filed in the Nadi folder and labelled "Nadi Report"
   * whatever the brief said.
   */
  offerings: CustomBriefOffering[]
  languages: string[]
  delivery_profiles: { value: string; label: string; aspect: number }[]
  models: { model: string; quality: string }[]
  raw_visual_directions: string[]
  /**
   * Raw `slack_runs.status` → human phase, e.g. `generating` → "Generating the image".
   * Served rather than hardcoded so a new pipeline status reads correctly with no deploy here.
   */
  status_phases: Record<string, string>
  /** The three things a person can mean by attaching an image. Served because the form must ask
   *  this up front — the pipeline has no follow-up turn, so there is no gate to sit in. */
  image_directions: CustomBriefChoice[]
  count: { default: number; min: number; max: number }
}

export type CustomBriefMethod = 'create' | 'research'
export type CustomBriefTrack = 'polished' | 'raw'

/** A reference image already stored by the pipeline, ready to attach to a run. */
export interface CustomBriefImageRef {
  filename: string
  s3_url: string | null
}

export interface StartCustomBriefBody {
  method: CustomBriefMethod
  prompt: string
  /** A string because the input is text and empty must mean "use the default"
   *  (5). The pipeline owns the clamping so there is one rule, not two. */
  count?: string
  track?: CustomBriefTrack
  domain?: 'astro' | 'automotive'
  /**
   * WHICH product the creative is for — a `value` from `CustomBriefOptions.offerings`.
   *
   * Required by the pipeline for an astro `create`; it answers with a 400 naming the allowed
   * values if it is missing. Enforced in the form too, so the operator cannot submit without it.
   */
  offering?: string
  /** Single-language spelling, kept for callers that only ever send one. */
  language?: string
  /** Several languages SPLIT the run round-robin rather than multiplying it:
   *  count 5 over 3 languages is 5 creatives, not 15. */
  languages?: string[]
  format?: string
  /** Multi-select formats; supersedes the single `format`. */
  formats?: string[]
  angles?: string[]
  image_refs?: CustomBriefImageRef[]
  /** Required whenever `image_refs` is set — the pipeline has no follow-up turn to ask in. */
  image_direction?: string
  quality?: string
  model?: string
}

export interface CustomBriefStarted {
  run_id: number
  method: CustomBriefMethod
  count: number
  status: string
  intent: string
}

export interface CustomBriefProgress {
  total: number
  done: number
  failed: number
  /** Runs parked on a gate nobody can answer from here — surfaced so a stuck
   *  run reads as stuck rather than merely slow. */
  blocked: number
  terminal: boolean
  percent: number
}

/**
 * Presigned, browser-loadable URLs for what a run has produced so far.
 *
 * The pipeline stores these as plain URLs into a PRIVATE S3 bucket, which a
 * raw `<img src>` cannot load. The API signs them on the way out (1 hour), so
 * they are safe to render directly but must not be persisted anywhere.
 */
export interface CustomBriefArtifacts {
  /** Appears first, while the run is still generating. */
  layout_preview_s3?: string
  final_s3?: string
  deliverable_s3?: string
  /** Alternate cuts once the resize cascade has run, keyed by profile. */
  sizes?: Record<string, string>
}

export interface CustomBriefRunNode {
  run_id: number
  status: string
  item_index: number | null
  mode?: string
  track?: string
  domain?: string
  language?: string | null
  error?: string | null
  model?: string | null
  quality?: string | null
  started_at?: string | null
  heartbeat_at?: string | null
  updated_at?: string | null
  artifacts?: CustomBriefArtifacts
}

export interface CustomBriefRun extends CustomBriefRunNode {
  progress: CustomBriefProgress
  children: CustomBriefRunNode[]
  /** The dashboard package this run was pushed into, when it has been pushed. */
  package_id?: string | null
  /**
   * Set only while a revise is parked waiting on an answer. The brief editor could not pinpoint
   * the edit and asked this; answering it via `clarifyCustomBriefRun` is the only way the run
   * continues, so it must be shown rather than left looking merely slow.
   */
  pending_question?: string | null
}

export interface CustomBriefEvent {
  id: number
  run_id: number
  item_index: number | null
  kind: 'progress' | 'status' | 'artifact' | 'error'
  message: string | null
  payload?: Record<string, unknown> | null
  at: string
}

export interface CustomBriefEvents {
  run_id: number
  /** Pass back as `after` on the next poll. */
  cursor: number
  events: CustomBriefEvent[]
}
