import { DEFAULT_HIT, DEFAULT_SWING, DEFAULT_TOSS, HEIGHT_LIMITS, JUMP_LIMITS, STANCES, TOSS_LIMITS } from '../serve.js'
import BallPicker from './BallPicker.jsx'
import { Seg, Slider } from './Fields.jsx'
import HeightField from './HeightField.jsx'
import { useUnits } from '../units.js'
import TossPad from './TossPad.jsx'

const HAND_OPTIONS = [
  { label: 'right-handed', value: 'right' },
  { label: 'left-handed', value: 'left' },
]

const STANCE_OPTIONS = [
  { label: 'platform', value: 'platform' },
  { label: 'pinpoint', value: 'pinpoint' },
]
const stanceNote = (stance, units) =>
  stance === 'pinpoint'
    ? `the back foot slides up beside the front foot, then both drive up and into the court: you meet the ball ${units.short(STANCES.pinpoint.forward)} further in and ${units.short(STANCES.pinpoint.lift)} higher, and land inside the baseline.`
    : 'feet stay apart the whole time, and you meet the ball right where you tossed it. steady and simple.'


const pct = (x) => `${Math.round(Math.abs(x) * 100)}%`

function describeToss({ forward, side }, units) {
  const d = (m) => units.short(m, { abs: true })
  const f = forward >= 0 ? `${d(forward)} in front` : `${d(forward)} behind`
  const s = Math.abs(side) < 0.025 ? 'above your hitting shoulder' : side < 0 ? `${d(side)} to the left` : `${d(side)} to the right`
  return `${f}, ${s}`
}

// One part of the spin, with a bar out of the most a serve can carry.
function SpinPart({ label, rpm, note, side = false }) {
  return (
    <span className="spin-part">
      <span className="row">
        <span>{label}</span>
        <span>
          <b>{rpm} rpm</b> <span className="spin-note">{note}</span>
        </span>
      </span>
      <span className="spin-bar">
        <span className={side ? 'side' : 'top'} style={{ width: `${Math.min(rpm / 4000, 1) * 100}%` }} />
      </span>
    </span>
  )
}

// Slice curves away from the hitting arm: left for a right-hander, right for a left-hander.
const spinNote = (character, lefty) => {
  const away = lefty ? 'right' : 'left'
  const toward = lefty ? 'left' : 'right'
  return {
    flat: 'almost no spin: the ball flies straight and fast, with little room over the net.',
    topspin: 'the ball dips down into the box, so it can cross the net higher.',
    kick: 'heavy topspin: a big dip, then a high bounce.',
    'topspin-slice': `dips and curves a little to the ${away}.`,
    slice: `mostly side spin: curves ${away} and stays low after the bounce.`,
    reverse: `side spin the other way: curves ${toward}.`,
  }[character]
}

// Two groups, side by side on wide screens: the toss and the server's body, then the swing.
export default function Controls({ s, plan, onChange, onToss, onHand }) {
  const { spin } = plan
  const units = useUnits()
  const lefty = s.hand === 'left'
  // The side a slice is brushed toward, and the side of the ball a slice is struck on.
  const sliceSide = lefty ? 'left' : 'right'
  return (
    <div className="controls">
      <div className="controls-col">
        <h2>Toss</h2>
        <TossPad toss={s.toss} stance={s.stance} lefty={lefty} onChange={onToss} />
        <p className="note">{describeToss(s.toss, units)}</p>
        <Slider
          label="Toss height"
          value={s.toss.height}
          display={`${units.short(s.toss.height, { abs: true })} ${s.toss.height < 0 ? 'below' : 'above'} your reach`}
          min={TOSS_LIMITS.height[0]}
          max={TOSS_LIMITS.height[1]}
          step={0.05}
          onChange={(height) => onToss({ height })}
          ends={['at your reach', 'way above']}
          hint={
            plan.belowReach
              ? `peaks at ${units.long(plan.tossApex)}, below your ${units.long(plan.reachY)} reach, so you hit it lower.`
              : `peaks ${units.long(plan.tossApex)} off the ground and rises with your height and jump. in the air for ${plan.tossTime.toFixed(2)} s.`
          }
        />
        <button className="ghost" onClick={() => onToss(DEFAULT_TOSS)}>
          reset toss
        </button>

        <h2>Server</h2>
        <span className="sub">Hand</span>
        <Seg label="hand" options={HAND_OPTIONS} value={s.hand} onChange={onHand} />
        <p className="note">switching mirrors your toss, brush and contact point, so it's the same serve played the other way.</p>
        <Slider
          label="Height"
          value={s.height}
          display={units.height(s.height)}
          min={HEIGHT_LIMITS[0]}
          max={HEIGHT_LIMITS[1]}
          step={0.01}
          onChange={(height) => onChange({ height })}
          ends={['shorter', 'taller']}
          hint={`a taller server reaches higher: you meet the ball at ${units.long(plan.contact.y)}.`}
        />
        {/* Keyed on the unit system so a half-typed number doesn't carry across a switch. */}
        <HeightField key={units.system} meters={s.height} onChange={(height) => onChange({ height })} />
        <span className="sub">Stance</span>
        <Seg label="stance" options={STANCE_OPTIONS} value={s.stance} onChange={(stance) => onChange({ stance })} />
        <p className="note">{stanceNote(s.stance, units)}</p>
        <Slider
          label="Jump height"
          value={s.jump}
          display={(() => {
            const clear = s.jump + STANCES[s.stance].lift
            return clear < 0.01 ? 'no jump' : `${units.short(clear)} off the ground`
          })()}
          min={JUMP_LIMITS[0]}
          max={JUMP_LIMITS[1]}
          step={0.01}
          onChange={(jump) => onChange({ jump })}
          ends={['no jump', 'big jump']}
          hint="jumping higher meets the ball higher, which gives more room over the net."
        />
      </div>

      <div className="controls-col">
        <h2>Swing and spin</h2>
        <p className="lede">How hard you hit, how your racket brushes the ball, and where on the ball you make contact.</p>
        <Slider
          label="Serve speed"
          value={s.speedKmh}
          display={units.speed(s.speedKmh)}
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
          hint={`brushing across to the ${sliceSide} adds slice, which curves the ball ${lefty ? 'right' : 'left'}.`}
        />
        <span className="sub">Contact on the ball</span>
        <BallPicker hit={s.hit} swing={s.swing} onChange={(hit) => onChange({ hit })} />
        <p className="hint">
          low on the ball adds topspin and sends it up. the {sliceSide} side ({lefty ? '9' : '3'} o'clock) adds slice and pushes it{' '}
          {lefty ? 'right' : 'left'}. high on the ball flattens it out and drives it down.
        </p>
        <div className="readonly">
          <span className="row">
            <span>Resulting spin</span>
            <span className={`badge ${spin.character}`}>{spin.character}</span>
          </span>
          <SpinPart label="Topspin" rpm={spin.topspin} note="dip, then kick up" />
          <SpinPart
            label="Side spin"
            rpm={Math.abs(spin.sidespin)}
            note={Math.abs(spin.sidespin) < 50 ? 'none' : `curves ${spin.sidespin > 0 ? 'left' : 'right'}`}
            side
          />
          <span className="row total">
            <span>Total</span>
            <b>{spin.rpm} rpm</b>
          </span>
          <span className="hint">{spinNote(spin.character, lefty)}</span>
        </div>
        <button className="ghost" onClick={() => onChange({ swing: DEFAULT_SWING, hit: DEFAULT_HIT })}>
          reset swing
        </button>

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
    </div>
  )
}
