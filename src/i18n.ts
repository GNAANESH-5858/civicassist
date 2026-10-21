// Interface translations (bundled; no external translation service is used for the UI).
// Languages: English (default), Tamil, Hindi. Preference is remembered in localStorage.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Lang } from './lib/civic/data.ts'
import enCommon from './locales/en/common.json'
import enGuidance from './locales/en/guidance.json'
import hiCommon from './locales/hi/common.json'
import hiGuidance from './locales/hi/guidance.json'
import taCommon from './locales/ta/common.json'
import taGuidance from './locales/ta/guidance.json'

export const LANGUAGES: { code: Lang; native: string; english: string }[] = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
]

export const LANG_KEY = 'civicassist.lang'

export function storedLanguage(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    return v === 'ta' || v === 'hi' || v === 'en' ? v : 'en'
  } catch {
    return 'en'
  }
}

export const resources = {
  en: { common: enCommon, guidance: enGuidance },
  ta: { common: taCommon, guidance: taGuidance },
  hi: { common: hiCommon, guidance: hiGuidance },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: typeof window === 'undefined' ? 'en' : storedLanguage(),
  fallbackLng: 'en',
  ns: ['common', 'guidance'],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React escapes output
  returnNull: false,
})

function applyLang(lng: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
}
applyLang(i18n.language)
i18n.on('languageChanged', (lng) => {
  applyLang(lng)
  try {
    localStorage.setItem(LANG_KEY, lng)
  } catch {
    // storage unavailable: the choice lasts for this visit only
  }
})

export function currentLang(): Lang {
  const l = i18n.language
  return l === 'ta' || l === 'hi' ? l : 'en'
}

export default i18n
