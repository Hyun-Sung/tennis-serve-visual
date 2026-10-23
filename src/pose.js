// Side-view serve motion, keyframed as joint angles and blended with Catmull-Rom.
// Angles are in degrees, 0 = straight up, 90 = toward the net, 180 = straight down.
// Hitting-arm angles keep winding past 360 so the blend swings the right way round.

export const BODY = {
  torso: 0.6,
  neck: 0.22,
  head: 0.12,
  upperArm: 0.32,
  forearm: 0.3,
  racketToHead: 0.44,
  thigh: 0.46,
  shin: 0.47,
}

// hx/hy: hip position. h*: hitting arm, t*: tossing arm, f*/b*: front/back leg.
const KEYS = [
  { t: 0.0, hx: 0, hy: 0.9, torso: 4, hU: 165, hF: 140, rk: 95, tU: 165, tF: 125, fT: 172, fS: 182, bT: 195, bS: 195 },
  { t: 0.45, hx: -0.06, hy: 0.88, torso: -4, hU: 200, hF: 210, rk: 235, tU: 150, tF: 140, fT: 168, fS: 185, bT: 192, bS: 198 },
  { t: 0.85, hx: -0.04, hy: 0.76, torso: -18, hU: 265, hF: 335, rk: 320, tU: 15, tF: 8, fT: 148, fS: 205, bT: 168, bS: 222 },
  { t: 1.12, hx: 0.04, hy: 0.82, torso: -10, hU: 315, hF: 375, rk: 195, tU: 40, tF: 70, fT: 160, fS: 196, bT: 180, bS: 212 },
  { t: 1.3, hx: 0.18, hy: 1.0, torso: 12, hU: 372, hF: 374, rk: 380, tU: 150, tF: 120, fT: 176, fS: 180, bT: 202, bS: 205 },
  { t: 1.6, hx: 0.42, hy: 0.92, torso: 32, hU: 495, hF: 530, rk: 575, tU: 125, tF: 95, fT: 165, fS: 185, bT: 215, bS: 250 },
  { t: 2.1, hx: 0.6, hy: 0.9, torso: 10, hU: 525, hF: 510, rk: 470, tU: 160, tF: 130, fT: 172, fS: 182, bT: 192, bS: 196 },
]

export const CONTACT_T = 1.3
export const RELEASE_T = 0.78

export const PHASES = [
  { t: 0, label: 'stance' },
  { t: 0.45, label: 'toss' },
  { t: 0.85, label: 'trophy' },
  { t: 1.12, label: 'racket drop' },
  { t: CONTACT_T, label: 'contact' },
  { t: 1.6, label: 'follow-through' },
]

const CHANNELS = Object.keys(KEYS[0]).filter((k) => k !== 't')

const catmull = (p0, p1, p2, p3, u) =>
  0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)

export function poseAt(t) {
  const last = KEYS.length - 1
  if (t <= KEYS[0].t) return { ...KEYS[0] }
  if (t >= KEYS[last].t) return { ...KEYS[last] }
  let i = 0
  while (KEYS[i + 1].t < t) i++
  const k0 = KEYS[Math.max(i - 1, 0)]
  const k1 = KEYS[i]
  const k2 = KEYS[i + 1]
  const k3 = KEYS[Math.min(i + 2, last)]
  const u = (t - k1.t) / (k2.t - k1.t)
  const out = { t }
  for (const c of CHANNELS) out[c] = catmull(k0[c], k1[c], k2[c], k3[c], u)
  return out
}

const step = (p, len, deg) => {
  const r = (deg * Math.PI) / 180
  return { x: p.x + len * Math.sin(r), y: p.y + len * Math.cos(r) }
}

/** Joint positions in meters for a pose, with the player's base at x = baseX. */
export function skeleton(pose, baseX = 0) {
  const hip = { x: baseX + pose.hx, y: pose.hy }
  const shoulder = step(hip, BODY.torso, pose.torso)
  const head = step(shoulder, BODY.neck, pose.torso * 0.6)
  const hElbow = step(shoulder, BODY.upperArm, pose.hU)
  const hHand = step(hElbow, BODY.forearm, pose.hF)
  const racketHead = step(hHand, BODY.racketToHead, pose.rk)
  const tElbow = step(shoulder, BODY.upperArm, pose.tU)
  const tHand = step(tElbow, BODY.forearm, pose.tF)
  const fKnee = step(hip, BODY.thigh, pose.fT)
  const fFoot = step(fKnee, BODY.shin, pose.fS)
  const bKnee = step(hip, BODY.thigh, pose.bT)
  const bFoot = step(bKnee, BODY.shin, pose.bS)
  const j = { hip, shoulder, head, hElbow, hHand, racketHead, tElbow, tHand, fKnee, fFoot, bKnee, bFoot }
  // Keep the lower foot on the ground instead of sinking through it.
  const lift = Math.max(0, -Math.min(fFoot.y, bFoot.y))
  for (const p of Object.values(j)) p.y += lift
  return { ...j, racketAngle: pose.rk }
}
