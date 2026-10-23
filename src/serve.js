// How the toss, footwork and swing shape the serve: where the ball is met, when, with what spin and launch angle.
// World axes match physics.js: x toward the receiver, y up, z to the server's right.

import { ballAt, COURT, solveAngle } from './physics.js'
import { BODY, CONTACT_T, poseAt, racketRoll, RELEASE_T, skeleton, torsoYaw } from './pose.js'

export const BASE_X = -0.3
export const SERVER_Z = 0.5
// The 2D pose lives in the x-y plane; these spread the limbs out sideways in 3D.
export const SIDE = { hit: 0.2, toss: -0.2, front: -0.1, back: 0.12 }
const G = 9.81
const POSE_TOSS = CONTACT_T - RELEASE_T
// Toss further in front makes the server hit down more; behind makes them hit up.
const DEG_PER_M_FORWARD = 4

const TAKEOFF = 1.1
const LANDING = 1.56
/** 0 on the ground, 1 at the top of the jump (pose time). */
export function jumpCurve(p) {
  return p <= TAKEOFF || p >= LANDING ? 0 : Math.sin((Math.PI * (p - TAKEOFF)) / (LANDING - TAKEOFF))
}
/** How far the body has carried forward into the court: 0 before takeoff, 1 at contact, a little more on landing. */
function forwardCurve(p) {
  return smooth((p - TAKEOFF) / (CONTACT_T - TAKEOFF)) + 0.3 * smooth((p - CONTACT_T) / 0.3)
}

// A pinpoint stance drives up and forward off both feet, so the server meets the ball higher and
// further into the court, and lands inside the baseline. A platform stance stays put.
export const STANCES = {
  platform: { forward: 0, lift: 0 },
  pinpoint: { forward: 0.15, lift: 0.06 },
}
export const DEFAULT_FOOTWORK = { stance: 'platform', jump: 0.15 }
export const JUMP_LIMITS = [0, 0.45]
const BASE_HEIGHT = 1.85
export const HEIGHT_LIMITS = [1.5, 2.1]
export const DEFAULT_HEIGHT = BASE_HEIGHT

/** A standing server with no adjustments, for the receiver and for working out reach. */
export const NEUTRAL_BODY = { delta: { x: 0, y: 0, z: 0 }, stance: 'platform', jumpExtra: 0, forwardShift: 0, scale: 1, hand: 1 }
export const DEFAULT_HAND = 'right'
/** +1 for a right-hander, -1 for a left-hander: a lefty is the righty mirrored across the server's spine. */
export const handSign = (hand) => (hand === 'left' ? -1 : 1)

// Everything that depends only on the server's size and hand, worked out once per combination.
const frames = new Map()
function frameFor(k, hs = 1) {
  const key = `${k.toFixed(3)}/${hs}`
  if (!frames.has(key)) {
    const cp = skeleton(poseAt(CONTACT_T), BASE_X, k)
    const shoulder = { x: cp.shoulder.x, y: cp.shoulder.y, z: SERVER_Z + SIDE.hit * k * hs }
    const contact = { x: cp.racketHead.x, y: cp.racketHead.y, z: SERVER_Z + SIDE.hit * k * hs }
    frames.set(key, {
      shoulder,
      contact,
      reach: Math.hypot(contact.x - shoulder.x, contact.y - shoulder.y),
      // How far the feet clear the ground at contact in the keyframed pose; the jump slider replaces it.
      authoredJump: Math.min(cp.fFoot.y, cp.bFoot.y),
      release: serverJoints(RELEASE_T, { ...NEUTRAL_BODY, scale: k, hand: hs }).tHand,
    })
  }
  return frames.get(key)
}
const BASE_FRAME = frameFor(1)

// toss.height is how far above the server's full reach (including the jump) the toss peaks, the way
// coaches describe it, so a taller server or a bigger jump tosses higher. Below zero the toss peaks
// under their reach and they have to hit it lower.
export const DEFAULT_TOSS = { height: 0.7, forward: Math.round(BASE_FRAME.contact.x * 100) / 100, side: 0 }
export const TOSS_LIMITS = { height: [-0.5, 1.8], forward: [-0.4, 0.9], side: [-0.6, 0.6] }

