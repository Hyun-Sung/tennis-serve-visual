import * as THREE from 'three'
import { mesh, toon } from './toon.js'

const UP = new THREE.Vector3(0, 1, 0)
const WORLD_Z = new THREE.Vector3(0, 0, 1)
const v = (p) => new THREE.Vector3(p.x, p.y, p.z)

const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 14)
const unitSphere = new THREE.SphereGeometry(1, 20, 14)

const twistQ = new THREE.Quaternion()

// A cylinder from a to b, re-aimed every frame. depth < 1 flattens it front to back,
// and twist turns that flat side about its own axis.
function bone(material, radius, depth = 1) {
  const m = mesh(unitCylinder, material)
  return {
    m,
    set(a, b, twist = 0) {
      const dir = new THREE.Vector3().subVectors(b, a)
      const len = dir.length()
      m.position.copy(a).addScaledVector(dir, 0.5)
      m.quaternion.setFromUnitVectors(UP, dir.normalize())
      if (twist) m.quaternion.multiply(twistQ.setFromAxisAngle(UP, twist))
      m.scale.set(radius * depth, len, radius)
    },
  }
}

function ball(material, radius) {
  const m = mesh(unitSphere, material)
  m.scale.setScalar(radius)
  return m
}

function racket() {
  const g = new THREE.Group()
  const frame = toon('#e2574c')
  const handle = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.36, 10), toon('#2f3e66'))
  handle.position.y = 0.1
  const hoop = mesh(new THREE.TorusGeometry(0.13, 0.012, 8, 36), frame)
  hoop.scale.set(0.95, 1.2, 1)
  hoop.position.y = 0.44
  const strings = mesh(
    new THREE.CircleGeometry(0.125, 32),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  )
  strings.scale.set(0.95, 1.2, 1)
  strings.position.y = 0.44
  g.add(handle, hoop, strings)
  return g
}

/**
 * A stylized player assembled from cylinders and spheres.
 * update() takes the joints from serverJoints() (or a mirrored copy) in world meters.
 */
export function createFigure({ shirt = '#f27b5c', shorts = '#2f3e66', skin = '#f1c7a3', hair = '#4a3426', facing = 1 } = {}) {
  const group = new THREE.Group()
  const skinM = toon(skin)
  const shirtM = toon(shirt)
  const shortsM = toon(shorts)
  const shoeM = toon('#ffffff')

  const torso = bone(shirtM, 0.17, 0.62)
  const chest = ball(shirtM, 0.17)
  chest.scale.set(0.12, 0.15, 0.2)
  const pelvis = ball(shortsM, 0.15)
  const limbs = {
    hUpper: bone(shirtM, 0.055),
    hFore: bone(skinM, 0.042),
    tUpper: bone(shirtM, 0.055),
    tFore: bone(skinM, 0.042),
    fThigh: bone(shortsM, 0.075),
    fShin: bone(skinM, 0.052),
    bThigh: bone(shortsM, 0.075),
    bShin: bone(skinM, 0.052),
  }
  const joints = {
    hElbow: ball(skinM, 0.045),
    hHand: ball(skinM, 0.045),
    tElbow: ball(skinM, 0.045),
    tHand: ball(skinM, 0.045),
    fKnee: ball(skinM, 0.055),
    bKnee: ball(skinM, 0.055),
  }
  const shoes = [0, 1].map(() => mesh(new THREE.BoxGeometry(0.26, 0.09, 0.11), shoeM))

  const head = new THREE.Group()
  const face = ball(skinM, 0.13)
  const hairCap = mesh(new THREE.SphereGeometry(0.138, 20, 12, Math.PI * 1.3, Math.PI * 1.4, 0, Math.PI * 0.55), toon(hair))
  const band = mesh(new THREE.TorusGeometry(0.133, 0.018, 8, 28), toon('#ffffff'))
  band.rotation.x = Math.PI / 2
  band.position.y = 0.04
  const eyes = [-0.045, 0.045].map((z) => {
    const e = ball(toon('#2b2b2b'), 0.017)
    e.position.set(0.118, 0.01, z)
    return e
  })
  head.add(face, hairCap, band, ...eyes)
  head.rotation.y = facing > 0 ? 0 : Math.PI

  const rk = racket()
  group.add(torso.m, chest, pelvis, head, rk, ...shoes, ...Object.values(joints), ...Object.values(limbs).map((l) => l.m))

  const basis = new THREE.Matrix4()
  const xAxis = new THREE.Vector3()
  const zAxis = new THREE.Vector3()

  function update(j) {
    const hip = v(j.hip)
    const neck = v(j.neck)
    torso.set(hip, neck, j.yaw ?? 0)
    chest.position.copy(neck).lerp(hip, 0.18)
    chest.rotation.y = j.yaw ?? 0
    pelvis.position.copy(hip)
    head.position.copy(v(j.head))
    head.rotation.z = (-(j.lean ?? 0) * 0.5 * Math.PI) / 180

    limbs.hUpper.set(v(j.hShoulder), v(j.hElbow))
    limbs.hFore.set(v(j.hElbow), v(j.hHand))
    limbs.tUpper.set(v(j.tShoulder), v(j.tElbow))
    limbs.tFore.set(v(j.tElbow), v(j.tHand))
    limbs.fThigh.set(v(j.fHip), v(j.fKnee))
    limbs.fShin.set(v(j.fKnee), v(j.fFoot))
    limbs.bThigh.set(v(j.bHip), v(j.bKnee))
    limbs.bShin.set(v(j.bKnee), v(j.bFoot))
    for (const k of Object.keys(joints)) joints[k].position.copy(v(j[k]))
    shoes[0].position.set(j.fFoot.x + 0.06 * facing, Math.max(j.fFoot.y, 0.045), j.fFoot.z)
    shoes[1].position.set(j.bFoot.x + 0.06 * facing, Math.max(j.bFoot.y, 0.045), j.bFoot.z)

    // Racket: its long axis runs hand → head. At roll 0 the strings face along the swing
    // (square to the target at contact); at roll 90° the edge leads.
    const hand = v(j.hHand)
    const tip = v(j.racketHead)
    const yAxis = new THREE.Vector3().subVectors(tip, hand).normalize()
    xAxis.copy(WORLD_Z).addScaledVector(yAxis, -yAxis.dot(WORLD_Z)).normalize()
    zAxis.crossVectors(xAxis, yAxis)
    basis.makeBasis(xAxis, yAxis, zAxis)
    rk.quaternion.setFromRotationMatrix(basis).multiply(twistQ.setFromAxisAngle(UP, j.roll ?? 0))
    rk.position.copy(tip).addScaledVector(yAxis, -0.44)
  }

  return { group, update }
}

/** Mirror server-style joints to face the other way, standing at (x, z). */
export function mirrorJoints(j, x, z, refX, refZ) {
  const out = {}
  for (const [k, p] of Object.entries(j)) {
    out[k] = typeof p === 'object' ? { x: x - (p.x - refX), y: p.y, z: z - (p.z - refZ) } : p
  }
  return out
}
