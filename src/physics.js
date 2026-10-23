// Ball flight for a serve: gravity, drag and Magnus lift, one bounce model.
// World axes: x toward the receiver, y up, z to the server's right. Meters, seconds.

const G = 9.81
const RHO = 1.21 // air density, kg/m^3
export const BALL_R = 0.0335
const MASS = 0.057
const CD = 0.55
const K = (0.5 * RHO * Math.PI * BALL_R * BALL_R) / MASS

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

export const netHeightAt = (z) =>
  COURT.netCenter + (COURT.netPost - COURT.netCenter) * Math.min(Math.abs(z) / COURT.halfDoubles, 1)

/**
 * @param {{speedKmh:number, angleDeg:number, aimZ:number, axis:number[], rpm:number}} p
 *   axis is the unit spin axis: -z is topspin, +y curves the ball left (slice), -y right (kick)
 * @param {{x:number, y:number, z:number}} c contact point
 */
export function simulateServe(p, c) {
  const v0 = p.speedKmh / 3.6
  const a = (p.angleDeg * Math.PI) / 180
  const yaw = Math.atan2(p.aimZ - c.z, COURT.serviceLine - c.x)
  let pos = [c.x, c.y, c.z]
  let vel = [v0 * Math.cos(a) * Math.cos(yaw), v0 * Math.sin(a), v0 * Math.cos(a) * Math.sin(yaw)]
  let omega = p.axis.map((u) => (u * p.rpm * 2 * Math.PI) / 60)

  const dt = 1 / 1000
  const sampleEvery = 3
  const points = [{ t: 0, x: pos[0], y: pos[1], z: pos[2] }]
  const ev = { net: null, bounce: null, result: null, peakAfterBounce: 0 }
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
      if (clearance < 0) {
        hitNet = true
        pos[0] = COURT.net - BALL_R
        vel = [-0.12 * vel[0], Math.min(vel[1], 0) * 0.25, vel[2] * 0.3]
        omega = [0, 0, 0]
      }
    }

    if (pos[1] <= BALL_R && vel[1] < 0) {
      pos[1] = BALL_R
      bounces++
      if (bounces === 1) ev.bounce = { t, x: pos[0], z: pos[2], speedKmh: s * 3.6 }
      // Tangential friction pulls the contact patch toward rolling.
      const rim = cross(omega, [0, -BALL_R, 0])
      vel = [vel[0] - 0.4 * (vel[0] + rim[0]), -0.75 * vel[1], vel[2] - 0.4 * (vel[2] + rim[2])]
      omega = omega.map((o) => o * 0.5)
    }
    if (bounces === 1 && !hitNet) ev.peakAfterBounce = Math.max(ev.peakAfterBounce, pos[1])

    if (i % sampleEvery === 0) points.push({ t, x: pos[0], y: pos[1], z: pos[2] })
    if (bounces >= 2 || pos[0] > COURT.length + 6 || Math.abs(pos[2]) > 12) break
    if (hitNet && Math.hypot(...vel) < 0.3) break
  }
  points.push({ t: points.at(-1).t + dt, x: pos[0], y: pos[1], z: pos[2] })

  const b = ev.bounce
  if (hitNet || (b && b.x < COURT.net)) ev.result = 'net'
  else if (!b || b.x > COURT.serviceLine) ev.result = 'long'
  else if (b.z < -COURT.halfSingles || b.z > 0) ev.result = 'wide'
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
    const sim = simulateServe({ ...p, angleDeg: mid }, c)
    const x = sim.result === 'net' ? -1 : sim.bounce ? sim.bounce.x : 1e9
    if (x < targetX) lo = mid
    else hi = mid
  }
  return Math.round(((lo + hi) / 2) * 10) / 10
}
