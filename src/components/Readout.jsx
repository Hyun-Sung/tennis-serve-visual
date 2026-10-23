const VERDICT = {
  in: { title: 'in!', sub: 'right in the box' },
  net: { title: 'fault', sub: 'into the net' },
  long: { title: 'fault', sub: 'long, past the service line' },
  wide: { title: 'fault', sub: 'outside the box' },
}

// What the returner made of a serve that landed in, once the ball reaches them.
const RETURN_VERDICT = {
  ace: { title: 'ace!', sub: "the returner couldn't reach it" },
  winner: { title: 'return error', sub: "there's a good chance they hit it, but it doesn't clear the net or goes out" },
  tough: { title: 'tough return', sub: 'it comes back, but under pressure' },
  easy: { title: 'easy return', sub: 'they had time to set up and swing' },
}
// The biggest reason a return was hard, in plain words.
const REASON = {
  rush: 'not much time to swing',
  stretch: 'pulled out wide',
  heat: 'faster than they are used to',
  pace: 'coming through quickly',
  high: 'kicked up high',
  low: 'stayed low',
  jam: 'jammed at the body',
}

import { useUnits } from '../units.js'

export default function Readout({ sim, plan, flown, autoSwing, ret }) {
  const units = useUnits()
  const bounced = sim.bounce ? flown >= sim.bounce.t : sim.net && flown >= sim.net.t
  const returned = sim.result === 'in' && ret?.c && flown >= ret.c.t
  const decided = bounced
  let v = VERDICT[sim.result]
  let kind = sim.result
  if (returned && RETURN_VERDICT[ret.kind]) {
    kind = ret.kind
    v = { ...RETURN_VERDICT[ret.kind] }
    if (ret.parts && ret.kind !== 'easy') {
      const [top, amount] = Object.entries(ret.parts).sort((a, b) => b[1] - a[1])[0]
      if (amount > 0.15) v.sub = `${v.sub}: ${REASON[top]}`
    }
  }
  const stats = [
    ['over the net', sim.net ? units.short(sim.net.clearance) : '–'],
    ['contact height', units.long(plan.contact.y)],
    ['launch angle', `${plan.launchDeg.toFixed(1)}°`],
    ['speed at net', sim.net ? units.speed(sim.net.speedKmh) : '–'],
    ['speed at bounce', sim.bounce ? units.speed(sim.bounce.speedKmh) : '–'],
    ['bounce height', sim.peakAfterBounce ? units.long(sim.peakAfterBounce) : '–'],
    ['time to returner', ret?.c ? `${ret.c.t.toFixed(2)} s` : '–'],
    ['returner has to move', ret?.c ? units.long(ret.D) : '–'],
  ]
  const tip =
    decided && sim.result !== 'in'
      ? sim.result === 'net'
        ? plan.belowReach
          ? 'toss higher so you can hit it at full reach, or jump higher.'
          : 'toss a little further back, brush up for more topspin, or hit lower on the ball.'
        : sim.result === 'long'
          ? autoSwing
            ? 'toss a little further in front, or brush up for more topspin to bring it down.'
            : 'angle the racket down a touch, or brush up for more topspin.'
          : 'aim a bit more inside the box.'
      : null

  return (
    <div className="readout">
      <div className={`verdict ${decided ? kind : 'pending'}`}>
        <b>{decided ? v.title : '…'}</b>
        <span>{decided ? v.sub : 'ball in the air'}</span>
      </div>
      <dl>
        {stats.map(([k, val]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      {tip && <p className="tip">{tip}</p>}
    </div>
  )
}
