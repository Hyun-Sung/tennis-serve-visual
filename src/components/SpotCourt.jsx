import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { returnerAt, returnerReady } from '../outcome.js'
import { ballAt, boxZ, COURT } from '../physics.js'

// The far half of the court seen from above and behind the server: right on screen is the server's
// right (z), up the screen is toward the returner (x). Screen point = (z, -x).
const VB = { x: -6.2, y: -25, w: 12.4, h: 14.8 }
const snap = (v) => Math.round(v * 20) / 20
// How far the arrow keys move the spot, in metres.
const KEY_STEP = 0.1
// The played ball flies at half speed so you can follow it.
const RATE = 0.5
// 9 in 10 of a two-dimensional normal scatter fall inside this many standard deviations.
const CLOUD_K = Math.sqrt(-2 * Math.log(0.1))

const STYLE_COLORS = { flat: '#ffffff', slice: '#7cc4ff', 'topspin-slice': '#c9b6ff', kick: '#ffe08a' }

// Paths only need drawing from just below the bottom edge.
const NEAR_X = -(VB.y + VB.h) - 0.5
const pts = (points) =>
  points
    .filter((p) => p.x > NEAR_X)
    .map((p) => `${p.z.toFixed(3)},${(-p.x).toFixed(3)}`)
    .join(' ')

