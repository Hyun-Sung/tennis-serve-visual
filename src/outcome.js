// What happens after the serve: how much room for error it has, and whether the returner can do
// anything with it. The returner model is a simple estimate of what different levels can handle,
// not measured data.

import { boxZ, COURT, sideSign, simulateServe } from './physics.js'

// The returner waits just behind the baseline, about a metre inside the singles sideline of the box
// being served to, which splits the difference between a serve down the T and one swinging out wide.
export const RETURNER_READY = { x: 24.2, z: -3.05 }
export const returnerReady = (side) => ({ x: RETURNER_READY.x, z: RETURNER_READY.z * sideSign(side) })
// Where they usually meet the ball: a little in front of their body.
export const RETURN_X = 23.7
// A ball curving away from them can be cut off earlier on its path, up to CUT_OFF in front of that.
const CUT_OFF = 3
const MEET_STEP = 0.25
export const MEET_XS = Array.from({ length: CUT_OFF / MEET_STEP + 1 }, (_, i) => RETURN_X - (CUT_OFF - i * MEET_STEP))
/** What simulateServe needs to record for the returner. */
export const RETURN_FLIGHT = { crossX: RETURN_X, meetXs: MEET_XS }
export const LEVEL_LIMITS = [2, 5]
export const DEFAULT_LEVEL = 3.5

// Typical abilities at NTRP 2.0 and 5.0; levels in between blend the two.
// reaction: seconds before they move. accel, vmax: how fast they get across (m/s², m/s).
// reach: arm, racket and a lunge (m). pace: ball speed they handle comfortably at contact (km/h).
// high: the highest bounce they're comfortable with (m). prep: time they like for the backswing (s).
// speed: the fastest serve they're used to (km/h).
const LOW = { reaction: 0.42, accel: 5, vmax: 3, reach: 1.65, pace: 70, high: 1.25, prep: 0.75, speed: 110 }
const HIGH = { reaction: 0.25, accel: 8, vmax: 5, reach: 1.9, pace: 125, high: 1.7, prep: 0.55, speed: 175 }

export function levelParams(level) {
  const f = (level - LEVEL_LIMITS[0]) / (LEVEL_LIMITS[1] - LEVEL_LIMITS[0])
  const out = {}
  for (const k of Object.keys(LOW)) out[k] = LOW[k] + (HIGH[k] - LOW[k]) * f
  return out
}

/** How far the returner can travel t seconds after the serve is struck, in any direction. */
export function movable(t, L) {
  const tt = t - L.reaction
  if (tt <= 0) return 0
  const tAcc = L.vmax / L.accel
  return tt < tAcc ? 0.5 * L.accel * tt * tt : 0.5 * L.accel * tAcc * tAcc + L.vmax * (tt - tAcc)
}

const clamp01 = (x) => Math.min(Math.max(x, 0), 1)
// Difficulty above WINNER_AT is usually a return error (hit, but into the net or out); below EASY_BELOW
// it comes back comfortably.
const WINNER_AT = 0.8
const EASY_BELOW = 0.35
const sigmoid = (x) => 1 / (1 + Math.exp(-x))

// How far the ball at q is from where the returner usually meets it (RETURN_X, level with where they wait),
// how far they'd have to run to get it within reach, and how far they can run by then.
function reachFor(q, ready, L) {
  const D = Math.hypot(RETURN_X - q.x, q.z - ready.z)
  return { c: q, D, need: Math.max(0, D - L.reach), move: movable(q.t, L) }
}

/**
 * Where the returner meets the ball. They take the shortest way to its path: for a ball coming toward
 * them that's their usual spot, but one curving away from them they cut off by moving diagonally
 * forward, meeting it earlier on its path. That is the nearest point they can still reach in time. If
 * there's none, it's an ace, and they run for the point they came closest to reaching.
 */
function meetingPoint(sim, ready, L) {
  const c = sim.cross
  const path = c.short || !sim.path?.length ? [c] : sim.path
  let best = null
  let closest = null
  for (const q of path) {
    const r = reachFor(q, ready, L)
    if (r.need <= r.move) {
      if (!best || r.D <= best.D) best = r
    } else if (!closest || r.move - r.need > closest.move - closest.need) closest = r
  }
  return best ? { ...best, reached: true } : { ...closest, reached: false }
}

/**
 * How the returner copes with one serve that landed in, struck at serveKmh.
 * kind is 'ace' (they can't reach it), or a difficulty d where higher is harder,
 * split into chances of a return error (they hit it, but into the net or out), a tough return and an easy return.
 * courtSide is the side served from ('deuce' or 'ad'), which decides where the returner waits.
 * c is where they meet the ball, and D how far that is from their usual spot.
 */
