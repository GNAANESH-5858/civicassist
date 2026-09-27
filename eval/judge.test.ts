import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { judge, parseJudgement } from './judge.ts'

const dirs: string[] = []
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true })
})

describe('parseJudgement', () => {
  it('extracts and clamps JSON even with surrounding text', () => {
    expect(parseJudgement('Here: {"faithfulness": 1.4, "answer_relevance": 0.7, "reason": "ok"}')).toEqual({ faithfulness: 1, answer_relevance: 0.7, reason: 'ok' })
  })
  it('rejects non-numeric scores', () => {
    expect(() => parseJudgement('{"faithfulness": "high"}')).toThrow(/Bad judgement/)
  })
})

describe('judge', () => {
  it('caches judgements on disk and reuses them', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'judge-'))
    dirs.push(dir)
    const run = vi.fn(async () => ({ text: '{"faithfulness":0.9,"answer_relevance":0.8,"reason":"r"}', provider: 'gemini' }))
    const a = await judge('ctx', 'q', 'a', run, dir)
    const b = await judge('ctx', 'q', 'a', run, dir)
    expect(a).toEqual(b)
    expect(run).toHaveBeenCalledTimes(1)
    expect(await readdir(dir)).toHaveLength(1)
  })
})
