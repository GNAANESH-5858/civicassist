// Runs triage on the fifteen acceptance complaints and prints department + urgency.
// With --http it calls the running `netlify dev` server instead of the function module.
// Usage: npx tsx scripts/triage_acceptance.ts [--http]
import { ACCEPTANCE } from '../eval/acceptance.ts'
import { runTriage } from '../netlify/functions/triage.ts'
import type { TriageResult } from '../src/lib/nlp/triage.ts'

const http = process.argv.includes('--http')
let correct = 0
console.log(`Mode: ${http ? 'HTTP POST http://localhost:8888/api/triage' : 'function module'}\n`)
console.log('ok  complaint                             department                   urgency  issue')
for (const a of ACCEPTANCE) {
  const r: TriageResult = http
    ? await (await fetch('http://localhost:8888/api/triage', { method: 'POST', body: JSON.stringify({ text: a.text }) })).json()
    : runTriage({ text: a.text })
  const ok = r.department === a.department
  if (ok) correct++
  console.log(`${ok ? 'Y ' : 'N '}  ${a.text.padEnd(36)}  ${String(r.department).padEnd(27)}  ${String(r.urgency).padEnd(7)}  ${r.issue ?? '-'}${ok ? '' : `   (expected ${a.department})`}`)
}
console.log(`\nDepartment matches expected: ${correct}/${ACCEPTANCE.length}`)
