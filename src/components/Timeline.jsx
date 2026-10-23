import { useTranslation } from 'react-i18next'

// Phase and event labels double as keys for their translations (phase.<label>).
export default function Timeline({ t, total, phases, events, onScrub }) {
  const { t: tr } = useTranslation()
  const current = [...phases, ...events].filter((m) => m.t <= t + 1e-6).sort((a, b) => a.t - b.t).at(-1)

  const row = (marks, cls) => (
    <div className={`marks ${cls}`}>
      {marks.map((m, i) => (
        <button
          key={m.label}
          className={`mark ${m.label === current?.label ? 'on' : ''} ${cls === 'body' && i % 2 ? 'low' : ''}`}
          style={{ left: `${(m.t / total) * 100}%` }}
          onClick={() => onScrub(m.t + 0.001)}
        >
          {tr(`phase.${m.label}`)}
        </button>
      ))}
    </div>
  )

  return (
    <div className="timeline">
      {row(phases, 'body')}
      <input type="range" min={0} max={total} step={0.001} value={t} aria-label={tr('phase.time')}
        onChange={(e) => onScrub(Number(e.target.value))} />
      {row(events, 'ball')}
    </div>
  )
}
