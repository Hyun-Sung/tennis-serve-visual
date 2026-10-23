import { useRef } from 'react'
import { COURT } from '../physics.js'

// Seen from above: x runs toward the receiver, z (the server's right) points down the screen.
const VB = { x: -2.5, y: -7, w: 29, h: 14 }
const AIM_MIN = -4.6
const AIM_MAX = 0.6

const RESULT_TEXT = { in: 'in!', net: 'net', long: 'long', wide: 'out' }

export default function TopView({ flown, sim, ball, aimZ, serverZ, onAim, lineColor = '#e2574c', kept = [] }) {
  const svgRef = useRef(null)
  const dragging = useRef(false)
  const { length: L, net, serviceLine: S, halfSingles: hs, halfDoubles: hd } = COURT
  const nearService = 2 * net - S
  const bounced = sim.bounce && flown >= sim.bounce.t
  const path = sim.points.map((p) => `${p.x},${p.z}`).join(' ')
  const done = sim.points.filter((p) => p.t <= flown).map((p) => `${p.x},${p.z}`)
  if (flown > 0) done.push(`${ball.x},${ball.z}`)

  const aimFromEvent = (e) => {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    onAim(Math.round(Math.min(Math.max(p.y, AIM_MIN), AIM_MAX) * 20) / 20)
  }

  return (
    <svg
      ref={svgRef}
      className="top"
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      role="img"
      aria-label="court from above; drag to aim"
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        aimFromEvent(e)
      }}
      onPointerMove={(e) => dragging.current && aimFromEvent(e)}
      onPointerUp={() => (dragging.current = false)}
    >
      <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} rx="0.8" fill="#5f9e6e" />
      <rect x="0" y={-hd} width={L} height={hd * 2} fill="#3d6fb6" />
      <rect x={net} y={-hs} width={S - net} height={hs} fill="#5a8bd0" opacity="0.8" />
      <g fill="none" stroke="#fff" strokeWidth="0.07">
        <rect x="0" y={-hd} width={L} height={hd * 2} />
        <line x1="0" y1={-hs} x2={L} y2={-hs} />
        <line x1="0" y1={hs} x2={L} y2={hs} />
        <line x1={nearService} y1={-hs} x2={nearService} y2={hs} />
        <line x1={S} y1={-hs} x2={S} y2={hs} />
        <line x1={nearService} y1="0" x2={S} y2="0" />
        <line x1="0" y1="0" x2="0.25" y2="0" />
        <line x1={L} y1="0" x2={L - 0.25} y2="0" />
      </g>
      <line x1={net} y1={-hd - 0.5} x2={net} y2={hd + 0.5} stroke="#2f3e66" strokeWidth="0.14" />
      <text x={(net + S) / 2} y={-hs / 2} className="box-label">service box</text>

      <g className="aim" transform={`translate(${S} ${aimZ})`}>
        <circle r="0.45" fill="none" stroke="#ffe08a" strokeWidth="0.09" strokeDasharray="0.25 0.18" />
        <path d="M-0.25,0 H0.25 M0,-0.25 V0.25" stroke="#ffe08a" strokeWidth="0.09" strokeLinecap="round" />
      </g>

      {kept.map((k) => (
        <g key={k.id}>
          <polyline points={k.points.map((p) => `${p.x},${p.z}`).join(' ')} fill="none" stroke={k.color} strokeWidth="0.1"
            strokeLinecap="round" opacity="0.9" />
          {k.bounce && <circle cx={k.bounce.x} cy={k.bounce.z} r="0.22" fill={k.color} stroke="#fff" strokeWidth="0.05" />}
        </g>
      ))}
      <polyline points={path} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.08" strokeDasharray="0.3 0.22" />
      {done.length > 1 && <polyline points={done.join(' ')} fill="none" stroke={lineColor} strokeWidth="0.12" strokeLinecap="round" />}

      <circle cx="-0.6" cy={serverZ} r="0.32" fill="#f27b5c" stroke="#fff" strokeWidth="0.07" />
      {flown > 0 && <circle cx={ball.x} cy={ball.z} r="0.2" fill="#d8ef3a" stroke="#a9c21f" strokeWidth="0.05" />}

      {bounced && (
        <g transform={`translate(${sim.bounce.x} ${sim.bounce.z})`} className={`mark ${sim.result}`}>
          <ellipse rx="0.32" ry="0.22" />
          <text y="-0.7">{RESULT_TEXT[sim.result]}</text>
        </g>
      )}
    </svg>
  )
}
