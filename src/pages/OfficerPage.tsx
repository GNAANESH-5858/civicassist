import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconChart, IconDownload, IconTable } from '../components/icons.tsx'
import { Drawer } from '../components/kit.tsx'
import { PageHeader, Status, UrgencyBadge } from '../components/ui.tsx'
import { currentLang } from '../i18n.ts'
import { recordsApi } from '../lib/browser/records.ts'
import { authorityById } from '../lib/civic/data.ts'
import { categoryLabel } from '../lib/civic/messages.ts'
import { DEPARTMENTS } from '../lib/nlp/departments.ts'
import type { TriageResult } from '../lib/nlp/triage.ts'
import { SETTABLE_STATUSES, type ComplaintRecord } from '../lib/records/schema.ts'

type Row = TriageResult & { expected?: { department: string } }
const URGENCIES = ['high', 'medium', 'low'] as const
const ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
const ADMIN_KEY = 'civicassist.admin_token'

function csvEscape(v: unknown): string {
  const s = Array.isArray(v) ? v.join(';') : v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<T extends object>(rows: T[], cols: readonly (keyof T & string)[]): string {
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\n')
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Bars({ title, counts }: { title: string; counts: [string, number][] }) {
  const max = Math.max(1, ...counts.map(([, n]) => n))
  return (
    <section className="card">
      <h3>{title}</h3>
      <div className="bars">
        {counts.map(([label, n]) => (
          <div key={label} className="bar-row">
            <span>{label}</span>
            <span className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ width: `${(n / max) * 100}%`, display: 'block' }} />
            </span>
            <span className="mono">{n}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function countBy<T>(rows: T[], key: (r: T) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export default function OfficerPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'sample' | 'records'>('sample')
  return (
    <>
      <PageHeader eyebrow={t('officer.eyebrow')} title={t('officer.title')}>
        {t('officer.intro')}
      </PageHeader>
      <div className="dash">
        <nav className="dash-rail" role="tablist" aria-label={t('officer.nav_label')}>
          <span className="rail-label">{t('officer.nav_label')}</span>
          {(['sample', 'records'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {k === 'sample' ? <IconChart /> : <IconTable />} {t(`officer.tab_${k}`)}
            </button>
          ))}
        </nav>
        <div className="dash-main">{tab === 'sample' ? <SampleDashboard /> : <AdminRecords />}</div>
      </div>
    </>
  )
}

function SampleDashboard() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dept, setDept] = useState('')
  const [urgency, setUrgency] = useState('')
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState<Row | null>(null)

  useEffect(() => {
    fetch('/data/triaged.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setRows)
      .catch((e: Error) => setError(e.message))
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows ?? []).filter((r) => (!dept || r.department === dept) && (!urgency || r.urgency === urgency) && (!needle || r.masked_text.toLowerCase().includes(needle) || (r.ward ?? '').toLowerCase().includes(needle)))
  }, [rows, dept, urgency, q])
  // Group repeats under the complaint they repeat.
  const repeatsOf = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of filtered) if (r.duplicate_of) m.set(r.duplicate_of, [...(m.get(r.duplicate_of) ?? []), r])
    return m
  }, [filtered])
  const primaries = filtered.filter((r) => !r.duplicate_of || !filtered.some((p) => p.complaint_id === r.duplicate_of))
  primaries.sort((a, b) => (ORDER[a.urgency ?? 'low'] ?? 3) - (ORDER[b.urgency ?? 'low'] ?? 3))

  if (error) return <Status kind="error">{t('officer.load_failed', { detail: error })}</Status>
  if (!rows) return <Status kind="loading">{t('common.loading')}</Status>

  const cols = ['complaint_id', 'department', 'ward', 'issue', 'urgency', 'duplicate_of', 'similarity', 'masked_text', 'flags'] as const

  return (
    <>
      <Status kind="warn">{t('officer.sample_notice', { count: rows.length })}</Status>
      <div className="toolbar">
        <label>
          {t('officer.department')}{' '}
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">{t('officer.all')}</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          {t('officer.urgency')}{' '}
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="">{t('officer.all')}</option>
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {t(`common.urgency.${u}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('officer.search')} <input className="input" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button onClick={() => download('civicassist-sample-complaints.csv', toCsv(filtered, cols), 'text/csv')} disabled={!filtered.length}>
          <IconDownload /> {t('officer.export_csv', { count: filtered.length })}
        </button>
      </div>
      <div className="stat-row">
        <div className="stat">
          <div className="stat-value">{filtered.length}</div>
          <div className="stat-label">{t('officer.shown')}</div>
        </div>
        {URGENCIES.map((u) => (
          <div key={u} className="stat">
            <div className="stat-value">{filtered.filter((r) => r.urgency === u).length}</div>
            <div className="stat-label">
              <UrgencyBadge level={u} />
            </div>
          </div>
        ))}
        <div className="stat">
          <div className="stat-value">{filtered.filter((r) => r.duplicate_of).length}</div>
          <div className="stat-label">{t('officer.repeats')}</div>
        </div>
      </div>
      <div className="grid-2">
        <Bars title={t('officer.by_department')} counts={countBy(filtered, (r) => r.department ?? '—')} />
        <Bars title={t('officer.by_ward')} counts={countBy(filtered, (r) => r.ward ?? '—').slice(0, 8)} />
      </div>
      {filtered.length === 0 ? (
        <Status kind="empty">{t('officer.no_match')}</Status>
      ) : (
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('officer.urgency')}</th>
                <th>{t('officer.department')}</th>
                <th>{t('officer.ward')}</th>
                <th>{t('officer.issue')}</th>
                <th>{t('officer.complaint_masked')}</th>
              </tr>
            </thead>
            <tbody>
              {primaries.map((r) => (
                <FragmentRows key={r.complaint_id} row={r} repeats={repeatsOf.get(r.complaint_id) ?? []} onOpen={setDetail} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Drawer open={detail !== null} title={t('officer.detail_title')} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <span className="badge badge-warn" style={{ marginBottom: 14 }}>
              {t('officer.tab_sample')}
            </span>
            <dl className="kv">
              <dt>ID</dt>
              <dd className="mono">{detail.complaint_id}</dd>
              <dt>{t('officer.urgency')}</dt>
              <dd>
                <UrgencyBadge level={detail.urgency} />
              </dd>
              <dt>{t('officer.department')}</dt>
              <dd>{detail.department ?? '—'}</dd>
              <dt>{t('officer.ward')}</dt>
              <dd>{detail.ward ?? '—'}</dd>
              <dt>{t('officer.issue')}</dt>
              <dd>{detail.issue ?? '—'}</dd>
              {detail.duplicate_of && (
                <>
                  <dt>{t('officer.repeats')}</dt>
                  <dd>{t('officer.repeat_of', { id: detail.duplicate_of, score: detail.similarity.toFixed(2) })}</dd>
                </>
              )}
            </dl>
            <h3>{t('officer.complaint_masked')}</h3>
            <p>{detail.masked_text}</p>
          </>
        )}
      </Drawer>
    </>
  )
}

function FragmentRows({ row, repeats, onOpen }: { row: Row; repeats: Row[]; onOpen: (r: Row) => void }) {
  const { t } = useTranslation()
  const cells = (r: Row, repeat: boolean) => (
    <tr key={r.complaint_id} className={`clickable ${repeat ? 'repeat-row' : ''}`} tabIndex={0} aria-label={t('officer.open_detail')} onClick={() => onOpen(r)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(r))}>
      <td className="mono">{repeat ? `↳ ${r.complaint_id}` : r.complaint_id}</td>
      <td>
        <UrgencyBadge level={r.urgency} />
      </td>
      <td>{r.department}</td>
      <td>{r.ward ?? '—'}</td>
      <td>{r.issue ?? '—'}</td>
      <td>
        {repeat && <span className="badge badge-warn">{t('officer.repeat_of', { id: r.duplicate_of, score: r.similarity.toFixed(2) })}</span>} {r.masked_text}
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

function readToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_KEY) ?? ''
  } catch {
    return ''
  }
}

function AdminRecords() {
  const { t } = useTranslation()
  const lang = currentLang()
  const [token, setToken] = useState(readToken)
  const [input, setInput] = useState('')
  const [records, setRecords] = useState<ComplaintRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<ComplaintRecord | null>(null)

  useEffect(() => {
    if (!token) return
    setError(null)
    recordsApi
      .adminList(token)
      .then(({ records }) => setRecords(records))
      .catch((e: Error & { status?: number }) => {
        setRecords(null)
        setError(e.status === 503 ? t('officer.admin_disabled') : e.status === 401 ? t('officer.admin_wrong') : e.message)
      })
  }, [token, t])

  function signIn() {
    try {
      sessionStorage.setItem(ADMIN_KEY, input.trim())
    } catch {
      /* session-only convenience */
    }
    setToken(input.trim())
    setInput('')
  }
  function signOut() {
    try {
      sessionStorage.removeItem(ADMIN_KEY)
    } catch {
      /* ignore */
    }
    setToken('')
    setRecords(null)
  }

  if (!token)
    return (
      <section className="card">
        <p>{t('officer.admin_intro')}</p>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (input.trim()) signIn()
          }}
        >
          <label htmlFor="admin-token" className="sr-only">
            {t('officer.admin_token')}
          </label>
          <input id="admin-token" className="input" type="password" autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('officer.admin_token')} />
          <button type="submit" disabled={!input.trim()}>
            {t('officer.admin_open')}
          </button>
        </form>
        <p className="hint">{t('officer.admin_hint')}</p>
      </section>
    )

  const shown = (records ?? []).filter((r) => !status || r.status === status)
  const cols = ['id', 'created_at', 'updated_at', 'status', 'category', 'authority', 'department', 'locality', 'channel_id', 'external_reference', 'title'] as const

  return (
    <>
      <div className="toolbar">
        <label>
          {t('records.status_label')}{' '}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('officer.all')}</option>
            {SETTABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`records.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-secondary" disabled={!shown.length} onClick={() => download('civicassist-records.csv', toCsv(shown, cols), 'text/csv')}>
          <IconDownload /> {t('officer.export_csv', { count: shown.length })}
        </button>
        <button className="btn-ghost" onClick={signOut}>
          {t('officer.admin_close')}
        </button>
      </div>
      {error && <Status kind="error">{error}</Status>}
      {records && records.length === 0 && <Status kind="empty">{t('officer.no_records')}</Status>}
      {records && records.length > 0 && (
        <>
          <div className="grid-2">
            <Bars title={t('officer.by_category')} counts={countBy(records, (r) => categoryLabel(r.category, lang))} />
            <Bars title={t('officer.by_status')} counts={countBy(records, (r) => t(`records.status.${r.status}`))} />
            <Bars title={t('officer.by_authority')} counts={countBy(records, (r) => authorityById.get(r.authority)?.name ?? r.authority)} />
            <Bars title={t('officer.by_locality')} counts={countBy(records, (r) => r.locality || '—').slice(0, 8)} />
          </div>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>{t('officer.updated')}</th>
                  <th>{t('records.status_label')}</th>
                  <th>{t('officer.category')}</th>
                  <th>{t('officer.locality')}</th>
                  <th>{t('officer.title_col')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => setSelected(r)}>
                    <td className="mono">{r.updated_at.slice(0, 10)}</td>
                    <td>{t(`records.status.${r.status}`)}</td>
                    <td>{categoryLabel(r.category, lang)}</td>
                    <td>{r.locality ?? '—'}</td>
                    <td>
                      <button className="btn-ghost" onClick={() => setSelected(r)}>
                        {r.title}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Drawer open={selected !== null} title={t('officer.detail_title')} onClose={() => setSelected(null)}>
      {selected && (
        <AdminDetail
          key={selected.id}
          record={selected}
          token={token}
          onChanged={(r) => {
            setSelected(r)
            setRecords((xs) => (xs ?? []).map((x) => (x.id === r.id ? r : x)))
          }}
        />
      )}
      </Drawer>
    </>
  )
}

function AdminDetail({ record, token, onChanged }: { record: ComplaintRecord; token: string; onChanged: (r: ComplaintRecord) => void }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<string>(record.status)
  const [resolution, setResolution] = useState(record.resolution_notes ?? '')
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function save() {
    setState('saving')
    try {
      const { record: r } = await recordsApi.adminUpdate(record.id, token, {
        status: status as never,
        resolution_notes: resolution || null,
        ...(note.trim() ? { history_note: note.trim() } : {}),
      })
      onChanged(r)
      setNote('')
      setState('saved')
    } catch {
      setState('error')
    }
  }

  return (
    <section>
      <h2>{record.title}</h2>
      <p>{record.summary}</p>
      <p className="hint">{t('officer.admin_audit')}</p>
      <div className="grid-2">
        <div className="field">
          <label className="field-label" htmlFor="ad-status">
            {t('records.status_label')}
          </label>
          <select id="ad-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {SETTABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`records.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ad-note">
            {t('records.history_note')}
          </label>
          <input id="ad-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </div>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="ad-res">
          {t('officer.resolution_notes')}
        </label>
        <textarea id="ad-res" rows={2} style={{ minHeight: 64 }} value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={1000} />
      </div>
      <div className="actions">
        <button onClick={save} disabled={state === 'saving'}>
          {state === 'saving' ? t('common.saving') : t('common.save')}
        </button>
      </div>
      {state === 'saved' && <Status kind="ok">{t('records.saved')}</Status>}
      {state === 'error' && <Status kind="error">{t('records.save_failed')}</Status>}
      <ol className="timeline">
        {[...record.history].reverse().map((h, i) => (
          <li key={i}>
            <strong>{t(`records.status.${h.status}`)}</strong> · {new Date(h.at).toLocaleString()} · <span className="hint">{t(h.by === 'admin' ? 'records.by_admin' : 'records.by_citizen')}</span>
            {h.note && <div>{h.note}</div>}
          </li>
        ))}
      </ol>
    </section>
  )
}
