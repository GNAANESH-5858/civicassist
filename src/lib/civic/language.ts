// Script-based language detection and Unicode-aware normalisation for English, Tamil and Hindi.
import type { Lang } from './data.ts'

const TAMIL = /[஀-௿]/g
const DEVANAGARI = /[ऀ-ॿ]/g
const LATIN = /[A-Za-z]/g

export interface DetectedLanguage {
  /** Dominant language, or null when the text has no letters. */
  lang: Lang | null
  /** True when two or more scripts each make up a meaningful share (e.g. Tamil-English). */
  mixed: boolean
  shares: Record<Lang, number>
}

/** Detects the language from the script of the letters (Tamil, Devanagari, Latin). */
export function detectLanguage(text: string): DetectedLanguage {
  const ta = text.match(TAMIL)?.length ?? 0
  const hi = text.match(DEVANAGARI)?.length ?? 0
  const en = text.match(LATIN)?.length ?? 0
  const total = ta + hi + en
  if (!total) return { lang: null, mixed: false, shares: { en: 0, ta: 0, hi: 0 } }
  const shares = { en: en / total, ta: ta / total, hi: hi / total }
  const significant = Object.values(shares).filter((s) => s >= 0.15).length
  // In Tamil-English and Hindi-English mixing, English supplies nouns ("street light", "ward")
  // while the grammar (suffixes, verbs) is Tamil or Hindi. So a meaningful amount of Indic script
  // (4+ letters) decides the language even when Latin letters are more numerous.
  const indic: [Lang, number] = ta >= hi ? ['ta', ta] : ['hi', hi]
  const lang: Lang = indic[1] >= 4 ? indic[0] : en > 0 ? 'en' : indic[0]
  return { lang, mixed: significant >= 2, shares }
}

const TAMIL_DIGITS = '௦௧௨௩௪௫௬௭௮௯'
const DEVANAGARI_DIGITS = '०१२३४५६७८९'

/** Converts Tamil and Devanagari digits to ASCII so numbers parse the same in every language. */
export function asciiDigits(text: string): string {
  return text.replace(/[௦-௯०-९]/g, (d) => String(TAMIL_DIGITS.includes(d) ? TAMIL_DIGITS.indexOf(d) : DEVANAGARI_DIGITS.indexOf(d)))
}

/** For MATCHING only (never display): NFC, ASCII digits, lowercase, no nukta, single spaces. */
export function normalizeText(text: string): string {
  return asciiDigits(text.normalize('NFC'))
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[​-‍﻿]/g, '') // zero-width characters (ZWJ/ZWNJ are not meaningful for matching)
    .replace(/़/g, '') // Devanagari nukta: precomposed and decomposed spellings both match
    .replace(/\s+/g, ' ')
    .trim()
}
