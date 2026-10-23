// Draws the 1200×630 preview card that link previews show (og:image / twitter:image) and saves it as
// public/og-image.png. Run with: npm run og-image (only needed when the design changes).
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const W = 1200
const H = 630
const ink = '#2f3e66'
const soft = '#6b7590'
const ball = '#d8ef3a'

// A court seen from behind the server, as a simple perspective trapezoid.
const court = { x: 640, y: 120, w: 500, h: 400 }
const lerp = (a, b, t) => a + (b - a) * t
// Points on the court from u (0 left to 1 right) and v (0 far baseline to 1 near baseline).
function at(u, v) {
  const top = { l: court.x + 140, r: court.x + court.w - 140, y: court.y + 150 }
  const bottom = { l: court.x + 10, r: court.x + court.w - 10, y: court.y + court.h - 20 }
  const y = lerp(top.y, bottom.y, v)
  const l = lerp(top.l, bottom.l, v)
  const r = lerp(top.r, bottom.r, v)
  return [lerp(l, r, u), y]
}
const line = (a, b) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" />`
const poly = (pts) => pts.map((p) => p.join(',')).join(' ')

// The feature chips under the subtitle: two on the first row, one below.
const chips = [
  { text: 'toss · stance · jump', x: 72, y: 480, w: 270 },
  { text: 'spin · speed · aim', x: 357, y: 480, w: 250 },
  { text: 'ace odds vs NTRP 2.0–5.0', x: 72, y: 536, w: 370 },
]
// Where the server stands (near baseline, deuce side) and where the serve lands (in the far service box).
const SERVER = at(0.7, 1.02)
const LAND = at(0.36, 0.29)

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#bfe3f5" />
      <stop offset="1" stop-color="#e8f5fb" />
    </linearGradient>
    <clipPath id="card"><rect x="${court.x}" y="${court.y}" width="${court.w}" height="${court.h}" rx="28" /></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="#fdf6e3" />

  <g font-family="Segoe UI, Arial, sans-serif" fill="${ink}">
    <text x="70" y="200" font-size="76" font-weight="800">Serve</text>
    <text x="70" y="290" font-size="76" font-weight="800">Visualization</text>
    <rect x="68" y="335" width="168" height="34" fill="${ball}" />
    <text x="70" y="380" font-size="76" font-weight="800">Tool</text>
    <text x="72" y="440" font-size="32" fill="${soft}">Free 3D tennis serve simulator</text>
    ${chips
      .map(
        (c) =>
          `<g transform="translate(${c.x} ${c.y})"><rect width="${c.w}" height="44" rx="22" fill="#fffdf7" stroke="#eadfc4" stroke-width="3" /><text x="${c.w / 2}" y="29" font-size="21" text-anchor="middle" fill="${ink}">${c.text}</text></g>`,
      )
      .join('')}
  </g>

  <g clip-path="url(#card)">
    <rect x="${court.x}" y="${court.y}" width="${court.w}" height="${court.h}" fill="url(#sky)" />
    <g fill="#7fb37f">
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${court.x + 30 + i * 80}" cy="${court.y + 150}" r="${46 + (i % 3) * 10}" />`).join('')}
    </g>
    <rect x="${court.x}" y="${court.y + 150}" width="${court.w}" height="70" fill="#3f7a5a" />
    <rect x="${court.x}" y="${court.y + 220}" width="${court.w}" height="${court.h}" fill="#5f9e6e" />
    <polygon points="${poly([at(0, 0), at(1, 0), at(1, 1), at(0, 1)])}" fill="#3d6fb6" />
    <g stroke="#ffffff" stroke-width="4" stroke-linecap="round">
      ${line(at(0, 0), at(1, 0))}${line(at(0, 1), at(1, 1))}${line(at(0, 0), at(0, 1))}${line(at(1, 0), at(1, 1))}
      ${line(at(0.12, 0), at(0.12, 1))}${line(at(0.88, 0), at(0.88, 1))}
      ${line(at(0.12, 0.25), at(0.88, 0.25))}${line(at(0.12, 0.75), at(0.88, 0.75))}${line(at(0.5, 0.25), at(0.5, 0.75))}
    </g>
    <polygon points="${poly([at(-0.04, 0.5), at(1.04, 0.5), [at(1.04, 0.5)[0], at(1.04, 0.5)[1] - 34], [at(-0.04, 0.5)[0], at(-0.04, 0.5)[1] - 30]])}" fill="#2b3446" opacity="0.85" />
    <line x1="${at(-0.04, 0.5)[0]}" y1="${at(-0.04, 0.5)[1] - 30}" x2="${at(1.04, 0.5)[0]}" y2="${at(1.04, 0.5)[1] - 34}" stroke="#ffffff" stroke-width="6" />
    <!-- the serve: from the server, over the net, into the far service box -->
    <path d="M ${SERVER[0] + 12} ${SERVER[1] - 160} Q ${at(0.48, 0.55)[0]} ${at(0.48, 0.55)[1] - 150} ${LAND[0]} ${LAND[1]}"
      fill="none" stroke="#ffc94d" stroke-width="7" stroke-linecap="round" stroke-dasharray="16 12" />
    <ellipse cx="${LAND[0]}" cy="${LAND[1] + 5}" rx="18" ry="6" fill="#ffffff" opacity="0.85" />
    <circle cx="${LAND[0]}" cy="${LAND[1] - 4}" r="11" fill="${ball}" stroke="#a9c21f" stroke-width="3" />
    <!-- the server, from behind -->
    <g transform="translate(${SERVER[0]} ${SERVER[1]}) scale(0.72)">
      <ellipse cx="0" cy="4" rx="40" ry="8" fill="#14281e" opacity="0.25" />
      <rect x="-18" y="-70" width="14" height="70" rx="7" fill="#e4b493" />
      <rect x="4" y="-70" width="14" height="70" rx="7" fill="#f1c7a3" />
      <rect x="-24" y="-92" width="48" height="34" rx="12" fill="${ink}" />
      <rect x="-28" y="-160" width="56" height="78" rx="22" fill="#f27b5c" />
      <rect x="18" y="-210" width="13" height="66" rx="6" fill="#f1c7a3" transform="rotate(12 24 -150)" />
      <circle cx="0" cy="-182" r="24" fill="#4a3426" />
      <rect x="-24" y="-196" width="48" height="9" rx="4" fill="#ffffff" />
    </g>
    <g transform="translate(${at(0.5, 0.5)[0] - 92} ${at(0.5, 0.5)[1] - 132})">
      <rect width="184" height="42" rx="21" fill="${ink}" />
      <text x="92" y="28" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="800" fill="#ffffff" text-anchor="middle">clears by 21 cm</text>
    </g>
  </g>
  <rect x="${court.x}" y="${court.y}" width="${court.w}" height="${court.h}" rx="28" fill="none" stroke="#eadfc4" stroke-width="5" />
  <g transform="translate(${court.x + court.w - 150} ${court.y + court.h - 50})">
    <rect width="132" height="58" rx="18" fill="${ball}" stroke="#ffffff" stroke-width="4" />
    <text x="66" y="40" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="800" fill="${ink}" text-anchor="middle">ACE!</text>
  </g>
</svg>`

const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' } }).render().asPng()
const out = path.resolve(import.meta.dirname, '..', 'public', 'og-image.png')
writeFileSync(out, png)
console.log(`wrote ${out} (${Math.round(png.length / 1024)} kB)`)
