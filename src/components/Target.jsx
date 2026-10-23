import { useTranslation } from 'react-i18next'
import { LEVEL_LIMITS } from '../outcome.js'
import { COURT_SIDES, sideSign } from '../physics.js'
import { Seg, Slider } from './Fields.jsx'

// On the deuce side; the ad side mirrors them.
const AIMS = [
  { key: 'T', value: -0.5 },
  { key: 'body', value: -2.1 },
  { key: 'wide', value: -3.7 },
]

const levelNote = (level) => (level < 2.75 ? 'beginner' : level < 3.75 ? 'club' : level < 4.75 ? 'strong' : 'advanced')

/** Which box, where in it, and who is waiting for it: the things the outcome odds depend on most. */
export default function Target({ side, onSide, aimZ, onAim, level, onLevel }) {
  const { t } = useTranslation()
  const cs = sideSign(side)
  const options = AIMS.map((a) => ({ label: t(`target.${a.key}`), value: a.value * cs }))
  return (
    <section className="target">
      <h2>{t('target.court')}</h2>
      <Seg label={t('target.court')} options={COURT_SIDES.map((c) => ({ label: t(`target.${c}`), value: c }))} value={side} onChange={onSide} />
      <p className="note">{t(`target.${side}Note`)}</p>

      <h2>{t('target.aim')}</h2>
      <Seg label={t('target.aim')} options={options} value={options.find((a) => Math.abs(a.value - aimZ) < 0.01)?.value} onChange={onAim} />
      <p className="note">{t('target.drag')}</p>

      <h2>{t('target.returner')}</h2>
      <Slider
        label={t('target.level')}
        value={level}
        display={level.toFixed(1)}
        min={LEVEL_LIMITS[0]}
        max={LEVEL_LIMITS[1]}
        step={0.5}
        onChange={onLevel}
        ends={['2.0', '5.0']}
        hint={t(`target.${levelNote(level)}`)}
      />
    </section>
  )
}
