// Retrieval over the knowledge base. Pure given its inputs, so it runs in the browser and in Node.
import { EMBED_MODEL, LOCALITY_BOOST, TOP_K } from '../config.ts'
import type { SchemeRecord } from '../kb/types.ts'
import { preprocess } from '../nlp/preprocess.ts'
import { extractWard } from '../nlp/ward.ts'
import { rank, type SearchIndex } from '../search/rank.ts'

export interface RetrieveDeps {
  records: SchemeRecord[]
  index: SearchIndex
  embed: (texts: string[]) => Promise<number[][]>
}

export interface Retrieved {
  record: SchemeRecord
  /** Raw cosine similarity. Used for the not-found threshold. */
  score: number
  /** Locality bonus from the record's applicability, added for ranking only (0 when fixes are off). */
  boost: number
  /** score + boost; the value results are ranked by. */
  final: number
}

export interface RetrieveOpts {
  k?: number
  ruralText?: string
  /** Self-exclusion filter + locality boost. On by default; off reproduces the original ranking. */
  precisionFixes?: boolean
}

/** Locality bonus from a record's applicability (first matching rule wins). */
export function localityBoost(applicability: string): number {
  if (/chennai/i.test(applicability)) return LOCALITY_BOOST.chennai
  if (/tamil nadu/i.test(applicability)) return LOCALITY_BOOST.tamilNadu
  if (/urban|\bulbs?\b/i.test(applicability)) return LOCALITY_BOOST.urban
  return LOCALITY_BOOST.other
}

/** Rule R1: rural programmes are only considered when the user explicitly talks about a rural setting. */
export function mentionsRural(text: string): boolean {
  return /\b(rural|village|villages|gram|panchayat|farm|farmer|farmers|agricultur\w*)\b/i.test(text)
}

/**
 * Whether rural-only and self-excluding records may be returned. A stated Greater Chennai
 * Corporation ward (1-200) confirms Chennai jurisdiction, so the complaint is never treated as
 * rural, even if it contains a word like "village" or "farm" (e.g. a locality name).
 */
export function allowsRural(text: string): boolean {
  return mentionsRural(text) && extractWard(text) === null
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
  opts: { k?: number; supportText?: string; ruralText?: string; precisionFixes?: boolean } = {},
): Promise<Retrieved[]> {
  const k = opts.k ?? TOP_K
  const terms = topicTerms(opts.supportText ?? query)
  const candidates = await retrieve(query, deps, { k: k * 2, ruralText: opts.ruralText ?? query, precisionFixes: opts.precisionFixes })
  return candidates.filter((h) => lexicalSupport(terms, h.record)).slice(0, k)
}

export async function retrieve(query: string, deps: RetrieveDeps, opts: RetrieveOpts = {}): Promise<Retrieved[]> {
  checkIndex(deps.records, deps.index)
  const byId = new Map(deps.records.map((r) => [r.id, r]))
  const rural = allowsRural(opts.ruralText ?? query)
  const fixes = opts.precisionFixes ?? true
  const allow = (id: number) => {
    const r = byId.get(id)
    if (!r) return false
    if (rural) return true
    // R1: rural programmes are excluded for urban complaints.
    if (r.geography === 'rural') return false
    // Fix 1: records that say they do not apply to ordinary city complaints.
    if (fixes && r.self_excludes_city) return false
    return true
  }
  const [q] = await deps.embed([query])
  // Score every allowed record, then rank by the boosted score.
  const scored = rank(q, deps.index, deps.index.ids.length, allow).map(({ id, score }) => {
    const record = byId.get(id)!
    // CivicAssist serves Greater Chennai Corporation only, so every complaint is a Chennai complaint:
    // the boost depends on the record's applicability alone, never on the wording of the query.
    const boost = fixes ? localityBoost(record.applicability) : 0
    return { record, score, boost, final: score + boost }
  })
  scored.sort((a, b) => b.final - a.final)
  return scored.slice(0, opts.k ?? TOP_K)
}
