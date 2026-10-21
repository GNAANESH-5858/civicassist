// Technical link check for every official URL in the civic knowledge base.
// It reports accessible / redirect / broken / network-failure per URL and writes data/source_check.json.
// A successful HTTP response does NOT prove a complaint form works: substantive verification is
// manual (see docs/SOURCE_MAINTENANCE.md). Requests are sequential with a delay to be gentle on
// government servers. Usage: npx tsx scripts/validate-civic-sources.ts [--strict]
import { writeFile } from 'node:fs/promises'
import { AUTHORITIES, CHANNELS, integrityProblems, SOURCES } from '../src/lib/civic/data.ts'

const DELAY_MS = 2000
const TIMEOUT_MS = 15000
const UA = 'CivicAssist-source-check/1.0 (link validation for a civic assistance project)'

export type CheckResult = {
  url: string
  used_by: string[]
  outcome: 'accessible' | 'redirect' | 'broken' | 'network_failure'
  http_status: number | null
  location: string | null
  detail: string | null
}

export function classify(status: number): CheckResult['outcome'] {
  if (status >= 200 && status < 300) return 'accessible'
  if (status >= 300 && status < 400) return 'redirect'
  return 'broken'
}

function collectUrls(): Map<string, string[]> {
  const urls = new Map<string, string[]>()
  const add = (u: string | null | undefined, who: string) => {
    if (!u || !u.startsWith('https://')) return
    urls.set(u, [...(urls.get(u) ?? []), who])
  }
  for (const s of SOURCES) add(s.url, `source:${s.id}`)
  for (const c of CHANNELS) {
    add(c.href, `channel:${c.id}`)
    add(c.alternate?.href, `channel:${c.id}(alt)`)
  }
  for (const a of AUTHORITIES) add(a.website, `authority:${a.id}`)
  return urls
}

async function check(url: string, usedBy: string[]): Promise<CheckResult> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': UA } })
    await res.body?.cancel()
    return { url, used_by: usedBy, outcome: classify(res.status), http_status: res.status, location: res.headers.get('location'), detail: null }
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } }
    const detail = err.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : (err.cause?.code ?? err.cause?.message ?? err.message)
    return { url, used_by: usedBy, outcome: 'network_failure', http_status: null, location: null, detail }
  } finally {
    clearTimeout(t)
  }
}

if (process.argv[1]?.endsWith('validate-civic-sources.ts')) {
  const problems = integrityProblems()
  if (problems.length) {
    console.error('Knowledge-base integrity problems:\n  ' + problems.join('\n  '))
    process.exit(1)
  }
  const urls = collectUrls()
  const results: CheckResult[] = []
  let i = 0
  for (const [url, usedBy] of urls) {
    if (i++) await new Promise((r) => setTimeout(r, DELAY_MS))
    const r = await check(url, usedBy)
    results.push(r)
    console.log(`${r.outcome.padEnd(15)} ${String(r.http_status ?? '-').padEnd(4)} ${url}${r.location ? ` -> ${r.location}` : ''}${r.detail ? ` (${r.detail})` : ''}`)
  }
  const count = (o: CheckResult['outcome']) => results.filter((r) => r.outcome === o).length
  const manual = CHANNELS.filter((c) => c.status !== 'verified').map((c) => c.id)
  const report = {
    checked_at: new Date().toISOString(),
    note: 'Technical link check only. A reachable page does not prove that a complaint form or phone line works.',
    summary: { total: results.length, accessible: count('accessible'), redirect: count('redirect'), broken: count('broken'), network_failure: count('network_failure') },
    requires_manual_review: [...new Set([...manual, ...results.filter((r) => r.outcome !== 'accessible').flatMap((r) => r.used_by)])],
    results,
  }
  await writeFile('data/source_check.json', JSON.stringify(report, null, 2) + '\n', 'utf8')
  console.log('\nSummary:', report.summary)
  console.log(`Needs manual review: ${report.requires_manual_review.length} item(s). Wrote data/source_check.json`)
  if (process.argv.includes('--strict') && count('broken') > 0) process.exit(1)
}
