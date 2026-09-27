// Prints the top 5 knowledge-base matches for a query.
// Usage: npx tsx scripts/try_search.ts "no water in my street for 3 days"
import { readFile } from 'node:fs/promises'
import { embed } from '../src/lib/embed.ts'
import type { SchemeRecord } from '../src/lib/kb/types.ts'
import { rank, type SearchIndex } from '../src/lib/search/rank.ts'

const query = process.argv.slice(2).join(' ').trim()
if (!query) {
  console.error('Usage: npx tsx scripts/try_search.ts "<query>"')
  process.exit(1)
}

const records: SchemeRecord[] = JSON.parse(await readFile('public/data/schemes.json', 'utf8'))
const index: SearchIndex = JSON.parse(await readFile('public/data/index.json', 'utf8'))
const byId = new Map(records.map((r) => [r.id, r]))

const [q] = await embed([query])
console.log(`\nQuery: "${query}"`)
console.log('score   id   page  geo    name')
for (const { id, score } of rank(q, index, 5)) {
  const r = byId.get(id)!
  console.log(`${score.toFixed(3)}  ${String(id).padStart(3)}  ${String(r.page).padStart(4)}  ${r.geography.padEnd(5)}  ${r.name}`)
}
