export const MAX_WARD = 200

/** Extracts "Ward N" (1..200) from phrases like "ward 12", "Ward No. 12", "ward#12", "w-12". */
export function extractWard(text: string): string | null {
  const m = /\b(?:ward|wd|w)\s*(?:no\.?|number|num|#|-|:)?\s*(\d{1,3})\b/i.exec(text)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= MAX_WARD ? `Ward ${n}` : null
}
