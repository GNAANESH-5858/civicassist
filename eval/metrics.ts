// Retrieval and classification metrics.

/** Fraction of the top-k results that are relevant. */
export function precisionAtK(retrieved: number[], relevant: number[], k = 4): number {
  if (k <= 0) return 0
  const rel = new Set(relevant)
  return retrieved.slice(0, k).filter((id) => rel.has(id)).length / k
}

/** Fraction of relevant items found in the top k. */
export function recallAtK(retrieved: number[], relevant: number[], k = 4): number {
  if (relevant.length === 0) return 0
  const top = new Set(retrieved.slice(0, k))
  return relevant.filter((id) => top.has(id)).length / relevant.length
}

/** Reciprocal rank of the first relevant item (0 if none). */
export function reciprocalRank(retrieved: number[], relevant: number[]): number {
  const rel = new Set(relevant)
  const i = retrieved.findIndex((id) => rel.has(id))
  return i === -1 ? 0 : 1 / (i + 1)
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

export function f1(tp: number, fp: number, fn: number): { precision: number; recall: number; f1: number } {
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  return { precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 }
}

/** Repeat detection scored per complaint: a flag is a true positive only if it points at the right original. */
export function duplicateScores(rows: { predicted: string | null; expected: string | null }[]) {
  let tp = 0
  let fp = 0
  let fn = 0
  for (const r of rows) {
    if (r.predicted && r.predicted === r.expected) tp++
    else {
      if (r.predicted) fp++
      if (r.expected) fn++
    }
  }
  return { tp, fp, fn, ...f1(tp, fp, fn) }
}
