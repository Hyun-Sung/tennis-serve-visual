import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { nextColor, PALETTE, summarize } from './compare.js'
import About, { DONATE_URL } from './components/About.jsx'
import Compare from './components/Compare.jsx'
import Controls from './components/Controls.jsx'
import Readout from './components/Readout.jsx'
import Risk from './components/Risk.jsx'
import Target from './components/Target.jsx'
import { Seg } from './components/Fields.jsx'
import Timeline from './components/Timeline.jsx'
import TopView from './components/TopView.jsx'
import { assessServe, DEFAULT_LEVEL, evaluateReturn, RETURN_X } from './outcome.js'
import { simulateServe } from './physics.js'
import { PHASES } from './pose.js'
import {
  ballPosition,
  DEFAULT_FOOTWORK,
  DEFAULT_HAND,
  DEFAULT_HEIGHT,
  DEFAULT_HIT,
  DEFAULT_SWING,
  DEFAULT_TOSS,
  planServe,
  realTime,
  SERVER_Z,
} from './serve.js'
import { LANGUAGES, rememberChoice, switchLanguage } from './i18n.js'
import { parsePath, pathFor } from './languages.js'
import { savedSystem, saveSystem, UNIT_SYSTEMS, UnitsContext, unitsFor } from './units.js'

// three.js is most of the download, so the 3D view loads in its own file after the rest of the page.
const Scene3D = lazy(() => import('./components/Scene3D.jsx'))

// Metric unless this browser chose otherwise, or it's set up for the US.
const firstSystem = () => savedSystem() ?? (navigator.language === 'en-US' ? 'us' : 'metric')

const START = {
  toss: DEFAULT_TOSS,
  hand: DEFAULT_HAND,
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
    document.title = tr(page === 'about' ? 'seo.aboutTitle' : 'seo.title')
    document.querySelector('meta[name="description"]')?.setAttribute('content', tr(page === 'about' ? 'seo.aboutDescription' : 'seo.description'))
  }, [page, tr])
  const link = (nextPage) => ({
    href: pathFor(i18n.language, nextPage),
    onClick: (e) => {
      e.preventDefault()
      go(nextPage)
    },
  })

  const plan = useMemo(() => planServe(s), [s])
  const sim = useMemo(() => simulateServe(plan.flight, plan.contact, { crossX: RETURN_X }), [plan])
  const ret = useMemo(() => evaluateReturn(sim, level, plan.flight.speedKmh), [sim, level, plan])
  // Simulating 64 slightly-off serves takes a few tens of milliseconds, so let it lag behind a dragged slider.
  const lagPlan = useDeferredValue(plan)
  const lagLevel = useDeferredValue(level)
  const risk = useMemo(() => assessServe(lagPlan, lagLevel), [lagPlan, lagLevel])
  const total = plan.contactT + Math.max(sim.duration, (sim.bounce?.t ?? 0) + 1) + 0.4
  const ball = ballPosition(plan, sim, t)
  const flown = t - plan.contactT
  const atEnd = t >= total - 0.001
  const running = playing && !atEnd

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
              <a className={page === 'tool' ? 'on' : ''} aria-current={page === 'tool' ? 'page' : undefined} {...link('tool')}>
                {tr('nav.tool')}
              </a>
              <a className={page === 'about' ? 'on' : ''} aria-current={page === 'about' ? 'page' : undefined} {...link('about')}>
                {tr('nav.about')}
              </a>
            </nav>
          </div>
          <div className="settings">
            <label className="units-switch">
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
                <TopView flown={flown} sim={sim} ball={ball} aimZ={s.aimZ} serverZ={SERVER_Z} onAim={(aimZ) => update({ aimZ })}
                  lineColor={lineColor} kept={kept} ret={ret} />
                <Readout sim={sim} plan={plan} flown={flown} autoSwing={s.autoSwing} ret={ret} />
              </div>
              <div className="outcome-row">
                <Risk risk={risk} level={lagLevel} stale={lagPlan !== plan || lagLevel !== level} />
                <Target aimZ={s.aimZ} onAim={(aimZ) => update({ aimZ })} level={level} onLevel={setLevel} />
              </div>
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