export function evaluateReturn(sim, level, serveKmh, courtSide) {
  const ready = returnerReady(courtSide)
  if (sim.result !== 'in') return { kind: 'fault', ready }
  const L = levelParams(level)
  if (!sim.cross) return { kind: 'easy', d: 0, p: { winner: 0, tough: 0, easy: 1 }, L, ready }
  const { c, D, need, move, reached } = meetingPoint(sim, ready, L)
  const side = Math.sign(c.z - ready.z) || 1
  const base = { c, D, move, need, side, L, t: c.t, ready }
  if (!reached) return { ...base, kind: 'ace', d: Infinity, p: { winner: 0, tough: 0, easy: 0 } }

  // Each part is 0 when comfortable and grows as it gets harder.
  const stretch = move > 0 ? need / move : 0
  const pace = c.speedKmh / L.pace
  // A high bounce is only trouble when it's also quick: with time to spare they back up or step in
  // and take it at a comfortable height.
  const spare = clamp01((c.t - L.reaction - L.prep) / 0.5)
  const high = (Math.max(0, c.y - L.high) / 0.5) * (1 - spare)
  const low = Math.max(0, 0.4 - c.y) / 0.25
  const jam = D < 0.35 ? ((0.35 - D) / 0.35) * Math.min(1, pace) : 0
  const rush = clamp01((L.prep - (c.t - L.reaction)) / L.prep)
  const heat = Math.max(0, serveKmh / L.speed - 1)
  const d =
    0.9 * rush +
    0.9 * stretch * stretch +
    0.6 * Math.max(0, pace - 0.8) +
    1.2 * heat +
    0.5 * high +
    0.3 * low +
    0.35 * jam
  const winner = c.short ? 0 : sigmoid((d - WINNER_AT) / 0.12)
  const easy = c.short ? 1 : sigmoid((EASY_BELOW - d) / 0.1) * (1 - winner)
  const p = { winner, easy, tough: Math.max(0, 1 - winner - easy) }
  const kind = c.short ? 'easy' : d > WINNER_AT ? 'winner' : d > EASY_BELOW ? 'tough' : 'easy'
  return { ...base, kind, d, p, parts: { rush, stretch, pace, heat, high, low, jam } }
}

/**
 * Where the returner's body is t seconds after contact, as { x, z }: once they've reacted they set off
 * in a straight line toward where they meet the ball (diagonally forward when they cut it off).
 */
export function returnerAt(ret, t) {
  const home = ret?.ready ?? RETURNER_READY
  if (!ret || ret.kind === 'fault' || !ret.L || !ret.D) return { x: home.x, z: home.z }
  // Aim to finish about a racket's length from the ball, so they can swing at it.
  const want = Math.max(0, ret.D - (ret.kind === 'ace' ? 0 : 0.7))
  const run = Math.min(movable(Math.min(t, ret.t + 0.2), ret.L), want) / ret.D
  return { x: home.x - run * (RETURN_X - ret.c.x), z: home.z + run * (ret.c.z - home.z) }
}

// The small mistakes any server makes from serve to serve.
// brushDeg is how much the brush direction (the tilt of the spin axis) wanders. It matters most for
// slice: with the axis tipped sideways, a few degrees changes how much topspin is left to make the ball dip.
const NOISE = { angleDeg: 0.6, yawDeg: 1.0, speed: 0.03, rpm: 0.1, brushDeg: 8 }
export const TRIES = 1024
// A direction that's awkward for the hitting arm (strain, from swingDirection in serve.js) makes the
// aim wander most, and the racket angle and pace a little.
const STRAIN_SPREAD = { angleDeg: 0.5, yawDeg: 1, speed: 0.3 }

/** How big each kind of mistake is for this serve. */
export function noiseFor(plan) {
  const s = plan.direction?.strain ?? 0
  const out = { ...NOISE }
  for (const [k, f] of Object.entries(STRAIN_SPREAD)) out[k] = NOISE[k] * (1 + f * s)
  return out
}

// The tries are spread evenly (a Halton sequence through the normal curve) rather than drawn at
// random, so the percentages are steady and only move when the serve really changes.
// (Each try is one row: racket angle, aim, speed, spin and brush direction, in standard deviations.)
function halton(i, base) {
  let f = 1
  let r = 0
  while (i > 0) {
    f /= base
    r += f * (i % base)
    i = Math.floor(i / base)
  }
  return r
}
// Inverse of the standard normal CDF (Acklam's approximation).
function probit(p) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924]
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857]
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878]
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742]
  const lo = 0.02425
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - lo) return -probit(1 - p)
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}
const SAMPLES = Array.from({ length: TRIES }, (_, i) => [2, 3, 5, 7, 11].map((base) => probit(halton(i + 1, base))))

/** Racket angles (relative to this serve) that still land in: how far off you can be either way. */
function angleWindow(flight, contact) {
  const at = (da) => simulateServe({ ...flight, angleDeg: flight.angleDeg + da }, contact, { fast: true }).result
  if (at(0) !== 'in') return null
  const edge = (dir) => {
    let lo = 0
    let hi = 6 * dir
    if (at(hi) === 'in') return hi
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2
      if (at(mid) === 'in') lo = mid
      else hi = mid
    }
    return lo
  }
  return { down: edge(-1), up: edge(1) }
}

