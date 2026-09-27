// Triage endpoint. Rule-based NLP + Naive Bayes; calls NO language model.
// POST { text: string, recent?: { id, text, ward }[] }
import model from '../../src/lib/nlp/model.json' with { type: 'json' }
import { restore } from '../../src/lib/nlp/classifier.ts'
import { triage, type TriageResult } from '../../src/lib/nlp/triage.ts'

const classifier = restore(model)

export function runTriage(body: unknown): TriageResult {
  const b = (body && typeof body === 'object' ? body : {}) as { text?: unknown; recent?: unknown; id?: unknown }
  return triage(
    {
      text: b.text,
      recent: Array.isArray(b.recent) ? b.recent.slice(-20) : [],
      id: typeof b.id === 'string' ? b.id.slice(0, 40) : undefined,
    },
    classifier,
  )
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return Response.json(runTriage({ text: '' }), { status: 405 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ ...runTriage({ text: '' }), error: 'Body must be JSON' }, { status: 400 })
  }
  const result = runTriage(body)
  return Response.json(result, { status: result.error ? 400 : 200 })
}
