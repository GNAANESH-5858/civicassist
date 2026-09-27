// Triages every complaint in data/complaints.csv -> public/data/triaged.json
// and writes public/data/pipeline_report.json with counters.
// Usage: npx tsx scripts/pipeline.ts   (CI sets BUILD_STARTED_AT=<epoch seconds> to time the whole build)
import { readFile, writeFile } from 'node:fs/promises'
import model from '../src/lib/nlp/model.json' with { type: 'json' }
import type { SchemeRecord } from '../src/lib/kb/types.ts'
import { restore } from '../src/lib/nlp/classifier.ts'
import { maskPII } from '../src/lib/nlp/pii.ts'
import { triage, type TriageResult } from '../src/lib/nlp/triage.ts'
import { parseCsv } from './lib/csv.ts'

const started = process.env.BUILD_STARTED_AT ? Number(process.env.BUILD_STARTED_AT) * 1000 : Date.now()
const classifier = restore(model)
const rows = parseCsv(await readFile('data/complaints.csv', 'utf8'))
const records: SchemeRecord[] = JSON.parse(await readFile('public/data/schemes.json', 'utf8'))

export interface TriagedRow extends TriageResult {
  expected: { department: string; urgency: string; duplicate_of: string | null }
}

let phones = 0
const prior: { id: string; text: string; ward: string | null }[] = []
const triaged: TriagedRow[] = []
for (const r of rows) {
  phones += maskPII(r.text).counts.phone
  const t = triage({ text: r.text, id: r.id, recent: prior }, classifier)
  prior.push({ id: r.id, text: t.masked_text, ward: t.ward })
  triaged.push({ ...t, expected: { department: r.department, urgency: r.urgency, duplicate_of: r.duplicate_of || null } })
}

await writeFile('public/data/triaged.json', JSON.stringify(triaged, null, 1) + '\n', 'utf8')
const report = {
  generated_at: new Date().toISOString(),
  records_parsed: records.length,
  complaints_processed: triaged.length,
  phone_numbers_masked: phones,
  triage_errors: triaged.filter((t) => t.error).length,
  flagged_repeats: triaged.filter((t) => t.duplicate_of).length,
  build_duration_seconds: Math.round((Date.now() - started) / 100) / 10,
}
await writeFile('public/data/pipeline_report.json', JSON.stringify(report, null, 2) + '\n', 'utf8')
console.log(report)
