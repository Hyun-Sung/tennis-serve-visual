// Small form pieces shared by the control panels.

/**
 * A labelled range slider. centered is for settings that go either way from zero (like brushing left
 * or right): the fill grows out from a mark in the middle instead of from the left edge, and ends can
 * then name the middle too.
 */
export function Slider({ label, value, display, min, max, step, onChange, hint, disabled, ends, centered = false }) {
  const pct = ((value - min) / (max - min)) * 100
  const input = (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      className={centered ? 'centered' : undefined}
      style={centered ? { '--from': `${Math.min(pct, 50)}%`, '--to': `${Math.max(pct, 50)}%` } : undefined}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
  return (
    <label className={`slider ${disabled ? 'disabled' : ''}`}>
      <span className="row">
        <span>{label}</span>
        <b>{display ?? value}</b>
      </span>
      {centered ? <span className="centered-track">{input}</span> : input}
      {ends && (
        <span className="ends" aria-hidden="true">
          {ends.map((e) => (
            <span key={e}>{e}</span>
          ))}
        </span>
      )}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

export function Seg({ label, options, value, onChange }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
