import { LEVEL_LIMITS } from '../outcome.js'
import { Seg, Slider } from './Fields.jsx'

const AIMS = [
  { label: 'T', value: -0.5 },
  { label: 'body', value: -2.1 },
  { label: 'wide', value: -3.7 },
]

const levelNote = (level) =>
  level < 2.75
    ? 'a beginner: slow to react and uneasy with pace, so most serves win the point.'
    : level < 3.75
      ? 'a club player: handles a steady serve, but pace, width or a big kick cause trouble.'
      : level < 4.75
        ? 'a strong club player: quick to react, so serves need pace and placement.'
        : 'an advanced player: fast hands and feet. you need a big, well-placed serve, or a kick or slice that pulls them off the court.'

/** Where the serve is aimed and who is waiting for it: the two things the outcome odds depend on most. */
export default function Target({ aimZ, onAim, level, onLevel }) {
  return (
    <section className="target">
      <h2>Aim</h2>
      <Seg label="aim" options={AIMS} value={AIMS.find((a) => Math.abs(a.value - aimZ) < 0.01)?.value} onChange={onAim} />
      <p className="note">or drag on the court map.</p>

      <h2>Returner</h2>
      <Slider
        label="Level (NTRP)"
        value={level}
        display={level.toFixed(1)}
        min={LEVEL_LIMITS[0]}
        max={LEVEL_LIMITS[1]}
        step={0.5}
        onChange={onLevel}
        ends={['2.0', '5.0']}
        hint={levelNote(level)}
      />
    </section>
  )
}
