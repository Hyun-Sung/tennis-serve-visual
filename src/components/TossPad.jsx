import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_TOSS, TOSS_LIMITS } from '../serve.js'
import { useUnits } from '../units.js'

// Looking down from above and behind the server: right is the server's right, up is into the court.
// Drawn in meters, with side = 0 straight above the hitting shoulder.
const clamp = (v, [lo, hi]) => Math.min(Math.max(v, lo), hi)
const snap = (v) => Math.round(v * 20) / 20

export default function TossPad({ toss, stance = 'platform', lefty = false, onChange }) {
  const ref = useRef(null)
  const dragging = useRef(false)
  const units = useUnits()
  const { t } = useTranslation()

  const fromEvent = (e) => {
    const svg = ref.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    onChange({ side: snap(clamp(p.x, TOSS_LIMITS.side)), forward: snap(clamp(-p.y, TOSS_LIMITS.forward)) })
  }

  const onKey = (e) => {
    const step = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[e.key]
    if (!step) return
    e.preventDefault()
    onChange({
      side: snap(clamp(toss.side + step[0], TOSS_LIMITS.side)),
      forward: snap(clamp(toss.forward + step[1], TOSS_LIMITS.forward)),
    })
  }

  return (
    <svg
      ref={ref}
      className="toss-pad"
      viewBox="-0.75 -1 1.5 1.5"
      tabIndex={0}
      role="slider"
      aria-label={t('toss.padLabel')}
      aria-valuetext={t('toss.padValue', { forward: units.short(toss.forward), side: units.short(toss.side) })}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        fromEvent(e)
      }}
      onPointerMove={(e) => dragging.current && fromEvent(e)}
      onPointerUp={() => (dragging.current = false)}
    >
      <rect x="-0.75" y="-1" width="1.5" height="1" fill="#3d6fb6" />
      <rect x="-0.75" y="0" width="1.5" height="0.5" fill="#5f9e6e" />
      <line x1="-0.75" y1="0" x2="0.75" y2="0" stroke="#fff" strokeWidth="0.03" />
      <g stroke="rgba(255,255,255,0.18)" strokeWidth="0.006">
        {[-0.5, -0.25, 0.25, 0.5].map((x) => <line key={`x${x}`} x1={x} y1="-1" x2={x} y2="0.5" />)}
        {[-0.75, -0.5, -0.25, 0.25].map((y) => <line key={`y${y}`} x1="-0.75" y1={y} x2="0.75" y2={y} />)}
      </g>
      <text x="0" y="-0.9" className="pad-label">{t('toss.padCourt')}</text>
      <text x="0" y="0.44" className="pad-label">{t('toss.padBehind')}</text>

      {/* A left-hander is the same body mirrored about their hitting shoulder at x = 0. */}
      <g className="pad-player" transform={lefty ? 'scale(-1 1)' : undefined}>
        <ellipse cx="-0.32" cy="0.12" rx="0.05" ry="0.11" fill="#fff" />
        {/* In a pinpoint stance the back foot ends up beside the front one. */}
        <ellipse cx={stance === 'pinpoint' ? -0.16 : -0.08} cy={stance === 'pinpoint' ? 0.22 : 0.33} rx="0.05" ry="0.11" fill="#fff" />
        <ellipse cx="-0.2" cy="0" rx="0.27" ry="0.1" fill="#f27b5c" />
        <circle cx="-0.2" cy="-0.01" r="0.1" fill="#4a3426" />
        <circle cx="0" cy="0" r="0.045" fill="#f1c7a3" />
      </g>

      <circle cx={DEFAULT_TOSS.side} cy={-DEFAULT_TOSS.forward} r="0.06" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.012"
        strokeDasharray="0.03 0.025" />
      <line x1="0" y1="0" x2={toss.side} y2={-toss.forward} stroke="rgba(255,224,138,0.8)" strokeWidth="0.012" strokeDasharray="0.03 0.02" />
      <circle cx={toss.side + 0.012} cy={-toss.forward + 0.015} r="0.055" fill="rgba(0,0,0,0.25)" />
      <circle cx={toss.side} cy={-toss.forward} r="0.055" fill="#d8ef3a" stroke="#a9c21f" strokeWidth="0.012" />
    </svg>
  )
}
