import * as THREE from 'three'
import { COURT, netHeightAt } from '../physics.js'
import { mesh, toon } from './toon.js'

const POST_Z = COURT.halfDoubles + 0.914
const FENCE = { x0: -6.4, x1: COURT.length + 6.4, z: 10.5, h: 3.6 }

function flat(w, d, color, x, z, y = 0) {
  const m = mesh(new THREE.PlaneGeometry(w, d), toon(color), { cast: false, receive: true })
  m.rotation.x = -Math.PI / 2
  m.position.set(x, y, z)
  return m
}

function lines() {
  const g = new THREE.Group()
  const W = 0.05
  const y = 0.004
  const { length: L, net, serviceLine: S, halfSingles: hs, halfDoubles: hd } = COURT
  const near = 2 * net - S
  const add = (x0, z0, x1, z1) => {
    const w = Math.max(Math.abs(x1 - x0), W)
    const d = Math.max(Math.abs(z1 - z0), W)
    g.add(flat(w, d, '#ffffff', (x0 + x1) / 2, (z0 + z1) / 2, y))
  }
  add(0, -hd, 0, hd)
  add(L, -hd, L, hd)
  for (const z of [-hd, -hs, hs, hd]) add(0, z, L, z)
  add(near, -hs, near, hs)
  add(S, -hs, S, hs)
  add(near, 0, S, 0)
  add(0, 0, 0.15, 0)
  add(L - 0.15, 0, L, 0)
  return g
}

function netMesh() {
  const g = new THREE.Group()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')
  ctx.strokeStyle = 'rgba(25,30,40,0.9)'
  ctx.lineWidth = 3
  ctx.strokeRect(0, 0, 32, 32)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace

  const N = 80
  const pos = []
  const uv = []
  const band = []
  const idx = []
  for (let i = 0; i <= N; i++) {
    const z = -POST_Z + (2 * POST_Z * i) / N
    const top = netHeightAt(z)
    pos.push(COURT.net, 0, z, COURT.net, top, z)
    uv.push(z / 0.045, 0, z / 0.045, top / 0.045)
    band.push(COURT.net, top - 0.055, z, COURT.net, top + 0.005, z)
    if (i < N) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  const net = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }))
  net.castShadow = true

  const bandGeo = new THREE.BufferGeometry()
  bandGeo.setAttribute('position', new THREE.Float32BufferAttribute(band, 3))
  bandGeo.setIndex(idx)
  bandGeo.computeVertexNormals()
  const bandMesh = mesh(bandGeo, toon('#ffffff', { side: THREE.DoubleSide }))

  g.add(net, bandMesh)
  for (const z of [-POST_Z, POST_Z]) {
    const post = mesh(new THREE.CylinderGeometry(0.045, 0.045, COURT.netPost + 0.04, 12), toon('#2f5e45'))
    post.position.set(COURT.net, (COURT.netPost + 0.04) / 2, z)
    g.add(post)
  }
  return g
}

// Trees and fence panels are hidden when they block the camera. Each one is a group tagged
// userData.occluder, so the scene can hide them one at a time.
function occluder(parts) {
  const g = new THREE.Group()
  g.add(...parts)
  g.userData = { occluder: true }
  return g
}

function fence() {
  const panels = []
  const { x0, x1, z, h } = FENCE
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, h + 0.15, 8)
  // One panel per gap between posts, from (ax, az) to (bx, bz), with the post at its start.
  const wall = (ax, az, bx, bz, n) => {
    for (let i = 0; i < n; i++) {
      const sx = ax + ((bx - ax) * i) / n
      const sz = az + ((bz - az) * i) / n
      const ex = ax + ((bx - ax) * (i + 1)) / n
      const ez = az + ((bz - az) * (i + 1)) / n
      const w = Math.hypot(ex - sx, ez - sz)
      const panel = mesh(new THREE.PlaneGeometry(w, h), toon('#3f7a5a', { side: THREE.DoubleSide }), { cast: false, receive: true })
      panel.position.set((sx + ex) / 2, h / 2, (sz + ez) / 2)
      panel.rotation.y = Math.atan2(-(ez - sz), ex - sx)
      const post = mesh(postGeo, toon('#2f5e45'), { cast: false })
      post.position.set(sx, (h + 0.15) / 2, sz)
      panels.push(occluder([panel, post]))
    }
  }
  wall(x0, -z, x1, -z, 10)
  wall(x1, -z, x1, z, 6)
  wall(x1, z, x0, z, 10)
  wall(x0, z, x0, -z, 6)
  return panels
}

function trees() {
  const out = []
  const leaf = ['#7fb37f', '#6aa36f', '#8cc08a']
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const ring = []
  for (let x = FENCE.x0 - 2; x <= FENCE.x1 + 2; x += 3.2) ring.push([x, -FENCE.z - 3], [x, FENCE.z + 3])
  for (let z = -FENCE.z; z <= FENCE.z; z += 3.4) ring.push([FENCE.x0 - 3, z], [FENCE.x1 + 3, z])
  for (const [x, z] of ring) {
    const r = 1.4 + rand() * 1.3
    const t = mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.4, 8), toon('#8a6a4a'), { cast: false })
    t.position.set(x + rand() - 0.5, 1.2, z + rand() - 0.5)
    const crown = mesh(new THREE.IcosahedronGeometry(r, 1), toon(leaf[Math.floor(rand() * 3)]), { cast: false })
    crown.position.set(t.position.x, 2.4 + r * 0.8, t.position.z)
    out.push(occluder([t, crown]))
  }
  return out
}

function clouds() {
  const g = new THREE.Group()
  const m = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  const puff = new THREE.SphereGeometry(1, 16, 10)
  for (const [x, y, z, s] of [[-30, 26, -45, 3], [10, 30, -60, 4], [45, 24, -40, 3.5], [60, 28, 30, 3], [-40, 22, 35, 3.2], [20, 32, 55, 4]]) {
    for (const [dx, dy, ss] of [[0, 0, 1], [1.4, 0.3, 0.75], [-1.3, 0.2, 0.7], [0.5, 0.6, 0.7]]) {
      const p = new THREE.Mesh(puff, m)
      p.position.set(x + dx * s, y + dy * s, z)
      p.scale.set(ss * s * 1.4, ss * s * 0.6, ss * s * 0.8)
      g.add(p)
    }
  }
  return g
}

/** Ground, court, net, windscreen, trees and a few clouds. The fence panels and trees come back as occluders too. */
export function buildWorld() {
  const g = new THREE.Group()
  g.add(flat(400, 400, '#79b36f', 11.9, 0, -0.01))
  g.add(flat(FENCE.x1 - FENCE.x0, 2 * FENCE.z, '#5f9e6e', (FENCE.x0 + FENCE.x1) / 2, 0, 0))
  g.add(flat(COURT.length, 2 * COURT.halfDoubles, '#3d6fb6', COURT.length / 2, 0, 0.002))
  const occluders = [...fence(), ...trees()]
  g.add(lines(), netMesh(), clouds(), ...occluders)
  return { world: g, occluders }
}
