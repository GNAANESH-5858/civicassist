import { afterEach, describe, expect, it, vi } from 'vitest'
import handler, { buildRequest, MAX_INPUT_CHARS } from '../functions/llm.ts'

const post = (body: unknown) => new Request('http://x/api/llm', { method: 'POST', body: JSON.stringify(body) })
const rec = { id: 1, name: 'AMRUT 2.0', level: 'Central', authority: 'MoHUA', complaint_domains: 'Water', what_it_does: 'x', applicability: 'Urban', official_source: 'https://amrut.mohua.gov.in/', page: 5, kind: 'scheme' }
const geminiReply = (text: string) => vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('buildRequest', () => {
  it('caps user input at 4000 characters', () => {
    const r = buildRequest('rewrite', { question: 'a'.repeat(9000) })
    expect(r.user.length).toBeLessThan(MAX_INPUT_CHARS + 50)
  })

  it('validates payloads', () => {
    expect(() => buildRequest('answer', { question: 'q' })).toThrow(/records/)
    expect(() => buildRequest('extract', { text: '' })).toThrow(/text/)
    expect(() => buildRequest('polish', { body: [] })).toThrow(/body/)
  })

  it('re-masks personal details before anything is sent to a provider', () => {
    expect(buildRequest('extract', { text: 'No water, call 9876543210 or a@b.co' }).user).not.toMatch(/9876543210|a@b\.co/)
    expect(buildRequest('polish', { body: ['Call me on 9876543210'] }).user).toContain('[PHONE]')
  })

  it('asks for answers in the requested language while keeping official names', () => {
    const ta = buildRequest('answer', { question: 'q', records: [rec], language: 'ta' }).system
    expect(ta).toMatch(/Write the answer in Tamil/)
    expect(ta).toMatch(/Keep official scheme names, numbers and URLs exactly/)
  })
})

describe('llm handler', () => {
  it('rejects unknown and internal-only actions over HTTP', async () => {
    expect((await handler(post({ action: 'judge', payload: {} }))).status).toBe(400)
    expect((await handler(post({ action: 'letter', payload: {} }))).status).toBe(400)
  })

  it('returns 502 with an error when no keys are configured', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('GROQ_API_KEY', '')
    const res = await handler(post({ action: 'rewrite', payload: { question: 'water' } }))
    expect(res.status).toBe(502)
    expect(((await res.json()) as { error: string }).error).toMatch(/no API keys/)
  })

  it('calls Gemini with the env key and returns text', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubGlobal('fetch', geminiReply('water supply'))
    const res = await handler(post({ action: 'rewrite', payload: { question: 'no water?' } }))
    expect(await res.json()).toMatchObject({ text: 'water supply', provider: 'gemini', error: null })
  })

  it('validates extraction output and rejects anything that does not match the schema', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    const good = { category: 'roads', alternative_category: null, locality: 'Velachery', landmark: null, duration_days: 7, premises: 'public', immediate_danger: false, english_summary: 'Large pothole on a street in Velachery for a week.' }
    vi.stubGlobal('fetch', geminiReply(JSON.stringify(good)))
    const ok = (await (await handler(post({ action: 'extract', payload: { text: 'வேளச்சேரியில் பள்ளம்' } }))).json()) as { extraction: unknown }
    expect(ok.extraction).toEqual(good)

    vi.stubGlobal('fetch', geminiReply(JSON.stringify({ ...good, category: 'teleportation' })))
    const bad = await handler(post({ action: 'extract', payload: { text: 'something' } }))
    expect(bad.status).toBe(502)
    expect(((await bad.json()) as { error: string }).error).toMatch(/expected format/)
  })
})
