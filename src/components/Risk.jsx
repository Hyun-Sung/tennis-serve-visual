import { Trans, useTranslation } from 'react-i18next'
import { TRIES } from '../outcome.js'
import { OUTCOME_PARTS as PARTS } from '../palette.js'

const pct = (x) => Math.round(x * 100)
// Mistake sizes grow on an awkward direction, so they're no longer round numbers.
const one = (x) => Number(x.toFixed(1))

export default function Risk({ risk, level, stale, direction }) {
  const { t, i18n } = useTranslation()
  const { inRate, share, window: win, noise, base } = risk
  // Whether this direction suits the hitting arm, and what that does to the aim.
  const across = direction?.across ?? 0
  const sideNote =
    across < -1.5
      ? t('risk.insideOut', { yaw: one(noise.yawDeg), base: one(base.yawDeg) })
      : across > 1.5
        ? t('risk.acrossBody')
        : null
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
          {sideNote && <p>{sideNote}</p>}
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
          angle: one(noise.angleDeg),
          yaw: one(noise.yawDeg),
          speed: one(noise.speed * 100),
          rpm: noise.rpm * 100,
          brush: noise.brushDeg,
        })}
      </p>
    </section>
  )
}
