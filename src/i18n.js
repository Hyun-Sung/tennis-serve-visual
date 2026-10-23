// Translations. All on-screen text lives in src/locales/<code>.json; English is the source and the
// fallback for anything a translation is missing. Only English and the visitor's own language are
// downloaded up front; any other language is fetched when someone switches to it.

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, htmlLang, isLanguage, parsePath, pathFor } from './languages.js'
import en from './locales/en.json'

const loaders = import.meta.glob(['./locales/*.json', '!./locales/en.json'], { import: 'default' })

/** Fetches a language's strings if we don't have them yet. */
async function loadLanguage(code) {
  if (i18n.hasResourceBundle(code, 'translation')) return
  const load = loaders[`./locales/${code}.json`]
  if (load) i18n.addResourceBundle(code, 'translation', await load())
}

/** Switches language once its strings are here, so the page never flashes untranslated. */
export async function switchLanguage(code) {
  await loadLanguage(code)
  if (code !== i18n.language) await i18n.changeLanguage(code)
}

export { LANGUAGES } from './languages.js'

// Remembers that this visitor has picked (or been given) a language, so we only ever send them to
// their browser's language once, on their first visit.
const CHOICE_KEY = 'serve-visual-language-chosen'
function choiceMade() {
  try {
    return localStorage.getItem(CHOICE_KEY) === '1'
  } catch {
    return true // No storage: don't redirect on every visit.
  }
}
export function rememberChoice() {
  try {
    localStorage.setItem(CHOICE_KEY, '1')
  } catch {
    // Nothing to remember it in.
  }
}

/**
 * The language comes from the URL, so every language has its own address that search engines can
 * index. On a first visit to an unprefixed page, a visitor whose browser prefers a language we have
 * is moved to that language's address once.
 */
function firstLanguage() {
  const { lang, page } = parsePath(window.location.pathname)
  if (lang) return lang
  if (!choiceMade()) {
    rememberChoice()
    for (const tag of navigator.languages ?? [navigator.language]) {
      const code = tag?.toLowerCase().split('-')[0]
      if (isLanguage(code)) {
        if (code !== DEFAULT_LANGUAGE) window.history.replaceState(null, '', pathFor(code, page) + window.location.search)
        return code
      }
    }
  }
  return DEFAULT_LANGUAGE
}

const setHtmlLang = (code) => {
  document.documentElement.lang = htmlLang(code)
}

const startLanguage = firstLanguage()
i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false }, // React already escapes
})
i18n.on('languageChanged', setHtmlLang)

/** Resolves once the starting language is loaded; main.jsx waits for it before the first render. */
export const i18nReady = switchLanguage(startLanguage).then(() => setHtmlLang(i18n.language))

export default i18n
