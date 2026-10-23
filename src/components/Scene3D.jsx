import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { RETURNER_READY, returnerZ } from '../outcome.js'
import { BALL_R, COURT } from '../physics.js'
import { RELEASE_T } from '../pose.js'
import { BASE_X, NEUTRAL_BODY, poseTime, SERVER_Z, serverJoints } from '../serve.js'
import { buildWorld } from '../three/court.js'
import { createFigure, mirrorJoints } from '../three/figure.js'
import { mesh, toon } from '../three/toon.js'

// Camera views; each id is also its label's key (views.<id>).
const VIEWS = ['server', 'receiver', 'net', 'side', 'coach']

const RECEIVER = RETURNER_READY
// The label over the returner for each outcome (its words come from outcome.<kind>).
const OUTCOME_COLOR = {
  ace: '#7c5cff',
  winner: '#3d8fd6',
  tough: '#2f9e78',
  easy: '#e8892c',
}

function viewPose(id, sim, hand) {
  if (id === 'receiver') return { pos: [RECEIVER.x + 0.2, 1.62, RECEIVER.z], target: [0.6, 1.5, 0.4], fov: 26 }
  if (id === 'net') {
    const z = sim.net ? sim.net.z : -0.8
    return { pos: [COURT.net - 1.1, 1.15, -9.8], target: [COURT.net, 0.95, z], fov: 26 }
  }
  // Side-on close-up of the server, the way coaches film a serve.
  // From the hitting-arm side, so a left-hander is filmed from their left.
  if (id === 'coach') return { pos: [0.3, 1.75, SERVER_Z + 4.4 * (hand === 'left' ? -1 : 1)], target: [0.3, 1.7, SERVER_Z], fov: 48 }
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
    // Shrink the type to fit, since some languages say it in many more characters.
    const family = 'ui-rounded, "Segoe UI", system-ui, sans-serif'
    ctx.font = `800 64px ${family}`
    const size = Math.max(28, Math.min(64, (64 * 440) / ctx.measureText(text).width))
    ctx.font = `800 ${size}px ${family}`
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
  const { world, occluders } = buildWorld()
  scene.add(sun, sun.target, world)

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
  // Serves kept for comparison: a solid line and a bounce ring each, in their own color.
  const keptGroup = new THREE.Group()
  scene.add(keptGroup)
  const keptMats = []
  let lastKept = null
  let lastColor = null
  const rebuildKept = (kept) => {
    for (const c of keptGroup.children) {
      c.geometry.dispose()
      c.material.dispose()
    }
    keptGroup.clear()
    keptMats.length = 0
    for (const k of kept) {
      const mat = new LineMaterial({ color: k.color, linewidth: 3 })
      mat.resolution.set(host.clientWidth, host.clientHeight)
      keptMats.push(mat)
      const line = new Line2(new LineGeometry().setPositions(k.points.flatMap((p) => [p.x, p.y, p.z])), mat)
      line.frustumCulled = false
      keptGroup.add(line)
      if (k.bounce) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 28), new THREE.MeshBasicMaterial({ color: k.color, side: THREE.DoubleSide }))
        ring.rotation.x = -Math.PI / 2
        ring.position.set(k.bounce.x, 0.01, k.bounce.z)
        keptGroup.add(ring)
      }
    }
  }
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
  // What the returner made of it, shown over their head once the ball reaches them.
  const outcomeLabel = labelSprite()
  scene.add(outcomeLabel)
  let lastOutcome = null

  const resize = () => {
    const w = host.clientWidth
    const h = host.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    for (const m of [...lineMats, ...keptMats]) m.resolution.set(w, h)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()

  // Camera moves between views with a short glide; grabbing the view with the mouse cancels it.
  let shownView = null
  let shownHand = null
  let glide = null
  controls.addEventListener('start', () => (glide = null))
  const goTo = (id, sim, instant, hand) => {
    const to = viewPose(id, sim, hand)
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
  let lastUnits = null
  let lastTr = null
  const rebuild = (plan, sim, units, tr) => {
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
      const clears = sim.net.clearance >= 0
      label.setText(clears ? tr('scene.clearsBy', { d: units.short(sim.net.clearance) }) : tr('scene.intoNet'), clears ? '#2f3e66' : '#e2574c')
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

  // Hide any tree or fence panel between the camera and what you're watching.
  const ray = new THREE.Raycaster()
  const toFocus = new THREE.Vector3()
  // Sight lines run to the players and ball, plus a spread of points over the court,
  // so anything covering part of the court is hidden too.
  const COURT_POINTS = []
  for (const x of [-0.5, 5.5, COURT.net, 18.3, COURT.length]) {
    for (const z of [-COURT.halfDoubles, 0, COURT.halfDoubles]) COURT_POINTS.push(new THREE.Vector3(x, 0.8, z))
  }
  const NEAR_CAMERA = 5
  const camDir = new THREE.Vector3()
  for (const o of occluders) {
    o.updateWorldMatrix(true, true)
    o.userData.sphere = new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere())
  }
  const hideOccluders = (points) => {
    const blocked = new Set()
    // Anything right in front of the lens takes up half the view, even off the sight lines.
    camera.getWorldDirection(camDir)
    for (const o of occluders) {
      const { center, radius } = o.userData.sphere
      toFocus.subVectors(center, camera.position)
      if (toFocus.length() - radius < NEAR_CAMERA && toFocus.dot(camDir) > -radius) blocked.add(o)
    }
    for (const f of points) {
      toFocus.subVectors(f, camera.position)
      const dist = toFocus.length()
      ray.set(camera.position, toFocus.normalize())
      ray.far = dist
      for (const hit of ray.intersectObjects(occluders, true)) {
        let o = hit.object
        while (o && !o.userData.occluder) o = o.parent
        if (o) blocked.add(o)
      }
    }
    // Raycasting still sees hidden objects, so a hidden one comes back as soon as it's out of the way.
    for (const o of occluders) o.visible = !blocked.has(o)
  }

  const spinQ = new THREE.Quaternion()
  let raf
  const frame = (now) => {
    raf = requestAnimationFrame(frame)
    const { t, plan, sim, ball: b, view, kept, lineColor, ret, hand, units, tr } = live.current
    if (!plan) return
    // Redraw whenever the words change, not just the outcome, so a renamed label never lingers.
    const outcome = OUTCOME_COLOR[ret?.kind] ? [tr(`outcome.${ret.kind}`), OUTCOME_COLOR[ret.kind]] : null
    if (outcome && outcome.join('|') !== lastOutcome) {
      outcomeLabel.setText(...outcome)
      lastOutcome = outcome.join('|')
    }
    if (kept !== lastKept) {
      rebuildKept(kept)
      lastKept = kept
    }
    if (lineColor !== lastColor) {
      trailMat.color.set(lineColor)
      lastColor = lineColor
    }
    if (sim !== lastSim || plan !== lastPlan || units !== lastUnits || tr !== lastTr) {
      rebuild(plan, sim, units, tr)
      lastTr = tr
      lastSim = sim
      lastPlan = plan
      lastUnits = units
    }
    if (view !== shownView || (view === 'coach' && hand !== shownHand)) {
      goTo(view, sim, shownView === null, hand)
      shownView = view
      shownHand = hand
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

    const sj = serverJoints(poseTime(plan, t), plan)
    server.update(sj)
    const flown = t - plan.contactT
    // The returner bounces on their toes, then sets off toward the ball once they've reacted.
    const rz = returnerZ(ret, Math.max(flown, 0))
    const moving = Math.abs(rz - RECEIVER.z) > 0.01
    const bob = moving ? 0 : 0.025 * (1 + Math.sin(now / 160))
    const rj = mirrorJoints(serverJoints(0, NEUTRAL_BODY), RECEIVER.x, rz, BASE_X, SERVER_Z)
    for (const p of Object.values(rj)) if (typeof p === 'object') p.y += bob
    receiver.update(rj)
    receiver.group.visible = view !== 'receiver'
    outcomeLabel.visible = !!(ret?.c && OUTCOME_COLOR[ret.kind] && flown >= ret.c.t)
    outcomeLabel.position.set(RECEIVER.x, 2.5, rz)
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
    hideOccluders([
      controls.target,
      new THREE.Vector3(sj.head.x, sj.head.y, sj.head.z),
      new THREE.Vector3(sj.hip.x, 0.3, sj.hip.z),
      ball.position,
      new THREE.Vector3(RECEIVER.x, 1.2, RECEIVER.z),
      ...COURT_POINTS,
    ])
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

export default function Scene3D({ t, plan, sim, ball, view, onView, lineColor, kept, ret, hand, units }) {
  // tr (not t, which is the time here) changes identity with the language, so labels redraw on a switch.
  const { t: tr } = useTranslation()
  const hostRef = useRef(null)
  const live = useRef({})
  useEffect(() => {
    live.current = { t, plan, sim, ball, view, lineColor, kept, ret, hand, units, tr }
  })
  useEffect(() => setup(hostRef.current, live), [])

  return (
    <div className="scene">
      <div ref={hostRef} className="canvas-host" />
      <div className="views" role="group" aria-label={tr('views.label')}>
        {VIEWS.map((id) => (
          <button key={id} className={id === view ? 'on' : ''} onClick={() => onView(id)}>
            {tr(`views.${id}`)}
          </button>
        ))}
      </div>
      <span className="orbit-hint">{tr('views.orbit')}</span>
    </div>
  )
}
