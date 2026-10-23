import { describeServe, PALETTE } from '../compare.js'
import { useUnits } from '../units.js'

export default function Compare({ color, onColor, kept, onKeep, onRemove, onClear }) {
  const units = useUnits()
  return (
    <div className="compare">
      <div className="compare-row">
        <span className="compare-label">New serve line</span>
        <div className="swatches" role="group" aria-label="line color for the new serve">
          {PALETTE.map((c) => (
            <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} aria-label={c}
              onClick={() => onColor(c)} />
          ))}
          <label className="swatch custom" title="pick any color" style={{ background: PALETTE.includes(color) ? undefined : color }}>
            <input type="color" value={color} onChange={(e) => onColor(e.target.value)} aria-label="custom line color" />
          </label>
        </div>
        <button className="keep" onClick={onKeep}>
          keep this serve to compare
        </button>
      </div>
      {kept.length > 0 && (
        <div className="kept">
          <ul>
            {kept.map((k, i) => (
              <li key={k.id}>
                <span className="dot" style={{ background: k.color }} />
                <span className="kept-text">
                  <b>serve {i + 1}</b> {describeServe(k.summary, units)}
                </span>
                <button className="x" aria-label={`remove serve ${i + 1}`} onClick={() => onRemove(k.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button className="ghost" onClick={onClear}>
            clear all
          </button>
        </div>
      )}
    </div>
  )
}
