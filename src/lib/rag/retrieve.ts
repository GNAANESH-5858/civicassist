// Retrieval over the knowledge base. Pure given its inputs, so it runs in the browser and in Node.
import { EMBED_MODEL, TOP_K } from '../config.ts'
import type { SchemeRecord } from '../kb/types.ts'
import { preprocess } from '../nlp/preprocess.ts'
import { rank, type SearchIndex } from '../search/rank.ts'

export interface RetrieveDeps {
  records: SchemeRecord[]
  index: SearchIndex
  embed: (texts: string[]) => Promise<number[][]>
}

export interface Retrieved {
  record: SchemeRecord
  score: number
}

/** Rule R1: rural programmes are only considered when the user explicitly talks about a rural setting. */
export function mentionsRural(text: string): boolean {
  return /\b(rural|village|villages|gram|panchayat|farm|farmer|farmers|agricultur\w*)\b/i.test(text)
}

/** Throws if the index does not belong to these records or this embedding model (stale index). */
export function checkIndex(records: SchemeRecord[], index: SearchIndex, model = EMBED_MODEL): void {
  if (index.model !== model) throw new Error(`Stale index: built with ${index.model}, expected ${model}`)
  if (index.ids.length !== records.length || index.vectors.length !== records.length) {
    throw new Error(`Stale index: ${index.vectors.length} vectors for ${records.length} records`)
  }
  index.ids.forEach((id, i) => {
    if (records[i]?.id !== id) throw new Error(`Stale index: position ${i} is #${id} in the index but #${records[i]?.id} in schemes.json`)
  })
  if (index.vectors.some((v) => v.length !== index.dim)) throw new Error('Stale index: vector dimension mismatch')
}

// Words that appear in almost any benefit question and so prove nothing about topic.
const GENERIC = new Set(
  preprocess(
    'eligible eligibility help helps subsidy subsidies scheme schemes government govt get getting want need know apply application benefit benefits support money loan assistance available provide citizen chennai tamil nadu india ward area problem issue complaint information info please tell what which how can could would',
  ),
)

export function topicTerms(text: string): Set<string> {
  return new Set(preprocess(text).filter((t) => t.length > 1 && !GENERIC.has(t)))
}

/** True when the record shares at least one topical (non-generic) stemmed word with the query. */
export function lexicalSupport(queryTerms: Set<string>, r: SchemeRecord): boolean {
  const recordTerms = new Set(preprocess([r.name, r.complaint_domains, r.matching_signals, r.what_it_does].join(' ')))
  for (const t of queryTerms) if (recordTerms.has(t)) return true
  return false
}

export async function retrieve(
  query: string,
  deps: RetrieveDeps,
  opts: { k?: number; ruralText?: string } = {},
): Promise<Retrieved[]> {
  checkIndex(deps.records, deps.index)
  const byId = new Map(deps.records.map((r) => [r.id, r]))
  const includeRural = mentionsRural(opts.ruralText ?? query)
  const [q] = await deps.embed([query])
  return rank(q, deps.index, opts.k ?? TOP_K, (id) => includeRural || byId.get(id)?.geography !== 'rural').map(({ id, score }) => ({
    record: byId.get(id)!,
    score,
  }))
}
