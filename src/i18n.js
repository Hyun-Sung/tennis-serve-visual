// Translations. All on-screen text lives in src/locales/<code>.json; English is the source and the
// fallback for anything a translation is missing.

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, htmlLang, isLanguage, parsePath, pathFor } from './languages.js'
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import pt from './locales/pt.json'
import zh from './locales/zh.json'

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

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    pt: { translation: pt },
    ja: { translation: ja },
    ko: { translation: ko },
    zh: { translation: zh },
  },
  lng: firstLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false }, // React already escapes
})

const setHtmlLang = (code) => {
  document.documentElement.lang = htmlLang(code)
}
setHtmlLang(i18n.language)
i18n.on('languageChanged', setHtmlLang)

export default i18n
