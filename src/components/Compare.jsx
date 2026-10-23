import { useTranslation } from 'react-i18next'
import { describeServe, PALETTE } from '../compare.js'
import { useUnits } from '../units.js'

export default function Compare({ color, onColor, kept, onKeep, onRemove, onClear }) {
  const { t } = useTranslation()
  const units = useUnits()
  return (
    <div className="compare">
      <div className="compare-row">
        <span className="compare-label">{t('compare.newLine')}</span>
        <div className="swatches" role="group" aria-label={t('compare.colors')}>
          {PALETTE.map((c) => (
            <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} aria-label={c}
              onClick={() => onColor(c)} />
          ))}
          <label className="swatch custom" title={t('compare.custom')} style={{ background: PALETTE.includes(color) ? undefined : color }}>
            <input type="color" value={color} onChange={(e) => onColor(e.target.value)} aria-label={t('compare.customLabel')} />
          </label>
        </div>
        <button className="keep" onClick={onKeep}>
          {t('compare.keep')}
        </button>
      </div>
      {kept.length > 0 && (
        <div className="kept">
          <ul>
            {kept.map((k, i) => (
              <li key={k.id}>
                <span className="dot" style={{ background: k.color }} />
                <span className="kept-text">
                  <b>{t('compare.serveN', { n: i + 1 })}</b> {describeServe(k.summary, units, t)}
                </span>
                <button className="x" aria-label={t('compare.remove', { n: i + 1 })} onClick={() => onRemove(k.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button className="ghost" onClick={onClear}>
            {t('compare.clear')}
          </button>
        </div>
      )}
    </div>
  )
}
