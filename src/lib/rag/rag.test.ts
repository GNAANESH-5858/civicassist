import { describe, expect, it, vi } from 'vitest'
import type { SchemeRecord } from '../kb/types.ts'
import type { SearchIndex } from '../search/rank.ts'
import { ask, citedNumbers, type Gateway } from './ask.ts'
import { checkIndex, mentionsRural, retrieve } from './retrieve.ts'

const mk = (id: number, name: string, geography: SchemeRecord['geography'], kind: SchemeRecord['kind'] = 'scheme'): SchemeRecord => ({
  id,
  name,
  level: 'Central',
  authority: 'X',
  complaint_domains: name,
  what_it_does: 'does things',
  matching_signals: name,
  applicability: geography,
  official_source: `https://example.gov.in/${id}`,
  page: 5 + id,
  kind,
  geography,
})

const records = [mk(1, 'Urban water', 'urban'), mk(2, 'Rural water', 'rural'), mk(3, 'Solar', 'both')]
const index: SearchIndex = {
  model: 'Xenova/all-MiniLM-L6-v2',
  dim: 3,
  ids: [1, 2, 3],
  vectors: [
    [0.95, 0.3, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
}
// Fake embedding: "water" points at x, "solar" at z, anything else at y (orthogonal-ish).
const embed = async (t: string[]) => t.map((s) => (/water/i.test(s) ? [1, 0, 0] : /solar/i.test(s) ? [0, 0, 1] : [0, 1, 0]))
const deps = { records, index, embed }

describe('retrieve', () => {
  it('filters rural records unless the text mentions a rural setting (R1)', async () => {
    expect((await retrieve('water', deps)).map((h) => h.record.id)).not.toContain(2)
    expect((await retrieve('water', deps, { ruralText: 'water in my village' }))[0].record.id).toBe(2)
  })

  it('mentionsRural', () => {
    expect(mentionsRural('panchayat water tank')).toBe(true)
    expect(mentionsRural('Chennai ward 12')).toBe(false)
  })

  it('detects a stale index', () => {
    expect(() => checkIndex(records, { ...index, model: 'other' })).toThrow(/Stale index/)
    expect(() => checkIndex(records, { ...index, ids: [1, 3, 2] })).toThrow(/position 1/)
    expect(() => checkIndex(records.slice(0, 2), index)).toThrow(/3 vectors for 2 records/)
  })
})

describe('ask', () => {
  const llmOk: Gateway = vi.fn(async (action) => ({ text: action === 'rewrite' ? 'water supply' : 'Urban water [1] may be applicable, subject to eligibility and local verification.' }))

  it('answers with numbered sources and citations', async () => {
    const r = await ask('no water at home', { ...deps, llm: llmOk })
    expect(r.found).toBe(true)
    expect(r.rewritten_query).toBe('water supply')
    expect(r.sources[0]).toEqual({ n: 1, id: 1, name: 'Urban water', page: 6, official_source: 'https://example.gov.in/1', score: 0.95 })
    expect(r.cited).toEqual([1])
  })

  it('returns found:false WITHOUT calling the answer model below the threshold', async () => {
    const llm = vi.fn<Gateway>(async () => ({ text: 'laptop' }))
    const r = await ask('laptop subsidy', { ...deps, llm })
    expect(r.found).toBe(false)
    expect(r.answer).toBeNull()
    expect(llm.mock.calls.map((c) => c[0])).toEqual(['rewrite'])
  })

  it('treats a NOT_FOUND reply as not found', async () => {
    const llm: Gateway = async (a) => ({ text: a === 'rewrite' ? 'water' : 'NOT_FOUND' })
    expect((await ask('water?', { ...deps, llm })).found).toBe(false)
  })

  it('falls back to the original question when rewrite fails or is slow', async () => {
    const llm: Gateway = async (a) => (a === 'rewrite' ? new Promise(() => {}) : { text: 'ok [1]' })
    const r = await ask('solar panel', { ...deps, llm, rewriteTimeoutMs: 5 })
    expect(r.rewritten_query).toBe('solar panel')
    expect(r.sources[0].id).toBe(3)
  })

  it('shows sources and an error when the answer service is down', async () => {
    const llm: Gateway = async (a) => {
      if (a === 'answer') throw new Error('502')
      return { text: 'water' }
    }
    const r = await ask('water', { ...deps, llm })
    expect(r).toMatchObject({ found: true, answer: null })
    expect(r.error).toMatch(/unavailable/)
    expect(r.sources.length).toBeGreaterThan(0)
  })

  it('rejects an empty question', async () => {
    expect((await ask('  ', { ...deps, llm: llmOk })).error).toMatch(/question/)
  })

  it('citedNumbers ignores out-of-range numbers', () => {
    expect(citedNumbers('a [1] b [3][9] c [1]', 4)).toEqual([1, 3])
  })
})

describe('lexical support', () => {
  it('ignores generic words and matches topical stems', async () => {
    const { lexicalSupport, topicTerms } = await import('./retrieve.ts')
    const solar = mk(3, 'Rooftop solar subsidy', 'both')
    expect([...topicTerms('can i get a subsidy for buying a laptop')]).toEqual(['bui', 'laptop'])
    expect(lexicalSupport(topicTerms('subsidy for a laptop'), solar)).toBe(false)
    expect(lexicalSupport(topicTerms('solar panels on my roof'), solar)).toBe(true)
  })

  it('ask drops high-scoring records with no topical overlap', async () => {
    // "gadget" embeds right on the Solar record's axis (score 1.0) but shares no word with it.
    const gadgetEmbed = async (t: string[]) => t.map((s) => (/gadget/i.test(s) ? [0, 0, 1] : [0, 1, 0]))
    const llm = vi.fn<Gateway>(async () => { throw new Error('no rewrite') })
    const r = await ask('gadget', { records, index, embed: gadgetEmbed, llm })
    expect(r.found).toBe(false)
    expect(r.sources).toEqual([])
    expect(llm.mock.calls.map((c) => c[0])).toEqual(['rewrite'])
  })
})
