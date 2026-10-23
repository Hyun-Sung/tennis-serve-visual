import { useTranslation } from 'react-i18next'
import { DEFAULT_HIT, DEFAULT_SWING, DEFAULT_TOSS, HEIGHT_LIMITS, JUMP_LIMITS, STANCES, TOSS_LIMITS } from '../serve.js'
import BallPicker from './BallPicker.jsx'
import { Seg, Slider } from './Fields.jsx'
import HeightField from './HeightField.jsx'
import { useUnits } from '../units.js'
import TossPad from './TossPad.jsx'

const pct = (x) => Math.round(Math.abs(x) * 100)

function describeToss({ forward, side }, units, t) {
  const d = (m) => units.short(m, { abs: true })
  const f = forward >= 0 ? t('toss.inFront', { d: d(forward) }) : t('toss.behind', { d: d(forward) })
  const s =
    Math.abs(side) < 0.025 ? t('toss.aboveShoulder') : side < 0 ? t('toss.toLeft', { d: d(side) }) : t('toss.toRight', { d: d(side) })
  return t('toss.placement', { forward: f, side: s })
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

// Slice curves away from the hitting arm: left for a right-hander, right for a left-hander, so the
// notes that mention a direction come in a version for each hand.
const SIDED = new Set(['topspin-slice', 'slice', 'reverse'])
const spinNote = (character, lefty, t) =>
  t(`swing.notes.${SIDED.has(character) ? `${character}_${lefty ? 'left' : 'right'}` : character}`)

// Two groups, side by side on wide screens: the toss and the server's body, then the swing.
export default function Controls({ s, plan, onChange, onToss, onHand }) {
  const { spin } = plan
  const { t } = useTranslation()
  const units = useUnits()
  const lefty = s.hand === 'left'
  const handOptions = [
    { label: t('server.right'), value: 'right' },
    { label: t('server.left'), value: 'left' },
  ]
  const stanceOptions = [
    { label: t('server.platform'), value: 'platform' },
    { label: t('server.pinpoint'), value: 'pinpoint' },
  ]
  const jumpClear = s.jump + STANCES[s.stance].lift
  return (
    <div className="controls">
      <div className="controls-col">
        <h2>{t('toss.title')}</h2>
        <TossPad toss={s.toss} stance={s.stance} lefty={lefty} onChange={onToss} />
        <p className="note">{describeToss(s.toss, units, t)}</p>
        <Slider
          label={t('toss.height')}
          value={s.toss.height}
          display={t(s.toss.height < 0 ? 'toss.belowReach' : 'toss.aboveReach', { d: units.short(s.toss.height, { abs: true }) })}
          min={TOSS_LIMITS.height[0]}
          max={TOSS_LIMITS.height[1]}
          step={0.05}
          onChange={(height) => onToss({ height })}
          ends={[t('toss.atReach'), t('toss.wayAbove')]}
          hint={
            plan.belowReach
              ? t('toss.peaksBelow', { apex: units.long(plan.tossApex), reach: units.long(plan.reachY) })
              : t('toss.peaks', { apex: units.long(plan.tossApex), t: plan.tossTime.toFixed(2) })
          }
        />
        <button className="ghost" onClick={() => onToss(DEFAULT_TOSS)}>
          {t('toss.reset')}
        </button>

        <h2>{t('server.title')}</h2>
        <span className="sub">{t('server.hand')}</span>
        <Seg label={t('server.hand')} options={handOptions} value={s.hand} onChange={onHand} />
        <p className="note">{t('server.mirror')}</p>
        <Slider
          label={t('server.height')}
          value={s.height}
          display={units.height(s.height)}
          min={HEIGHT_LIMITS[0]}
          max={HEIGHT_LIMITS[1]}
          step={0.01}
          onChange={(height) => onChange({ height })}
          ends={[t('server.shorter'), t('server.taller')]}
          hint={t('server.heightHint', { h: units.long(plan.contact.y) })}
        />
        {/* Keyed on the unit system so a half-typed number doesn't carry across a switch. */}
        <HeightField key={units.system} meters={s.height} onChange={(height) => onChange({ height })} />
        <span className="sub">{t('server.stance')}</span>
        <Seg label={t('server.stance')} options={stanceOptions} value={s.stance} onChange={(stance) => onChange({ stance })} />
        <p className="note">
          {s.stance === 'pinpoint'
            ? t('server.pinpointNote', { forward: units.short(STANCES.pinpoint.forward), lift: units.short(STANCES.pinpoint.lift) })
            : t('server.platformNote')}
        </p>
        <Slider
          label={t('server.jump')}
          value={s.jump}
          display={jumpClear < 0.01 ? t('server.noJump') : t('server.offGround', { d: units.short(jumpClear) })}
          min={JUMP_LIMITS[0]}
          max={JUMP_LIMITS[1]}
          step={0.01}
          onChange={(jump) => onChange({ jump })}
          ends={[t('server.noJump'), t('server.bigJump')]}
          hint={t('server.jumpHint')}
        />
      </div>

      <div className="controls-col">
        <h2>{t('swing.title')}</h2>
        <p className="lede">{t('swing.lede')}</p>
        <Slider
          label={t('swing.speed')}
          value={s.speedKmh}
          display={units.speed(s.speedKmh)}
          min={100}
          max={230}
          step={1}
          onChange={(speedKmh) => onChange({ speedKmh })}
          ends={[t('swing.slower'), t('swing.faster')]}
          hint={t('swing.speedHint')}
        />
        <Slider
          label={t('swing.up')}
          value={s.swing.up}
          display={`${pct(s.swing.up)}%`}
          min={0}
          max={1}
          step={0.01}
          onChange={(up) => onChange({ swing: { ...s.swing, up } })}
          ends={[t('swing.straight'), t('swing.upBack')]}
          hint={t('swing.upHint')}
        />
        <Slider
          label={t('swing.across')}
          value={s.swing.side}
          display={
            Math.abs(s.swing.side) < 0.01
              ? t('swing.none')
              : t(s.swing.side > 0 ? 'swing.pctRight' : 'swing.pctLeft', { p: pct(s.swing.side) })
          }
          min={-1}
          max={1}
          step={0.01}
          onChange={(side) => onChange({ swing: { ...s.swing, side } })}
          ends={
            lefty
              ? [t('swing.endLeftSlice'), t('swing.none'), t('swing.endRight')]
              : [t('swing.endLeft'), t('swing.none'), t('swing.endRightSlice')]
          }
          centered
          hint={t(lefty ? 'swing.acrossHintLefty' : 'swing.acrossHintRighty')}
        />
        <span className="sub">{t('swing.contact')}</span>
        <BallPicker hit={s.hit} swing={s.swing} onChange={(hit) => onChange({ hit })} />
        <p className="hint">{t(lefty ? 'swing.contactHintLefty' : 'swing.contactHintRighty')}</p>
        <div className="readonly">
          <span className="row">
            <span>{t('swing.result')}</span>
            <span className={`badge ${spin.character}`}>{t(`spin.${spin.character}`)}</span>
          </span>
          <SpinPart label={t('swing.topspin')} rpm={spin.topspin} note={t('swing.dipKick')} />
          <SpinPart
            label={t('swing.sidespin')}
            rpm={Math.abs(spin.sidespin)}
            note={Math.abs(spin.sidespin) < 50 ? t('swing.none') : t(spin.sidespin > 0 ? 'swing.curvesLeft' : 'swing.curvesRight')}
            side
          />
          <span className="row total">
            <span>{t('swing.total')}</span>
            <b>{spin.rpm} rpm</b>
          </span>
          <span className="hint">{spinNote(spin.character, lefty, t)}</span>
        </div>
        <button className="ghost" onClick={() => onChange({ swing: DEFAULT_SWING, hit: DEFAULT_HIT })}>
          {t('swing.reset')}
        </button>

        <h2>{t('racket.title')}</h2>
        <label className="check">
          <input type="checkbox" checked={s.autoSwing} onChange={(e) => onChange({ autoSwing: e.target.checked, swingDeg: plan.swingDeg })} />
          <span>{t('racket.auto')}</span>
        </label>
        <Slider
          label={t('racket.angle')}
          value={Math.round(plan.swingDeg * 10) / 10}
          display={`${plan.swingDeg.toFixed(1)}°`}
          min={-12}
          max={8}
          step={0.1}
          disabled={s.autoSwing}
          onChange={(swingDeg) => onChange({ swingDeg })}
          hint={t('racket.hint')}
        />
      </div>
    </div>
  )
}
