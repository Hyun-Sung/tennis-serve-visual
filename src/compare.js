// Kept serves for side-by-side comparison.

export const PALETTE = ['#ffc94d', '#ff6b5b', '#5aa9e6', '#b07cff', '#4fd1a5', '#ff9ad5']

const RESULT = { in: 'in', net: 'net', long: 'long', wide: 'out' }

/** One-line summary of a serve for the compare list. */
export function describeServe(s, plan, sim) {
  const clear = sim.net ? `${sim.net.clearance >= 0 ? '+' : ''}${Math.round(sim.net.clearance * 100)} cm` : ''
  return `${s.speedKmh} km/h · ${plan.spin.character} · ${s.stance} · ${RESULT[sim.result]}${clear ? ` · ${clear}` : ''}`
}

/** The first palette color nobody is using yet, so each new serve stands out. */
export function nextColor(used) {
  return PALETTE.find((c) => !used.includes(c)) ?? PALETTE[used.length % PALETTE.length]
}
