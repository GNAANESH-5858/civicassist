import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Status, UrgencyBadge } from '../components/ui.tsx'
import { loadHistory, recentForTriage, saveComplaint, type StoredComplaint } from '../lib/browser/storage.ts'
import type { TriageResult } from '../lib/nlp/triage.ts'

const EXAMPLES = ['No water supply in Ward 12 for three days', 'Sewer overflowing onto the street near Anna Salai, ward 45', 'Broken streetlight on Gandhi Street, Ward No. 110']

export default function ComplaintPage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<TriageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<StoredComplaint[]>(() => loadHistory())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, recent: recentForTriage(history) }),
      })
      const body = (await res.json()) as TriageResult
      if (body.error) throw new Error(body.error)
      setResult(body)
      setHistory(saveComplaint({ complaint_id: body.complaint_id, created_at: new Date().toISOString(), result: body }))
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const byId = new Map(history.map((h) => [h.complaint_id, h]))

  return (
    <section>
      <h1>File a complaint</h1>
      <p className="muted">Describe the problem in your own words and include your ward if you know it. Phone numbers, ID numbers and emails are masked before anything is stored.</p>
      <form onSubmit={submit}>
        <label htmlFor="complaint" className="sr-only">
          Complaint
        </label>
        <textarea id="complaint" rows={5} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. No water supply in Ward 12 for three days" />
        <div className="row">
          <button type="submit" disabled={loading || !text.trim()}>
            {loading ? 'Triaging…' : 'Submit complaint'}
          </button>
          <span className="muted small">{text.length}/2000</span>
        </div>
        <div className="examples">
          <span className="muted small">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="link-btn" onClick={() => setText(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </form>

      {loading && <Status kind="loading">Triaging your complaint…</Status>}
      {error && <Status kind="error">{error}</Status>}

      {result && (
        <div className="card result">
          <div className="result-head">
            <h2>Complaint {result.complaint_id}</h2>
            <UrgencyBadge level={result.urgency} />
          </div>
          <dl className="grid">
            <dt>Department</dt>
            <dd>{result.department}</dd>
            <dt>Ward</dt>
            <dd>{result.ward ?? <span className="muted">not stated (please add your ward)</span>}</dd>
            <dt>Issue</dt>
            <dd>{result.issue ?? '—'}</dd>
            <dt>Repeat?</dt>
            <dd>
              {result.duplicate_of ? (
                <span className="warn">
                  Possible repeat of {result.duplicate_of} (similarity {result.similarity.toFixed(2)})
                  {byId.get(result.duplicate_of) && <> — “{byId.get(result.duplicate_of)!.result.masked_text.slice(0, 80)}”</>}
                </span>
              ) : (
                'No earlier matching complaint in this session'
              )}
            </dd>
            <dt>Stored text</dt>
            <dd className="mono">{result.masked_text}</dd>
            {result.flags.length > 0 && (
              <>
                <dt>Flags</dt>
                <dd>
                  {result.flags.map((f) => (
                    <span key={f} className={`flag ${f === 'possible_injection' ? 'flag-bad' : ''}`}>
                      {f}
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>
          <div className="row">
            <Link to={`/letter?id=${encodeURIComponent(result.complaint_id)}`} className="btn-secondary">
              Draft acknowledgement letter
            </Link>
            <Link to="/advisory" className="btn-secondary">
              Ask which scheme may apply
            </Link>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <details className="history">
          <summary>This session's complaints ({history.length})</summary>
          <ul>
            {[...history].reverse().map((h) => (
              <li key={h.complaint_id}>
                <strong>{h.complaint_id}</strong> <UrgencyBadge level={h.result.urgency} /> {h.result.department} · {h.result.ward ?? 'no ward'} — {h.result.masked_text.slice(0, 90)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
