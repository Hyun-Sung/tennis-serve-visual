import { useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { MAX_SPEED_LIMITS, recommend, SECOND_IN_FLOOR, WIN_AFTER } from '../recommend.js'
import { useUnits } from '../units.js'
import { Slider } from './Fields.jsx'

const pct = (x) => Math.round(x * 100)
// Wait for a dragged slider to settle before starting a new search.
const SETTLE_MS = 250

// One worker for the whole page, started the first time it's needed.
let worker = null
function getWorker() {
  if (!worker && typeof Worker !== 'undefined') {
    worker = new Worker(new URL('../recommend.worker.js', import.meta.url), { type: 'module' })
  }
  return worker
}

/**
 * The search's result for these inputs, worked out in the background. busy is true while it runs.
 * who should keep its identity until one of its values changes.
 */
function useRecommendation(who, maxKmh, level) {
  // The latest answer, with the inputs it was worked out for.
  const [done, setDone] = useState(null)
  const job = useRef(0)
  useEffect(() => {
    const id = ++job.current
    const finish = (result) => id === job.current && setDone({ result, who, maxKmh, level })
    const timer = setTimeout(() => {
      const w = getWorker()
      if (w) {
        const onMessage = (e) => {
          if (e.data.id !== id) return
          w.removeEventListener('message', onMessage)
          finish(e.data.result)
        }
        w.addEventListener('message', onMessage)
        w.postMessage({ id, who, maxKmh, level })
      } else {
        // No workers here: do it on the page instead.
        finish(recommend(who, maxKmh, level))
      }
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [who, maxKmh, level])
  const current = done && done.who === who && done.maxKmh === maxKmh && done.level === level
  return { result: done?.result ?? null, busy: !current }
}

// The direction a serve takes, said in terms of the server's own arm.
function directionNote(across, t) {
  if (across < -3) return t('recommend.insideOut')
  if (across > 3) return t('recommend.acrossBody')
  return null
}

function Card({ kind, r, onTry, t, units }) {
  const dir = directionNote(r.across, t)
  return (
    <div className={`rec-card ${kind}`}>
      <span className="rec-kind">{t(`recommend.${kind}`)}</span>
      <span className="rec-serve">
        <span className={`badge ${r.style}`}>{t(`spin.${r.style}`)}</span>
        <b>{units.speed(r.speedKmh)}</b>
        <span>{t(`recommend.zone.${r.zone}`)}</span>
      </span>
      <dl>
        <div>
          <dt>{t('recommend.in')}</dt>
          <dd>{pct(r.inRate)}%</dd>
        </div>
        <div>
          <dt>{t('recommend.aces')}</dt>
          <dd>{pct(r.share.ace)}%</dd>
        </div>
        <div>
          <dt>{t('recommend.wonWhenIn')}</dt>
          <dd>{pct(r.wonWhenIn)}%</dd>
        </div>
      </dl>
      <p className="hint">
        {t(`recommend.why.${kind}`, { floor: pct(SECOND_IN_FLOOR) })}
        {dir && ` ${dir}`}
      </p>
      <button className="rec-try" onClick={() => onTry(r.serve)}>
        {t('recommend.try')}
      </button>
    </div>
  )
}

/**
 * The best first and second serve for the server as set up in the panel (height, hand, stance, jump),
 * on the side of the court and against the returner chosen beside the risk panel.
 */
export default function Recommend({ who, level, maxKmh, onMaxKmh, onTry, onKeepBoth }) {
  const { t } = useTranslation()
  const units = useUnits()
  const { result, busy } = useRecommendation(who, maxKmh, level)
  return (
    <section className={`recommend ${busy ? 'stale' : ''}`} aria-busy={busy}>
      <div className="rec-head">
        <div>
          <h2>{t('recommend.title')}</h2>
          <p className="note">
            {t('recommend.for', {
              height: units.height(who.height),
              hand: t(`server.${who.hand}`),
              side: t(`target.${who.side}`),
              level: level.toFixed(1),
            })}
          </p>
        </div>
        <Slider
          label={t('recommend.maxSpeed')}
          value={maxKmh}
          display={units.speed(maxKmh)}
          min={MAX_SPEED_LIMITS[0]}
          max={MAX_SPEED_LIMITS[1]}
          step={1}
          onChange={onMaxKmh}
          hint={t('recommend.maxSpeedHint')}
        />
      </div>

      {result ? (
        <>
          <div className="rec-cards">
            <Card kind="first" r={result.first} onTry={onTry} t={t} units={units} />
            <Card kind="second" r={result.second} onTry={onTry} t={t} units={units} />
          </div>
          <div className="rec-foot">
            <p>
              <Trans
                i18nKey="recommend.total"
                values={{ won: pct(result.servicePoints), df: (result.doubleFaults * 100).toFixed(1) }}
                components={{ b: <b /> }}
              />
            </p>
            <button className="ghost" onClick={() => onKeepBoth(result.first.serve, result.second.serve)}>
              {t('recommend.keepBoth')}
            </button>
          </div>
          <p className="hint">
            {t('recommend.method', { n: result.tried, tough: pct(WIN_AFTER.tough), easy: pct(WIN_AFTER.easy) })}
          </p>
        </>
      ) : (
        <p className="note">{t('recommend.working')}</p>
      )}
    </section>
  )
}
