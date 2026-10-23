import { useRef } from 'react'
import { HIT_RADIUS } from '../serve.js'

// The ball as the server sees it from behind: 12 o'clock on top, 3 o'clock on the right.
// hit is in ball radii (u right, v up); swing is drawn as the arrow the racket brushes along.

function clockOf(hit) {
  if (Math.hypot(hit.u, hit.v) < 0.12) return null
  const h = Math.round((Math.atan2(hit.u, hit.v) * 6) / Math.PI)
  return ((h + 12) % 12) || 12
}

export default function BallPicker({ hit, swing, onChange }) {
  const ref = useRef(null)
  const dragging = useRef(false)

  const set = (u, v) => {
    const r = Math.hypot(u, v)
    const k = r > HIT_RADIUS ? HIT_RADIUS / r : 1
    onChange({ u: Math.round(u * k * 20) / 20, v: Math.round(v * k * 20) / 20 })
  }
  const fromEvent = (e) => {
    const svg = ref.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    set(p.x, -p.y)
  }
  const onKey = (e) => {
    const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[e.key]
    if (!d) return
    e.preventDefault()
    set(hit.u + d[0], hit.v + d[1])
  }

  const len = Math.hypot(swing.side, swing.up)
  const ax = len > 0.02 ? (swing.side / len) * (0.25 + 0.45 * Math.min(len, 1)) : 0
  const ay = len > 0.02 ? (-swing.up / len) * (0.25 + 0.45 * Math.min(len, 1)) : 0
  const x = hit.u
  const y = -hit.v
  const clock = clockOf(hit)
  const where = !clock
    ? 'dead centre of the ball'
    : `${clock} o'clock, ${hit.v < -0.15 ? 'low on' : hit.v > 0.15 ? 'high on' : 'the side of'} the ball`

  return (
    <div className="ball-pick">
      <svg
        ref={ref}
        className="ball-picker"
        viewBox="-1.25 -1.25 2.5 2.5"
        tabIndex={0}
        role="slider"
        aria-label="contact point on the ball: arrow keys move it"
        aria-valuetext={clock ? `${clock} o'clock` : 'centre of the ball'}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          fromEvent(e)
        }}
        onPointerMove={(e) => dragging.current && fromEvent(e)}
        onPointerUp={() => (dragging.current = false)}
      >
        <defs>
          <marker id="brush-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#2f3e66" />
          </marker>
        </defs>
        <circle r="1" fill="#d8ef3a" stroke="#a9c21f" strokeWidth="0.05" />
        <path d="M-0.72,-0.69 C-0.25,-0.25 -0.25,0.25 -0.72,0.69 M0.72,-0.69 C0.25,-0.25 0.25,0.25 0.72,0.69" fill="none"
          stroke="#fff" strokeWidth="0.07" strokeLinecap="round" opacity="0.85" />
        <circle r={HIT_RADIUS} fill="none" stroke="rgba(47,62,102,0.25)" strokeWidth="0.015" strokeDasharray="0.05 0.05" />
        {[['12', 0, -1.13], ['3', 1.14, 0.04], ['6', 0, 1.2], ['9', -1.14, 0.04]].map(([n, tx, ty]) => (
          <text key={n} x={tx} y={ty} className="clock">{n}</text>
        ))}
        {len > 0.02 && (
          <line x1={x - ax * 0.5} y1={y - ay * 0.5} x2={x + ax} y2={y + ay} stroke="#2f3e66" strokeWidth="0.06"
            strokeLinecap="round" markerEnd="url(#brush-head)" />
        )}
        <circle cx={x} cy={y} r="0.13" fill="#e2574c" stroke="#fff" strokeWidth="0.04" />
      </svg>
      <p className="note">hitting at {where}. the arrow is your brush.</p>
    </div>
  )
}
