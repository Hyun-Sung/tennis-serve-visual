import * as THREE from 'three'

// Three flat bands of light for a soft cartoon look.
const gradient = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]), 3, 1)
gradient.minFilter = THREE.NearestFilter
gradient.magFilter = THREE.NearestFilter
gradient.needsUpdate = true

const cache = new Map()

export function toon(color, extra = {}) {
  const key = color + JSON.stringify(extra)
  if (!cache.has(key)) cache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra }))
  return cache.get(key)
}

export function mesh(geometry, material, { cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = cast
  m.receiveShadow = receive
  return m
}
