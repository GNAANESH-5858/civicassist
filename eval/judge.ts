// LLM-as-judge for faithfulness and answer relevance. Every judgement is cached in eval/cache/.
// Goes through the gateway's runAction, so API keys stay inside netlify/functions/llm.ts.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { runAction } from '../netlify/functions/llm.ts'
import { hashKey } from '../src/lib/browser/storage.ts'

export interface Judgement {
  faithfulness: number
  answer_relevance: number
  reason: string
  provider?: string
}

export const CACHE_DIR = 'eval/cache'

export function parseJudgement(text: string): Judgement {
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  const j = JSON.parse(json) as Partial<Judgement>
  const clamp = (x: unknown) => Math.max(0, Math.min(1, Number(x)))
  if (!Number.isFinite(Number(j.faithfulness)) || !Number.isFinite(Number(j.answer_relevance))) throw new Error(`Bad judgement: ${text.slice(0, 200)}`)
  return { faithfulness: clamp(j.faithfulness), answer_relevance: clamp(j.answer_relevance), reason: String(j.reason ?? '') }
}

type Runner = (action: 'judge', payload: Record<string, unknown>) => Promise<{ text: string; provider: string }>

export async function judge(context: string, question: string, answer: string, run: Runner = runAction as Runner, dir = CACHE_DIR): Promise<Judgement> {
  const key = hashKey(JSON.stringify({ v: 1, context, question, answer }))
  const file = `${dir}/${key}.json`
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Judgement
  } catch {
    // not cached yet
  }
  const r = await run('judge', { context, question, answer })
  const j = { ...parseJudgement(r.text), provider: r.provider }
  await mkdir(dir, { recursive: true })
  await writeFile(file, JSON.stringify(j, null, 2) + '\n', 'utf8')
  return j
}
