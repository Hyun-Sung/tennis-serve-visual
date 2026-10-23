import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { BALL_R, COURT } from '../physics.js'
import { RELEASE_T } from '../pose.js'
import { BASE_X, poseTime, SERVER_Z, serverJoints } from '../serve.js'
import { buildWorld } from '../three/court.js'
import { createFigure, mirrorJoints } from '../three/figure.js'
import { mesh, toon } from '../three/toon.js'

const VIEWS = [
  { id: 'server', label: 'server' },
  { id: 'receiver', label: 'receiver' },
  { id: 'net', label: 'net cam' },
  { id: 'side', label: 'side' },
]

const RECEIVER = { x: 24.4, z: -2.9 }
const NO_DELTA = { x: 0, y: 0, z: 0 }

function viewPose(id, sim) {
  if (id === 'receiver') return { pos: [RECEIVER.x + 0.2, 1.62, RECEIVER.z], target: [0.6, 1.5, 0.4], fov: 26 }
  if (id === 'net') {
    const z = sim.net ? sim.net.z : -0.8
    return { pos: [COURT.net - 1.1, 1.15, -9.8], target: [COURT.net, 0.95, z], fov: 26 }
  }
  if (id === 'side') return { pos: [11.9, 3.4, 10.2], target: [11.9, 1.1, -0.5], fov: 64 }
  return { pos: [-5.6, 2.8, SERVER_Z + 1.8], target: [12, 0.9, -1.2], fov: 50 }
}

function labelSprite() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false }))
  sprite.scale.set(0.2, 0.05, 1)
  sprite.renderOrder = 10
  sprite.setText = (text, bg) => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 512, 128)
    ctx.font = '800 64px ui-rounded, "Segoe UI", system-ui, sans-serif'
    const w = Math.min(ctx.measureText(text).width + 60, 512)
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.roundRect((512 - w) / 2, 14, w, 100, 50)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 66)
    tex.needsUpdate = true
  }
  return sprite
}

