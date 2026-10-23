// Checks every translation against English: same keys, and the same {{placeholders}} and <tags> in each
// string, so nothing shows up missing or as raw template text. Run with: npm run check:locales
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'src', 'locales')
const load = (file) => JSON.parse(readFileSync(join(dir, file), 'utf8'))

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out[key] = String(v)
  }
  return out
}
const tokens = (s) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}|<\/?(\w+)>/g)].map((m) => m[0].replace(/\s/g, '')).sort().join(' ')

const en = flatten(load('en.json'))
let problems = 0
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
  const other = flatten(load(file))
  for (const key of Object.keys(en)) {
    if (!(key in other)) {
      console.log(`${file}: missing ${key}`)
      problems++
    } else if (tokens(en[key]) !== tokens(other[key])) {
      console.log(`${file}: ${key} has [${tokens(other[key])}], English has [${tokens(en[key])}]`)
      problems++
    }
  }
  for (const key of Object.keys(other)) {
    if (!(key in en)) {
      console.log(`${file}: extra ${key}`)
      problems++
    }
  }
}
if (problems) {
  console.log(`${problems} problem(s)`)
  process.exit(1)
}
console.log('all translations match English')
