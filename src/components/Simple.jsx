import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { afterServe, callScore, NEW_GAME } from '../game.js'
import { LEVEL_LIMITS, RETURN_FLIGHT } from '../outcome.js'
import { COURT, simulateServe } from '../physics.js'
import { MAX_SPEED_LIMITS, STYLES, WIN_AFTER } from '../recommend.js'
import { clampSpot, difficultyWord, IN_FLOOR, playServe, rankSettings, sideOfSpot, spotReport } from '../spot.js'
import { OUTCOME_PARTS as PARTS } from '../palette.js'
import { useUnits } from '../units.js'
import { Seg, Slider } from './Fields.jsx'
import SpotCourt from './SpotCourt.jsx'

const pct = (x) => Math.round(x * 100)
// Wait for a dragged spot to settle a moment before working it out.
const SETTLE_MS = 120
const levelNote = (level) => (level < 2.75 ? 'beginner' : level < 3.75 ? 'club' : level < 4.75 ? 'strong' : 'advanced')
const METER = { easy: 1, medium: 2, hard: 3, veryHard: 4 }
// How many ways to hit the chosen serve the list shows, best first.
const SHOW_OPTIONS = 6
/** How much brush a setting uses compared with the usual for its kind of serve (a flat serve has just the one). */
const brushWord = (r) => (r.style === 'flat' ? null : r.brush < 1 ? 'less' : r.brush > 1 ? 'more' : 'usual')
/** The racket angle a setting is hit with, in words: up, down or level. */
function angleNote(deg, t) {
  const d = Math.round(Math.abs(deg))
  return d === 0 ? t('simple.angleLevel') : t(deg > 0 ? 'simple.angleUp' : 'simple.angleDown', { deg: d })
}

// One worker for the page, started the first time it's needed.
let worker = null
function getWorker() {
  if (!worker && typeof Worker !== 'undefined') {
    worker = new Worker(new URL('../spot.worker.js', import.meta.url), { type: 'module' })
  }
  return worker
}

/**
 * The ways to hit the chosen serves (spins: { 1: style, 2: style }) to this spot, worked out in the
 * background. busy is true until the answer for these exact inputs is in (the last answer stays on
 * show meanwhile). key names the inputs it's for.
 */
function useSpotReport(who, maxKmh, level, spot, spins) {
  const key = JSON.stringify({ who, maxKmh, level, spot, spins })
  const [done, setDone] = useState(null)
  // One job at a time: while one runs, only the newest waiting job is kept, so dragging doesn't pile up work.
  const queue = useRef({ busy: false, next: null })
  useEffect(() => {
    const w = getWorker()
    if (!w) return
    const q = queue.current
    const onMessage = (e) => {
      setDone(e.data)
      if (q.next) {
        w.postMessage(q.next)
        q.next = null
      } else q.busy = false
    }
    const onError = () => {
      q.busy = false
      q.next = null
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    return () => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
    }
  }, [])
  useEffect(() => {
    const job = { key, who, maxKmh, level, spot, spins }
    const timer = setTimeout(() => {
      const w = getWorker()
      if (!w) {
        // No workers here: do it on the page instead.
        setDone({ key, result: spotReport(who, maxKmh, level, spot, spins) })
        return
      }
      const q = queue.current
      if (q.busy) q.next = job
      else {
        q.busy = true
        w.postMessage(job)
      }
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [key, who, maxKmh, level, spot, spins])
  return { report: done?.result ?? null, busy: done?.key !== key, key: done?.key ?? null }
}

/** Four bars, more of them lit the harder a serve is to return. */
function Meter({ d }) {
  const n = METER[difficultyWord(d)]
  return (
    <span className={`meter m${n}`} aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={i <= n ? 'on' : ''} />
      ))}
    </span>
  )
}

/** Every way the serve can turn out, as one bar and a legend (the same colors as the full tool). */
function Outcomes({ share, t }) {
  const label = (key) => t(`risk.parts.${key}`)
  return (
    <>
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
    </>
  )
}

/** What happened on a played serve, in a sentence. */
function resultText(p, t) {
  const o = p.outcome
  let text
  if (o.kind === 'fault') text = t(p.serveNo === 1 ? 'simple.result.fault' : 'simple.result.double', { why: t(`simple.miss.${o.why}`) })
  else if (o.kind === 'ace' || o.kind === 'winner') text = t(`simple.result.${o.kind}`)
  else text = t(`simple.result.${o.kind}${o.won ? 'Won' : 'Lost'}`)
  if (p.next.gameTo) text += ` ${t(p.next.gameTo === 'you' ? 'simple.result.gameYou' : 'simple.result.gameThem')}`
  return text
}

