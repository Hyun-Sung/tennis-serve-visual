// How the toss, footwork and swing shape the serve: where the ball is met, when, with what spin and launch angle.
// World axes match physics.js: x toward the receiver, y up, z to the server's right.

import { ballAt, solveAngle } from './physics.js'
import { BODY, CONTACT_T, poseAt, racketRoll, RELEASE_T, skeleton, torsoYaw } from './pose.js'

export const BASE_X = -0.3
export const SERVER_Z = 0.5
// The 2D pose lives in the x-y plane; these spread the limbs out sideways in 3D.
export const SIDE = { hit: 0.2, toss: -0.2, front: -0.1, back: 0.12 }
const G = 9.81
const POSE_TOSS = CONTACT_T - RELEASE_T
// Toss further in front makes the server hit down more; behind makes them hit up.
const DEG_PER_M_FORWARD = 4

const contactPose = skeleton(poseAt(CONTACT_T), BASE_X)
const SHOULDER = { x: contactPose.shoulder.x, y: contactPose.shoulder.y, z: SERVER_Z + SIDE.hit }
export const DEFAULT_CONTACT = { x: contactPose.racketHead.x, y: contactPose.racketHead.y, z: SERVER_Z + SIDE.hit }
const REACH = Math.hypot(DEFAULT_CONTACT.x - SHOULDER.x, DEFAULT_CONTACT.y - SHOULDER.y)
// How far the feet clear the ground at contact in the keyframed pose; the jump slider adds to it.
const AUTHORED_JUMP = Math.min(contactPose.fFoot.y, contactPose.bFoot.y)
const TAKEOFF = 1.1
const LANDING = 1.56
/** 0 on the ground, 1 at the top of the jump (pose time). */
export const jumpCurve = (p) => (p <= TAKEOFF || p >= LANDING ? 0 : Math.sin((Math.PI * (p - TAKEOFF)) / (LANDING - TAKEOFF)))

export const DEFAULT_FOOTWORK = { stance: 'platform', jump: 0.15 }
export const JUMP_LIMITS = [0, 0.45]
/** A standing server with no adjustments, for the receiver and the ball before the toss. */
export const NEUTRAL_BODY = { delta: { x: 0, y: 0, z: 0 }, stance: 'platform', jumpExtra: 0 }
const RELEASE = serverJoints(RELEASE_T, NEUTRAL_BODY).tHand

export const DEFAULT_TOSS = { height: 3.4, forward: Math.round(DEFAULT_CONTACT.x * 100) / 100, side: 0 }
export const TOSS_LIMITS = { height: [2.2, 5], forward: [-0.4, 0.9], side: [-0.6, 0.6] }

// The server leans toward the toss, sideways more easily than forward, so distance counts for less.
function reachAt(x, z) {
  const d = Math.min(Math.hypot(0.75 * (x - SHOULDER.x), 0.5 * (z - SHOULDER.z)), REACH * 0.95)
  return SHOULDER.y + Math.sqrt(REACH * REACH - d * d)
}

const MAX_RPM = 4000
// Meeting the ball off-centre adds to the brush, the way coaches describe it on a clock face:
// low on the ball (6-7 o'clock) adds topspin, the right side (3 o'clock) adds slice.
const CONTACT_BRUSH = 0.7
// The ball also leaves away from where it was struck: hit it low and it goes up, hit its right side and it goes left.
const CONTACT_PITCH_DEG = 4
const CONTACT_YAW_DEG = 3

export const DEFAULT_SWING = { up: 0.45, side: 0.1 }
export const DEFAULT_HIT = { u: 0, v: 0 }
export const HIT_RADIUS = 0.8

/**
 * Spin from the arm swing and the contact point on the ball.
 * swing.up (0..1) brushes up the back of the ball for topspin; swing.side (-1..1) brushes across it,
 * positive to the right for slice. hit is where the strings meet the ball, seen from behind,
 * in ball radii: u to the right, v up.
 */
