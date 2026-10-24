// The simple mode: pick a spot in the service box and a kind of serve, and see the best way to hit
// that serve there. It tries the serve with more and less spin at a few speeds, finds the racket angle
// and aim that land each one on the spot, flies each through the same error model and returner as the
// full tool, and scores them.

import { assessServe } from './outcome.js'
import { boxZ, COURT, simulateServe } from './physics.js'
import { SECOND_IN_FLOOR, serveFor, SLOWEST_SERVE, speedCap, WIN_AFTER } from './recommend.js'
import { planServe } from './serve.js'

// How much spin to try for each kind of serve, as shares of its usual brush (STYLES). More spin makes
// the ball dip into the box and kick up more, but takes pace off. A flat serve has next to none to vary.
// (A kick needs about 2,600 rpm to still be a kick, which is where its lightest brush sits.)
export const BRUSH = { flat: [1], slice: [0.7, 1, 1.3], 'topspin-slice': [0.7, 1, 1.3], kick: [0.85, 1, 1.25] }
// Speeds tried for each, as shares of the fastest it can be hit. A spot short in the box needs a
// slower ball to come down in time, so when none of these land in often, slower ones are tried too.
const PACE = [1, 0.9, 0.8, 0.7]
const SLOW_PACE = [0.6, 0.5]
const TRY_SLOWER_BELOW = 0.6

// Where the spot can go: just inside the lines, and not right up against the net.
const INSET = 0.05
const MIN_DEPTH = 1.5
export const DEFAULT_SPOT = { x: COURT.serviceLine - 1, z: -0.6 }
// The kind of serve to start with for the first and second serve: the usual club choice.
export const DEFAULT_SPINS = { 1: 'flat', 2: 'kick' }

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
 * Every way to hit this kind of serve onto the spot (each amount of spin at each speed), with its odds
 * against a returner of this level. who: { height, hand, side, stance, jump }, maxKmh: their fastest
 * flat serve, spot: { x, z } on the court in metres (z is negative in the deuce box). An empty list
 * means this serve can't land there.
 */
export function serveOptions(who, maxKmh, level, spot, style) {
  const tries = []
  for (const brush of BRUSH[style]) {
    const probe = planServe(serveFor(who, style, maxKmh, spot.z, brush))
    const cap = speedCap(maxKmh, probe.spin, probe.direction.strain)
    let start = { angleDeg: probe.autoSwing, aimZ: spot.z }
    const found = []
    const tryPace = (pace) => {
      const speedKmh = Math.round(cap * pace)
      if (speedKmh < SLOWEST_SERVE) return
      const flight = { ...probe.flight, speedKmh, angleDeg: start.angleDeg, aimZ: start.aimZ }
      const hit = solveFor(flight, probe.contact, spot)
      if (!hit) return
      // The next speed starts from this answer, which is close.
      start = hit
      const serve = { ...serveFor(who, style, speedKmh, hit.aimZ, brush), autoSwing: false, swingDeg: hit.angleDeg }
      const plan = planServe(serve)
      const risk = assessServe(plan, level, { window: false })
      found.push({
        id: `${brush}/${speedKmh}`,
        style,
        brush,
        pace,
        speedKmh,
        rpm: plan.spin.rpm,
        angleDeg: hit.angleDeg,
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
    if (!found.some((c) => c.inRate >= TRY_SLOWER_BELOW)) SLOW_PACE.forEach(tryPace)
    tries.push(...found)
  }
  return tries
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

/**
 * These from best to worst: first the ones that go in often enough, highest score first, then the
 * rest, the ones that go in most first (when nothing is safe enough, landing in comes first).
 */
function ordered(list, serveNo, secondWins) {
  const floor = IN_FLOOR[serveNo]
  const score = (c) => scoreOf(c, serveNo, secondWins)
  const safe = list.filter((c) => c.inRate >= floor).sort((a, b) => score(b) - score(a))
  const rest = list.filter((c) => c.inRate < floor).sort((a, b) => b.inRate - a.inRate)
  return [...safe, ...rest]
}

// Working out one serve for a spot takes a tenth of a second or so, and switching back and forth
// between serves (or first and second serve) asks for the same ones again, so the last few are kept.
const options = new Map()
function optionsFor(who, maxKmh, level, spot, style) {
  const key = JSON.stringify([who, maxKmh, level, spot, style])
  if (!options.has(key)) {
    if (options.size > 64) options.clear()
    options.set(key, serveOptions(who, maxKmh, level, spot, style))
  }
  return options.get(key)
}

/**
 * Everything the simple mode shows for a spot: every way to hit the serves chosen for the first and
 * second serve (spins: { 1: style, 2: style }), and which serves those are.
 */
export function spotReport(who, maxKmh, level, spot, spins) {
  const out = { spins, options: {} }
  for (const style of new Set([spins[1], spins[2]])) out.options[style] = optionsFor(who, maxKmh, level, spot, style)
  return out
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
 * Every way to hit the chosen serve on this serve (first or second), best first: rows[0] is the
 * recommended speed and spin. report is what spotReport returned. A first serve that misses goes to
 * the second serve's best option to the same spot, so second is that option (null if it can't get there).
 */
export function rankSettings(report, serveNo) {
  const withScore = (list, n, secondWins) =>
    ordered(list, n, secondWins).map((c) => ({ ...c, score: scoreOf(c, n, secondWins), difficulty: returnDifficulty(c) }))
  const second = withScore(report.options[report.spins[2]] ?? [], 2)[0] ?? null
  const rows = serveNo === 2 ? withScore(report.options[report.spins[2]] ?? [], 2) : withScore(report.options[report.spins[1]] ?? [], 1, second?.wins ?? 0)
  const pick = rows[0] ?? null
  // What makes the pick stand out from the other ways to hit it, for the one-line reason.
  let why = 'balance'
  if (pick && rows.length > 1) {
    const others = rows.slice(1)
    const safest = others.every((r) => pick.inRate >= r.inRate)
    const hardest = others.every((r) => pick.difficulty >= r.difficulty)
    why = safest && hardest ? 'both' : safest ? 'safest' : hardest ? 'hardest' : 'balance'
  }
  return { rows, pick, why, second }
}
