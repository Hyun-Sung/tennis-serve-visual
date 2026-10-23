const VERDICT = {
  in: { title: 'in!', sub: 'right in the box' },
  net: { title: 'fault', sub: 'into the net' },
  long: { title: 'fault', sub: 'long, past the service line' },
  wide: { title: 'fault', sub: 'outside the box' },
}

export default function Readout({ sim, plan, flown, autoSwing }) {
  const decided = sim.bounce ? flown >= sim.bounce.t : sim.net && flown >= sim.net.t
  const v = VERDICT[sim.result]
  const stats = [
    ['over the net', sim.net ? `${Math.round(sim.net.clearance * 100)} cm` : '–'],
    ['contact height', `${plan.contact.y.toFixed(2)} m`],
    ['launch angle', `${plan.launchDeg.toFixed(1)}°`],
    ['speed at net', sim.net ? `${Math.round(sim.net.speedKmh)} km/h` : '–'],
    ['speed at bounce', sim.bounce ? `${Math.round(sim.bounce.speedKmh)} km/h` : '–'],
    ['bounce height', sim.peakAfterBounce ? `${sim.peakAfterBounce.toFixed(2)} m` : '–'],
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
      <div className={`verdict ${decided ? sim.result : 'pending'}`}>
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