export function spinFromSwing(swing, hit) {
  const up = Math.max(swing.up - CONTACT_BRUSH * hit.v, 0)
  const side = swing.side + CONTACT_BRUSH * hit.u
  const amount = Math.min(Math.hypot(up, side), 1.2)
  const rpm = Math.round((MAX_RPM * amount) / 50) * 50
  const axis = amount > 0.001 ? [0, side / Math.hypot(up, side), -up / Math.hypot(up, side)] : [0, 0, -1]
  const tilt = (Math.atan2(side, up) * 180) / Math.PI
  const character =
    rpm < 500
      ? 'flat'
      : tilt > 50
        ? 'slice'
        : tilt < -50
          ? 'reverse'
          : tilt > 20
            ? 'topspin-slice'
            : rpm >= 2600 && tilt > -20
              ? 'kick'
              : 'topspin'
  return { axis, rpm, character, tilt, topspin: Math.round(MAX_RPM * Math.min(up, 1.2)), sidespin: Math.round(MAX_RPM * side) }
}

/**
 * Everything the toss decides, plus the launch angle the server ends up with.
 * @param {{toss:{height:number,forward:number,side:number}, speedKmh:number, aimZ:number,
 *   autoSwing:boolean, swingDeg:number, stance:'platform'|'pinpoint', jump:number,
 *   swing:{up:number, side:number}, hit:{u:number, v:number}}} s
 *   jump is how far the feet leave the ground at contact, in meters.
 */
export function planServe(s) {
  const { toss } = s
  const cz = SERVER_Z + SIDE.hit + toss.side
  // Jumping lifts the whole body, so the server can meet the ball that much higher.
  const jumpExtra = s.jump - AUTHORED_JUMP
  const jumpLift = jumpExtra * jumpCurve(CONTACT_T)
  const reachY = reachAt(toss.forward, cz) + jumpLift
  const belowReach = toss.height < reachY
  const contact = { x: toss.forward, y: Math.min(reachY, toss.height), z: cz }

  const up = Math.sqrt(2 * G * Math.max(toss.height - RELEASE.y, 0.01))
  const tossTime = up / G + Math.sqrt((2 * (toss.height - contact.y)) / G)

  const spin = spinFromSwing(s.swing, s.hit)
  const pitchFromHit = -CONTACT_PITCH_DEG * s.hit.v
  const base = { speedKmh: s.speedKmh, rpm: spin.rpm, aimZ: s.aimZ, axis: spin.axis, yawOffsetDeg: -CONTACT_YAW_DEG * s.hit.u }
  // The server picks the sideways toss, the jump, the swing and the contact point on purpose, so the
  // auto swing allows for them. A toss too far forward or back, or below their reach, is a mistake it
  // doesn't know about.
  const intended = { x: DEFAULT_CONTACT.x, y: reachAt(DEFAULT_CONTACT.x, cz) + jumpLift, z: cz }
  const autoSwing = solveAngle({ ...base, angleDeg: 0 }, intended) - pitchFromHit
  const swingDeg = s.autoSwing ? autoSwing : s.swingDeg
  const launchDeg = swingDeg + pitchFromHit - DEG_PER_M_FORWARD * (toss.forward - DEFAULT_TOSS.forward)

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
    // The arm reaches from wherever the jump already carried the body.
    delta: { x: contact.x - DEFAULT_CONTACT.x, y: contact.y - DEFAULT_CONTACT.y - jumpLift, z: contact.z - DEFAULT_CONTACT.z },
    stance: s.stance,
    jumpExtra,
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
    return { ...serverJoints(t, NEUTRAL_BODY).tHand, phase: 'hand' }
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

// Function declarations, so they're ready when RELEASE is worked out at load time.
function smooth(u) {
  const c = Math.min(Math.max(u, 0), 1)
  return c * c * (3 - 2 * c)
}

// Pinpoint stance: the back foot slides up beside the front foot during the toss, holds there
// through the trophy, then both feet drive up together.
function pinpointWeight(p) {
  if (p < 0.45 || p > 1.3) return 0
  if (p < 0.8) return smooth((p - 0.45) / 0.35)
  if (p < 1.12) return 1
  return 1 - smooth((p - 1.12) / 0.18)
}

/** Two-bone leg reaching for a foot target, with the knee bending toward the net. */
function legTo(hip, target) {
  const a = BODY.thigh
  const b = BODY.shin
  let dx = target.x - hip.x
  let dy = target.y - hip.y
  let d = Math.hypot(dx, dy)
  const max = (a + b) * 0.999
  if (d > max) {
    dx *= max / d
    dy *= max / d
    d = max
  }
  const ux = dx / d
  const uy = dy / d
  const cos = (a * a + d * d - b * b) / (2 * a * d)
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos))
  const nx = Math.abs(uy)
  const ny = uy < 0 ? ux : -ux
  return { knee: { x: hip.x + a * (cos * ux + sin * nx), y: hip.y + a * (cos * uy + sin * ny) }, foot: { x: hip.x + dx, y: hip.y + dy } }
}

