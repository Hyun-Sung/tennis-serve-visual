// Picks a first and a second serve for a server's height, hand and court side. It tries a spread of
// spins, speeds and directions through the same physics and error model the tool shows, and keeps
// the pair that wins the most points against the chosen returner.

import { assessServe } from './outcome.js'
import { COURT, sideSign, simulateServe } from './physics.js'
import { DEFAULT_HIT, DEFAULT_TOSS, handSign, planServe } from './serve.js'

// The serve styles tried, as the swing a right-hander would use (a left-hander brushes the other way).
export const STYLES = {
  flat: { up: 0.08, side: 0.04 },
  slice: { up: 0.3, side: 0.6 },
  'topspin-slice': { up: 0.55, side: 0.32 },
  kick: { up: 0.78, side: 0.1 },
}

// Launch directions tried, across the deuce box from the T to wide (the ad side mirrors them).
// Spin curves the ball after it leaves, so where it lands is read off the flight, not these.
const AIMS = [-0.3, -1.0, -1.7, -2.4, -3.1, -3.8]
// Speeds tried, as shares of the most this serve can be hit at. Slowing the arm down much further
// doesn't make a real serve safer (it makes it tentative), so the search doesn't go there.
const PACE = [1, 0.95, 0.9, 0.85, 0.8]
// Coaches want a second serve to go in at least nine times in ten, whatever it wins.
export const SECOND_IN_FLOOR = 0.9

// The fastest serve someone has is a flat one. Spin uses part of the swing to brush the ball instead
// of driving it, topspin more than side spin, so a kick comes off about a quarter slower. Hitting
// inside-out (holding back the shoulder turn) costs a little pace too.
const TOP_COST = 0.3
const SIDE_COST = 0.15
const STRAIN_COST = 0.15
export const MAX_SPEED_LIMITS = [110, 230]
export const DEFAULT_MAX_SPEED = 170

/** The fastest this style can be hit, for someone whose fastest flat serve is maxKmh. */
export function speedCap(maxKmh, spin, strain) {
  return maxKmh * (1 - (TOP_COST * spin.topspin + SIDE_COST * Math.abs(spin.sidespin)) / 4000) * (1 - STRAIN_COST * strain)
}

// The chance the server goes on to win the point after each kind of return. Aces and return errors
// win it outright. After a return the rally starts, a little in the server's favour if the return
// was hard. These are rough guesses in line with typical club numbers, not measured data.
export const WIN_AFTER = { ace: 1, winner: 1, tough: 0.58, easy: 0.42 }

// Where in the box the ball lands, measured out from the centre line.
const zoneOf = (bz) => (Math.abs(bz) < COURT.halfSingles / 3 ? 'T' : Math.abs(bz) < (2 * COURT.halfSingles) / 3 ? 'body' : 'wide')

/**
 * The serve settings for one candidate, ready to hand to planServe (and to the tool's controls).
 * who: { height, hand, side, stance, jump }.
 */
export function serveFor(who, style, speedKmh, aimZ) {
  const sw = STYLES[style]
  return {
    toss: DEFAULT_TOSS,
    hand: who.hand,
    side: who.side,
    height: who.height,
    stance: who.stance,
    jump: who.jump,
    speedKmh: Math.round(speedKmh),
    swing: { up: sw.up, side: sw.side * handSign(who.hand) },
    hit: DEFAULT_HIT,
    aimZ,
    autoSwing: true,
    swingDeg: 0,
  }
}

/**
 * The best first and second serve for this server against a returner of this level.
 * who: { height, hand, side, stance, jump }, maxKmh: their fastest flat serve.
 *
 * The second serve is the one that wins the most points, counting a double fault as a lost point,
 * among those that go in at least SECOND_IN_FLOOR of the time. The first serve is worth what it wins when it goes in, plus, when it misses,
 * what the second serve is worth: so it can afford to take more risk, but not unlimited risk.
 */
export function recommend(who, maxKmh, level) {
  const cs = sideSign(who.side)
  const tried = []
  for (const style of Object.keys(STYLES)) {
    for (const a of AIMS) {
      const aimZ = a * cs
      // Spin and direction don't depend on speed, so one look tells us how fast this one can go.
      const probe = planServe(serveFor(who, style, maxKmh, aimZ))
      const cap = speedCap(maxKmh, probe.spin, probe.direction.strain)
      for (const f of PACE) {
        const s = serveFor(who, style, cap * f, aimZ)
        const plan = planServe(s)
        const risk = assessServe(plan, level, { window: false })
        const ev = Object.keys(WIN_AFTER).reduce((sum, k) => sum + risk.share[k] * WIN_AFTER[k], 0)
        tried.push({ s, plan, risk, ev, style, pace: f })
      }
    }
  }

  // If nothing is that safe, the safest serve there is.
  const safe = tried.filter((c) => c.risk.inRate >= SECOND_IN_FLOOR)
  const second = safe.length
    ? safe.reduce((best, c) => (c.ev > best.ev ? c : best))
    : tried.reduce((best, c) => (c.risk.inRate > best.risk.inRate ? c : best))
  const firstValue = (c) => c.ev + (1 - c.risk.inRate) * second.ev
  const first = tried.reduce((best, c) => (firstValue(c) > firstValue(best) ? c : best))

  const describe = (c) => {
    const sim = simulateServe(c.plan.flight, c.plan.contact)
    const { inRate, share } = c.risk
    return {
      serve: c.s,
      style: c.plan.spin.character,
      speedKmh: c.s.speedKmh,
      rpm: c.plan.spin.rpm,
      zone: sim.bounce ? zoneOf(sim.bounce.z) : 'body',
      inRate,
      share,
      // Points won when it goes in, and over all serves of this kind (faults count as lost here).
      wonWhenIn: inRate > 0 ? c.ev / inRate : 0,
      across: c.plan.direction.across,
      contactY: c.plan.contact.y,
    }
  }
  const out = { first: describe(first), second: describe(second) }
  // All told: first serves in, plus second serves after a miss.
  out.servicePoints = firstValue(first)
  out.doubleFaults = (1 - first.risk.inRate) * (1 - second.risk.inRate)
  out.tried = tried.length
  return out
}
