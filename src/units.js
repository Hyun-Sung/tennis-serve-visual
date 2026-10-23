// Showing measurements in metric or US units. Everything inside the model stays in metres and km/h;
// only what's on screen changes.

import { createContext, useContext } from 'react'

// Each value is also its label's key (units.<value>).
export const UNIT_SYSTEMS = ['metric', 'us']

const M_PER_IN = 0.0254
const KMH_PER_MPH = 1.609344

function feetAndInches(m) {
  const inches = Math.round(Math.abs(m) / M_PER_IN)
  return `${m < 0 ? '−' : ''}${Math.floor(inches / 12)}′${inches % 12}″`
}

/** Formatters for one unit system. */
export function unitsFor(system) {
  const us = system === 'us'
  return {
    system,
    us,
    // Small distances (clearance, toss placement, jump): whole centimetres or inches. abs drops the sign.
    short(m, { abs = false, signed = false } = {}) {
      const v = Math.round((abs ? Math.abs(m) : m) / (us ? M_PER_IN : 0.01))
      return `${signed && v > 0 ? '+' : ''}${v} ${us ? 'in' : 'cm'}`
    },
    // Heights and longer distances: metres to two places, or feet and inches.
    long(m) {
      return us ? feetAndInches(m) : `${m.toFixed(2)} m`
    },
    speed(kmh) {
      return us ? `${Math.round(kmh / KMH_PER_MPH)} mph` : `${Math.round(kmh)} km/h`
    },
    // Height is the one people like to see both ways.
    height(m) {
      return us ? `${feetAndInches(m)} · ${m.toFixed(2)} m` : `${m.toFixed(2)} m · ${feetAndInches(m)}`
    },
  }
}

export const UnitsContext = createContext(unitsFor('metric'))
export const useUnits = () => useContext(UnitsContext)

const KEY = 'serve-visual-units'
/** The viewer's last choice, if this browser remembers it. */
export function savedSystem() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'us' || v === 'metric' ? v : null
  } catch {
    return null
  }
}
export function saveSystem(system) {
  try {
    localStorage.setItem(KEY, system)
  } catch {
    // Storage can be blocked; the choice just won't be remembered.
  }
}
