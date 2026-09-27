import type { SchemeRecord } from './types.ts'

export const EXPECTED_COUNT = 148

/** kind = "regulatory" when level mentions rules, law, code or guidance; otherwise "scheme". */
export function deriveKind(level: string): SchemeRecord['kind'] {
  return /rules|law|code|guidance/i.test(level) ? 'regulatory' : 'scheme'
}

/**
 * "rural" if applicability mentions rural/agriculture and not urban;
 * "urban" if it mentions urban/ULB/city and not rural; otherwise "both".
 */
export function deriveGeography(applicability: string): SchemeRecord['geography'] {
  const a = applicability.toLowerCase()
  const rural = /rural|agricultur/.test(a)
  const urban = /urban|\bulbs?\b|\bcit(y|ies)\b/.test(a)
  if (rural && !urban) return 'rural'
  if (urban && !rural) return 'urban'
  return 'both'
}

type FieldKey = 'level' | 'complaint_domains' | 'what_it_does' | 'matching_signals' | 'applicability' | 'official_source'

const FIELD_LABELS: [string, FieldKey][] = [
  ['Level:', 'level'],
  ['Complaint domains:', 'complaint_domains'],
  ['What it does:', 'what_it_does'],
  ['AI matching signals:', 'matching_signals'],
  ['Applicability:', 'applicability'],
  ['Official source:', 'official_source'],
]

const HEADER_RE = /^(\d{1,3})\.\s+(.+)$/
const FOOTER_RE = /^CivicAssist\s+—\s+Person 3 Scheme Knowledge Base(\s+Page \d+)?$/
const PAGE_RE = /^Page \d+$/

export interface ParseResult {
  records: SchemeRecord[]
  missing: number[]
  errors: string[]
}

interface Draft {
  id: number
  page: number
  name: string
  fields: Partial<Record<FieldKey | 'authority', string>>
  current: FieldKey | 'name'
}

function appendText(prev: string | undefined, next: string): string {
  if (!prev) return next
  // A line broken right after "/" continues the same word ("public/" + "community").
  return prev.endsWith('/') ? prev + next : `${prev} ${next}`
}

/**
 * Parses entry pages into one record per entry.
 * @param pages lines per page, index 0 = page 1
 * @param firstPage first entry page (1-based, inclusive)
 * @param lastPage last entry page (1-based, inclusive)
 */
export function parseEntries(pages: string[][], firstPage = 5, lastPage = 34): ParseResult {
  const lines: { text: string; page: number }[] = []
  for (let p = firstPage; p <= lastPage; p++) {
    for (const text of pages[p - 1] ?? []) {
      if (FOOTER_RE.test(text) || PAGE_RE.test(text)) continue
      lines.push({ text, page: p })
    }
  }

  const drafts: Draft[] = []
  let cur: Draft | null = null
  for (let i = 0; i < lines.length; i++) {
    const { text, page } = lines[i]

    // An entry header is "<N>. <name>" with N increasing, followed shortly by a "Level:" line.
    const h = HEADER_RE.exec(text)
    if (h) {
      const n = Number(h[1])
      const lastId = drafts.length ? drafts[drafts.length - 1].id : 0
      const levelSoon = lines.slice(i + 1, i + 3).some((l) => l.text.startsWith('Level:'))
      if (n > lastId && n <= EXPECTED_COUNT && levelSoon) {
        cur = { id: n, page, name: h[2].trim(), fields: {}, current: 'name' }
        drafts.push(cur)
        continue
      }
    }
    if (!cur) continue

    const label = FIELD_LABELS.find(([l]) => text.startsWith(l))
    if (label) {
      const [l, key] = label
      let value = text.slice(l.length).trim()
      if (key === 'level') {
        const m = /^(.*?)\s*Authority:\s*(.*)$/.exec(value)
        if (m) {
          value = m[1].trim()
          cur.fields.authority = m[2].trim()
        }
      }
      cur.fields[key] = value
      cur.current = key
    } else if (cur.current === 'name') {
      cur.name = appendText(cur.name, text)
    } else {
      cur.fields[cur.current] = appendText(cur.fields[cur.current], text)
    }
  }

  const errors: string[] = []
  const records: SchemeRecord[] = drafts.map((d) => {
    const f = d.fields
    for (const key of ['level', 'authority', ...FIELD_LABELS.slice(1).map(([, k]) => k)] as const) {
      if (!f[key]) errors.push(`#${d.id}: missing field ${key}`)
    }
    if (f.official_source && !/^https?:\/\/\S+$/.test(f.official_source)) {
      errors.push(`#${d.id}: official_source is not a URL: ${f.official_source}`)
    }
    const level = f.level ?? ''
    const applicability = f.applicability ?? ''
    return {
      id: d.id,
      name: d.name,
      level,
      authority: f.authority ?? '',
      complaint_domains: f.complaint_domains ?? '',
      what_it_does: f.what_it_does ?? '',
      matching_signals: f.matching_signals ?? '',
      applicability,
      official_source: f.official_source ?? '',
      page: d.page,
      kind: deriveKind(level),
      geography: deriveGeography(applicability),
    }
  })

  const seen = new Set(records.map((r) => r.id))
  const missing: number[] = []
  for (let n = 1; n <= EXPECTED_COUNT; n++) if (!seen.has(n)) missing.push(n)

  return { records, missing, errors }
}
