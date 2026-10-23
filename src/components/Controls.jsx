import { DEFAULT_HIT, DEFAULT_SWING, DEFAULT_TOSS, JUMP_LIMITS, TOSS_LIMITS } from '../serve.js'
import BallPicker from './BallPicker.jsx'
import TossPad from './TossPad.jsx'

function Slider({ label, value, display, min, max, step, onChange, hint, disabled, ends }) {
  return (
    <label className={`slider ${disabled ? 'disabled' : ''}`}>
      <span className="row">
        <span>{label}</span>
        <b>{display ?? value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))} />
      {ends && (
        <span className="ends" aria-hidden="true">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </span>
      )}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

function Seg({ label, options, value, onChange }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const AIMS = [
  { label: 'T', value: -0.5 },
  { label: 'body', value: -2.1 },
  { label: 'wide', value: -3.7 },
]

const STANCES = [
  { label: 'platform', value: 'platform' },
  { label: 'pinpoint', value: 'pinpoint' },
]
const STANCE_NOTE = {
  platform: 'feet stay apart the whole time. steady and simple.',
  pinpoint: 'the back foot slides up beside the front foot during the toss, then both drive up together.',
}

const cm = (m) => `${Math.abs(Math.round(m * 100))} cm`
const pct = (x) => `${Math.round(Math.abs(x) * 100)}%`

function describeToss({ forward, side }) {
  const f = forward >= 0 ? `${cm(forward)} in front` : `${cm(forward)} behind`
  const s = Math.abs(side) < 0.025 ? 'above your hitting shoulder' : side < 0 ? `${cm(side)} to the left` : `${cm(side)} to the right`
  return `${f}, ${s}`
}

const SPIN_TYPE = {
  flat: 'almost no spin: the ball flies straight and fast, with little room over the net.',
  topspin: 'the ball dips down into the box, so it can cross the net higher.',
  kick: 'heavy topspin: a big dip, then a high bounce.',
  'topspin-slice': 'dips and curves a little to the left.',
  slice: 'mostly side spin: curves left and stays low after the bounce.',
  reverse: 'side spin the other way: curves right.',
}

export default function Controls({ s, plan, onChange, onToss }) {
  const { spin } = plan
  return (
    <div className="controls">
      <h2>Toss</h2>
      <TossPad toss={s.toss} stance={s.stance} onChange={onToss} />
      <p className="note">{describeToss(s.toss)}</p>
      <Slider
        label="Toss height"
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

      <h2>Footwork</h2>
      <span className="sub">Stance</span>
      <Seg label="stance" options={STANCES} value={s.stance} onChange={(stance) => onChange({ stance })} />
      <p className="note">{STANCE_NOTE[s.stance]}</p>
      <Slider
        label="Jump height"
        value={s.jump}
        display={s.jump < 0.01 ? 'no jump' : `${cm(s.jump)} off the ground`}
        min={JUMP_LIMITS[0]}
        max={JUMP_LIMITS[1]}
        step={0.01}
        onChange={(jump) => onChange({ jump })}
        ends={['no jump', 'big jump']}
        hint="jumping higher meets the ball higher, which gives more room over the net."
      />

      <h2>Swing and spin</h2>
      <p className="lede">How hard you hit, how your racket brushes the ball, and where on the ball you make contact.</p>
      <Slider
        label="Serve speed"
        value={s.speedKmh}
        display={`${s.speedKmh} km/h`}
        min={100}
        max={230}
        step={1}
        onChange={(speedKmh) => onChange({ speedKmh })}
        ends={['slower', 'faster']}
        hint="a faster ball has less time to drop, so it needs more spin to land in."
      />
      <Slider
        label="Brush up (topspin)"
        value={s.swing.up}
        display={pct(s.swing.up)}
        min={0}
        max={1}
        step={0.01}
        onChange={(up) => onChange({ swing: { ...s.swing, up } })}
        ends={['straight through', 'up the back']}
        hint="swinging up the back of the ball adds topspin, which pulls it down into the box."
      />
      <Slider
        label="Brush across (side spin)"
        value={s.swing.side}
        display={Math.abs(s.swing.side) < 0.01 ? 'none' : `${pct(s.swing.side)} to the ${s.swing.side > 0 ? 'right' : 'left'}`}
        min={-1}
        max={1}
        step={0.01}
        onChange={(side) => onChange({ swing: { ...s.swing, side } })}
        ends={['to the left', 'to the right']}
        hint="brushing across to the right adds slice, which curves the ball left."
      />
      <span className="sub">Contact on the ball</span>
      <BallPicker hit={s.hit} swing={s.swing} onChange={(hit) => onChange({ hit })} />
      <p className="hint">
        low on the ball adds topspin and sends it up. the right side adds slice and pushes it left. high on the ball
        flattens it out and drives it down.
      </p>
      <div className="readonly">
        <span className="row">
          <span>Resulting spin</span>
          <span>
            <b>{spin.rpm} rpm</b> <span className={`badge ${spin.character}`}>{spin.character}</span>
          </span>
        </span>
        <span className="hint">{SPIN_TYPE[spin.character]}</span>
      </div>
      <button className="ghost" onClick={() => onChange({ swing: DEFAULT_SWING, hit: DEFAULT_HIT })}>
        reset swing
      </button>

      <h2>Aim</h2>
      <Seg label="aim" options={AIMS} value={AIMS.find((a) => Math.abs(a.value - s.aimZ) < 0.01)?.value} onChange={(aimZ) => onChange({ aimZ })} />
      <p className="note">or drag on the court map.</p>

      <h2>Racket angle</h2>
      <label className="check">
        <input type="checkbox" checked={s.autoSwing} onChange={(e) => onChange({ autoSwing: e.target.checked, swingDeg: plan.swingDeg })} />
        <span>auto: the server angles the racket to land in the box, as if the toss were perfect</span>
      </label>
      <Slider
        label="Racket angle"
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
