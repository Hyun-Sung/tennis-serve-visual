// The simple mode: pick a spot in the service box and see how each kind of serve would get the ball
// there. For every spin it finds the racket angle and aim that land the ball on the spot at a few
// speeds, flies each through the same error model and returner as the full tool, and scores them.

import { assessServe, evaluateReturn, misHit, RETURN_X } from './outcome.js'
import { boxZ, COURT, sideSign, simulateServe } from './physics.js'
import { SECOND_IN_FLOOR, serveFor, SLOWEST_SERVE, speedCap, STYLES, WIN_AFTER } from './recommend.js'
import { planServe } from './serve.js'

// Speeds tried for each spin, as shares of the fastest it can be hit. A spot short in the box needs
// a slower ball to come down in time, so when none of these land in often, slower ones are tried too.
const PACE = [1, 0.9, 0.8, 0.7]
const SLOW_PACE = [0.6, 0.5]
const TRY_SLOWER_BELOW = 0.6

// Where the spot can go: just inside the lines, and not right up against the net.
const INSET = 0.05
const MIN_DEPTH = 1.5
export const DEFAULT_SPOT = { x: COURT.serviceLine - 1, z: -0.6 }

/** The box a spot is in: the one on the server's left (negative z) is served to from the deuce side. */
export const sideOfSpot = (spot) => (spot.z > 0 ? 'ad' : 'deuce')

/** The spot moved into the service box for this side. */
export function clampSpot(spot, side) {
  const [z0, z1] = boxZ(side)
  return {
    x: Math.min(Math.max(spot.x, COURT.net + MIN_DEPTH), COURT.serviceLine - INSET),
    z: Math.min(Math.max(spot.z, z0 + INSET), z1 - INSET),
  }
}

/** Where a serve first lands and how far it clears the net, flying through the net if it has to. */
function landing(flight, contact) {
  const sim = simulateServe(flight, contact, { fast: true, ghost: true, untilBounce: true })
  return sim.bounce ? { x: sim.bounce.x, z: sim.bounce.z, clearance: sim.net ? sim.net.clearance : -1 } : null
}

// Newton's method on two unknowns (racket angle and aim) to hit two targets (depth and sideways).
const STEP = 0.05
const CLOSE_ENOUGH = 0.02
// A slow serve can need a steep launch to carry the net; beyond this it's a lob, not a serve.
const MAX_ANGLE = 40
/** The racket angle and aim that land this serve on the spot, or null if it can't get there. */
function solveFor(flight, contact, spot) {
  let a = flight.angleDeg
  let z = flight.aimZ
  for (let i = 0; i < 12; i++) {
    const f = { ...flight, angleDeg: a, aimZ: z }
    const at = landing(f, contact)
    if (!at) return null
    const ex = at.x - spot.x
    const ez = at.z - spot.z
    if (Math.hypot(ex, ez) < CLOSE_ENOUGH) return { angleDeg: a, aimZ: z, clearance: at.clearance }
    const byA = landing({ ...f, angleDeg: a + STEP }, contact)
    const byZ = landing({ ...f, aimZ: z + STEP }, contact)
    if (!byA || !byZ) return null
    const xa = (byA.x - at.x) / STEP
    const xz = (byZ.x - at.x) / STEP
    const za = (byA.z - at.z) / STEP
    const zz = (byZ.z - at.z) / STEP
    const det = xa * zz - xz * za
    if (Math.abs(det) < 1e-9) return null
    const da = -(zz * ex - xz * ez) / det
    const dz = -(-za * ex + xa * ez) / det
    // Big jumps can overshoot into a region where the ball never comes down, so take them in pieces.
    const k = Math.min(1, 3 / Math.abs(da || 1e-9), 3 / Math.abs(dz || 1e-9))
    a += da * k
    z += dz * k
    if (Math.abs(a) > MAX_ANGLE) return null
  }
  return null
}

const winsOf = (share) => Object.keys(WIN_AFTER).reduce((sum, k) => sum + share[k] * WIN_AFTER[k], 0)

/**
 * Every spin at every speed that lands on the spot, with its odds against a returner of this level.
 * who: { height, hand, side, stance, jump }, maxKmh: their fastest flat serve, spot: { x, z } on the
 * court in metres (z is negative in the deuce box). Spins that can't reach the spot get an empty list.
 */
export function serveOptions(who, maxKmh, level, spot) {
  const out = {}
  for (const style of Object.keys(STYLES)) {
    const probe = planServe(serveFor(who, style, maxKmh, spot.z))
    const cap = speedCap(maxKmh, probe.spin, probe.direction.strain)
    let start = { angleDeg: probe.autoSwing, aimZ: spot.z }
    const tries = []
    const tryPace = (pace) => {
      const speedKmh = Math.round(cap * pace)
      if (speedKmh < SLOWEST_SERVE) return
      const flight = { ...probe.flight, speedKmh, angleDeg: start.angleDeg, aimZ: start.aimZ }
      const hit = solveFor(flight, probe.contact, spot)
      if (!hit) return
      // The next speed starts from this answer, which is close.
      start = hit
      const serve = { ...serveFor(who, style, speedKmh, hit.aimZ), autoSwing: false, swingDeg: hit.angleDeg }
      const plan = planServe(serve)
      const risk = assessServe(plan, level, { window: false })
      tries.push({
        style,
        pace,
        speedKmh,
        rpm: plan.spin.rpm,
        serve,
        flight: plan.flight,
        contact: plan.contact,
        noise: risk.noise,
        spread: risk.spread,
        clearance: hit.clearance,
        across: plan.direction.across,
        inRate: risk.inRate,
        share: risk.share,
        wins: winsOf(risk.share),
      })
    }
    PACE.forEach(tryPace)
    if (!tries.some((c) => c.inRate >= TRY_SLOWER_BELOW)) SLOW_PACE.forEach(tryPace)
    out[style] = tries
  }
  return out
}

