import { useTranslation } from 'react-i18next'
import { useUnits } from '../units.js'

// The calls that come from the returner, once the ball reaches them.
const RETURN_KINDS = new Set(['ace', 'winner', 'tough', 'easy'])

export default function Readout({ sim, plan, flown, autoSwing, ret }) {
  const { t } = useTranslation()
  const units = useUnits()
  const bounced = sim.bounce ? flown >= sim.bounce.t : sim.net && flown >= sim.net.t
  const returned = sim.result === 'in' && ret?.c && flown >= ret.c.t
  const decided = bounced
  const kind = returned && RETURN_KINDS.has(ret.kind) ? ret.kind : sim.result
  const title = t(`verdict.${kind}.title`)
  let sub = t(`verdict.${kind}.sub`)
  // The biggest reason a return was hard, in plain words.
  if (kind === ret?.kind && ret.parts && kind !== 'easy') {
    const [top, amount] = Object.entries(ret.parts).sort((a, b) => b[1] - a[1])[0]
    if (amount > 0.15) sub = t('verdict.because', { sub, reason: t(`reason.${top}`) })
  }
  const stats = [
    ['overNet', sim.net ? units.short(sim.net.clearance) : '–'],
    ['contactHeight', units.long(plan.contact.y)],
    ['launchAngle', `${plan.launchDeg.toFixed(1)}°`],
    ['speedAtNet', sim.net ? units.speed(sim.net.speedKmh) : '–'],
    ['speedAtBounce', sim.bounce ? units.speed(sim.bounce.speedKmh) : '–'],
    ['bounceHeight', sim.peakAfterBounce ? units.long(sim.peakAfterBounce) : '–'],
    ['timeToReturner', ret?.c ? `${ret.c.t.toFixed(2)} s` : '–'],
    ['returnerMoves', ret?.c ? units.long(ret.D) : '–'],
  ]
  const tip =
    decided && sim.result !== 'in'
      ? t(
          sim.result === 'net'
            ? plan.belowReach
              ? 'tips.lowToss'
              : 'tips.net'
            : sim.result === 'long'
              ? autoSwing
                ? 'tips.longAuto'
                : 'tips.longManual'
              : 'tips.wide',
        )
      : null

  return (
    <div className="readout">
      <div className={`verdict ${decided ? kind : 'pending'}`}>
        <b>{decided ? title : '…'}</b>
        <span>{decided ? sub : t('verdict.pending')}</span>
      </div>
      <dl>
        {stats.map(([k, val]) => (
          <div key={k}>
            <dt>{t(`stats.${k}`)}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      {tip && <p className="tip">{tip}</p>}
    </div>
  )
}
