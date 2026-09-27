// Embeds every knowledge-base record and writes public/data/index.json.
// Usage: npx tsx scripts/build_index.ts
import { readFile, writeFile } from 'node:fs/promises'
import { EMBED_MODEL } from '../src/lib/config.ts'
import { embed } from '../src/lib/embed.ts'
import { searchText } from '../src/lib/kb/searchText.ts'
import type { SchemeRecord } from '../src/lib/kb/types.ts'
import type { SearchIndex } from '../src/lib/search/rank.ts'

const SCHEMES_PATH = 'public/data/schemes.json'
const OUT_PATH = 'public/data/index.json'

const records: SchemeRecord[] = JSON.parse(await readFile(SCHEMES_PATH, 'utf8'))
const started = Date.now()
const vectors = await embed(records.map(searchText))

// 6 decimals keeps the file small without changing rankings.
const index: SearchIndex = {
  model: EMBED_MODEL,
  dim: vectors[0].length,
  ids: records.map((r) => r.id),
  vectors: vectors.map((v) => v.map((x) => Math.round(x * 1e6) / 1e6)),
}
await writeFile(OUT_PATH, JSON.stringify(index) + '\n', 'utf8')

console.log(`Embedded ${records.length} records with ${EMBED_MODEL} (dim ${index.dim}) in ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(`Wrote ${OUT_PATH}`)
