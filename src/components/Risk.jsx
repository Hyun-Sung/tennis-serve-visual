import { Trans, useTranslation } from 'react-i18next'
import { TRIES } from '../outcome.js'

const pct = (x) => Math.round(x * 100)

// Best outcome for the server first.
const PARTS = [
  { key: 'ace', color: '#7c5cff' },
  { key: 'winner', color: '#5aa9e6' },
  { key: 'tough', color: '#4fd1a5' },
  { key: 'easy', color: '#ffb35c' },
  { key: 'fault', color: '#e2574c' },
]

export default function Risk({ risk, level, stale }) {
  const { t, i18n } = useTranslation()
  const { inRate, share, window: win, noise } = risk
  const wonOutright = share.ace + share.winner
  const label = (key) => t(`risk.parts.${key}`)

  return (
    <section className={`risk ${stale ? 'stale' : ''}`} aria-busy={stale}>
      <div className="risk-head">
        <div className="tolerance">
          <span className="risk-label">{t('risk.label')}</span>
          <b>{pct(inRate)}%</b>
          <span className="risk-sub">{t('risk.sub')}</span>
        </div>
        <div className="risk-facts">
          <p>
            {win ? (
              <Trans i18nKey="risk.window" values={{ down: win.down.toFixed(1), up: win.up.toFixed(1) }} components={{ b: <b /> }} />
            ) : (
              t('risk.misses')
            )}
          </p>
          <p>
            <Trans
              i18nKey="risk.against"
              values={{ level: level.toFixed(1), won: pct(wonOutright), fault: pct(share.fault) }}
              components={{ b: <b /> }}
            />
          </p>
        </div>
      </div>

      <div className="outcome-bar" role="img" aria-label={PARTS.map((p) => `${label(p.key)} ${pct(share[p.key])}%`).join(', ')}>
        {PARTS.map((p) => (share[p.key] > 0.005 ? <span key={p.key} style={{ width: `${share[p.key] * 100}%`, background: p.color }} /> : null))}
      </div>
      <ul className="outcome-legend">
        {PARTS.map((p) => (
          <li key={p.key}>
            <span className="dot" style={{ background: p.color }} />
            {label(p.key)} <b>{pct(share[p.key])}%</b>
          </li>
        ))}
      </ul>
      <p className="hint">
        {t('risk.method', {
          tries: TRIES.toLocaleString(i18n.language),
          angle: noise.angleDeg,
          yaw: noise.yawDeg,
          speed: noise.speed * 100,
          rpm: noise.rpm * 100,
          brush: noise.brushDeg,
        })}
      </p>
    </section>
  )
}