// Each kind of mistake on its own, g standard deviations in size.
function nudge(flight, tilt, which, g, noise) {
  const f = { ...flight }
  if (which === 0) f.angleDeg = flight.angleDeg + g * noise.angleDeg
  if (which === 1) f.yawOffsetDeg = (flight.yawOffsetDeg ?? 0) + g * noise.yawDeg
  if (which === 2) f.speedKmh = flight.speedKmh * (1 + g * noise.speed)
  if (which === 3) f.rpm = Math.max(0, flight.rpm * (1 + g * noise.rpm))
  if (which === 4) {
    const t = tilt + (g * noise.brushDeg * Math.PI) / 180
    f.axis = [0, Math.sin(t), -Math.cos(t)]
  }
  return f
}

/** The serve hit with all five kinds of mistake at once; g is each one's size in standard deviations. */
export function misHit(flight, noise, g) {
  const tilt = Math.atan2(flight.axis[1], -flight.axis[2])
  let f = flight
  for (let which = 0; which < 5; which++) f = nudge(f, tilt, which, g[which], noise)
  return f
}

// What matters about a flight: net clearance, where it bounces, and the ball at each place the returner
// could meet it (MEET_XS): when it gets there, how high, how far across and how fast.
const CLEAR = 0
const BX = 1
const BZ = 2
const MEET = 3
function measure(flight, contact) {
  const sim = simulateServe(flight, contact, { ...RETURN_FLIGHT, fast: true, ghost: true })
  const b = sim.bounce
  const c = sim.cross
  const m = [sim.net ? sim.net.clearance : -1, b ? b.x : 99, b ? b.z : 0]
  // A ball that bounces twice before a line is met where it bounced the second time (c).
  for (let i = 0; i < MEET_XS.length; i++) {
    const q = sim.path[i] ?? c
    m.push(q ? q.t : 9, q ? q.y : 1, q ? q.z : 0, q ? q.speedKmh : 0)
  }
  return { m, short: !!c?.short }
}

/**
 * Risk and reward for a serve: the share that lands in when hit with small mistakes, and how a
 * returner of this level fares against the ones that do.
 *
 * Rather than flying a thousand slightly-off serves, it flies this one with each kind of mistake
 * on its own (a little either way), measures how much each moves the ball, and adds those effects
 * up for each try. That keeps the numbers smooth and quick to work out.
 */
export function assessServe(plan, level, { window = true } = {}) {
  const { flight, contact } = plan
  const noise = noiseFor(plan)
  const [z0, z1] = boxZ(flight.side)
  const tilt = Math.atan2(flight.axis[1], -flight.axis[2])
  const base = measure(flight, contact)
  // How much each metric moves per standard deviation of each mistake.
  const slope = [0, 1, 2, 3, 4].map((which) => {
    const up = measure(nudge(flight, tilt, which, 1, noise), contact).m
    const down = measure(nudge(flight, tilt, which, -1, noise), contact).m
    return up.map((u, k) => (u - down[k]) / 2)
  })

  const tally = { fault: 0, ace: 0, winner: 0, tough: 0, easy: 0 }
  const m = new Array(base.m.length)
  // Where the returner could meet the ball, refilled for each try.
  const path = MEET_XS.map((x) => ({ t: 0, x, y: 0, z: 0, speedKmh: 0 }))
  const sim = { result: 'in', cross: null, path }
  for (const g of SAMPLES) {
    for (let k = 0; k < m.length; k++) {
      let v = base.m[k]
      for (let which = 0; which < 5; which++) v += slope[which][k] * g[which]
      m[k] = v
    }
    const fault =
      m[CLEAR] < 0 || m[BX] < COURT.net || m[BX] > COURT.serviceLine || m[BZ] < z0 || m[BZ] > z1
    if (fault) {
      tally.fault++
      continue
    }
    for (let i = 0; i < path.length; i++) {
      const k = MEET + 4 * i
      path[i].t = m[k]
      path[i].y = Math.max(m[k + 1], 0.05)
      path[i].z = m[k + 2]
      path[i].speedKmh = m[k + 3]
    }
    sim.cross = base.short ? { ...path.at(-1), short: true } : path.at(-1)
    const ret = evaluateReturn(sim, level, flight.speedKmh * (1 + g[2] * noise.speed), flight.side)
    if (ret.kind === 'ace') tally.ace++
    else for (const k of ['winner', 'tough', 'easy']) tally[k] += ret.p[k]
  }
  const share = {}
  for (const k of Object.keys(tally)) share[k] = tally[k] / TRIES
  // How the bounce scatters around the aimed-for spot: its covariance in x (depth) and z (sideways), in m².
  const spread = { xx: 0, xz: 0, zz: 0 }
  for (const s of slope) {
    spread.xx += s[BX] * s[BX]
    spread.xz += s[BX] * s[BZ]
    spread.zz += s[BZ] * s[BZ]
  }
  // window is optional so a search over many serves can skip it.
  return { inRate: 1 - share.fault, share, spread, window: window ? angleWindow(flight, contact) : null, noise, base: NOISE }
}
