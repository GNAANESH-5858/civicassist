import nlp from 'compromise'
import { removeStopWords, tokenise } from './preprocess.ts'

export const MAX_WARD = 200

/** Extracts "Ward N" (1..200) from phrases like "ward 12", "Ward No. 12", "ward#12", "w-12". */
export function extractWard(text: string): string | null {
  const m = /\b(?:ward|wd|w)\s*(?:no\.?|number|num|#|-|:)?\s*(\d{1,3})\b/i.exec(text)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= MAX_WARD ? `Ward ${n}` : null
}

const NOISE = /\b(ward|sir|madam|days?|weeks?|months?|hours?|times?|area|street|road|people|someone|please|number|no\.?)\b/gi

/** Picks the main issue as the first meaningful noun phrase (compromise noun-phrase chunking). */
export function extractIssue(text: string): string | null {
  const doc = nlp(text.replace(/\[(PHONE|ID|EMAIL)\]/g, ''))
  // Prefer adjective/noun chunks such as "broken streetlight" or "garbage bins".
  const phrases = doc
    .match('(#Adjective|#Noun)+ #Noun')
    .out('array')
    .concat(doc.nouns().out('array')) as string[]
  for (const raw of phrases) {
    const p = clean(raw)
    if (p.length >= 3 && !/^(i|we|my|our|it|this|that|there)$/.test(p)) return p
  }
  // Fallback for text without a noun chunk (e.g. "flooding and waterlogging"): first content words.
  const words = removeStopWords(tokenise(clean(text))).filter((w) => !/^\d+$/.test(w))
  return words.length ? words.slice(0, 3).join(' ') : null
}

function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/\[(phone|id|email)\]/g, ' ')
    .replace(/[^a-z\s/-]/g, ' ')
    .replace(NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s/-]+|[\s/-]+$/g, '')
}
