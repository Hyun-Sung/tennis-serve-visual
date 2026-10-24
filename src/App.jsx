import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { nextColor, PALETTE, summarize } from './compare.js'
import About, { DONATE_URL } from './components/About.jsx'
import Compare from './components/Compare.jsx'
import Controls from './components/Controls.jsx'
import Readout from './components/Readout.jsx'
import Recommend from './components/Recommend.jsx'
import Risk from './components/Risk.jsx'
import Simple from './components/Simple.jsx'
import Target from './components/Target.jsx'
import { Seg } from './components/Fields.jsx'
import Timeline from './components/Timeline.jsx'
import TopView from './components/TopView.jsx'
import { assessServe, DEFAULT_LEVEL, evaluateReturn, RETURN_FLIGHT } from './outcome.js'
import { simulateServe } from './physics.js'
import { PHASES } from './pose.js'
import { DEFAULT_MAX_SPEED } from './recommend.js'
import { DEFAULT_SPINS, DEFAULT_SPOT } from './spot.js'
import {
  ballPosition,
  DEFAULT_FOOTWORK,
  DEFAULT_HAND,
  DEFAULT_HEIGHT,
  DEFAULT_HIT,
  DEFAULT_SIDE,
  DEFAULT_SWING,
  DEFAULT_TOSS,
  planServe,
  realTime,
} from './serve.js'
import { LANGUAGES, rememberChoice, switchLanguage } from './i18n.js'
import { PAGES, parsePath, pathFor } from './languages.js'
import { savedSystem, saveSystem, UNIT_SYSTEMS, UnitsContext, unitsFor } from './units.js'

// three.js is most of the download, so the 3D view loads in its own file after the rest of the page.
const Scene3D = lazy(() => import('./components/Scene3D.jsx'))

// Each page's tab title and search description.
const SEO_KEYS = {
  tool: { title: 'seo.title', description: 'seo.description' },
  simple: { title: 'seo.simpleTitle', description: 'seo.simpleDescription' },
  about: { title: 'seo.aboutTitle', description: 'seo.aboutDescription' },
}

// Metric unless this browser chose otherwise, or it's set up for the US.
const firstSystem = () => savedSystem() ?? (navigator.language === 'en-US' ? 'us' : 'metric')

const START = {
  toss: DEFAULT_TOSS,
  hand: DEFAULT_HAND,
  side: DEFAULT_SIDE,
  height: DEFAULT_HEIGHT,
  ...DEFAULT_FOOTWORK,
  speedKmh: 180,
  swing: DEFAULT_SWING,
  hit: DEFAULT_HIT,
  aimZ: -2.1,
  autoSwing: true,
  swingDeg: -4,
}

