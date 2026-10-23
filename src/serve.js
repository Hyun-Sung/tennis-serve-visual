// How the toss shapes the serve: where the ball is met, when, with which spin axis and launch angle.
// World axes match physics.js: x toward the receiver, y up, z to the server's right.

import { ballAt, solveAngle } from './physics.js'
import { CONTACT_T, poseAt, RELEASE_T, skeleton } from './pose.js'

export const BASE_X = -0.3
export const SERVER_Z = 0.5
// The 2D pose lives in the x-y plane; these spread the limbs out sideways in 3D.
export const SIDE = { hit: 0.2, toss: -0.2, front: -0.1, back: 0.12 }
const G = 9.81
const POSE_TOSS = CONTACT_T - RELEASE_T
// Toss further in front makes the server hit down more; behind makes them hit up.
const DEG_PER_M_FORWARD = 4

const contactPose = skeleton(poseAt(CONTACT_T), BASE_X)
const releasePose = skeleton(poseAt(RELEASE_T), BASE_X)
const SHOULDER = { x: contactPose.shoulder.x, y: contactPose.shoulder.y, z: SERVER_Z + SIDE.hit }
export const DEFAULT_CONTACT = { x: contactPose.racketHead.x, y: contactPose.racketHead.y, z: SERVER_Z + SIDE.hit }
const REACH = Math.hypot(DEFAULT_CONTACT.x - SHOULDER.x, DEFAULT_CONTACT.y - SHOULDER.y)
const RELEASE = { x: releasePose.tHand.x, y: releasePose.tHand.y, z: SERVER_Z + SIDE.toss }

export const DEFAULT_TOSS = { height: 3.4, forward: Math.round(DEFAULT_CONTACT.x * 100) / 100, side: 0 }
export const TOSS_LIMITS = { height: [2.2, 5], forward: [-0.4, 0.9], side: [-0.6, 0.6] }

// The server leans toward the toss, sideways more easily than forward, so distance counts for less.
function reachAt(x, z) {
  const d = Math.min(Math.hypot(0.75 * (x - SHOULDER.x), 0.5 * (z - SHOULDER.z)), REACH * 0.95)
  return SHOULDER.y + Math.sqrt(REACH * REACH - d * d)
}

/** Spin axis from the sideways toss: over the head gives kick, out to the right gives slice. */
export function spinFromToss(side, rpm) {
  const phi = Math.min(Math.max(20 + side * (side >= 0 ? 130 : 110), -40), 80)
  const r = (phi * Math.PI) / 180
  const axis = [0, Math.sin(r), -Math.cos(r)]
  const character = rpm < 500 ? 'flat' : phi < 5 ? 'kick' : phi > 45 ? 'slice' : 'topspin'
  return { axis, character, tilt: phi }
}

/**
 * Everything the toss decides, plus the launch angle the server ends up with.
 * @param {{toss:{height:number,forward:number,side:number}, speedKmh:number, rpm:number, aimZ:number,
 *   autoSwing:boolean, swingDeg:number}} s
 */
