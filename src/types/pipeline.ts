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

export interface CustomBriefOptions {
  methods: CustomBriefChoice[]
  tracks: CustomBriefChoice[]
  formats: CustomBriefMappedChoice[]
  angles: CustomBriefMappedChoice[]
  languages: string[]
  delivery_profiles: { value: string; label: string; aspect: number }[]
  models: { model: string; quality: string }[]
  raw_visual_directions: string[]
  count: { default: number; min: number; max: number }
}

export type CustomBriefMethod = 'create' | 'research'
export type CustomBriefTrack = 'polished' | 'raw'

export interface StartCustomBriefBody {
  method: CustomBriefMethod
  prompt: string
  /** A string because the input is text and empty must mean "use the default"
   *  (5). The pipeline owns the clamping so there is one rule, not two. */
  count?: string
  track?: CustomBriefTrack
  domain?: 'astro' | 'automotive'
  language?: string
  format?: string
  angles?: string[]
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
  artifacts?: Record<string, string>
}

export interface CustomBriefRun extends CustomBriefRunNode {
  progress: CustomBriefProgress
  children: CustomBriefRunNode[]
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