export default function App() {
  const { t: tr, i18n } = useTranslation()
  const [page, setPage] = useState(() => parsePath(window.location.pathname).page)
  const [s, setS] = useState(START)
  const [view, setView] = useState('server')
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(0.5)
  const [lineColor, setLineColor] = useState(PALETTE[0])
  const [kept, setKept] = useState([])
  const [level, setLevel] = useState(DEFAULT_LEVEL)
  const [maxKmh, setMaxKmh] = useState(DEFAULT_MAX_SPEED)
  // The simple mode's landing spot and choices, kept here so they survive a trip to the full tool.
  const [spot, setSpot] = useState(DEFAULT_SPOT)
  // The kind of serve chosen there for the first and second serve.
  const [spins, setSpins] = useState(DEFAULT_SPINS)
  // Whether it's showing the first or the second serve.
  const [serveNo, setServeNo] = useState(1)
  const [system, setSystem] = useState(firstSystem)
  const units = useMemo(() => unitsFor(system), [system])
  const chooseSystem = (v) => {
    setSystem(v)
    saveSystem(v)
  }

  // Each page in each language has its own address (see languages.js), so moving around updates the URL.
  const go = (nextPage, lang = i18n.language) => {
    const href = pathFor(lang, nextPage)
    if (href !== window.location.pathname) window.history.pushState(null, '', href)
    if (lang !== i18n.language) switchLanguage(lang)
    if (nextPage !== page) {
      setPage(nextPage)
      window.scrollTo(0, 0)
    }
  }
  const chooseLanguage = (lang) => {
    rememberChoice()
    go(page, lang)
  }
  useEffect(() => {
    const onPop = () => {
      const where = parsePath(window.location.pathname)
      setPage(where.page)
      switchLanguage(where.lang ?? 'en')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [i18n])
  // Keep the tab title and description in step with the page and language.
  useEffect(() => {
    const seo = SEO_KEYS[page]
    document.title = tr(seo.title)
    document.querySelector('meta[name="description"]')?.setAttribute('content', tr(seo.description))
  }, [page, tr])
  const link = (nextPage) => ({
    href: pathFor(i18n.language, nextPage),
    onClick: (e) => {
      e.preventDefault()
      go(nextPage)
    },
  })

  const plan = useMemo(() => planServe(s), [s])
  const sim = useMemo(() => simulateServe(plan.flight, plan.contact, RETURN_FLIGHT), [plan])
  const ret = useMemo(() => evaluateReturn(sim, level, plan.flight.speedKmh, plan.side), [sim, level, plan])
  // Simulating 64 slightly-off serves takes a few tens of milliseconds, so let it lag behind a dragged slider.
  const lagPlan = useDeferredValue(plan)
  const lagLevel = useDeferredValue(level)
  const risk = useMemo(() => assessServe(lagPlan, lagLevel), [lagPlan, lagLevel])
  const total = plan.contactT + Math.max(sim.duration, (sim.bounce?.t ?? 0) + 1) + 0.4
  const ball = ballPosition(plan, sim, t)
  const flown = t - plan.contactT
  const atEnd = t >= total - 0.001
  // The 3D serve only plays on the tool page; elsewhere it waits.
  const running = playing && !atEnd && page === 'tool'

  const totalRef = useRef(total)
  useEffect(() => {
    totalRef.current = total
  }, [total])

  useEffect(() => {
    if (!running) return
    let last = performance.now()
    let raf
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      setT((prev) => Math.min(prev + dt * rate, totalRef.current))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, rate])

  const serve = useCallback(() => {
    if (atEnd) setT(0)
    setPlaying(atEnd || !running)
  }, [atEnd, running])
  const replay = () => {
    setT(0)
    setPlaying(true)
  }

  useEffect(() => {
    const id = setTimeout(() => setPlaying(true), 700)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (page === 'tool' && e.code === 'Space' && !['INPUT', 'BUTTON', 'SELECT', 'A'].includes(e.target.tagName)) {
        e.preventDefault()
        serve()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [serve, page])

  // Keep the current serve on screen and give the next one its own color.
  const keepServe = () => {
    const summary = summarize(s, plan, sim, risk, level)
    const next = [...kept, { id: Date.now(), color: lineColor, points: sim.points, bounce: sim.bounce, result: sim.result, summary }]
    setKept(next)
    setLineColor(nextColor(next.map((k) => k.color)))
  }
  // Keep the recommended first and second serve as lines of their own, without changing the current serve.
  const keepPair = (...serves) => {
    const next = [...kept]
    serves.forEach((one, i) => {
      const p = planServe(one)
      const flight = simulateServe(p.flight, p.contact, RETURN_FLIGHT)
      const summary = summarize(one, p, flight, assessServe(p, level, { window: false }), level, i === 0 ? 'first' : 'second')
      const color = nextColor(next.map((k) => k.color))
      next.push({ id: Date.now() + i, color, points: flight.points, bounce: flight.bounce, result: flight.result, summary })
    })
    setKept(next)
    setLineColor(nextColor(next.map((k) => k.color)))
  }
  // The server as the recommender sees them; a new object only when one of these changes.
  const who = useMemo(
    () => ({ height: s.height, hand: s.hand, side: s.side, stance: s.stance, jump: s.jump }),
    [s.height, s.hand, s.side, s.stance, s.jump],
  )
  // Load a recommended serve into the controls and play it.
  const tryServe = (one) => {
    const { speedKmh, swing, hit, toss, aimZ, autoSwing } = one
    setS((p) => ({ ...p, speedKmh, swing, hit, toss, aimZ, autoSwing }))
    setT(0)
    setPlaying(true)
  }
  // From the simple mode: the serve that lands on the chosen spot (its racket angle is set by hand,
  // since it was solved for that spot), played in the full tool.
  const watchServe = (one) => {
    const { speedKmh, swing, hit, toss, aimZ, autoSwing, swingDeg } = one
    setS((p) => ({ ...p, speedKmh, swing, hit, toss, aimZ, autoSwing, swingDeg }))
    setT(0)
    setPlaying(true)
    go('tool')
  }

  const update = (patch) => setS((p) => ({ ...p, ...patch }))
  // Switching hands mirrors the toss, the brush and the contact point, so it's the same serve played the other way.
  const setHand = (hand) =>
    setS((p) =>
      p.hand === hand
        ? p
        : {
            ...p,
            hand,
            toss: { ...p.toss, side: -p.toss.side },
            swing: { ...p.swing, side: -p.swing.side },
            hit: { ...p.hit, u: -p.hit.u },
          },
    )
  // The other side of the court: the aim mirrors with it, so a serve to the T stays a serve to the T.
  const setSide = (side) => setS((p) => (p.side === side ? p : { ...p, side, aimZ: -p.aimZ }))
  const updateToss = (patch) => setS((p) => ({ ...p, toss: { ...p.toss, ...patch } }))

  const phases = PHASES.map((p) => ({ ...p, t: realTime(plan, p.t) }))
  const events = []
  if (sim.net) events.push({ t: plan.contactT + sim.net.t, label: 'net' })
  if (sim.bounce) events.push({ t: plan.contactT + sim.bounce.t, label: 'bounce' })

  return (
    <UnitsContext.Provider value={units}>
      <main className="app">
        <header>
          <div>
            {/* The tool page's main heading is the app name; on the About page it's the article title. */}
            {page === 'tool' ? (
              <h1 className="brand">
                Serve Visualization <span>Tool</span>
              </h1>
            ) : (
              <a className="brand" {...link('tool')}>
                Serve Visualization <span>Tool</span>
              </a>
            )}
            <p>{tr('app.tagline')}</p>
            <nav className="site-nav">
              {PAGES.map((p) => (
                <a key={p} className={page === p ? 'on' : ''} aria-current={page === p ? 'page' : undefined} {...link(p)}>
                  {tr(`nav.${p}`)}
                </a>
              ))}
            </nav>
          </div>
          <div className="settings">
            <label className="units-switch">
              {/* A globe reads as "language" whatever language the label happens to be in. */}
              <svg className="globe" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9.5" />
                <ellipse cx="12" cy="12" rx="4" ry="9.5" />
                <path d="M2.5 12h19M4 7h16M4 17h16" />
              </svg>
              <span>{tr('app.language')}</span>
              <select value={i18n.language} onChange={(e) => chooseLanguage(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="units-switch">
              <span>{tr('app.units')}</span>
              <Seg
                label={tr('app.units')}
                options={UNIT_SYSTEMS.map((u) => ({ value: u, label: tr(`units.${u}`) }))}
                value={system}
                onChange={chooseSystem}
              />
            </div>
          </div>
        </header>

        {page === 'about' ? (
          <About onTool={() => go('tool')} toolHref={pathFor(i18n.language, 'tool')} />
        ) : page === 'simple' ? (
          <Simple
            who={who}
            level={level}
            onLevel={setLevel}
            maxKmh={maxKmh}
            onMaxKmh={setMaxKmh}
            onHand={setHand}
            onSide={setSide}
            spot={spot}
            onSpot={setSpot}
            spins={spins}
            onSpins={setSpins}
            serveNo={serveNo}
            onServeNo={setServeNo}
            onWatch={watchServe}
          />
        ) : (
          <div className="layout">
            <section className="stage">
              <Suspense
                fallback={
                  <div className="scene">
                    <div className="canvas-host scene-loading">{tr('views.loading')}</div>
                  </div>
                }
              >
                <Scene3D t={t} plan={plan} sim={sim} ball={ball} view={view} onView={setView} lineColor={lineColor} kept={kept} ret={ret}
                  hand={s.hand} units={units} />
              </Suspense>
              <Timeline t={t} total={total} phases={phases} events={events} onScrub={(v) => (setPlaying(false), setT(v))} />
              <div className="transport">
                <button className="primary" onClick={serve}>
                  {tr(running ? 'transport.pause' : atEnd ? 'transport.serveAgain' : 'transport.serve')}
                </button>
                <button onClick={replay}>{tr('transport.replay')}</button>
                <div className="rates" role="group" aria-label={tr('transport.speed')}>
                  {[1, 0.5, 0.25].map((r) => (
                    <button key={r} className={r === rate ? 'on' : ''} onClick={() => setRate(r)}>
                      {r === 1 ? '1×' : r === 0.5 ? '½×' : '¼×'}
                    </button>
                  ))}
                </div>
              </div>
              <Compare
                color={lineColor}
                onColor={setLineColor}
                kept={kept}
                onKeep={keepServe}
                onRemove={(id) => setKept((k) => k.filter((x) => x.id !== id))}
                onClear={() => setKept([])}
              />
              <div className="below">
                <TopView flown={flown} sim={sim} ball={ball} aimZ={s.aimZ} serverZ={plan.serverZ} side={s.side} onAim={(aimZ) => update({ aimZ })}
                  lineColor={lineColor} kept={kept} ret={ret} />
                <Readout sim={sim} plan={plan} flown={flown} autoSwing={s.autoSwing} ret={ret} />
              </div>
              <div className="outcome-row">
                <Risk risk={risk} direction={lagPlan.direction} level={lagLevel} stale={lagPlan !== plan || lagLevel !== level} />
                <Target side={s.side} onSide={setSide} aimZ={s.aimZ} onAim={(aimZ) => update({ aimZ })} level={level} onLevel={setLevel} />
              </div>
              <Recommend who={who} level={lagLevel} maxKmh={maxKmh} onMaxKmh={setMaxKmh} onTry={tryServe} onKeepBoth={keepPair} />
            </section>

            <aside className="panel">
              <Controls s={s} plan={plan} onChange={update} onToss={updateToss} onHand={setHand} />
            </aside>
          </div>
        )}

        <footer className="site-footer">
          <span>{tr('footer.free')}</span>
          <a {...link('about')}>{tr('footer.about')}</a>
          <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
            {tr('footer.donate')}
          </a>
        </footer>
      </main>
    </UnitsContext.Provider>
  )
}
