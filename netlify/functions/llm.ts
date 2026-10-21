// LLM gateway. The ONLY place API keys are read (process.env.GEMINI_API_KEY / GROQ_API_KEY /
// GOOGLE_GEMINI_BASE_URL). Prompts are built here from { action, payload }, so the browser cannot
// send arbitrary system prompts. Every free-text input is re-masked for PII before it leaves the
// server, and outputs that must be structured are validated before being returned.
import type { Config } from '@netlify/functions'
import { callLLM, type LLMRequest, type LLMResponse } from '../../src/lib/llm/client.ts'
import { EXTRACT_SYSTEM, extractUser, parseExtraction } from '../../src/lib/llm/extract.ts'
import { polishSystem, polishUser } from '../../src/lib/letter/polish.ts'
import { maskPII } from '../../src/lib/nlp/pii.ts'
import { answerSystem, answerUser, REWRITE_SYSTEM, rewriteUser, type AnswerLang } from '../../src/lib/prompts/answer.ts'
import type { ContextRecord } from '../../src/lib/prompts/context.ts'
import { JUDGE_SYSTEM, judgeUser } from '../../src/lib/prompts/judge.ts'

export const MAX_INPUT_CHARS = 4000
export const PUBLIC_ACTIONS = ['rewrite', 'answer', 'extract', 'polish'] as const
/** judge and generate are for build/eval scripts only and are not reachable over HTTP. */
export type Action = (typeof PUBLIC_ACTIONS)[number] | 'judge' | 'generate'

const cap = (v: unknown): string => (typeof v === 'string' ? v.slice(0, MAX_INPUT_CHARS) : '')
const masked = (v: unknown) => maskPII(cap(v)).text
const lang = (v: unknown): AnswerLang => (v === 'ta' || v === 'hi' ? v : 'en')

function records(v: unknown): ContextRecord[] {
  return Array.isArray(v) ? (v.slice(0, 8) as ContextRecord[]) : []
}

/** Builds the provider request for an action. Throws on a bad payload. */
export function buildRequest(action: Action, p: Record<string, unknown>): LLMRequest {
  switch (action) {
    case 'rewrite': {
      const q = masked(p.question)
      if (!q.trim()) throw new Error('payload.question is required')
      return { system: REWRITE_SYSTEM, user: rewriteUser(q), temperature: 0 }
    }
    case 'answer': {
      const q = masked(p.question)
      const recs = records(p.records)
      if (!q.trim() || recs.length === 0) throw new Error('payload.question and payload.records are required')
      return { system: answerSystem(lang(p.language)), user: answerUser(q, recs), temperature: 0.1, topP: 0.9 }
    }
    case 'extract': {
      const t = masked(p.text)
      if (t.trim().length < 3) throw new Error('payload.text is required')
      return { system: EXTRACT_SYSTEM, user: extractUser(t), temperature: 0, json: true }
    }
    case 'polish': {
      const body = Array.isArray(p.body) ? p.body.slice(0, 12).map((x) => masked(x)).filter(Boolean) : []
      if (!body.length) throw new Error('payload.body is required')
      return { system: polishSystem(lang(p.language)), user: polishUser(body), temperature: 0.2 }
    }
    case 'judge':
      return { system: JUDGE_SYSTEM, user: judgeUser(cap(p.context), cap(p.question), cap(p.answer)), temperature: 0, json: true }
    case 'generate':
      return { system: cap(p.system), user: String(p.user ?? '').slice(0, 20000), temperature: 0.9, json: true }
  }
}

/** Runs an action with the keys from the environment. Used by the HTTP handler and by Node scripts. */
export async function runAction(action: Action, payload: Record<string, unknown>): Promise<LLMResponse> {
  return callLLM(buildRequest(action, payload), {
    geminiKey: process.env.GEMINI_API_KEY,
    // Set automatically by Netlify AI Gateway; unset means Google's public endpoint.
    geminiBaseUrl: process.env.GOOGLE_GEMINI_BASE_URL,
    groqKey: process.env.GROQ_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
    groqModel: process.env.GROQ_MODEL,
  })
}

export function hasKeys(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY)
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return Response.json({ error: 'Use POST' }, { status: 405 })
  if (Number(req.headers.get('content-length') ?? '0') > 64 * 1024) return Response.json({ error: 'Request too large' }, { status: 413 })
  let body: { action?: unknown; payload?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'Body must be JSON' }, { status: 400 })
  }
  const action = body.action as Action
  if (!PUBLIC_ACTIONS.includes(action as never)) {
    return Response.json({ error: `action must be one of ${PUBLIC_ACTIONS.join(', ')}` }, { status: 400 })
  }
  const payload = body.payload && typeof body.payload === 'object' ? (body.payload as Record<string, unknown>) : {}
  try {
    buildRequest(action, payload)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 })
  }
  try {
    const r = await runAction(action, payload)
    if (action === 'extract') {
      // Structured output is validated here; invalid output is reported, never passed on.
      const extraction = parseExtraction(r.text)
      if (!extraction) return Response.json({ text: '', provider: r.provider, model: r.model, error: 'AI output did not match the expected format' }, { status: 502 })
      return Response.json({ ...r, text: JSON.stringify(extraction), extraction, error: null })
    }
    return Response.json({ ...r, error: null })
  } catch (e) {
    return Response.json({ text: '', provider: null, model: null, error: (e as Error).message }, { status: 502 })
  }
}

export const config: Config = {
  path: '/api/llm',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
