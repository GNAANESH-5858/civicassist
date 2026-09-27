import { describe, expect, it } from 'vitest'
import handler, { runTriage } from '../functions/triage.ts'

const post = (body: string) => new Request('http://x/api/triage', { method: 'POST', body })

describe('triage function', () => {
  it('triages a complaint with the trained model', async () => {
    const res = await handler(post(JSON.stringify({ text: 'Garbage not collected in ward 23 for a week' })))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ department: 'Solid Waste Management', ward: 'Ward 23', error: null })
  })

  it('returns an error field (not a throw) for bad input', async () => {
    const res = await handler(post('not json'))
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toMatch(/JSON/)
    expect(runTriage(null).error).toMatch(/empty/)
  })

  it('only uses the last 20 recent complaints', () => {
    const recent = Array.from({ length: 30 }, (_, i) => ({ id: `R${i}`, text: 'garbage not collected in ward 5', ward: 'Ward 5' }))
    const r = runTriage({ text: 'garbage not collected in ward 5', recent })
    expect(Number(r.duplicate_of?.slice(1))).toBeGreaterThanOrEqual(10)
  })
})
