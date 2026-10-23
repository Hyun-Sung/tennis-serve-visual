import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Controls from './components/Controls.jsx'
import Readout from './components/Readout.jsx'
import Scene3D from './components/Scene3D.jsx'
import Timeline from './components/Timeline.jsx'
import TopView from './components/TopView.jsx'
import { simulateServe } from './physics.js'
import { PHASES } from './pose.js'
import { ballPosition, DEFAULT_TOSS, planServe, realTime, SERVER_Z } from './serve.js'

const START = { toss: DEFAULT_TOSS, speedKmh: 180, rpm: 1800, aimZ: -2.1, autoSwing: true, swingDeg: -4 }

export default function App() {
  const [s, setS] = useState(START)
  const [view, setView] = useState('server')
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(0.5)

  const plan = useMemo(() => planServe(s), [s])
  const sim = useMemo(() => simulateServe(plan.flight, plan.contact), [plan])
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
      if (e.code === 'Space' && !['INPUT', 'BUTTON'].includes(e.target.tagName)) {
        e.preventDefault()
        serve()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [serve])

  const update = (patch) => setS((p) => ({ ...p, ...patch }))
  const updateToss = (patch) => setS((p) => ({ ...p, toss: { ...p.toss, ...patch } }))

  const phases = PHASES.map((p) => ({ ...p, t: realTime(plan, p.t) }))
  const events = []
  if (sim.net) events.push({ t: plan.contactT + sim.net.t, label: 'net' })
  if (sim.bounce) events.push({ t: plan.contactT + sim.bounce.t, label: 'bounce' })

  return (
    <main className="app">
      <header>
        <h1>
          Serve Visualization <span>Tool</span>
        </h1>
        <p>move the toss, add spin and power, and watch whether the ball clears the net.</p>
      </header>

      <div className="layout">
        <section className="stage">
          <Scene3D t={t} plan={plan} sim={sim} ball={ball} view={view} onView={setView} />
          <Timeline t={t} total={total} phases={phases} events={events} onScrub={(v) => (setPlaying(false), setT(v))} />
          <div className="transport">
            <button className="primary" onClick={serve}>
              {running ? 'pause' : atEnd ? 'serve again' : 'serve!'}
            </button>
            <button onClick={replay}>replay</button>
            <div className="rates" role="group" aria-label="playback speed">
              {[1, 0.5, 0.25].map((r) => (
                <button key={r} className={r === rate ? 'on' : ''} onClick={() => setRate(r)}>
                  {r === 1 ? '1×' : r === 0.5 ? '½×' : '¼×'}
                </button>
              ))}
            </div>
          </div>
          <div className="below">
            <TopView flown={flown} sim={sim} ball={ball} aimZ={s.aimZ} serverZ={SERVER_Z} onAim={(aimZ) => update({ aimZ })} />
            <Readout sim={sim} plan={plan} flown={flown} autoSwing={s.autoSwing} />
          </div>
        </section>

        <aside className="panel">
          <Controls s={s} plan={plan} onChange={update} onToss={updateToss} />
        </aside>
      </div>
    </main>
  )
}
