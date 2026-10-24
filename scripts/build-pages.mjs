// After `vite build`, writes a real HTML page for every page in every language, so search engines can
// index each one: dist/index.html, dist/about/index.html, dist/es/index.html, dist/es/about/index.html…
//
// Each page gets its own <html lang>, title, description, social tags and structured data, and the
// page's text written out as plain HTML inside #root (the app replaces it once it starts).
//
// Pages that point at each other (canonical, hreflang, sitemap, og:url, og:image) need the site's full address.
// Set it when building, e.g. SITE_URL=https://example.com npm run build. Without it those parts are
// left out rather than pointing at a wrong domain.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DEFAULT_LANGUAGE, htmlLang, LANGUAGES, PAGES, pathFor } from '../src/languages.js'

const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/+$/, '')
const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const APP_NAME = 'Serve Visualization Tool'
// Each page's title and description keys.
const SEO_KEYS = {
  tool: ['seo.title', 'seo.description'],
  simple: ['seo.simpleTitle', 'seo.simpleDescription'],
  about: ['seo.aboutTitle', 'seo.aboutDescription'],
}
const ABOUT_SECTIONS = ['flight', 'spin', 'bounce', 'toss', 'swing', 'tolerance', 'returner', 'direction', 'recommend', 'limits']

const template = readFileSync(path.join(dist, 'index.html'), 'utf8')
const seoStart = template.indexOf('<!-- SEO:START')
const seoEnd = template.indexOf('<!-- SEO:END -->')
if (seoStart < 0 || seoEnd < seoStart || !template.includes('<!-- PRERENDER -->')) {
  throw new Error('build-pages: index.html lost its SEO:START/SEO:END or PRERENDER markers')
}

const strings = Object.fromEntries(LANGUAGES.map(({ code }) => [code, JSON.parse(readFileSync(path.join(root, 'src', 'locales', `${code}.json`), 'utf8'))]))
const get = (code, key) => key.split('.').reduce((o, k) => o?.[k], strings[code]) ?? key.split('.').reduce((o, k) => o?.[k], strings.en)

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// Translations only ever use <b>…</b> for emphasis; keep that, escape everything else.
const rich = (s) => escape(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>').replace(/\{\{\s*\w+\s*\}\}/g, '')
const url = (code, page) => `${SITE_URL}${pathFor(code, page)}`

function head(code, page) {
  const title = escape(get(code, SEO_KEYS[page][0]))
  const description = escape(get(code, SEO_KEYS[page][1]))
  const lines = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${APP_NAME}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:locale" content="${htmlLang(code).replace('-', '_')}" />`,
    // With the site's address we can point at the preview card (public/og-image.png); it needs a full URL.
    `<meta name="twitter:card" content="${SITE_URL ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ]
  if (SITE_URL) {
    lines.push(`<link rel="canonical" href="${url(code, page)}" />`, `<meta property="og:url" content="${url(code, page)}" />`)
    lines.push(
      `<meta property="og:image" content="${SITE_URL}/og-image.png" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${title}" />`,
      `<meta name="twitter:image" content="${SITE_URL}/og-image.png" />`,
    )
    for (const l of LANGUAGES) lines.push(`<link rel="alternate" hreflang="${l.html}" href="${url(l.code, page)}" />`)
    lines.push(`<link rel="alternate" hreflang="x-default" href="${url(DEFAULT_LANGUAGE, page)}" />`)
  }
  const data =
    page === 'about'
      ? {
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: get(code, 'about.title'),
          description: get(code, 'seo.aboutDescription'),
          inLanguage: htmlLang(code),
          ...(SITE_URL && { url: url(code, page), isPartOf: { '@type': 'WebSite', name: APP_NAME, url: url(code, 'tool') } }),
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: APP_NAME,
          description: get(code, SEO_KEYS[page][1]),
          inLanguage: htmlLang(code),
          applicationCategory: 'SportsApplication',
          operatingSystem: 'Any (web browser)',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          ...(SITE_URL && { url: url(code, page) }),
        }
  lines.push(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`)
  return lines.map((l) => `    ${l}`).join('\n').trimStart()
}

// The page's words as plain HTML: what a crawler or a visitor without JavaScript sees.
function body(code, page) {
  const nav = `<nav>${PAGES.map((p) => `<a href="${pathFor(code, p)}">${escape(get(code, `nav.${p}`))}</a>`).join(' · ')}</nav>`
  const langs = `<p>${LANGUAGES.map((l) => `<a href="${pathFor(l.code, page)}" hreflang="${l.html}" lang="${l.html}">${escape(l.name)}</a>`).join(' · ')}</p>`
  if (page === 'about') {
    const sections = ABOUT_SECTIONS.map((id) => {
      const formula = get(code, `about.${id}.formula`)
      const extra = strings.en.about[id].formula
        ? `<figure><code>${escape(formula)}</code><figcaption>${escape(get(code, `about.${id}.note`))}</figcaption></figure>`
        : ''
      return `<section><h2>${escape(get(code, `about.${id}.title`))}</h2><p>${rich(get(code, `about.${id}.body`))}</p>${extra}</section>`
    }).join('')
    return `<article class="prerender">${nav}<h1>${escape(get(code, 'about.title'))}</h1><p>${escape(get(code, 'about.intro')).replace('&lt;a&gt;', '<a href="https://paypal.me/hyuns89">').replace('&lt;/a&gt;', '</a>')}</p>${sections}${langs}</article>`
  }
  if (page === 'simple') {
    return `<main class="prerender">${nav}<h1>${escape(get(code, 'simple.title'))}</h1><p>${escape(get(code, 'simple.lede'))}</p><p>${escape(get(code, 'seo.simpleDescription'))}</p><noscript><p>${escape(get(code, 'seo.noscript'))}</p></noscript>${langs}</main>`
  }
  return `<main class="prerender">${nav}<h1>${APP_NAME}</h1><p>${escape(get(code, 'app.tagline'))}</p><p>${escape(get(code, 'seo.description'))}</p><noscript><p>${escape(get(code, 'seo.noscript'))}</p></noscript>${langs}</main>`
}

const written = []
for (const { code } of LANGUAGES) {
  for (const page of PAGES) {
    const html = (template.slice(0, seoStart) + head(code, page) + template.slice(seoEnd + '<!-- SEO:END -->'.length))
      .replace(/<html lang="[^"]*">/, `<html lang="${htmlLang(code)}">`)
      .replace('<!-- PRERENDER -->', body(code, page))
    const out = path.join(dist, ...pathFor(code, page).split('/').filter(Boolean), 'index.html')
    mkdirSync(path.dirname(out), { recursive: true })
    writeFileSync(out, html)
    written.push(pathFor(code, page))
  }
}

const robots = ['User-agent: *', 'Allow: /']
if (SITE_URL) {
  robots.push(`Sitemap: ${SITE_URL}/sitemap.xml`)
  const entries = PAGES.flatMap((page) =>
    LANGUAGES.map(({ code }) => {
      const alts = LANGUAGES.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.html}" href="${url(l.code, page)}" />`)
      alts.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${url(DEFAULT_LANGUAGE, page)}" />`)
      return `  <url>\n    <loc>${url(code, page)}</loc>\n${alts.join('\n')}\n  </url>`
    }),
  )
  writeFileSync(
    path.join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`,
  )
}
writeFileSync(path.join(dist, 'robots.txt'), robots.join('\n') + '\n')

console.log(`build-pages: wrote ${written.length} pages (${written.join(', ')})`)
if (!SITE_URL) console.log('build-pages: SITE_URL is not set, so canonical/hreflang links, og:url, og:image and sitemap.xml were left out.')
