import { describe, expect, it } from 'vitest'
import llm from '../functions/llm.ts'
import triage from '../functions/triage.ts'

describe('function stubs', () => {
  it('triage returns the full response shape', async () => {
    const res = await triage(new Request('http://x/api/triage', { method: 'POST', body: '{}' }))
    const body = await res.json()
    for (const key of ['complaint_id', 'department', 'ward', 'issue', 'urgency', 'duplicate_of', 'similarity', 'masked_text', 'flags', 'error']) {
      expect(body).toHaveProperty(key)
    }
  })

  it('llm returns text, provider and model', async () => {
    const res = await llm(new Request('http://x/api/llm', { method: 'POST', body: '{}' }))
    expect(await res.json()).toMatchObject({ text: expect.any(String), provider: 'stub', model: 'none' })
  })
})