function lerp2(a, b, k) {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}

/**
 * 3D joints for the server at pose time p. The shoulders coil side-on and uncoil through contact,
 * each arm riding along with its shoulder, and the hitting arm bends toward the actual contact point.
 * body carries the contact correction (delta), the stance and the extra jump height.
 */
export function serverJoints(p, body) {
  const { delta } = body
  const j = skeleton(poseAt(p), BASE_X)
  const w = Math.exp(-(((p - CONTACT_T) / 0.16) ** 2))
  const yaw = (torsoYaw(p) * Math.PI) / 180
  // Turning a shoulder offset (0, 0, side) about the spine moves it by this much.
  const turn = (side) => ({ x: side * Math.sin(yaw), z: side * (Math.cos(yaw) - 1) })
  const hitTurn = turn(SIDE.hit)
  const tossTurn = turn(SIDE.toss)
  // After contact the hitting arm keeps going across the body and finishes on the left side.
  const across = -0.55 * smooth((p - CONTACT_T - 0.04) / 0.26)
  const handTurn = { x: hitTurn.x, z: hitTurn.z + across }
  const elbowTurn = { x: hitTurn.x, z: hitTurn.z + across * 0.5 }
  const lift = body.jumpExtra * jumpCurve(p)

  let bKnee = j.bKnee
  let bFoot = j.bFoot
  let backZ = SIDE.back
  const pin = body.stance === 'pinpoint' ? pinpointWeight(p) : 0
  if (pin > 0) {
    const leg = legTo(j.hip, { x: j.fFoot.x - 0.13, y: 0 })
    bKnee = lerp2(j.bKnee, leg.knee, pin)
    bFoot = lerp2(j.bFoot, leg.foot, pin)
    backZ = SIDE.back + (0.04 - SIDE.back) * pin
  }

  const at = (q, z, k = 0, r = { x: 0, z: 0 }) => ({
    x: q.x + r.x + delta.x * w * k,
    y: q.y + lift + delta.y * w * k,
    z: SERVER_Z + z + r.z + delta.z * w * k,
  })
  const foot = (q, z) => {
    const f = at(q, z)
    f.y = Math.max(f.y, 0)
    return f
  }
  return {
    hip: at(j.hip, 0),
    neck: at(j.shoulder, 0),
    head: at(j.head, 0),
    hShoulder: at(j.shoulder, SIDE.hit, 0, hitTurn),
    hElbow: at(j.hElbow, SIDE.hit + 0.05, 0.35, elbowTurn),
    hHand: at(j.hHand, SIDE.hit, 0.8, handTurn),
    racketHead: at(j.racketHead, SIDE.hit, 1, { x: hitTurn.x, z: hitTurn.z + across * 1.3 }),
    tShoulder: at(j.shoulder, SIDE.toss, 0, tossTurn),
    tElbow: at(j.tElbow, SIDE.toss - 0.04, 0, tossTurn),
    tHand: at(j.tHand, SIDE.toss, 0, tossTurn),
    fHip: at(j.hip, SIDE.front),
    fKnee: at(j.fKnee, SIDE.front),
    fFoot: foot(j.fFoot, SIDE.front),
    bHip: at(j.hip, SIDE.back),
    bKnee: at(bKnee, backZ),
    bFoot: foot(bFoot, backZ),
    lean: poseAt(p).torso,
    yaw,
    roll: (racketRoll(p) * Math.PI) / 180,
  }
}