// The server leans toward the toss, sideways more easily than forward, so distance counts for less.
// x is measured as if the body hadn't moved forward.
function reachAt(x, z, f) {
  const d = Math.min(Math.hypot(0.75 * (x - f.shoulder.x), 0.5 * (z - f.shoulder.z)), f.reach * 0.95)
  return f.shoulder.y + Math.sqrt(f.reach * f.reach - d * d)
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
export function spinFromSwing(swing, hit, hs = 1) {
  const up = Math.max(swing.up - CONTACT_BRUSH * hit.v, 0)
  const side = swing.side + CONTACT_BRUSH * hit.u
  const amount = Math.min(Math.hypot(up, side), 1.2)
  const rpm = Math.round((MAX_RPM * amount) / 50) * 50
  const axis = amount > 0.001 ? [0, side / Math.hypot(up, side), -up / Math.hypot(up, side)] : [0, 0, -1]
  const tilt = (Math.atan2(side, up) * 180) / Math.PI
  // The physics is the same for either hand; only the names flip. A lefty's slice curves right.
  const handed = tilt * hs
  const character =
    rpm < 500
      ? 'flat'
      : handed > 50
        ? 'slice'
        : handed < -50
          ? 'reverse'
          : handed > 20
            ? 'topspin-slice'
            : rpm >= 2600 && handed > -20
              ? 'kick'
              : 'topspin'
  // The same spin split into its two jobs: topspin makes the ball dip and kick up, side spin curves it
  // (positive curves it left). They add up to rpm the way the sides of a right triangle do.
  const len = Math.hypot(up, side)
  const part = (x) => (len > 0.001 ? Math.round((rpm * x) / len / 50) * 50 : 0)
  return { axis, rpm, character, tilt, topspin: part(up), sidespin: part(side) }
}

/**
 * Everything the toss decides, plus the launch angle the server ends up with.
 * @param {{toss:{height:number,forward:number,side:number}, speedKmh:number, aimZ:number,
 *   autoSwing:boolean, swingDeg:number, stance:'platform'|'pinpoint', jump:number, height:number, hand:'right'|'left',
 *   swing:{up:number, side:number}, hit:{u:number, v:number}}} s
 *   jump is how far the feet leave the ground at contact, in meters; height is the server's height.
 *   toss.forward is measured from the server: the contact point moves with a taller body or a pinpoint stance.
 *   toss.height is measured above the server's reach, so the toss rises with their height and jump.
 */
export function planServe(s) {
  const { toss } = s
  const k = s.height / BASE_HEIGHT
  const hs = handSign(s.hand)
  const f = frameFor(k, hs)
  const stance = STANCES[s.stance]
  const cz = SERVER_Z + SIDE.hit * k * hs + toss.side
  // Jumping (and a pinpoint stance's extra drive) lifts the whole body, so the server meets the ball higher.
  const jumpExtra = s.jump + stance.lift - f.authoredJump
  const jumpLift = jumpExtra * jumpCurve(CONTACT_T)
  const tossOffset = toss.forward - DEFAULT_TOSS.forward
  const bodyX = f.contact.x + tossOffset
  const reachY = reachAt(bodyX, cz, f) + jumpLift
  const tossApex = reachY + toss.height
  const belowReach = toss.height < 0
  const contact = { x: bodyX + stance.forward, y: Math.min(reachY, tossApex), z: cz }

  const up = Math.sqrt(2 * G * Math.max(tossApex - f.release.y, 0.01))
  const tossTime = up / G + Math.sqrt((2 * (tossApex - contact.y)) / G)

  const spin = spinFromSwing(s.swing, s.hit, hs)
  const pitchFromHit = -CONTACT_PITCH_DEG * s.hit.v
  const base = { speedKmh: s.speedKmh, rpm: spin.rpm, aimZ: s.aimZ, axis: spin.axis, yawOffsetDeg: -CONTACT_YAW_DEG * s.hit.u }
  // The server picks their height, stance, jump, sideways toss, swing and contact point on purpose,
  // so the auto racket angle allows for them. A toss too far forward or back, or below their reach,
  // is a mistake it doesn't know about.
  const intended = { x: f.contact.x + stance.forward, y: reachAt(f.contact.x, cz, f) + jumpLift, z: cz }
  const autoSwing = solveAngle({ ...base, angleDeg: 0 }, intended) - pitchFromHit
  const swingDeg = s.autoSwing ? autoSwing : s.swingDeg
  // The racket face: the racket angle, tipped down by a toss in front (or up by one behind). Where on
  // the ball you hit then deflects the ball off that face (pitchFromHit), so the two can differ a little.
  const faceDeg = swingDeg - DEG_PER_M_FORWARD * tossOffset
  const launchDeg = faceDeg + pitchFromHit
  const faceYawDeg = (Math.atan2(s.aimZ - contact.z, COURT.serviceLine - contact.x) * 180) / Math.PI

  return {
    contact,
    release: f.release,
    reachY,
    belowReach,
    tossApex,
    tossTime,
    contactT: RELEASE_T + tossTime,
    tossVy: up,
    spin,
    autoSwing,
    swingDeg,
    launchDeg,
    flight: { ...base, angleDeg: launchDeg },
    faceDeg,
    faceYawDeg,
    // The arm reaches from wherever the jump and the stance already carried the body.
    delta: {
      x: contact.x - f.contact.x - stance.forward,
      y: contact.y - f.contact.y - jumpLift,
      z: contact.z - f.contact.z,
    },
    stance: s.stance,
    jumpExtra,
    forwardShift: stance.forward,
    scale: k,
    hand: hs,
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
    return { ...serverJoints(t, plan).tHand, phase: 'hand' }
  }
  if (t < plan.contactT) {
    const u = t - RELEASE_T
    const f = u / plan.tossTime
    const c = plan.contact
    const r = plan.release
    return {
      x: r.x + (c.x - r.x) * f,
      y: r.y + plan.tossVy * u - 0.5 * G * u * u,
      z: r.z + (c.z - r.z) * f,
      phase: 'toss',
    }
  }
  return { ...ballAt(sim, t - plan.contactT), phase: 'flight' }
}

// Function declarations, so they're ready when the frames are worked out at load time.
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
function legTo(hip, target, k) {
  const a = BODY.thigh * k
  const b = BODY.shin * k
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
 * body carries the contact correction (delta), the stance, the extra jump height, how far the stance
 * carries the body forward, the body scale and the hand (+1 right, -1 left).
 */
export function serverJoints(p, body) {
  const { delta } = body
  const k = body.scale ?? 1
  const hs = body.hand ?? 1
  const side = { hit: SIDE.hit * k * hs, toss: SIDE.toss * k * hs, front: SIDE.front * k * hs, back: SIDE.back * k * hs }
  const j = skeleton(poseAt(p), BASE_X, k)
  const w = Math.exp(-(((p - CONTACT_T) / 0.16) ** 2))
  // A lefty coils the other way, so their toss shoulder still turns toward the net.
  const yaw = (hs * torsoYaw(p) * Math.PI) / 180
  // Turning a shoulder offset (0, 0, side) about the spine moves it by this much.
  const turn = (side) => ({ x: side * Math.sin(yaw), z: side * (Math.cos(yaw) - 1) })
  const hitTurn = turn(side.hit)
  const tossTurn = turn(side.toss)
  // After contact the hitting arm keeps going across the body and finishes on the other side.
  const across = -0.55 * k * hs * smooth((p - CONTACT_T - 0.04) / 0.26)
  const handTurn = { x: hitTurn.x, z: hitTurn.z + across }
  const elbowTurn = { x: hitTurn.x, z: hitTurn.z + across * 0.5 }
  const lift = body.jumpExtra * jumpCurve(p)
  const ahead = (body.forwardShift ?? 0) * forwardCurve(p)

  let bKnee = j.bKnee
  let bFoot = j.bFoot
  let backZ = side.back
  const pin = body.stance === 'pinpoint' ? pinpointWeight(p) : 0
  if (pin > 0) {
    const leg = legTo(j.hip, { x: j.fFoot.x - 0.13 * k, y: 0 }, k)
    bKnee = lerp2(j.bKnee, leg.knee, pin)
    bFoot = lerp2(j.bFoot, leg.foot, pin)
    backZ = side.back + (0.04 * k * hs - side.back) * pin
  }

  // reach is how much of the contact correction a joint takes on: 1 for the racket, less up the arm.
  const at = (q, z, reach = 0, r = { x: 0, z: 0 }) => ({
    x: q.x + r.x + ahead + delta.x * w * reach,
    y: q.y + lift + delta.y * w * reach,
    z: SERVER_Z + z + r.z + delta.z * w * reach,
  })
  const foot = (q, z) => {
    const f = at(q, z)
    f.y = Math.max(f.y, 0)
    return f
  }
  const racketHead = at(j.racketHead, side.hit, 1, { x: hitTurn.x, z: hitTurn.z + across * 1.3 })
  let hHand = at(j.hHand, side.hit, 0.8, handTurn)
  let roll = racketRoll(p)
  // Around contact the racket turns to the serve's racket angle and aim: the face tilts to faceDeg
  // (by leaning the handle) and turns toward the target (by rolling about the handle). The head stays
  // on the ball.
  if (body.faceDeg != null && w > 0.001) {
    const lean = (-body.faceDeg * Math.PI) / 180
    const L = BODY.racketToHead
    hHand = {
      x: hHand.x + (racketHead.x - L * Math.sin(lean) - hHand.x) * w,
      y: hHand.y + (racketHead.y - L * Math.cos(lean) - hHand.y) * w,
      z: hHand.z,
    }
    roll -= body.faceYawDeg * w
  }
  return {
    hip: at(j.hip, 0),
    neck: at(j.shoulder, 0),
    head: at(j.head, 0),
    hShoulder: at(j.shoulder, side.hit, 0, hitTurn),
    hElbow: at(j.hElbow, side.hit + 0.05 * k * hs, 0.35, elbowTurn),
    hHand,
    racketHead,
    tShoulder: at(j.shoulder, side.toss, 0, tossTurn),
    tElbow: at(j.tElbow, side.toss - 0.04 * k * hs, 0, tossTurn),
    tHand: at(j.tHand, side.toss, 0, tossTurn),
    fHip: at(j.hip, side.front),
    fKnee: at(j.fKnee, side.front),
    fFoot: foot(j.fFoot, side.front),
    bHip: at(j.hip, side.back),
    bKnee: at(bKnee, backZ),
    bFoot: foot(bFoot, backZ),
    lean: poseAt(p).torso,
    yaw,
    roll: (roll * Math.PI) / 180,
    scale: k,
  }
}
