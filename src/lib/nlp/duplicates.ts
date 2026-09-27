import { preprocess } from './preprocess.ts'

export const DUPLICATE_THRESHOLD = 0.6

export interface PriorComplaint {
  id: string
  text: string
  ward: string | null
}

export interface DuplicateMatch {
  duplicate_of: string | null
  similarity: number
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
  return tf
}

/** TF-IDF vectors for a small corpus, with smoothed idf = ln((1+N)/(1+df)) + 1. */
export function tfidfVectors(docs: string[][]): Map<string, number>[] {
  const df = new Map<string, number>()
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1)
  const n = docs.length
  return docs.map((d) => {
    const v = new Map<string, number>()
    for (const [t, f] of termFreq(d)) v.set(t, f * (Math.log((1 + n) / (1 + (df.get(t) ?? 0))) + 1))
    return v
  })
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dotp = 0
  let na = 0
  let nb = 0
  for (const [t, x] of a) {
    na += x * x
    const y = b.get(t)
    if (y) dotp += x * y
  }
  for (const y of b.values()) nb += y * y
  return na && nb ? dotp / Math.sqrt(na * nb) : 0
}

/**
 * Finds the most similar earlier complaint. It is flagged as a repeat only when
 * similarity exceeds the threshold AND both complaints name the same ward.
 */
export function findDuplicate(text: string, ward: string | null, prior: PriorComplaint[]): DuplicateMatch {
  if (prior.length === 0) return { duplicate_of: null, similarity: 0 }
  const docs = [preprocess(text), ...prior.map((p) => preprocess(p.text))]
  const [q, ...rest] = tfidfVectors(docs)
  let best = { duplicate_of: null as string | null, similarity: 0 }
  rest.forEach((v, i) => {
    const s = cosine(q, v)
    const sameWard = ward !== null && prior[i].ward === ward
    if (sameWard && s > DUPLICATE_THRESHOLD && s > best.similarity) best = { duplicate_of: prior[i].id, similarity: s }
  })
  if (best.duplicate_of) return { ...best, similarity: round(best.similarity) }
  // Report the best similarity even when not flagged, for transparency.
  const top = Math.max(0, ...rest.map((v) => cosine(q, v)))
  return { duplicate_of: null, similarity: round(top) }
}

const round = (x: number) => Math.round(x * 1000) / 1000
