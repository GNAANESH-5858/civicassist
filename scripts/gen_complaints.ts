// Generates 200 synthetic complaints -> data/complaints.csv
// Uses Gemini (via the LLM gateway, which owns the API keys) when a key is set;
// otherwise, or with --offline, uses the seeded template generator.
// Usage: node --env-file-if-exists=.env --import tsx scripts/gen_complaints.ts [--offline]
import { mkdir, writeFile } from 'node:fs/promises'
import { hasKeys, runAction } from '../netlify/functions/llm.ts'
import { seededShuffle } from '../src/lib/nlp/classifier.ts'
import { DEPARTMENTS, type Department } from '../src/lib/nlp/departments.ts'
import type { Urgency } from '../src/lib/nlp/urgency.ts'
import { styleComplaint, TEMPLATES } from './lib/complaintTemplates.ts'
import { toCsv } from './lib/csv.ts'

const TOTAL = 200
const REPEATS = 20 // ~10%: half near-identical, half reworded
const ORIGINALS = TOTAL - REPEATS
const PHONE_COUNT = 8

interface Row {
  id: string
  text: string
  department: Department
  urgency: Urgency
  ward: string
  duplicate_of: string
}

function mulberry(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry(2026)
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]
const randWard = () => 1 + Math.floor(rand() * 200)
const phone = () => `${pick(['9', '8', '7', '6'])}${String(Math.floor(rand() * 1e9)).padStart(9, '0')}`

interface Draft {
  text: string
  department: Department
  urgency: Urgency
  ward: number | null
  alt?: string // reworded version for repeats
}

function offlineOriginals(): Draft[] {
  const perDept = ORIGINALS / DEPARTMENTS.length
  const out: Draft[] = []
  for (const dept of DEPARTMENTS) {
    for (let i = 0; i < perDept; i++) {
      const t = TEMPLATES[dept][i % TEMPLATES[dept].length]
      const ward = rand() < 0.1 ? null : randWard()
      const k = Math.floor(rand() * t.phrasings.length)
      const styled = styleComplaint(t.phrasings[k], ward, rand)
      const altStyled = styleComplaint(t.phrasings[(k + 1) % t.phrasings.length], ward, rand)
      out.push({ text: styled.text, department: dept, urgency: t.urgency, ward, alt: altStyled.text })
    }
  }
  return out
}

async function geminiOriginals(): Promise<Draft[]> {
  const perDept = ORIGINALS / DEPARTMENTS.length
  const out: Draft[] = []
  for (const dept of DEPARTMENTS) {
    const r = await runAction('generate', {
      system:
        'You write realistic synthetic citizen grievances for the Greater Chennai Corporation, India. Output JSON only: {"items":[{"text":string,"urgency":"high"|"medium"|"low","ward":number|null,"reworded":string}]}',
      user: `Write ${perDept} different complaints for the department "${dept}".
Vary writing quality: some formal, some casual, some all lowercase without punctuation, some with spelling mistakes, some with Indian English phrases ("pls sir", "very worst").
Mention a ward between 1 and 200 in about 90% of them in varied formats ("Ward 12", "ward no 12", "W-12"); set ward to that number, or null if not mentioned.
Mix urgency: high only for health/safety hazards (sewage overflow, live wire, contamination, collapse), medium for service failures, low for nuisances and requests.
"reworded" must say the same thing as "text" in different words, with the same ward.
Do not include phone numbers.`,
    })
    const items = (JSON.parse(r.text).items ?? []) as { text: string; urgency: Urgency; ward: number | null; reworded: string }[]
    for (const it of items.slice(0, perDept)) {
      const ward = typeof it.ward === 'number' && it.ward >= 1 && it.ward <= 200 ? it.ward : null
      out.push({ text: it.text, department: dept, urgency: it.urgency, ward, alt: it.reworded })
    }
    console.log(`  ${dept}: ${items.length} from ${r.provider}/${r.model}`)
  }
  if (out.length < ORIGINALS) throw new Error(`Gemini returned only ${out.length} complaints`)
  return out
}

function nearIdentical(text: string): string {
  const variants = [
    (s: string) => `${s} Still not solved.`,
    (s: string) => s.replace(/\.$/, '!!'),
    (s: string) => `Again complaining: ${s}`,
    (s: string) => s.toLowerCase(),
  ]
  return pick(variants)(text)
}

const offline = process.argv.includes('--offline') || !hasKeys()
console.log(offline ? 'Source: offline template generator (no LLM key set or --offline)' : 'Source: Gemini via LLM gateway')

const originals = offline ? offlineOriginals() : await geminiOriginals()
const rows: Row[] = seededShuffle(originals, 7).map((d, i) => ({
  id: `C${String(i + 1).padStart(3, '0')}`,
  text: d.text,
  department: d.department,
  urgency: d.urgency,
  ward: d.ward === null ? '' : `Ward ${d.ward}`,
  duplicate_of: '',
}))
const alts = new Map(seededShuffle(originals, 7).map((d, i) => [rows[i].id, d.alt ?? d.text]))

// Repeats reference an original that has a ward (repeat detection needs the ward to match).
const repeatSources = seededShuffle(rows.filter((r) => r.ward), 11).slice(0, REPEATS)
repeatSources.forEach((src, i) => {
  const reworded = i >= REPEATS / 2
  rows.push({
    id: `C${String(rows.length + 1).padStart(3, '0')}`,
    text: reworded ? alts.get(src.id)! : nearIdentical(src.text),
    department: src.department,
    urgency: src.urgency,
    ward: src.ward,
    duplicate_of: src.id,
  })
})

// A few complaints carry phone numbers (to exercise PII masking).
for (const r of seededShuffle(rows, 13).slice(0, PHONE_COUNT)) r.text += ` Contact ${phone()}.`

await mkdir('data', { recursive: true })
await writeFile('data/complaints.csv', toCsv(rows as never, ['id', 'text', 'department', 'urgency', 'ward', 'duplicate_of']), 'utf8')
await writeFile('data/complaints.meta.json', JSON.stringify({ source: offline ? 'offline-templates' : 'gemini', total: rows.length, repeats: REPEATS, with_phone: PHONE_COUNT }, null, 2) + '\n')

const count = (k: keyof Row) => rows.reduce<Record<string, number>>((m, r) => ((m[String(r[k]) || '(none)'] = (m[String(r[k]) || '(none)'] ?? 0) + 1), m), {})
console.log(`Wrote data/complaints.csv: ${rows.length} rows, ${REPEATS} repeats, ${PHONE_COUNT} with phone numbers`)
console.table(count('department'))
console.table(count('urgency'))
