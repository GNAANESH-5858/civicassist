// LLM gateway. The ONLY place API keys are read (process.env.GEMINI_API_KEY / GROQ_API_KEY).
// Prompts are built here from { action, payload }, so the browser cannot send arbitrary system prompts.
import { callLLM, type LLMRequest, type LLMResponse } from '../../src/lib/llm/client.ts'
import { ANSWER_SYSTEM, answerUser, REWRITE_SYSTEM, rewriteUser } from '../../src/lib/prompts/answer.ts'
import type { ContextRecord } from '../../src/lib/prompts/context.ts'
import { JUDGE_SYSTEM, judgeUser } from '../../src/lib/prompts/judge.ts'
import { CRITIQUE_SYSTEM, critiqueUser, letterSystem, letterUser, type LetterInput } from '../../src/lib/prompts/letter.v1.ts'

export const MAX_INPUT_CHARS = 4000
export const PUBLIC_ACTIONS = ['rewrite', 'answer', 'letter'] as const
/** judge and generate are for build/eval scripts only and are not reachable over HTTP. */
export type Action = (typeof PUBLIC_ACTIONS)[number] | 'judge' | 'generate'

const cap = (v: unknown): string => (typeof v === 'string' ? v.slice(0, MAX_INPUT_CHARS) : '')

function records(v: unknown): ContextRecord[] {
  return Array.isArray(v) ? (v.slice(0, 8) as ContextRecord[]) : []
}

/** Builds the provider request for an action. Throws on a bad payload. */
export function buildRequest(action: Action, p: Record<string, unknown>): LLMRequest {
  switch (action) {
    case 'rewrite': {
      const q = cap(p.question)
      if (!q.trim()) throw new Error('payload.question is required')
      return { system: REWRITE_SYSTEM, user: rewriteUser(q), temperature: 0 }
    }
    case 'answer': {
      const q = cap(p.question)
      const recs = records(p.records)
      if (!q.trim() || recs.length === 0) throw new Error('payload.question and payload.records are required')
      return { system: ANSWER_SYSTEM, user: answerUser(q, recs), temperature: 0.1, topP: 0.9 }
    }
    case 'letter': {
      const input: LetterInput = {
        complaint: cap(p.complaint),
        complaint_id: cap(p.complaint_id) || 'pending',
        department: typeof p.department === 'string' ? p.department : null,
        ward: typeof p.ward === 'string' ? p.ward : null,
        issue: typeof p.issue === 'string' ? p.issue : null,
        urgency: typeof p.urgency === 'string' ? p.urgency : null,
        records: records(p.records),
      }
      if (!input.complaint.trim()) throw new Error('payload.complaint is required')
      if (p.stage === 'critique') {
        const draft = cap(p.draft)
        if (!draft.trim()) throw new Error('payload.draft is required for the critique stage')
        return { system: CRITIQUE_SYSTEM, user: critiqueUser(input, draft), temperature: 0 }
      }
      return { system: letterSystem(), user: letterUser(input), temperature: 0.3, topP: 0.9 }
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
    return Response.json({ ...r, error: null })
  } catch (e) {
    return Response.json({ text: '', provider: null, model: null, error: (e as Error).message }, { status: 502 })
  }
}
