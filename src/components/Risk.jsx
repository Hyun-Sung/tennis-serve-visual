import { TRIES } from '../outcome.js'

const pct = (x) => Math.round(x * 100)

// Best outcome for the server first.
const PARTS = [
  { key: 'ace', label: 'ace', color: '#7c5cff' },
  { key: 'winner', label: 'return error', color: '#5aa9e6' },
  { key: 'tough', label: 'tough return', color: '#4fd1a5' },
  { key: 'easy', label: 'easy return', color: '#ffb35c' },
  { key: 'fault', label: 'fault', color: '#e2574c' },
]

export default function Risk({ risk, level, stale }) {
  const { inRate, share, window: win, noise } = risk
  const wonOutright = share.ace + share.winner

  return (
    <section className={`risk ${stale ? 'stale' : ''}`} aria-busy={stale}>
      <div className="risk-head">
        <div className="tolerance">
          <span className="risk-label">Error tolerance</span>
          <b>{pct(inRate)}%</b>
          <span className="risk-sub">land in when hit with small mistakes</span>
        </div>
        <div className="risk-facts">
          {win ? (
            <p>
              the racket angle can be off by <b>{win.down.toFixed(1)}°</b> before it hits the net, or <b>+{win.up.toFixed(1)}°</b>{' '}
              before it goes long.
            </p>
          ) : (
            <p>even hit perfectly, this serve misses. change something to bring it in.</p>
          )}
          <p>
            against a <b>{level.toFixed(1)}</b> returner: <b>{pct(wonOutright)}%</b> of points won outright, <b>{pct(share.fault)}%</b> faults.
          </p>
        </div>
      </div>

      <div className="outcome-bar" role="img"
        aria-label={PARTS.map((p) => `${p.label} ${pct(share[p.key])}%`).join(', ')}>
        {PARTS.map((p) => (share[p.key] > 0.005 ? <span key={p.key} style={{ width: `${share[p.key] * 100}%`, background: p.color }} /> : null))}
      </div>
      <ul className="outcome-legend">
        {PARTS.map((p) => (
          <li key={p.key}>
            <span className="dot" style={{ background: p.color }} />
            {p.label} <b>{pct(share[p.key])}%</b>
          </li>
        ))}
      </ul>
      <p className="hint">
        from {TRIES.toLocaleString()} tries at this serve, each a little off: about ±{noise.angleDeg}° racket angle, ±{noise.yawDeg}° aim, ±
        {noise.speed * 100}% speed, ±{noise.rpm * 100}% spin and ±{noise.brushDeg}° in brush direction. that last one is why slice is riskier:
        with the spin tipped sideways, a slightly different brush changes how much the ball dips. a return error means they likely
        hit it, but into the net or out. an easy return means they have time to set up and swing.
      </p>
    </section>
  )
}
