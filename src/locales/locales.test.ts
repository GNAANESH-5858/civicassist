// Every language must have exactly the same keys, and every key the code uses must exist.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUTHORITIES, CATEGORIES, CHANNELS } from '../lib/civic/data.ts'
import { STATUSES } from '../lib/records/schema.ts'

type Tree = { [k: string]: string | string[] | Tree }
const LANGS = ['en', 'ta', 'hi'] as const
const NS = ['common', 'guidance'] as const
const load = (lang: string, ns: string): Tree => JSON.parse(readFileSync(`src/locales/${lang}/${ns}.json`, 'utf8'))

function flatten(t: Tree, prefix = ''): Map<string, string | string[]> {
  const out = new Map<string, string | string[]>()
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string' || Array.isArray(v)) out.set(key, v)
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv)
  }
  return out
}

const flat = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(NS.map((ns) => [ns, flatten(load(l, ns))]))])) as Record<string, Record<string, Map<string, string | string[]>>>
// String literals that look like keys but are not (template version ids).
const NOT_KEYS = new Set(['letter.v3'])
const params = (s: string | string[]) => [...new Set([...(Array.isArray(s) ? s.join(' ') : s).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].sort()

/** Resolves a key as i18next would, including plural suffixes. */
function has(key: string): boolean {
  const [ns, k] = key.includes(':') ? key.split(':') : ['common', key]
  const m = flat.en[ns]
  return m.has(k) || m.has(`${k}_other`) || [...m.keys()].some((x) => x.startsWith(`${k}.`))
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return f === 'locales' ? [] : sourceFiles(p)
    return /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : []
  })
}

describe('locales', () => {
  for (const ns of NS)
    for (const lang of ['ta', 'hi'])
      it(`${lang}/${ns} has the same keys and placeholders as en`, () => {
        const en = flat.en[ns]
        const other = flat[lang][ns]
        expect([...other.keys()].filter((k) => !en.has(k))).toEqual([])
        expect([...en.keys()].filter((k) => !other.has(k))).toEqual([])
        const wrong = [...en.entries()].filter(([k, v]) => JSON.stringify(params(v)) !== JSON.stringify(params(other.get(k)!))).map(([k]) => k)
        expect(wrong).toEqual([])
        expect([...other.entries()].filter(([, v]) => (Array.isArray(v) ? v.some((x) => !x.trim()) : !v.trim())).map(([k]) => k)).toEqual([])
      })

  it('every literal key used in the code exists', () => {
    const used = new Set<string>()
    for (const f of sourceFiles('src')) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/['"]((?:guidance:)?(?:nav|brand|footer|common|home|report|assistant|schemes|letter|records|officer|evaluation|about|reason|uncertain|plan|question|yesno|evidence|channel_kind|channel_action|requires|verification|safety|hazard|confidence|portal_language_unknown)(?:\.[a-z0-9_]+)+)['"]/g)) if (!NOT_KEYS.has(m[1])) used.add(m[1])
    }
    const engineKeys = [...used].filter((k) => /^(reason|uncertain|plan)\./.test(k)).map((k) => `guidance:${k}`)
    const missing = [...used].filter((k) => !/^(reason|uncertain|plan)\./.test(k)).concat(engineKeys).filter((k) => !has(k))
    expect(missing).toEqual([])
    expect(used.size).toBeGreaterThan(300)
  })

  it('covers every value used in dynamic keys', () => {
    const keys = [
      ...STATUSES.map((s) => `records.status.${s}`),
      ...CATEGORIES.flatMap((c) => c.evidence.map((e) => `guidance:evidence.${e}`)),
      ...CATEGORIES.flatMap((c) => c.questions.map((q) => `guidance:question.${q}.label`)),
      ...CATEGORIES.flatMap((c) => c.questions.map((q) => `guidance:question.${q}.short`)),
      ...CHANNELS.map((c) => `guidance:channel_kind.${c.kind}`),
      ...CHANNELS.map((c) => `guidance:channel_action.${c.kind === 'phone' ? 'call' : c.kind}`),
      ...CHANNELS.flatMap((c) => c.requires.map((r) => `guidance:requires.${r}`)),
      ...CHANNELS.map((c) => `guidance:verification.${c.status}`),
      ...['verified', 'loads', 'unreachable'].map((s) => `about.sources.s_${s}`),
      ...['hour', 'day', 'week', 'month', 'year'].map((u) => `common.unit.${u}`),
    ]
    expect(AUTHORITIES.length).toBeGreaterThan(0)
    expect([...new Set(keys)].filter((k) => !has(k))).toEqual([])
  })
})
