/** Shape of public/data/index.json. vectors[i] belongs to record ids[i]. */
export interface SearchIndex {
  model: string
  dim: number
  ids: number[]
  vectors: number[][]
}

export interface Ranked {
  id: number
  score: number
}

export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`)
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/** Ranks every indexed record by cosine similarity (vectors are normalised) and returns the top k. */
export function rank(query: number[], index: SearchIndex, k: number, allow?: (id: number) => boolean): Ranked[] {
  const scored: Ranked[] = []
  index.vectors.forEach((v, i) => {
    const id = index.ids[i]
    if (allow && !allow(id)) return
    scored.push({ id, score: dot(query, v) })
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}