/**
 * The simple mode: tap where the serve should land and pick a kind of serve (flat, slice, topspin-slice
 * or kick) for the first and second serve. It recommends the speed and amount of spin that get that
 * serve there best, with its room for error, how hard it is to return and how it scores. Then play a
 * game. The server (height, hand, stance, jump, court side), returner level and fastest serve are
 * shared with the full tool, so both pages describe the same player.
 */
export default function Simple({ who, level, onLevel, maxKmh, onMaxKmh, onHand, onSide, spot, onSpot, spins, onSpins, game, onGame, onWatch }) {
  const { t, i18n } = useTranslation()
  const units = useUnits()
  const side = who.side
  // The spot in the box being served to (the full tool may have switched sides since it was placed).
  const here = useMemo(() => clampSpot(sideOfSpot(spot) === side ? spot : { x: spot.x, z: -spot.z }, side), [spot, side])
  const { report, busy, key } = useSpotReport(who, maxKmh, level, here, spins)
  const ranked = useMemo(() => (report ? rankSettings(report, game.serveNo) : null), [report, game.serveNo])
  // The serve chosen for this serve, and the one the answer on show is for (they differ while it's worked out).
  const spin = spins[game.serveNo]
  const shownSpin = report?.spins[game.serveNo] ?? spin

  // A setting picked from the list, for this answer and serve only: a new spot goes back to the recommendation.
  const [choice, setChoice] = useState({ key: null, serveNo: 0, id: null })
  const picked = choice.key === key && choice.serveNo === game.serveNo ? ranked?.rows.find((r) => r.id === choice.id) : null
  const pickRow = ranked?.pick ?? null
  const row = picked ?? pickRow
  // The best ways to hit it, plus the one picked if it's further down.
  const listed = ranked ? ranked.rows.filter((r, i) => i < SHOW_OPTIONS || r === row) : []
  // The chosen setting's path, and the recommended one's too when something else is chosen.
  const paths = useMemo(
    () =>
      [pickRow, row]
        .filter((r, i, all) => r && all.indexOf(r) === i)
        .map((r) => ({ id: r.id, style: r.style, spread: r.spread, points: simulateServe(r.flight, r.contact, RETURN_FLIGHT).points })),
    [pickRow, row],
  )

  // The practice game: the last serve hit, and whether it has landed yet (the score waits for it).
  const [played, setPlayed] = useState(null)
  const [landedId, setLandedId] = useState(null)
  const flying = played != null && landedId !== played.id
  const serveIt = () => {
    if (!row || busy || flying) return
    const outcome = playServe(row, level, side)
    setPlayed({ id: Date.now(), sim: outcome.sim, ret: outcome.ret, outcome, serveNo: game.serveNo, next: afterServe(game, outcome) })
  }
  const onLanded = (id) => {
    if (!played || id !== played.id) return
    setLandedId(id)
    onGame(played.next)
  }
  // Space serves, like it plays the serve on the full tool.
  const serveRef = useRef(serveIt)
  useEffect(() => {
    serveRef.current = serveIt
  })
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !['INPUT', 'BUTTON', 'SELECT', 'A'].includes(e.target.tagName) && e.target.getAttribute?.('role') !== 'slider') {
        e.preventDefault()
        serveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A fresh touch in the other box serves from the other side; a drag stays in its box.
  const place = (p, fresh) => {
    let to = side
    if (fresh && sideOfSpot(p) !== side) {
      to = sideOfSpot(p)
      onSide(to)
    }
    onSpot(clampSpot(p, to))
    if (!flying) setPlayed(null)
  }
  const changeSide = (to) => {
    if (to === side) return
    onSide(to)
    onSpot(clampSpot({ x: here.x, z: -here.z }, to))
    if (!flying) setPlayed(null)
  }

  const dist = (m) => (m < 1 ? units.short(m) : units.long(m))
  const fromCentre = Math.abs(here.z)
  const fromSide = COURT.halfSingles - Math.abs(here.z)
  const facts = t('simple.spotFacts', {
    deep: dist(COURT.serviceLine - here.x),
    across: dist(Math.min(fromCentre, fromSide)),
    line: t(fromCentre < fromSide ? 'simple.centreLine' : 'simple.sideline'),
  })

  // Where the chosen serve would land with no spin to curve it, against where it does land.
  let aimNote = null
  if (row) {
    const c = row.contact
    const straight = c.z + ((row.flight.aimZ - c.z) * (here.x - c.x)) / (COURT.serviceLine - c.x) - here.z
    if (Math.abs(straight) >= 0.3) aimNote = t(straight > 0 ? 'simple.aimRight' : 'simple.aimLeft', { d: dist(Math.abs(straight)) })
  }
  const floor = IN_FLOOR[game.serveNo]
  const score = callScore(game)
  const s = game.stats

  return (
    <section className="simple panel">
      <div className="simple-intro">
        <h1>{t('simple.title')}</h1>
        <p>{t('simple.lede')}</p>
      </div>

      <div className="simple-bar">
        <div className="field">
          <span className="field-label">{t('target.court')}</span>
          <Seg label={t('target.court')} options={['deuce', 'ad'].map((c) => ({ value: c, label: t(`target.${c}`) }))} value={side}
            onChange={changeSide} />
        </div>
        <div className="field">
          <span className="field-label">{t('simple.serve')}</span>
          <Seg label={t('simple.serve')} options={[1, 2].map((n) => ({ value: n, label: t(n === 1 ? 'compare.first' : 'compare.second') }))}
            value={game.serveNo} onChange={(serveNo) => onGame({ ...game, serveNo })} />
        </div>
        <div className="field">
          <span className="field-label">{t('server.hand')}</span>
          <Seg label={t('server.hand')} options={['right', 'left'].map((h) => ({ value: h, label: t(`server.${h}`) }))} value={who.hand}
            onChange={onHand} />
        </div>
        <Slider label={t('recommend.maxSpeed')} value={maxKmh} display={units.speed(maxKmh)} min={MAX_SPEED_LIMITS[0]} max={MAX_SPEED_LIMITS[1]}
          step={1} onChange={onMaxKmh} hint={t('simple.speedHint')} />
        <Slider label={t('target.level')} value={level} display={level.toFixed(1)} min={LEVEL_LIMITS[0]} max={LEVEL_LIMITS[1]} step={0.5}
          onChange={onLevel} hint={t(`simple.levels.${levelNote(level)}`)} />
      </div>

      <div className="simple-grid">
        <div className="simple-court">
          <h2>{t('simple.court')}</h2>
          <SpotCourt side={side} spot={here} onPlace={place} paths={paths} stale={busy} chosen={row?.id} played={played}
            onLanded={onLanded} label={t('simple.courtLabel')} valueText={facts} />
          <p className="spot-facts">{facts}</p>
          <p className="note">{t('simple.courtHint')}</p>
        </div>

        <div className="simple-info">
          <div className="spin-pick">
            <h2>{t(game.serveNo === 1 ? 'simple.spinFirst' : 'simple.spinSecond')}</h2>
            <Seg label={t(game.serveNo === 1 ? 'simple.spinFirst' : 'simple.spinSecond')}
              options={Object.keys(STYLES).map((v) => ({ value: v, label: t(`spin.${v}`) }))} value={spin}
              onChange={(v) => onSpins({ ...spins, [game.serveNo]: v })} />
          </div>
          <div className={`simple-results ${busy ? 'stale' : ''}`} aria-busy={busy} aria-live="polite">
            {ranked && row ? (
              <>
                <div className="pick-card">
                  <div className="pick-top">
                    <span className="rec-kind">{t(picked && picked !== pickRow ? 'simple.yourChoice' : 'simple.recommended')}</span>
                    {picked && picked !== pickRow && (
                      <button className="ghost" onClick={() => setChoice({ key: null, serveNo: 0, id: null })}>
                        {t('simple.backToPick')}
                      </button>
                    )}
                  </div>
                  <div className="rec-serve">
                    <span className={`badge ${row.style}`}>{t(`spin.${row.style}`)}</span>
                    <b>{units.speed(row.speedKmh)}</b>
                    <span className="rpm">
                      {[t('simple.rpm', { rpm: row.rpm.toLocaleString(i18n.language) }), brushWord(row) && t(`simple.brush.${brushWord(row)}`)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  {row === pickRow && ranked.rows.length > 1 && <p className="pick-why">{t(`simple.why.${ranked.why}`)}</p>}
                  <dl className="pick-stats">
                    <div>
                      <dt>{t('simple.margin')}</dt>
                      <dd className={row.inRate < floor ? 'low' : ''}>{pct(row.inRate)}%</dd>
                      <dd className="sub">{t('simple.marginSub')}</dd>
                    </div>
                    <div>
                      <dt>{t('simple.return')}</dt>
                      <dd>{t(`simple.difficulty.${difficultyWord(row.difficulty)}`)}</dd>
                      <dd className="sub">
                        <Meter d={row.difficulty} />
                      </dd>
                    </div>
                    <div>
                      <dt>{t('simple.score')}</dt>
                      <dd>{pct(row.score)}</dd>
                      <dd className="sub">{t('simple.scoreSub')}</dd>
                    </div>
                  </dl>
                  <Outcomes share={row.share} t={t} />
                  <p className="pick-note">
                    {[angleNote(row.angleDeg, t), t('simple.clears', { d: dist(row.clearance) }), aimNote].filter(Boolean).join(' · ')}
                  </p>
                  <button className="rec-try" onClick={() => onWatch(row.serve)}>
                    {t('simple.watch')}
                  </button>
                </div>
  
                {pickRow.inRate < floor && <p className="tip">{t(game.serveNo === 1 ? 'simple.warnFirst' : 'simple.warnSecond', { p: pct(pickRow.inRate) })}</p>}
  
                {ranked.rows.length > 1 && (
                  <>
                    <h2>{t('simple.options', { spin: t(`spin.${shownSpin}`) })}</h2>
                    <div className="spin-list" role="group" aria-label={t('simple.options', { spin: t(`spin.${shownSpin}`) })}>
                      <div className="spin-head" aria-hidden="true">
                        <span>{t('simple.setting')}</span>
                        <span>{t('simple.margin')}</span>
                        <span>{t('simple.return')}</span>
                        <span>{t('simple.score')}</span>
                      </div>
                      {listed.map((r) => (
                        <button key={r.id} className={`spin-row ${r === row ? 'on' : ''}`} aria-pressed={r === row}
                          onClick={() => setChoice({ key, serveNo: game.serveNo, id: r.id })}>
                          <span className="spin-name">
                            <b>{units.speed(r.speedKmh)}</b>
                            {r === pickRow && (
                              <span className="pick-star" title={t('simple.recommended')}>
                                ★
                              </span>
                            )}
                            <small>{t('simple.rpm', { rpm: r.rpm.toLocaleString(i18n.language) })}</small>
                          </span>
                          <span className="spin-margin">
                            <b className={r.inRate < floor ? 'low' : ''}>{pct(r.inRate)}%</b>
                            <span className="mini-bar">
                              <span style={{ width: `${r.inRate * 100}%` }} />
                            </span>
                          </span>
                          <span className="spin-return">
                            <Meter d={r.difficulty} />
                            <small>{t(`simple.difficulty.${difficultyWord(r.difficulty)}`)}</small>
                          </span>
                          <span className="spin-score">{pct(r.score)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="hint">
                  {t('simple.method', {
                    tough: pct(WIN_AFTER.tough),
                    easy: pct(WIN_AFTER.easy),
                    second: ranked.second ? `${t(`spin.${ranked.second.style}`)} ${units.speed(ranked.second.speedKmh)}` : '–',
                    secondWins: ranked.second ? pct(ranked.second.wins) : 0,
                  })}
                </p>
              </>
            ) : (
              <p className="note">{ranked ? t('simple.cantSpin', { spin: t(`spin.${shownSpin}`) }) : t('simple.working')}</p>
            )}
          </div>
        </div>

        <div className="simple-game">
          <div className="game-head">
            <h2>{t('simple.game.title')}</h2>
            <button
              className="ghost"
              onClick={() => {
                onGame(NEW_GAME)
                setPlayed(null)
              }}
            >
              {t('simple.game.newGame')}
            </button>
          </div>
          <p className="note">{t('simple.game.note')}</p>
          <div className="score-row">
            <table className="scoreboard">
              <thead>
                <tr>
                  <td />
                  <th scope="col">{t('simple.game.games')}</th>
                  <th scope="col">{t('simple.game.points')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    <span className="serving" title={t('simple.game.serving')} aria-label={t('simple.game.serving')}>
                      ●
                    </span>
                    {t('simple.game.you')}
                  </th>
                  <td>{game.games[0]}</td>
                  <td className="pts">{score.you}</td>
                </tr>
                <tr>
                  <th scope="row">{t('simple.game.them')}</th>
                  <td>{game.games[1]}</td>
                  <td className="pts">{score.them}</td>
                </tr>
              </tbody>
            </table>
            <div className="score-side">
              {score.call && <span className="call">{t(`simple.game.${score.call}`)}</span>}
              <span className="next">{t(game.serveNo === 1 ? 'compare.first' : 'compare.second')}</span>
            </div>
          </div>
          <button className="serve-it" onClick={serveIt} disabled={!row || busy || flying}>
            {t('simple.game.serve', { serve: row ? `${t(`spin.${row.style}`)} ${units.speed(row.speedKmh)}` : '' })}
          </button>
          {played && landedId === played.id && (
            <p key={played.id} className={`played ${played.outcome.kind} ${played.outcome.won === false || (played.outcome.kind === 'fault' && played.serveNo === 2) ? 'lost' : ''}`}>
              {resultText(played, t)}
            </p>
          )}
          {s.firsts > 0 && (
            <p className="hint">
              {t('simple.game.stats', { won: s.won, points: s.points, aces: s.aces, doubles: s.doubles, first: pct(s.firstsIn / s.firsts) })}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
