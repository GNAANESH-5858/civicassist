import { useEffect, useMemo, useState } from 'react'
import { IconDownload } from '../components/icons.tsx'
import { PageHeader, Status, UrgencyBadge } from '../components/ui.tsx'
import { DEPARTMENTS } from '../lib/nlp/departments.ts'
import type { TriageResult } from '../lib/nlp/triage.ts'

type Row = TriageResult & { expected?: { department: string } }
const URGENCIES = ['high', 'medium', 'low'] as const
const ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export function toCsv(rows: Row[]): string {
  const cols = ['complaint_id', 'department', 'ward', 'issue', 'urgency', 'duplicate_of', 'similarity', 'masked_text', 'flags'] as const
  const esc = (v: unknown) => {
    const s = Array.isArray(v) ? v.join(';') : v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export default function OfficerPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dept, setDept] = useState('')
  const [urgency, setUrgency] = useState('')

  useEffect(() => {
    fetch('/data/triaged.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Could not load triaged.json (HTTP ${r.status})`))))
      .then(setRows)
      .catch((e: Error) => setError(e.message))
  }, [])

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => (!dept || r.department === dept) && (!urgency || r.urgency === urgency)),
    [rows, dept, urgency],
  )
  // Group repeats under the complaint they repeat.
  const repeatsOf = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of filtered) if (r.duplicate_of) m.set(r.duplicate_of, [...(m.get(r.duplicate_of) ?? []), r])
    return m
  }, [filtered])
  const primaries = filtered.filter((r) => !r.duplicate_of || !filtered.some((p) => p.complaint_id === r.duplicate_of))
  primaries.sort((a, b) => (ORDER[a.urgency ?? 'low'] ?? 3) - (ORDER[b.urgency ?? 'low'] ?? 3))

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(filtered)], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `civicassist-complaints${dept ? '-' + dept.replace(/\W+/g, '_') : ''}${urgency ? '-' + urgency : ''}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (error) return <Status kind="error">{error}</Status>
  if (!rows) return <Status kind="loading">Loading complaints…</Status>

  const counts = URGENCIES.map((u) => [u, filtered.filter((r) => r.urgency === u).length] as const)

  return (
    <>
      <PageHeader eyebrow="For officers" title="Officer dashboard">
        {rows.length} synthetic complaints triaged by the pipeline, highest urgency first. Repeats are grouped under the complaint they repeat.
      </PageHeader>
      <div className="toolbar">
        <label>
          Department{' '}
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Urgency{' '}
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="">All</option>
            {URGENCIES.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <button onClick={exportCsv} disabled={!filtered.length}>
          <IconDownload /> Export CSV ({filtered.length})
        </button>
      </div>
      <div className="stat-row">
        <div className="stat">
          <div className="stat-value">{filtered.length}</div>
          <div className="stat-label">Complaints shown</div>
        </div>
        {counts.map(([u, n]) => (
          <div key={u} className="stat">
            <div className="stat-value">{n}</div>
            <div className="stat-label">
              <UrgencyBadge level={u} />
            </div>
          </div>
        ))}
        <div className="stat">
          <div className="stat-value">{filtered.filter((r) => r.duplicate_of).length}</div>
          <div className="stat-label">Possible repeats</div>
        </div>
      </div>
      {filtered.length === 0 ? (
        <Status kind="empty">No complaints match these filters.</Status>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Urgency</th>
                <th>Department</th>
                <th>Ward</th>
                <th>Issue</th>
                <th>Complaint (masked)</th>
              </tr>
            </thead>
            <tbody>
              {primaries.map((r) => (
                <FragmentRows key={r.complaint_id} row={r} repeats={repeatsOf.get(r.complaint_id) ?? []} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function FragmentRows({ row, repeats }: { row: Row; repeats: Row[] }) {
  const cells = (r: Row, repeat: boolean) => (
    <tr key={r.complaint_id} className={repeat ? 'repeat-row' : undefined}>
      <td className="mono">{repeat ? `↳ ${r.complaint_id}` : r.complaint_id}</td>
      <td>
        <UrgencyBadge level={r.urgency} />
      </td>
      <td>{r.department}</td>
      <td>{r.ward ?? '—'}</td>
      <td>{r.issue ?? '—'}</td>
      <td>
        {repeat && <span className="pill pill-warn">repeat of {r.duplicate_of} ({r.similarity.toFixed(2)})</span>} {r.masked_text}
      </td>
    </tr>
  )
  return (
    <>
      {cells(row, Boolean(row.duplicate_of))}
      {repeats.map((r) => cells(r, true))}
    </>
  )
}
