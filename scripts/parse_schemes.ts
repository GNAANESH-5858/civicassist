// Parses the scheme master PDF into public/data/schemes.json (one record per entry).
// Usage: npx tsx scripts/parse_schemes.ts
import { mkdir, writeFile } from 'node:fs/promises'
import { EXPECTED_COUNT, parseEntries } from '../src/lib/kb/parse.ts'
import { extractPageLines } from './lib/pdfText.ts'

const PDF_PATH = 'data/raw/CivicAssist_Person3_India_Civic_Schemes_Master.pdf'
const OUT_PATH = 'public/data/schemes.json'

function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const it of items) out[key(it)] = (out[key(it)] ?? 0) + 1
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]))
}

const pages = await extractPageLines(PDF_PATH)
console.log(`PDF pages: ${pages.length}`)

const { records, missing, errors } = parseEntries(pages, 5, 34)

await mkdir('public/data', { recursive: true })
await writeFile(OUT_PATH, JSON.stringify(records, null, 2) + '\n', 'utf8')

console.log(`\nTotal records: ${records.length} (expected ${EXPECTED_COUNT})`)
console.log('\nBy level:')
console.table(countBy(records, (r) => r.level))
console.log('By kind:')
console.table(countBy(records, (r) => r.kind))
console.log('By geography:')
console.table(countBy(records, (r) => r.geography))
console.log(`Missing entry numbers: ${missing.length ? missing.join(', ') : 'none'}`)
console.log(`Field errors: ${errors.length ? '\n  ' + errors.join('\n  ') : 'none'}`)
console.log(`\nWrote ${OUT_PATH}`)

if (records.length !== EXPECTED_COUNT || missing.length || errors.length) process.exit(1)