export function planServe(s) {
  const { toss } = s
  const cz = SERVER_Z + SIDE.hit + toss.side
  const reachY = reachAt(toss.forward, cz)
  const belowReach = toss.height < reachY
  const contact = { x: toss.forward, y: Math.min(reachY, toss.height), z: cz }

  const up = Math.sqrt(2 * G * Math.max(toss.height - RELEASE.y, 0.01))
  const tossTime = up / G + Math.sqrt((2 * (toss.height - contact.y)) / G)

  const spin = spinFromToss(toss.side, s.rpm)
  const base = { speedKmh: s.speedKmh, rpm: s.rpm, aimZ: s.aimZ, axis: spin.axis }
  // The server picks the sideways toss on purpose (kick or slice), so their swing allows for it.
  // Forward/back errors and a toss below their reach are mistakes the swing doesn't know about.
  const intended = { x: DEFAULT_CONTACT.x, y: reachAt(DEFAULT_CONTACT.x, cz), z: cz }
  const autoSwing = solveAngle({ ...base, angleDeg: 0 }, intended)
  const swingDeg = s.autoSwing ? autoSwing : s.swingDeg
  const launchDeg = swingDeg - DEG_PER_M_FORWARD * (toss.forward - DEFAULT_TOSS.forward)

  return {
    contact,
    release: RELEASE,
    reachY,
    belowReach,
    tossTime,
    contactT: RELEASE_T + tossTime,
    tossVy: up,
    spin,
    autoSwing,
    swingDeg,
    launchDeg,
    flight: { ...base, angleDeg: launchDeg },
    delta: { x: contact.x - DEFAULT_CONTACT.x, y: contact.y - DEFAULT_CONTACT.y, z: contact.z - DEFAULT_CONTACT.z },
  }
}

/** Real time to pose time: the toss stretches the stretch between release and contact. */
export function poseTime(plan, t) {
  if (t <= RELEASE_T) return t
  if (t <= plan.contactT) return RELEASE_T + ((t - RELEASE_T) * POSE_TOSS) / plan.tossTime
  return CONTACT_T + (t - plan.contactT)
}

/** Pose time back to real time, for placing phase labels on the timeline. */
export function realTime(plan, p) {
  if (p <= RELEASE_T) return p
  if (p <= CONTACT_T) return RELEASE_T + ((p - RELEASE_T) * plan.tossTime) / POSE_TOSS
  return plan.contactT + (p - CONTACT_T)
}

/** The ball for the whole sequence: in hand, tossed, then in flight. */
export function ballPosition(plan, sim, t) {
  if (t < RELEASE_T) {
    const j = skeleton(poseAt(t), BASE_X)
    return { x: j.tHand.x, y: j.tHand.y, z: SERVER_Z + SIDE.toss, phase: 'hand' }
  }
  if (t < plan.contactT) {
    const u = t - RELEASE_T
    const f = u / plan.tossTime
    const c = plan.contact
    return {
      x: RELEASE.x + (c.x - RELEASE.x) * f,
      y: RELEASE.y + plan.tossVy * u - 0.5 * G * u * u,
      z: RELEASE.z + (c.z - RELEASE.z) * f,
      phase: 'toss',
    }
  }
  return { ...ballAt(sim, t - plan.contactT), phase: 'flight' }
}

/** 3D joints for the server at pose time p, with the hitting arm bent toward the actual contact point. */
export function serverJoints(p, delta) {
  const j = skeleton(poseAt(p), BASE_X)
  const w = Math.exp(-(((p - CONTACT_T) / 0.16) ** 2))
  const at = (q, z, k = 0) => ({ x: q.x + delta.x * w * k, y: q.y + delta.y * w * k, z: SERVER_Z + z + delta.z * w * k })
  return {
    hip: at(j.hip, 0),
    neck: at(j.shoulder, 0),
    head: at(j.head, 0),
    hShoulder: at(j.shoulder, SIDE.hit),
    hElbow: at(j.hElbow, SIDE.hit + 0.05, 0.35),
    hHand: at(j.hHand, SIDE.hit, 0.8),
    racketHead: at(j.racketHead, SIDE.hit, 1),
    tShoulder: at(j.shoulder, SIDE.toss),
    tElbow: at(j.tElbow, SIDE.toss - 0.04),
    tHand: at(j.tHand, SIDE.toss),
    fHip: at(j.hip, SIDE.front),
    fKnee: at(j.fKnee, SIDE.front),
    fFoot: at(j.fFoot, SIDE.front),
    bHip: at(j.hip, SIDE.back),
    bKnee: at(j.bKnee, SIDE.back),
    bFoot: at(j.bFoot, SIDE.back),
    lean: poseAt(p).torso,
  }
}
