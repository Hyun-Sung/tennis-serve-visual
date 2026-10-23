import { DEFAULT_TOSS, TOSS_LIMITS } from '../serve.js'
import TossPad from './TossPad.jsx'

function Slider({ label, value, display, min, max, step, onChange, hint, disabled }) {
  return (
    <label className={`slider ${disabled ? 'disabled' : ''}`}>
      <span className="row">
        <span>{label}</span>
        <b>{display ?? value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

const AIMS = [
  { label: 'T', z: -0.5 },
  { label: 'body', z: -2.1 },
  { label: 'wide', z: -3.7 },
]

const cm = (m) => `${Math.abs(Math.round(m * 100))} cm`

function describeToss({ forward, side }) {
  const f = forward >= 0 ? `${cm(forward)} in front` : `${cm(forward)} behind`
  const s = Math.abs(side) < 0.025 ? 'above your hitting shoulder' : side < 0 ? `${cm(side)} to the left` : `${cm(side)} to the right`
  return `${f}, ${s}`
}

const CHARACTER_NOTE = {
  flat: 'almost no spin: fast, straight, tiny margin',
  topspin: 'topspin pulls the ball down into the box',
  kick: 'toss over your head: the ball dips, then kicks up and right',
  slice: 'toss out to the right: the ball curves left and stays low',
}

export default function Controls({ s, plan, onChange, onToss }) {
  return (
    <div className="controls">
      <h2>the toss</h2>
      <TossPad toss={s.toss} onChange={onToss} />
      <p className="note">{describeToss(s.toss)}</p>
      <Slider
        label="toss height"
        value={s.toss.height}
        display={`${s.toss.height.toFixed(2)} m`}
        min={TOSS_LIMITS.height[0]}
        max={TOSS_LIMITS.height[1]}
        step={0.05}
        onChange={(height) => onToss({ height })}
        hint={
          plan.belowReach
            ? `below your reach: you hit it at ${plan.contact.y.toFixed(2)} m instead of ${plan.reachY.toFixed(2)} m`
            : `in the air for ${plan.tossTime.toFixed(2)} s, hit at ${plan.contact.y.toFixed(2)} m`
        }
      />
      <button className="ghost" onClick={() => onToss(DEFAULT_TOSS)}>
        reset toss
      </button>

      <h2>spin &amp; power</h2>
      <Slider
        label={
          <>
            spin <span className={`badge ${plan.spin.character}`}>{plan.spin.character}</span>
          </>
        }
        value={s.rpm}
        display={`${s.rpm} rpm`}
        min={0}
        max={4000}
        step={50}
        onChange={(rpm) => onChange({ rpm })}
        hint={CHARACTER_NOTE[plan.spin.character]}
      />
      <Slider label="power" value={s.speedKmh} display={`${s.speedKmh} km/h`} min={100} max={230} step={1}
        onChange={(speedKmh) => onChange({ speedKmh })} />

      <h2>aim</h2>
      <div className="seg" role="group" aria-label="aim">
        {AIMS.map((a) => (
          <button key={a.label} className={Math.abs(s.aimZ - a.z) < 0.01 ? 'on' : ''} onClick={() => onChange({ aimZ: a.z })}>
            {a.label}
          </button>
        ))}
      </div>
      <p className="note">or drag on the court map.</p>

      <h2>swing</h2>
      <label className="check">
        <input type="checkbox" checked={s.autoSwing} onChange={(e) => onChange({ autoSwing: e.target.checked, swingDeg: plan.swingDeg })} />
        <span>auto swing: the server aims for the box as if the toss were perfect</span>
      </label>
      <Slider
        label="swing angle"
        value={Math.round(plan.swingDeg * 10) / 10}
        display={`${plan.swingDeg.toFixed(1)}°`}
        min={-12}
        max={8}
        step={0.1}
        disabled={s.autoSwing}
        onChange={(swingDeg) => onChange({ swingDeg })}
        hint="negative is downward. a toss in front tilts it down, behind tilts it up."
      />
    </div>
  )
}
