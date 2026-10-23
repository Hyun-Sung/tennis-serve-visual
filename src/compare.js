// Kept serves for side-by-side comparison.

export const PALETTE = ['#ffc94d', '#ff6b5b', '#5aa9e6', '#b07cff', '#4fd1a5', '#ff9ad5']

const RESULT = { in: 'in', net: 'net', long: 'long', wide: 'out' }

/** What the compare list shows about a kept serve, as raw numbers so it can be shown in either unit system. */
export function summarize(s, plan, sim, risk, level) {
  return {
    lefty: s.hand === 'left',
    speedKmh: s.speedKmh,
    spin: plan.spin.character,
    stance: s.stance,
    result: sim.result,
    clearance: sim.net ? sim.net.clearance : null,
    inRate: risk.inRate,
    ace: risk.share.ace,
    level,
  }
}

/** One-line summary of a kept serve, in the units chosen now. */
export function describeServe(k, units) {
  const parts = [
    k.lefty && 'lefty',
    units.speed(k.speedKmh),
    k.spin,
    k.stance,
    RESULT[k.result],
    k.clearance != null && units.short(k.clearance, { signed: true }),
    `${Math.round(k.inRate * 100)}% in`,
    `${Math.round(k.ace * 100)}% aces vs ${k.level.toFixed(1)}`,
  ]
  return parts.filter(Boolean).join(' · ')
}

/** The first palette color nobody is using yet, so each new serve stands out. */
export function nextColor(used) {
  return PALETTE.find((c) => !used.includes(c)) ?? PALETTE[used.length % PALETTE.length]
}
