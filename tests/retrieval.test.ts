// Retrieval regression tests against the real knowledge base and embedding model.
// Guards the precision fixes: self-exclusion filter (Fix 1) and locality boost (Fix 2).
import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'
import { embed } from '../src/lib/embed.ts'
import type { SchemeRecord } from '../src/lib/kb/types.ts'
import { retrieve, type RetrieveDeps } from '../src/lib/rag/retrieve.ts'
import type { SearchIndex } from '../src/lib/search/rank.ts'

let deps: RetrieveDeps
const ids = async (q: string, k = 3) => (await retrieve(q, deps, { k })).map((h) => h.record.id)

beforeAll(async () => {
  const records: SchemeRecord[] = JSON.parse(await readFile('public/data/schemes.json', 'utf8'))
  const index: SearchIndex = JSON.parse(await readFile('public/data/index.json', 'utf8'))
  deps = { records, index, embed }
  await embed(['warm up']) // first call downloads/loads the model
}, 120_000)

describe('retrieval regression', () => {
  it('urban water complaint: #139 and #84 in the top 3, #17 (self-excluding groundwater scheme) absent', async () => {
    const top = await ids('no water supply in Ward 12')
    expect(top).toContain(139)
    expect(top).toContain(84)
    expect(top).not.toContain(17)
  })

  it('stated rural setting: the rural and self-exclusion filters do not apply, so #14 or #15 can be returned', async () => {
    const top = await ids('rural drinking water in my village', 4)
    expect(top.some((id) => id === 14 || id === 15)).toBe(true)
  })

  it('self-exclusion filter does not over-fire: #84 and #85 are still retrievable for their own topics', async () => {
    expect(await ids('new water connection and sewer connection in Chennai')).toContain(84)
    expect(await ids('factory releasing industrial effluent and illegal discharge')).toContain(85)
  })
})
