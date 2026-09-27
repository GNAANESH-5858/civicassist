import PorterStemmer from 'natural/lib/natural/stemmers/porter_stemmer.js'
import { words as NATURAL_STOP_WORDS } from 'natural/lib/natural/util/stopwords.js'

// Negations carry meaning in complaints ("no water", "not collected"), so keep them.
const KEEP = new Set(['no', 'not', 'nor', 'without'])
export const STOP_WORDS = new Set([...NATURAL_STOP_WORDS, 'please', 'sir', 'madam', 'kindly', 'pls', 'plz'].filter((w) => !KEEP.has(w)))

/** Lowercases and splits into alphanumeric tokens. */
export function tokenise(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

export function removeStopWords(tokens: string[]): string[] {
  return tokens.filter((t) => !STOP_WORDS.has(t))
}

export function stem(tokens: string[]): string[] {
  return tokens.map((t) => PorterStemmer.stem(t))
}

/** Full pipeline: lowercase, tokenise, drop stop words and bare numbers, Porter-stem. */
export function preprocess(text: string): string[] {
  return stem(removeStopWords(tokenise(text)).filter((t) => !/^\d+$/.test(t)))
}