function setup(host, live) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#bfe3f5')
  scene.fog = new THREE.Fog('#d6eef8', 60, 160)
  scene.add(new THREE.HemisphereLight('#eaf6ff', '#5f9e6e', 1.7))
  const sun = new THREE.DirectionalLight('#fff4dc', 2.4)
  sun.position.set(-6, 22, 12)
  sun.target.position.set(12, 0, 0)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 16, bottom: -16, near: 1, far: 60 })
  sun.shadow.bias = -0.0004
  scene.add(sun, sun.target, buildWorld())

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 400)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI * 0.495
  controls.minDistance = 1
  controls.maxDistance = 60

  const server = createFigure()
  const receiver = createFigure({ shirt: '#5aa9e6', shorts: '#ffffff', hair: '#2b2118', facing: -1 })
  scene.add(server.group, receiver.group)

  const ball = new THREE.Group()
  const ballR = BALL_R * 1.5
  ball.add(mesh(new THREE.SphereGeometry(ballR, 20, 14), toon('#d8ef3a')))
  const seam = mesh(new THREE.TorusGeometry(ballR * 0.98, ballR * 0.09, 6, 30), toon('#ffffff'))
  seam.rotation.set(0.5, 0.9, 0)
  ball.add(seam)
  scene.add(ball)

  const pathMat = new LineMaterial({ color: 0xffffff, linewidth: 2, dashed: true, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.75 })
  const tossMat = new LineMaterial({ color: 0xffffff, linewidth: 1.5, dashed: true, dashSize: 0.08, gapSize: 0.07, transparent: true, opacity: 0.6 })
  const trailMat = new LineMaterial({ color: 0xffc94d, linewidth: 4 })
  const path = new Line2(new LineGeometry(), pathMat)
  const tossPath = new Line2(new LineGeometry(), tossMat)
  const trail = new Line2(new LineGeometry(), trailMat)
  for (const l of [path, tossPath, trail]) l.frustumCulled = false
  scene.add(path, tossPath, trail)
  let trailOrig = null
  let trailMod = -1

  const bounce = mesh(new THREE.RingGeometry(0.16, 0.24, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), { cast: false })
  bounce.rotation.x = -Math.PI / 2
  scene.add(bounce)

  const clearance = new THREE.Group()
  const gapLine = new Line2(new LineGeometry(), new LineMaterial({ color: 0xffe08a, linewidth: 3 }))
  const label = labelSprite()
  clearance.add(gapLine, label)
  scene.add(clearance)
  const lineMats = [pathMat, tossMat, trailMat, gapLine.material]

  const resize = () => {
    const w = host.clientWidth
    const h = host.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    for (const m of lineMats) m.resolution.set(w, h)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()

  // Camera moves between views with a short glide; grabbing the view with the mouse cancels it.
  let shownView = null
  let glide = null
  controls.addEventListener('start', () => (glide = null))
  const goTo = (id, sim, instant) => {
    const to = viewPose(id, sim)
    if (instant) {
      camera.position.set(...to.pos)
      controls.target.set(...to.target)
      camera.fov = to.fov
      camera.updateProjectionMatrix()
      glide = null
      return
    }
    glide = {
      start: performance.now(),
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      fromFov: camera.fov,
      to: { pos: new THREE.Vector3(...to.pos), target: new THREE.Vector3(...to.target), fov: to.fov },
    }
  }

  let lastSim = null
  let lastPlan = null
  const rebuild = (plan, sim) => {
    const pts = sim.points.flatMap((p) => [p.x, p.y, p.z])
    path.geometry.dispose()
    path.geometry = new LineGeometry().setPositions(pts)
    path.computeLineDistances()
    trail.geometry.dispose()
    trail.geometry = new LineGeometry().setPositions(pts)
    trailOrig = trail.geometry.attributes.instanceStart.data.array.slice()
    trailMod = -1

    const toss = []
    for (let i = 0; i <= 30; i++) {
      const u = (plan.tossTime * i) / 30
      const f = u / plan.tossTime
      const r = plan.release
      toss.push(r.x + (plan.contact.x - r.x) * f, r.y + plan.tossVy * u - 4.905 * u * u, r.z + (plan.contact.z - r.z) * f)
    }
    tossPath.geometry.dispose()
    tossPath.geometry = new LineGeometry().setPositions(toss)
    tossPath.computeLineDistances()

    if (sim.bounce) {
      bounce.position.set(sim.bounce.x, 0.012, sim.bounce.z)
      bounce.material.color.set(sim.result === 'in' ? '#c8f04a' : '#ff6b5b')
    }
    if (sim.net) {
      const top = sim.net.y - BALL_R - sim.net.clearance
      gapLine.geometry.dispose()
      gapLine.geometry = new LineGeometry().setPositions([COURT.net, top, sim.net.z, COURT.net, Math.max(sim.net.y - BALL_R, top), sim.net.z])
      gapLine.visible = sim.net.clearance > 0
      label.position.set(COURT.net, Math.max(sim.net.y, top) + 0.3, sim.net.z)
      const cm = Math.round(sim.net.clearance * 100)
      label.setText(cm >= 0 ? `clears by ${cm} cm` : 'into the net', cm >= 0 ? '#2f3e66' : '#e2574c')
    }
  }

  const setTrail = (count, b) => {
    const geo = trail.geometry
    const data = geo.attributes.instanceStart.data
    const arr = data.array
    const nSeg = arr.length / 6
    if (trailMod >= 0) arr.set(trailOrig.subarray(trailMod * 6 + 3, trailMod * 6 + 6), trailMod * 6 + 3)
    trailMod = -1
    const seg = count - 1
    if (seg >= 0 && seg < nSeg) {
      arr[seg * 6 + 3] = b.x
      arr[seg * 6 + 4] = b.y
      arr[seg * 6 + 5] = b.z
      trailMod = seg
    }
    data.needsUpdate = true
    geo.instanceCount = Math.max(0, Math.min(count, nSeg))
  }

  const spinQ = new THREE.Quaternion()
  let raf
  const frame = (now) => {
    raf = requestAnimationFrame(frame)
    const { t, plan, sim, ball: b, view } = live.current
    if (!plan) return
    if (sim !== lastSim || plan !== lastPlan) {
      rebuild(plan, sim)
      lastSim = sim
      lastPlan = plan
    }
    if (view !== shownView) {
      goTo(view, sim, shownView === null)
      shownView = view
    }
    if (glide) {
      const k = Math.min((now - glide.start) / 800, 1)
      const e = k * k * (3 - 2 * k)
      camera.position.lerpVectors(glide.fromPos, glide.to.pos, e)
      controls.target.lerpVectors(glide.fromTarget, glide.to.target, e)
      camera.fov = glide.fromFov + (glide.to.fov - glide.fromFov) * e
      camera.updateProjectionMatrix()
      if (k >= 1) glide = null
    }

    server.update(serverJoints(poseTime(plan, t), plan.delta))
    const bob = 0.025 * (1 + Math.sin(now / 160))
    const rj = mirrorJoints(serverJoints(0, NO_DELTA), RECEIVER.x, RECEIVER.z, BASE_X, SERVER_Z)
    for (const p of Object.values(rj)) if (typeof p === 'object') p.y += bob
    receiver.update(rj)
    receiver.group.visible = view !== 'receiver'

    const flown = t - plan.contactT
    ball.position.set(b.x, b.y, b.z)
    // Real spin is far too fast to see; this is a slowed-down hint of its axis and rate.
    const turns = flown > 0 ? flown * (plan.flight.rpm / 60) * 0.08 : (t - RELEASE_T) * 0.6
    spinQ.setFromAxisAngle(new THREE.Vector3(...plan.flight.axis), turns * Math.PI * 2)
    ball.quaternion.copy(spinQ)

    const count = flown > 0 ? sim.points.filter((p) => p.t <= flown).length : 0
    setTrail(count, b)
    trail.visible = flown > 0
    tossPath.visible = flown < 0.6
    bounce.visible = !!sim.bounce && flown >= sim.bounce.t
    clearance.visible = !!sim.net && flown >= sim.net.t

    controls.update()
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    controls.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
}

export default function Scene3D({ t, plan, sim, ball, view, onView }) {
  const hostRef = useRef(null)
  const live = useRef({})
  useEffect(() => {
    live.current = { t, plan, sim, ball, view }
  })
  useEffect(() => setup(hostRef.current, live), [])

  return (
    <div className="scene">
      <div ref={hostRef} className="canvas-host" />
      <div className="views" role="group" aria-label="camera">
        {VIEWS.map((v) => (
          <button key={v.id} className={v.id === view ? 'on' : ''} onClick={() => onView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      <span className="orbit-hint">drag to look around</span>
    </div>
  )
}