/**
 * The score for a serve: the share of points won with serves like it. A second serve that misses
 * is a double fault, so it counts as a lost point. A first serve that misses still gets a second
 * serve, which wins secondWins of the time.
 */
export const scoreOf = (c, serveNo, secondWins = 0) => (serveNo === 1 ? c.wins + (1 - c.inRate) * secondWins : c.wins)

// How often a serve has to land in to count as a real try for the spot. A first serve that nearly
// always misses can still score well (the second serve does the work), but it isn't a way to get the
// ball there. Coaches want a second serve in nine times in ten.
export const IN_FLOOR = { 1: 0.5, 2: SECOND_IN_FLOOR }

/** The best of these: the highest score among those that go in often enough, else the safest. */
function best(list, serveNo, secondWins) {
  if (!list.length) return null
  const pool = list.filter((c) => c.inRate >= IN_FLOOR[serveNo])
  if (!pool.length) return list.reduce((b, c) => (c.inRate > b.inRate ? c : b))
  return pool.reduce((b, c) => (scoreOf(c, serveNo, secondWins) > scoreOf(b, serveNo, secondWins) ? c : b))
}

// A safe second serve: deep in the middle of the box, with room for error on every side.
const SAFE_SPOT = { x: COURT.serviceLine - 1.5, z: -COURT.halfSingles / 2 }
const fallbacks = new Map()
/**
 * The second serve a missed first serve falls back on: the best one into the middle of the box.
 * It doesn't depend on the spot, so it's worked out once for each server and returner.
 */
export function fallbackSecond(who, maxKmh, level) {
  const key = JSON.stringify([who, maxKmh, level])
  if (!fallbacks.has(key)) {
    const spot = { x: SAFE_SPOT.x, z: SAFE_SPOT.z * sideSign(who.side) }
    const c = best(Object.values(serveOptions(who, maxKmh, level, spot)).flat(), 2)
    if (fallbacks.size > 32) fallbacks.clear()
    fallbacks.set(key, c ? { style: c.style, speedKmh: c.speedKmh, inRate: c.inRate, wins: c.wins } : null)
  }
  return fallbacks.get(key)
}

/** Everything the simple mode shows for a spot: each spin's options, and the fallback second serve. */
export function spotReport(who, maxKmh, level, spot) {
  return { options: serveOptions(who, maxKmh, level, spot), second: fallbackSecond(who, maxKmh, level) }
}

/**
 * How hard the serves that land in are to return, from 0 (every one comes back easily) to 1 (every
 * one is an ace or a return error). A tough return counts for half.
 */
export function returnDifficulty(c) {
  if (c.inRate <= 0) return 0
  return (c.share.ace + c.share.winner + 0.5 * c.share.tough) / c.inRate
}
export const difficultyWord = (d) => (d >= 0.65 ? 'veryHard' : d >= 0.45 ? 'hard' : d >= 0.25 ? 'medium' : 'easy')

/**
 * The best speed for each spin on this serve (first or second), and which spin is recommended.
 * report is what spotReport returned. A spin that can't reach the spot comes back as just { style }.
 */
export function rankOptions(report, serveNo) {
  const secondWins = report.second?.wins ?? 0
  const rows = Object.keys(STYLES).map((style) => {
    const c = best(report.options[style] ?? [], serveNo, secondWins)
    return c ? { ...c, score: scoreOf(c, serveNo, secondWins), difficulty: returnDifficulty(c) } : { style }
  })
  const ok = rows.filter((r) => r.score != null)
  const pick = best(ok, serveNo, secondWins)
  // What makes the pick stand out from the other spins, for the one-line reason.
  let why = 'balance'
  if (pick && ok.length > 1) {
    const others = ok.filter((r) => r !== pick)
    const safest = others.every((r) => pick.inRate >= r.inRate)
    const hardest = others.every((r) => pick.difficulty >= r.difficulty)
    why = safest && hardest ? 'both' : safest ? 'safest' : hardest ? 'hardest' : 'balance'
  }
  return { rows, pick: pick?.style ?? null, why }
}

// A standard normal draw (Box-Muller).
function gauss(rand) {
  const u = 1 - rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

/**
 * One serve played for real: hit with a random set of the usual small mistakes, then returned (or not)
 * by a returner of this level. won is null after a fault (the point goes on), else whether the server
 * won the point. sim is the flight, for drawing where it landed.
 */
export function playServe(c, level, side, rand = Math.random) {
  const flight = misHit(c.flight, c.noise, Array.from({ length: 5 }, () => gauss(rand)))
  const sim = simulateServe(flight, c.contact, { crossX: RETURN_X })
  if (sim.result !== 'in') return { kind: 'fault', why: sim.result, sim, won: null }
  const ret = evaluateReturn(sim, level, flight.speedKmh, side)
  if (ret.kind === 'ace') return { kind: 'ace', sim, won: true }
  const r = rand()
  if (r < ret.p.winner) return { kind: 'winner', sim, won: true }
  const kind = r < ret.p.winner + ret.p.tough ? 'tough' : 'easy'
  return { kind, sim, won: rand() < WIN_AFTER[kind] }
}
