// The languages the app ships, and the URLs each page lives at. Plain data only, so the build script
// that writes the per-language HTML pages can import it too.

// Each language in its own name, so people can find theirs. html is the code for <html lang> and hreflang.
export const LANGUAGES = [
  { code: 'en', name: 'English', html: 'en' },
  { code: 'es', name: 'Español', html: 'es' },
  { code: 'fr', name: 'Français', html: 'fr' },
  { code: 'de', name: 'Deutsch', html: 'de' },
  { code: 'pt', name: 'Português', html: 'pt' },
  { code: 'ja', name: '日本語', html: 'ja' },
  { code: 'ko', name: '한국어', html: 'ko' },
  { code: 'zh', name: '中文（简体）', html: 'zh-Hans' },
]
export const DEFAULT_LANGUAGE = 'en'
export const PAGES = ['tool', 'about']

export const isLanguage = (code) => LANGUAGES.some((l) => l.code === code)
export const htmlLang = (code) => LANGUAGES.find((l) => l.code === code)?.html ?? code

/** English lives at the root; every other language under its own prefix. Pages end in a slash. */
export function pathFor(lang, page) {
  const prefix = lang === DEFAULT_LANGUAGE ? '' : `/${lang}`
  return page === 'about' ? `${prefix}/about/` : `${prefix}/`
}

/** Which language and page a path is. lang is null when the path has no language prefix. */
export function parsePath(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  const lang = isLanguage(parts[0]) && parts[0] !== DEFAULT_LANGUAGE ? parts.shift() : null
  return { lang, page: parts[0] === 'about' ? 'about' : 'tool' }
}
