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
    'eligible eligibility help helps subsidy subsidies scheme schemes government govt get getting want need know apply application benefit benefits support money loan assistance available provide citizen chennai tamil nadu india ward area problem issue complaint information info please tell what which how can could would ' +
      // Negations and filler carry no topic (they are kept for triage, but must not count as a match here).
      'not no nor without very really also still since just even day days week weeks month months time times people someone something thing things place near',
  ),
)

// Civic compounds written both joined and split ("streetlights" / "street lights").
// Splitting the joined form lets both spellings share the same stems.
const COMPOUNDS: [RegExp, string][] = [
  [/\bstreetlight/gi, 'street light'],
  [/\blamppost/gi, 'lamp post'],
  [/\brainwater/gi, 'rain water'],
  [/\bstormwater/gi, 'storm water'],
  [/\bwaterlogg/gi, 'water logg'],
  [/\bdustbin/gi, 'dust bin'],
]

export function normalizeCompounds(text: string): string {
  return COMPOUNDS.reduce((t, [re, joined]) => t.replace(re, joined), text)
}

/** Stems of a text after joining civic compounds. */
function stems(text: string): string[] {
  return preprocess(normalizeCompounds(text))
}

export function topicTerms(text: string): Set<string> {
  return new Set(stems(text).filter((t) => t.length > 1 && !GENERIC.has(t)))
}

export type MatchSection = 'complaint_domains' | 'matching_signals' | 'what_it_does'
export const MATCH_SECTIONS: MatchSection[] = ['complaint_domains', 'matching_signals', 'what_it_does']
/** Sections written from the citizen's side of the problem. A record must match at least one of these. */
export const REQUIRED_SECTIONS: MatchSection[] = ['complaint_domains', 'matching_signals']

export type MatchBreakdown = Record<MatchSection, string[]>

/** Which of the query's topical words appear in each section of the record (original words, not stems). */
export function matchBreakdown(query: string, r: SchemeRecord): MatchBreakdown {
  const words = (normalizeCompounds(query).toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => {
    const [s] = preprocess(w)
    return s && s.length > 1 && !GENERIC.has(s)
  })
  const out = {} as MatchBreakdown
  for (const section of MATCH_SECTIONS) {
    const sectionStems = new Set(stems(r[section]))
    out[section] = [...new Set(words.filter((w) => sectionStems.has(preprocess(w)[0])))]
  }
  return out
}

/**
 * True when the record shares a topical (non-generic) stemmed word with the query in a
 * complaint-facing section (complaint domains or AI matching signals). A match only in the
 * name or "what it does" is not enough: those use policy language, not the citizen's problem.
 */
export function lexicalSupport(queryTerms: Set<string>, r: SchemeRecord): boolean {
  const recordTerms = new Set(stems(REQUIRED_SECTIONS.map((s) => r[s]).join(' ')))
  for (const t of queryTerms) if (recordTerms.has(t)) return true
  return false
}

/**
 * Retrieves 2k candidates and keeps the top k that have lexical support in `supportText`
 * (defaults to the query). Used by the advisory and the letter so both pick records the same way.
 */
export async function retrieveSupported(
  query: string,
  deps: RetrieveDeps,
  opts: { k?: number; supportText?: string; ruralText?: string } = {},
): Promise<Retrieved[]> {
  const k = opts.k ?? TOP_K
  const terms = topicTerms(opts.supportText ?? query)
  const candidates = await retrieve(query, deps, { k: k * 2, ruralText: opts.ruralText ?? query })
  return candidates.filter((h) => lexicalSupport(terms, h.record)).slice(0, k)
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