/** The ellipse that holds 9 in 10 bounces, from their covariance in court coordinates. */
function cloud(spread) {
  // On screen x is z and y is -x, so the cross term flips sign.
  const a = spread.zz
  const b = -spread.xz
  const c = spread.xx
  const mid = (a + c) / 2
  const d = Math.sqrt(((a - c) / 2) ** 2 + b * b)
  return {
    rx: CLOUD_K * Math.sqrt(Math.max(mid + d, 0)),
    ry: CLOUD_K * Math.sqrt(Math.max(mid - d, 0)),
    deg: (Math.atan2(2 * b, a - c) * 90) / Math.PI,
  }
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Pick where the serve should land. spot is { x, z } in metres; onPlace(spot, fresh) is called with
 * where the pointer is, fresh on the first touch of a drag (a fresh touch in the other box switches
 * sides). paths are the serves to draw ({ id, style, spread, points }); the one whose id is chosen is
 * drawn with its scatter. played is the last serve hit
 * in the practice game ({ id, sim, ret }); onLanded(id) fires once it has landed. stale dims the paths while
 * the ones for a new spot are worked out.
 */
export default function SpotCourt({ side, spot, onPlace, paths, stale, chosen, played, onLanded, label, valueText }) {
  const { t } = useTranslation()
  const ref = useRef(null)
  const dragging = useRef(false)
  const { length: L, net, serviceLine: S, halfSingles: hs, halfDoubles: hd } = COURT
  const [z0] = boxZ(side)
  const cs = side === 'ad' ? -1 : 1
  const ready = returnerReady(side)

  const toCourt = (e) => {
    const svg = ref.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    return { x: snap(-p.y), z: snap(p.x) }
  }
  const onKey = (e) => {
    const step = { ArrowLeft: [0, -KEY_STEP], ArrowRight: [0, KEY_STEP], ArrowUp: [KEY_STEP, 0], ArrowDown: [-KEY_STEP, 0] }[e.key]
    if (!step) return
    e.preventDefault()
    onPlace({ x: snap(spot.x + step[0]), z: snap(spot.z + step[1]) }, false)
  }

  // Fly the played ball along its path, then report that it landed.
  const [clock, setClock] = useState(null)
  const landed = useRef(onLanded)
  useEffect(() => {
    landed.current = onLanded
  })
  const still = reducedMotion()
  const end = played ? (played.sim.bounce ? played.sim.bounce.t : played.sim.duration) + 0.3 : 0
  useEffect(() => {
    if (!played) return
    if (still) {
      landed.current?.(played.id)
      return
    }
    let raf
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(((now - start) / 1000) * RATE, end)
      setClock({ id: played.id, t })
      if (t < end) raf = requestAnimationFrame(tick)
      else landed.current?.(played.id)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [played, still, end])
  // With reduced motion the ball isn't flown: it has simply landed.
  const flyT = !played ? null : still ? end : clock?.id === played.id ? clock.t : null
  const flying = played && flyT != null && flyT < end
  const ball = flying ? ballAt(played.sim, flyT) : null
  const mark = played && flyT != null && played.sim.bounce && flyT >= played.sim.bounce.t ? played.sim.bounce : null
  // The returner sets off once they've read the played serve, sideways or diagonally forward to cut it off.
  const returner = played?.ret && flyT != null ? returnerAt(played.ret, flyT) : ready

  const chosenPath = paths.find((p) => p.id === chosen)
  const c = chosenPath?.spread ? cloud(chosenPath.spread) : null

  return (
    <svg
      ref={ref}
      className="spot-court"
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      tabIndex={0}
      role="slider"
      aria-label={label}
      aria-valuetext={valueText}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        onPlace(toCourt(e), true)
      }}
      onPointerMove={(e) => dragging.current && onPlace(toCourt(e), false)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="#5f9e6e" />
      <rect x={-hd} y={-L} width={hd * 2} height={L} fill="#3d6fb6" />
      <rect x={z0} y={-S} width={hs} height={S - net} fill="#5a8bd0" />
      <g fill="none" stroke="#fff" strokeWidth="0.07">
        <rect x={-hd} y={-L} width={hd * 2} height={L} />
        <line x1={-hs} y1={-L} x2={-hs} y2="0" />
        <line x1={hs} y1={-L} x2={hs} y2="0" />
        <line x1={-hs} y1={-S} x2={hs} y2={-S} />
        <line x1="0" y1={-S} x2="0" y2={-net} />
        <line x1="0" y1={-L} x2="0" y2={-L + 0.25} />
      </g>
      {/* Thirds of the box: down the T, into the body, out wide. */}
      <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.04" strokeDasharray="0.2 0.16">
        {[1, 2].map((k) => (
          <line key={k} x1={(-cs * k * hs) / 3} y1={-S} x2={(-cs * k * hs) / 3} y2={-net} />
        ))}
      </g>
      <g className="zone-label">
        {['T', 'body', 'wide'].map((z, k) => (
          <text key={z} x={(-cs * (2 * k + 1) * hs) / 6} y={-net - 0.45}>
            {t(`target.${z}`)}
          </text>
        ))}
      </g>
      <text className="other-box" x={(cs * hs) / 2} y={-(net + S) / 2}>
        {t('simple.otherBox', { side: t(`target.${side === 'ad' ? 'deuce' : 'ad'}`) })}
      </text>
      <line x1={-hd - 0.4} y1={-net} x2={hd + 0.4} y2={-net} stroke="#2f3e66" strokeWidth="0.14" />

      <circle cx={returner.z} cy={-returner.x} r="0.3" fill="#5aa9e6" stroke="#fff" strokeWidth="0.06" />
      <text className="who-label" x={returner.z} y={-returner.x - 0.5}>
        {t('simple.returner')}
      </text>

      <g className={`paths ${stale ? 'stale' : ''}`}>
        {c && (
          <ellipse className="cloud" cx={spot.z} cy={-spot.x} rx={c.rx} ry={c.ry} transform={`rotate(${c.deg} ${spot.z} ${-spot.x})`} />
        )}
        {paths
          .filter((p) => p.id !== chosen)
          .map((p) => (
            <polyline key={p.id} points={pts(p.points)} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.06"
              strokeDasharray="0.22 0.16" />
          ))}
        {chosenPath && (
          <polyline points={pts(chosenPath.points)} fill="none" stroke={STYLE_COLORS[chosenPath.style]} strokeWidth="0.12" strokeLinecap="round"
            strokeLinejoin="round" />
        )}
      </g>

      <g className="spot" transform={`translate(${spot.z} ${-spot.x})`}>
        <circle r="0.48" fill="none" stroke="#ffe08a" strokeWidth="0.07" strokeDasharray="0.22 0.15" />
        <circle cx="0.05" cy="0.06" r="0.2" fill="rgba(0,0,0,0.25)" />
        <circle r="0.2" fill="#d8ef3a" stroke="#a9c21f" strokeWidth="0.05" />
      </g>

      {mark && (
        <g className={`land ${played.sim.result}`} transform={`translate(${mark.z} ${-mark.x})`}>
          <path d="M-0.22,-0.22 L0.22,0.22 M-0.22,0.22 L0.22,-0.22" />
          <text y="-0.5">{t(`map.${played.sim.result}`)}</text>
        </g>
      )}
      {ball && (
        <g>
          <circle cx={ball.z + 0.06} cy={-ball.x + 0.08} r="0.16" fill="rgba(0,0,0,0.3)" />
          <circle cx={ball.z} cy={-ball.x - Math.min(ball.y, 3) * 0.12} r={0.16 + Math.min(ball.y, 3) * 0.05} fill="#d8ef3a"
            stroke="#a9c21f" strokeWidth="0.04" />
        </g>
      )}
    </svg>
  )
}
