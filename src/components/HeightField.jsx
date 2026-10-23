import { useState } from 'react'
import { HEIGHT_LIMITS } from '../serve.js'
import { useUnits } from '../units.js'

const CM_PER_IN = 2.54
const clampM = (m) => Math.min(Math.max(m, HEIGHT_LIMITS[0]), HEIGHT_LIMITS[1])
const toFeet = (m) => {
  const inches = Math.round((m * 100) / CM_PER_IN)
  return { ft: Math.floor(inches / 12), inch: inches % 12 }
}

/**
 * Type a height in centimetres or in feet and inches, following the unit switch. While you type, a
 * valid number updates the server straight away; leaving the box snaps it into the supported range.
 */
export default function HeightField({ meters, onChange }) {
  const unit = useUnits().us ? 'ft' : 'cm'
  // What's in the boxes while typing. null means "show the current height".
  const [draft, setDraft] = useState(null)

  const cm = String(Math.round(meters * 100))
  const { ft, inch } = toFeet(meters)
  const shown = draft ?? (unit === 'cm' ? { cm } : { ft: String(ft), inch: String(inch) })

  const commit = (next) => {
    const m = unit === 'cm' ? Number(next.cm) / 100 : (Number(next.ft) * 12 + Number(next.inch || 0)) * (CM_PER_IN / 100)
    if (Number.isFinite(m) && m >= HEIGHT_LIMITS[0] && m <= HEIGHT_LIMITS[1]) onChange(Math.round(m * 100) / 100)
  }
  const type = (patch) => {
    const next = { ...shown, ...patch }
    setDraft(next)
    commit(next)
  }
  const done = () => {
    if (!draft) return
    const m = unit === 'cm' ? Number(draft.cm) / 100 : (Number(draft.ft) * 12 + Number(draft.inch || 0)) * (CM_PER_IN / 100)
    if (Number.isFinite(m) && m > 0) onChange(Math.round(clampM(m) * 100) / 100)
    setDraft(null)
  }
  const box = (key, label, width) => (
    <input
      type="number"
      inputMode="numeric"
      className="num"
      style={{ width }}
      aria-label={label}
      value={shown[key]}
      onChange={(e) => type({ [key]: e.target.value })}
      onBlur={done}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )

  return (
    <div className="height-field">
      <span>or type it:</span>
      {unit === 'cm' ? (
        <>
          {box('cm', 'height in centimetres', '4.2rem')}
          <span>cm</span>
        </>
      ) : (
        <>
          {box('ft', 'height, feet', '2.8rem')}
          <span>ft</span>
          {box('inch', 'height, inches', '2.8rem')}
          <span>in</span>
        </>
      )}
    </div>
  )
}
