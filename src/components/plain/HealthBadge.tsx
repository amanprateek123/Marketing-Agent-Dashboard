interface Props {
  health: 'good' | 'watch' | 'bad' | 'unknown'
  /** Optional override label. Defaults to a plain-English word for each health. */
  label?: string
}

const DEFAULTS: Record<Props['health'], string> = {
  good: 'Working well',
  watch: 'Watch this',
  bad: 'Needs action',
  unknown: 'No data yet',
}

const CLASS: Record<Props['health'], string> = {
  good: 'chip chip-good',
  watch: 'chip chip-warn',
  bad: 'chip chip-bad',
  unknown: 'chip chip-neutral',
}

/**
 * Traffic-light chip used everywhere a campaign / ad has a health.
 * Green / amber / red / grey — no jargon, no abbreviation.
 */
export function HealthBadge({ health, label }: Props) {
  return (
    <span className={CLASS[health]}>
      <span
        className="inline-block rounded-full"
        style={{
          width: 6,
          height: 6,
          background:
            health === 'good'
              ? 'var(--good)'
              : health === 'watch'
                ? 'var(--warn)'
                : health === 'bad'
                  ? 'var(--bad)'
                  : 'var(--ink-4)',
        }}
      />
      {label ?? DEFAULTS[health]}
    </span>
  )
}
