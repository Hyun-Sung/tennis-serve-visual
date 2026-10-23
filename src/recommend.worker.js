// Runs the serve search (about a second of work) off the main thread, so the 3D view keeps moving.
import { recommend } from './recommend.js'

self.onmessage = (e) => {
  const { id, who, maxKmh, level } = e.data
  self.postMessage({ id, result: recommend(who, maxKmh, level) })
}
