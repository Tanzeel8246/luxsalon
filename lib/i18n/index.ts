/**
 * i18n Configuration — react-i18next
 * Supported: English (en), Urdu (ur), Arabic (ar)
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector    from 'i18next-browser-languagedetector'
import { en }              from './en'
import { ur }              from './ur'

const resources = {
  en: { translation: en },
  ur: { translation: ur },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng:      'en',
    supportedLngs:    ['en', 'ur'],
    interpolation:    { escapeValue: false },
    detection: {
      order:  ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    react: { useSuspense: false },
  })

export default i18n

export function setLocale(locale: string) {
  i18n.changeLanguage(locale)
  document.documentElement.lang = locale
  document.documentElement.dir  = ['ur', 'ar'].includes(locale) ? 'rtl' : 'ltr'
  localStorage.setItem('i18nextLng', locale)
}

export function getCurrentLocale(): string {
  return i18n.language ?? 'en'
}

export function isRTL(locale?: string): boolean {
  return ['ur', 'ar', 'fa', 'he'].includes(locale ?? getCurrentLocale())
}
