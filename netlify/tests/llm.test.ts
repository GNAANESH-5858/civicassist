import { afterEach, describe, expect, it, vi } from 'vitest'
import handler, { buildRequest, MAX_INPUT_CHARS } from '../functions/llm.ts'

const post = (body: unknown) => new Request('http://x/api/llm', { method: 'POST', body: JSON.stringify(body) })
const rec = { id: 1, name: 'AMRUT 2.0', level: 'Central', authority: 'MoHUA', complaint_domains: 'Water', what_it_does: 'x', applicability: 'Urban', official_source: 'https://amrut.mohua.gov.in/', page: 5, kind: 'scheme' }

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
    expect(() => buildRequest('letter', { complaint: 'x', stage: 'critique' })).toThrow(/draft/)
  })

  it('builds draft and critique letter prompts', () => {
    expect(buildRequest('letter', { complaint: 'No water', records: [rec] }).system).toContain('ROLE:')
    expect(buildRequest('letter', { complaint: 'No water', stage: 'critique', draft: 'Dear Citizen' }).system).toContain('REVIEWING')
  })
})

describe('llm handler', () => {
  it('rejects unknown and internal-only actions over HTTP', async () => {
    expect((await handler(post({ action: 'judge', payload: {} }))).status).toBe(400)
    expect((await handler(post({ action: 'nope' }))).status).toBe(400)
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
    const f = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'water supply' }] } }] })))
    vi.stubGlobal('fetch', f)
    const res = await handler(post({ action: 'rewrite', payload: { question: 'no water?' } }))
    expect(await res.json()).toMatchObject({ text: 'water supply', provider: 'gemini', error: null })
  })
})
