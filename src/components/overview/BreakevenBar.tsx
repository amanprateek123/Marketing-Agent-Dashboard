import { HelpCircle, TriangleAlert } from 'lucide-react'
import { formatPercent } from '@/lib/utils'
import type { DashboardEconomics } from '@/types'

/**
 * The breakeven context strip.
 *
 * Nothing else on the page means anything without it. A ROAS of 0.92 is a
 * near-miss against an assumed benchmark of 1.0 and a catastrophe against a
 * real breakeven of 1.03 with a 2.06 target — same number, opposite decisions.
 * This states the benchmark once, at the top, so every figure below inherits
 * it instead of being read against whatever the viewer assumes.
 */
export function BreakevenBar({
  economics,
  roas,
}: {
  economics: DashboardEconomics
  roas: number
}) {
  const { breakevenROAS, targetROAS, marginPct, refundPct, isEstimated } = economics

  // Position the marker on a 0 → 1.25x-target scale so both breakeven and
  // target are always visible and the gap between them is to scale.
  const scaleMax = Math.max(targetROAS * 1.25, roas * 1.1, 1)
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / scaleMax) * 100))}%`
  const isProfit = roas >= breakevenROAS

  return (
    <div className="card px-5 py-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <p className="micro-label" style={{ color: 'var(--ink-3)' }}>
          Where you stand
        </p>
        <span
          title={economics.notes.join('\n')}
          className="inline-flex"
          style={{ color: 'var(--ink-4)' }}
        >
          <HelpCircle size={13} />
        </span>
        {isEstimated && (
          <span className="chip chip-warn" style={{ fontSize: 11 }}>
            <TriangleAlert size={11} />
            Profit margin is a guess — add it in Settings
          </span>
        )}
        {/* With products on different margins there is no single breakeven the
            account ROAS can be read against — the bar shows the primary
            product's line, and each campaign is judged on its own. Saying so
            is the difference between a useful simplification and a wrong number. */}
        {economics.hasMixedMargins && (
          <span className="chip chip-neutral" style={{ fontSize: 11 }}>
            Line shown for {economics.productName}; each campaign is judged on its own product
          </span>
        )}
        <span className="explain ml-auto min-w-0 break-words">
          {economics.productName ? `${economics.productName} · ` : ''}
          {formatPercent(marginPct)} margin
          {refundPct > 0 ? ` · ${formatPercent(refundPct)} refunds` : ''}
        </span>
      </div>

      {/* Scale */}
      <div className="relative" style={{ height: 46 }}>
        <div
          className="absolute rounded-full"
          style={{
            left: 0, right: 0, top: 18, height: 6,
            background: 'var(--bg-muted)',
          }}
        />
        {/* Loss zone — everything left of breakeven */}
        <div
          className="absolute rounded-l-full"
          style={{
            left: 0, width: pos(breakevenROAS), top: 18, height: 6,
            background: 'var(--bad-bg)',
          }}
        />
        {/* Profit zone — breakeven to target */}
        <div
          className="absolute"
          style={{
            left: pos(breakevenROAS),
            width: `calc(${pos(targetROAS)} - ${pos(breakevenROAS)})`,
            top: 18, height: 6,
            background: 'var(--warn-bg)',
          }}
        />
        {/* Above target */}
        <div
          className="absolute rounded-r-full"
          style={{
            left: pos(targetROAS), right: 0, top: 18, height: 6,
            background: 'var(--good-bg)',
          }}
        />

        <Tick at={pos(breakevenROAS)} label={`Break even ${breakevenROAS.toFixed(2)}x`} color="var(--ink-3)" />
        <Tick at={pos(targetROAS)} label={`Target ${targetROAS.toFixed(2)}x`} color="var(--good)" />

        {/* Actual */}
        <div
          className="absolute flex flex-col items-center"
          style={{ left: pos(roas), transform: 'translateX(-50%)', top: 6 }}
        >
          <span
            className="rounded-full"
            style={{
              width: 14, height: 14,
              background: isProfit ? 'var(--good)' : 'var(--bad)',
              border: '3px solid var(--paper)',
              boxShadow: isProfit ? 'var(--glow-good)' : 'var(--glow-bad)',
            }}
          />
          <span
            className="mono font-semibold whitespace-nowrap mt-1.5"
            style={{ fontSize: 12, color: isProfit ? 'var(--good)' : 'var(--bad)' }}
          >
            You: {roas.toFixed(2)}x
          </span>
        </div>
      </div>
    </div>
  )
}

function Tick({ at, label, color }: { at: string; label: string; color: string }) {
  return (
    <div className="absolute" style={{ left: at, top: 14, transform: 'translateX(-50%)' }}>
      <span
        className="block"
        style={{ width: 2, height: 14, background: color, opacity: 0.5, margin: '0 auto' }}
      />
      <span
        className="block whitespace-nowrap mt-1"
        style={{ fontSize: 10.5, color, opacity: 0.85 }}
      >
        {label}
      </span>
    </div>
  )
}
