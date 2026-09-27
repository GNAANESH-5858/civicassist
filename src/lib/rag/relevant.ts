import { NOT_FOUND_THRESHOLD } from '../config.ts'
import type { SchemeRecord } from '../kb/types.ts'
import { matchBreakdown, retrieveSupported, type MatchBreakdown, type RetrieveDeps } from './retrieve.ts'

export interface RelevantRecord {
  record: SchemeRecord
  score: number
  match: MatchBreakdown
}

/**
 * Records that may be relevant to a complaint. A record qualifies only if it is semantically
 * close (score >= NOT_FOUND_THRESHOLD), passes the rural filter (R1), and shares a topical word
 * with the complaint in its complaint domains or AI matching signals.
 */
export async function findRelevant(text: string, deps: RetrieveDeps, k = 3, threshold = NOT_FOUND_THRESHOLD): Promise<RelevantRecord[]> {
  const hits = await retrieveSupported(text, deps, { k })
  return hits.filter((h) => h.score >= threshold).map((h) => ({ ...h, match: matchBreakdown(text, h.record) }))
}
