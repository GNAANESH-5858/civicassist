// ask(question): rewrite -> retrieve (R1) -> threshold gate -> cited answer from the records only.
import { NOT_FOUND_THRESHOLD, TOP_K } from '../config.ts'
import { NOT_FOUND } from '../prompts/answer.ts'
import type { ContextRecord } from '../prompts/context.ts'
import { lexicalSupport, retrieve, topicTerms, type RetrieveDeps } from './retrieve.ts'

export type GatewayAction = 'rewrite' | 'answer' | 'letter'
export type Gateway = (action: GatewayAction, payload: Record<string, unknown>) => Promise<{ text: string }>

export interface Source {
  n: number
  id: number
  name: string
  page: number
  official_source: string
  score: number
}

export interface AskResult {
  answer: string | null
  sources: Source[]
  found: boolean
  rewritten_query: string
  error: string | null
  /** Record numbers [n] the answer actually cites. */
  cited?: number[]
}

export interface AskOpts extends RetrieveDeps {
  llm: Gateway
  rewriteTimeoutMs?: number
  threshold?: number
  k?: number
}

export const REWRITE_TIMEOUT_MS = 8000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    )
  })
}

export function toContextRecord(r: ContextRecord): ContextRecord {
  const { id, name, level, authority, complaint_domains, what_it_does, applicability, official_source, page, kind } = r
  return { id, name, level, authority, complaint_domains, what_it_does, applicability, official_source, page, kind }
}

export function citedNumbers(answer: string, max: number): number[] {
  const nums = new Set<number>()
  for (const m of answer.matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1])
    if (n >= 1 && n <= max) nums.add(n)
  }
  return [...nums].sort((a, b) => a - b)
}

export async function ask(question: string, opts: AskOpts): Promise<AskResult> {
  const q = question.trim().slice(0, 1000)
  const base: AskResult = { answer: null, sources: [], found: false, rewritten_query: q, error: null }
  if (!q) return { ...base, error: 'Please type a question.' }

  // 1. Rewrite; on failure or > 8 s, fall back to the original question.
  let rewritten = q
  try {
    const r = await withTimeout(opts.llm('rewrite', { question: q }), opts.rewriteTimeoutMs ?? REWRITE_TIMEOUT_MS)
    const line = r.text.trim().split('\n')[0].replace(/^["']|["']$/g, '').trim()
    if (line && line.length <= 300) rewritten = line
  } catch {
    rewritten = q
  }

  // 2. Embed and rank; R1 filters rural records unless the citizen mentions a rural setting.
  //    Candidates must share a topical word with the question (lexical support), so a
  //    generic word like "subsidy" cannot pull in an unrelated scheme.
  const k = opts.k ?? TOP_K
  let hits
  try {
    const terms = topicTerms(`${q} ${rewritten}`)
    const candidates = await retrieve(rewritten, opts, { k: k * 2, ruralText: q })
    hits = candidates.filter((h) => lexicalSupport(terms, h.record)).slice(0, k)
  } catch (e) {
    return { ...base, rewritten_query: rewritten, error: `Search failed: ${(e as Error).message}` }
  }
  const sources: Source[] = hits.map((h, i) => ({
    n: i + 1,
    id: h.record.id,
    name: h.record.name,
    page: h.record.page,
    official_source: h.record.official_source,
    score: Math.round(h.score * 1000) / 1000,
  }))

  // 3. Nothing relevant enough: answer "not in my documents" WITHOUT calling the model.
  if (!hits.length || hits[0].score < (opts.threshold ?? NOT_FOUND_THRESHOLD)) {
    return { ...base, rewritten_query: rewritten, sources, found: false }
  }

  // 4. Answer only from the numbered records.
  try {
    const r = await opts.llm('answer', { question: q, records: hits.map((h) => toContextRecord(h.record)) })
    const text = r.text.trim()
    if (!text || text.replace(/[.\s]/g, '') === NOT_FOUND || text.startsWith(NOT_FOUND)) {
      return { ...base, rewritten_query: rewritten, sources, found: false }
    }
    const cited = citedNumbers(text, sources.length)
    return { answer: text, sources, found: true, rewritten_query: rewritten, error: null, cited }
  } catch (e) {
    // Records were found but no answer could be generated; show the sources, state nothing else.
    return { ...base, rewritten_query: rewritten, sources, found: true, error: `Answer service unavailable: ${(e as Error).message}` }
  }
}
