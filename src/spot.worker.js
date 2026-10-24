// Works out the simple mode's serves for a spot (a tenth of a second or so) off the main thread.
import { spotReport } from './spot.js'

self.onmessage = (e) => {
  const { key, who, maxKmh, level, spot, spins } = e.data
  self.postMessage({ key, result: spotReport(who, maxKmh, level, spot, spins) })
}
