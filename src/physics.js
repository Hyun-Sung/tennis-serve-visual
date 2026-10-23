// Ball flight for a serve: gravity, drag and Magnus lift, one bounce model.
// World axes: x toward the receiver, y up, z to the server's right. Meters, seconds.

const G = 9.81
const RHO = 1.21 // air density, kg/m^3
export const BALL_R = 0.0335
const MASS = 0.057
const CD = 0.55
const K = (0.5 * RHO * Math.PI * BALL_R * BALL_R) / MASS
// Extra upward bounce per m/s of topspin at the ball's rim.
const KICK = 0.12

export const COURT = {
  length: 23.77,
  net: 11.885,
  serviceLine: 18.285,
  halfSingles: 4.115,
  halfDoubles: 5.485,
  netCenter: 0.914,
  netPost: 1.07,
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

// The server stands right of the centre mark and serves to the deuce box (on their left), or left of
// it and serves to the ad box (on their right). Everything about the ad court is the deuce court
// mirrored across the centre line, so +1 for deuce, -1 for ad.
export const COURT_SIDES = ['deuce', 'ad']
export const sideSign = (side) => (side === 'ad' ? -1 : 1)
/** The z range of the service box a serve from this side has to land in. */
export const boxZ = (side) => (side === 'ad' ? [0, COURT.halfSingles] : [-COURT.halfSingles, 0])

export const netHeightAt = (z) =>
  COURT.netCenter + (COURT.netPost - COURT.netCenter) * Math.min(Math.abs(z) / COURT.halfDoubles, 1)

/**
 * @param {{speedKmh:number, angleDeg:number, aimZ:number, axis:number[], rpm:number}} p
 *   axis is the unit spin axis: -z is topspin, +y curves the ball left (slice), -y right.
 *   yawOffsetDeg (optional) turns the launch direction; positive is to the right.
 *   side (optional, 'deuce' or 'ad') picks the box it has to land in; deuce if left out.
 * @param {{x:number, y:number, z:number}} c contact point
 * @param {{crossX?:number, meetXs?:number[], fast?:boolean, ghost?:boolean}} [opts]
 *   crossX records where the ball crosses that x after the bounce (where the returner usually meets it).
 *   meetXs (ascending, none past crossX) records where it crosses each of those x after the bounce, as path:
 *   the places further up its path where the returner could cut it off.
 *   fast skips the sampled path and stops as soon as the outcome is known, for running many serves.
 *   ghost lets the ball fly through the net and on past a fault, so clearance, bounce and return point
 *   all change smoothly with the serve (for measuring how sensitive it is).
 */
export function simulateServe(p, c, opts = {}) {
  const { crossX = Infinity, meetXs = [], fast = false, ghost = false } = opts
  const [z0, z1] = boxZ(p.side)
  const inBox = (x, z) => x >= COURT.net && x <= COURT.serviceLine && z >= z0 && z <= z1
  const v0 = p.speedKmh / 3.6
  const a = (p.angleDeg * Math.PI) / 180
  const yaw = Math.atan2(p.aimZ - c.z, COURT.serviceLine - c.x) + ((p.yawOffsetDeg ?? 0) * Math.PI) / 180
  let pos = [c.x, c.y, c.z]
  let vel = [v0 * Math.cos(a) * Math.cos(yaw), v0 * Math.sin(a), v0 * Math.cos(a) * Math.sin(yaw)]
  let omega = p.axis.map((u) => (u * p.rpm * 2 * Math.PI) / 60)

  const dt = 1 / 1000
  const sampleEvery = 3
  const points = [{ t: 0, x: pos[0], y: pos[1], z: pos[2] }]
  const ev = { net: null, bounce: null, result: null, peakAfterBounce: 0, cross: null, path: [] }
  let bounces = 0
  let hitNet = false

  for (let i = 1; i < 4000; i++) {
    const t = i * dt
    const s = Math.hypot(...vel)
    const w = Math.hypot(...omega)
    const acc = vel.map((v) => -K * CD * s * v)
    if (w > 0 && s > 0.1) {
      const cl = 1 / (2 + s / (BALL_R * w))
      const lift = cross(omega, vel)
      const ll = Math.hypot(...lift) || 1
      for (let k = 0; k < 3; k++) acc[k] += (K * cl * s * s * lift[k]) / ll
    }
    acc[1] -= G
    vel = vel.map((v, k) => v + acc[k] * dt)
    const prev = pos
    pos = pos.map((q, k) => q + vel[k] * dt)

    if (!ev.net && prev[0] < COURT.net && pos[0] >= COURT.net) {
      const f = (COURT.net - prev[0]) / (pos[0] - prev[0])
      const y = prev[1] + f * (pos[1] - prev[1])
      const z = prev[2] + f * (pos[2] - prev[2])
      const clearance = y - BALL_R - netHeightAt(z)
      ev.net = { t, y, z, clearance, speedKmh: s * 3.6 }
      if (clearance < 0 && !ghost) {
        hitNet = true
        if (fast) break
        pos[0] = COURT.net - BALL_R
        vel = [-0.12 * vel[0], Math.min(vel[1], 0) * 0.25, vel[2] * 0.3]
        omega = [0, 0, 0]
      }
    }

    if (pos[1] <= BALL_R && vel[1] < 0) {
      pos[1] = BALL_R
      bounces++
      if (bounces === 1) ev.bounce = { t, x: pos[0], z: pos[2], speedKmh: s * 3.6 }
      // A ball that dies before reaching the returner: they just step in and take it.
      if (bounces === 2 && !ev.cross && !hitNet) ev.cross = { t, x: pos[0], y: BALL_R, z: pos[2], speedKmh: s * 3.6, short: true }
      if (fast && !ghost && bounces === 1 && !inBox(pos[0], pos[2])) break
      // Tangential friction pulls the contact patch toward rolling, and heavy topspin grips the
      // court and kicks the ball up a little higher than it came in.
      const rim = cross(omega, [0, -BALL_R, 0])
      const kick = KICK * BALL_R * Math.max(0, -omega[2])
      vel = [vel[0] - 0.4 * (vel[0] + rim[0]), -0.75 * vel[1] + kick, vel[2] - 0.4 * (vel[2] + rim[2])]
      omega = omega.map((o) => o * 0.5)
    }
    if (bounces === 1 && !hitNet) ev.peakAfterBounce = Math.max(ev.peakAfterBounce, pos[1])
    while (bounces === 1 && !hitNet && ev.path.length < meetXs.length && pos[0] >= meetXs[ev.path.length]) {
      // A line the ball had already passed when it bounced (a long serve) is taken where it bounced.
      const f = Math.max(0, (meetXs[ev.path.length] - prev[0]) / (pos[0] - prev[0]))
      const at = (k) => prev[k] + f * (pos[k] - prev[k])
      ev.path.push({ t, x: at(0), y: at(1), z: at(2), speedKmh: s * 3.6 })
    }
    if (bounces === 1 && !hitNet && !ev.cross && prev[0] < crossX && pos[0] >= crossX) {
      const f = (crossX - prev[0]) / (pos[0] - prev[0])
      ev.cross = { t, x: crossX, y: prev[1] + f * (pos[1] - prev[1]), z: prev[2] + f * (pos[2] - prev[2]), speedKmh: s * 3.6 }
      if (fast) break
    }

    if (!fast && i % sampleEvery === 0) points.push({ t, x: pos[0], y: pos[1], z: pos[2] })
    if (bounces >= 2 || pos[0] > COURT.length + 6 || Math.abs(pos[2]) > 12) break
    if (hitNet && Math.hypot(...vel) < 0.3) break
  }
  points.push({ t: points.at(-1).t + dt, x: pos[0], y: pos[1], z: pos[2] })

  const b = ev.bounce
  if (hitNet || (b && b.x < COURT.net)) ev.result = 'net'
  else if (!b || b.x > COURT.serviceLine) ev.result = 'long'
  else if (b.z < z0 || b.z > z1) ev.result = 'wide'
  else ev.result = 'in'

  return { points, ...ev, duration: points.at(-1).t }
}

/** Ball position at time t (seconds after contact), linearly interpolated. */
export function ballAt(sim, t) {
  const pts = sim.points
  if (t <= 0) return pts[0]
  if (t >= sim.duration) return pts.at(-1)
  let lo = 0
  let hi = pts.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (pts[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = pts[lo]
  const b = pts[hi]
  const f = (t - a.t) / (b.t - a.t)
  return { t, x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y), z: a.z + f * (b.z - a.z) }
}

/** Launch angle that lands the ball at depth targetX, found by bisection. */
export function solveAngle(p, c, targetX = COURT.serviceLine - 1.2) {
  let lo = -14
  let hi = 10
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    const sim = simulateServe({ ...p, angleDeg: mid }, c, { fast: true })
    const x = sim.result === 'net' ? -1 : sim.bounce ? sim.bounce.x : 1e9
    if (x < targetX) lo = mid
    else hi = mid
  }
  return Math.round(((lo + hi) / 2) * 10) / 10
}
