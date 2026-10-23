// Small form pieces shared by the control panels.

export function Slider({ label, value, display, min, max, step, onChange, hint, disabled, ends }) {
  return (
    <label className={`slider ${disabled ? 'disabled' : ''}`}>
      <span className="row">
        <span>{label}</span>
        <b>{display ?? value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))} />
      {ends && (
        <span className="ends" aria-hidden="true">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
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
