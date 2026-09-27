import nlp from 'compromise'
import { removeStopWords, STOP_WORDS, tokenise } from './preprocess.ts'

export { extractWard, MAX_WARD } from './ward.ts'

const NOISE = /\b(ward|sir|madam|respected|dear|officer|hello|hi|kindly|pls|plz|whole|days?|weeks?|months?|hours?|times?|area|street|road|people|someone|please|number|no\.?)\b/gi

/** Picks the main issue as the first meaningful noun phrase (compromise noun-phrase chunking). */
export function extractIssue(text: string): string | null {
  const doc = nlp(text.replace(/\[(PHONE|ID|EMAIL)\]/g, ''))
  // Prefer adjective/noun chunks such as "broken streetlight" or "garbage bins".
  const phrases = doc
    .match('(#Adjective|#Noun)+ #Noun')
    .out('array')
    .concat(doc.nouns().out('array')) as string[]
  for (const raw of phrases) {
    const p = trimStopWords(clean(raw))
    if (p.length >= 3 && !/^(i|we|my|our|it|this|that|there)$/.test(p)) return p
  }
  // Fallback for text without a noun chunk (e.g. "flooding and waterlogging"): first content words.
  const words = removeStopWords(tokenise(clean(text))).filter((w) => !/^\d+$/.test(w))
  return words.length ? words.slice(0, 3).join(' ') : null
}

/** Drops stop words at either end of a phrase ("water supply in" -> "water supply"). */
function trimStopWords(p: string): string {
  const words = p.split(' ')
  while (words.length && STOP_WORDS.has(words[0])) words.shift()
  while (words.length && STOP_WORDS.has(words[words.length - 1])) words.pop()
  return words.join(' ')
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
