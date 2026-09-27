import { describe, expect, it, vi } from 'vitest'
import { cacheKey, makeGateway } from './gateway.ts'
import { hashKey, loadHistory, readJson, recentForTriage, saveComplaint, writeJson, type KV } from './storage.ts'

function memoryStore(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}

describe('storage', () => {
  it('reads and writes JSON, falling back on bad data or a throwing store', () => {
    const s = memoryStore()
    writeJson('a', { x: 1 }, s)
    expect(readJson('a', null, s)).toEqual({ x: 1 })
    s.setItem('b', '{bad')
    expect(readJson('b', 'fallback', s)).toBe('fallback')
    const broken: KV = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('quota') }, removeItem: () => {} }
    expect(readJson('a', 7, broken)).toBe(7)
    expect(() => writeJson('a', 1, broken)).not.toThrow()
    expect(readJson('a', 3, null)).toBe(3)
  })

  it('hashKey is stable and distinguishes inputs', () => {
    expect(hashKey('abc')).toBe(hashKey('abc'))
    expect(hashKey('abc')).not.toBe(hashKey('abd'))
  })

  it('keeps history and sends only the last 20 as recent', () => {
    const s = memoryStore()
    for (let i = 0; i < 25; i++) {
      saveComplaint({ complaint_id: `C${i}`, created_at: '', result: { masked_text: `t${i}`, ward: 'Ward 1' } as never }, s)
    }
    const recent = recentForTriage(loadHistory(s))
    expect(recent).toHaveLength(20)
    expect(recent[0]).toEqual({ id: 'C5', text: 't5', ward: 'Ward 1' })
  })
})

describe('gateway', () => {
  it('caches successful answers by request hash', async () => {
    const s = memoryStore()
    const f = vi.fn(async () => Response.json({ text: 'hello', provider: 'gemini', model: 'm', error: null }))
    const gw = makeGateway(f as never, s)
    await gw('rewrite', { question: 'q' })
    const again = await gw('rewrite', { question: 'q' })
    expect(again.text).toBe('hello')
    expect(f).toHaveBeenCalledTimes(1)
    expect(s.data.has(cacheKey('rewrite', { question: 'q' }))).toBe(true)
  })

  it('throws the gateway error and does not cache failures', async () => {
    const s = memoryStore()
    const f = vi.fn(async () => Response.json({ text: '', error: 'no API keys configured' }, { status: 502 }))
    await expect(makeGateway(f as never, s)('rewrite', { question: 'q' })).rejects.toThrow(/no API keys/)
    expect(s.data.size).toBe(0)
  })
})
