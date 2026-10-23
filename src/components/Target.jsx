import { useTranslation } from 'react-i18next'
import { LEVEL_LIMITS } from '../outcome.js'
import { Seg, Slider } from './Fields.jsx'

const AIMS = [
  { key: 'T', value: -0.5 },
  { key: 'body', value: -2.1 },
  { key: 'wide', value: -3.7 },
]

const levelNote = (level) => (level < 2.75 ? 'beginner' : level < 3.75 ? 'club' : level < 4.75 ? 'strong' : 'advanced')

/** Where the serve is aimed and who is waiting for it: the two things the outcome odds depend on most. */
export default function Target({ aimZ, onAim, level, onLevel }) {
  const { t } = useTranslation()
  const options = AIMS.map((a) => ({ label: t(`target.${a.key}`), value: a.value }))
  return (
    <section className="target">
      <h2>{t('target.aim')}</h2>
      <Seg label={t('target.aim')} options={options} value={AIMS.find((a) => Math.abs(a.value - aimZ) < 0.01)?.value} onChange={onAim} />
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
