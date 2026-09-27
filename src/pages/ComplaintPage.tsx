import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconCheck, IconMail, IconSearch, IconShield } from '../components/icons.tsx'
import { Flag, PageHeader, SchemeCard, Status, UrgencyBadge } from '../components/ui.tsx'
import { loadHistory, recentForTriage, saveComplaint, type StoredComplaint } from '../lib/browser/storage.ts'
import type { TriageResult } from '../lib/nlp/triage.ts'
import type { RelevantRecord } from '../lib/rag/relevant.ts'

const EXAMPLES = ['No water supply in Ward 12 for three days', 'Sewer overflowing onto the street near Anna Salai, ward 45', 'Broken streetlight on Gandhi Street, Ward No. 110', 'Garbage not collected for a week in Ward 88']

export default function ComplaintPage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<TriageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<StoredComplaint[]>(() => loadHistory())
  const [relevant, setRelevant] = useState<RelevantRecord[] | null>(null)
  const [relevantState, setRelevantState] = useState<'idle' | 'loading' | 'error'>('idle')

  async function findSchemes(masked: string) {
    setRelevant(null)
    setRelevantState('loading')
    try {
      // Loaded on demand: the embedding model is only fetched when needed.
      const [{ loadKb }, { findRelevant }] = await Promise.all([import('../lib/browser/kb.ts'), import('../lib/rag/relevant.ts')])
      setRelevant(await findRelevant(masked, await loadKb()))
      setRelevantState('idle')
    } catch {
      setRelevantState('error')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    setRelevant(null)
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
      void findSchemes(body.masked_text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the triage service. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const byId = new Map(history.map((h) => [h.complaint_id, h]))

  return (
    <>
      <PageHeader eyebrow="Step 1 · Report" title="File a complaint">
        Describe the problem in your own words. We route it to the right department, check whether it has already been reported, and show which government
        schemes may be relevant.
      </PageHeader>

      <div className="layout-2">
        <div className="stack">
          <form className="card" onSubmit={submit}>
            <label htmlFor="complaint" className="field-label">
              What is the problem, and where?
            </label>
            <textarea id="complaint" rows={5} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. No water supply in Ward 12 for three days" />
            <div className="form-row">
              <span className="hint">Mention your ward (1–200) so we can route it. {text.length}/2000</span>
              <button type="submit" disabled={loading || !text.trim()}>
                {loading ? 'Submitting…' : 'Submit complaint'}
              </button>
            </div>
            <div className="examples">
              <span className="hint">Examples:</span>
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="example" onClick={() => setText(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </form>

          {loading && <Status kind="loading">Analysing your complaint…</Status>}
          {error && <Status kind="error">{error}</Status>}

          {result && (
            <section className="card" aria-live="polite">
              <div className="card-title">
                <div>
                  <div className="hint">Complaint registered</div>
                  <h2 className="mono" style={{ fontSize: '1.1rem' }}>
                    {result.complaint_id}
                  </h2>
                </div>
                <UrgencyBadge level={result.urgency} />
              </div>
              <div className="result-tiles">
                <div className="tile">
                  <div className="tile-label">Department</div>
                  <div className="tile-value">{result.department}</div>
                </div>
                <div className="tile">
                  <div className="tile-label">Ward</div>
                  <div className="tile-value">{result.ward ?? <span className="muted">Not detected</span>}</div>
                </div>
                <div className="tile">
                  <div className="tile-label">Issue</div>
                  <div className="tile-value">{result.issue ?? '—'}</div>
                </div>
              </div>
              {result.duplicate_of && (
                <div className="repeat-note">
                  This looks like a repeat of <strong>{result.duplicate_of}</strong> ({Math.round(result.similarity * 100)}% similar)
                  {byId.get(result.duplicate_of) && <>: “{byId.get(result.duplicate_of)!.result.masked_text.slice(0, 90)}”</>}
                </div>
              )}
              <p className="quote">{result.masked_text}</p>
              {result.flags.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {result.flags.map((f) => (
                    <Flag key={f} flag={f} />
                  ))}
                </div>
              )}

              <h3>Schemes and rules that may be relevant</h3>
              {relevantState === 'loading' && <Status kind="loading">Checking the knowledge base (the first search downloads a small model)…</Status>}
              {relevantState === 'error' && <Status kind="error">Could not load the knowledge base. The complaint itself was registered.</Status>}
              {relevant && relevant.length === 0 && <Status kind="empty">No scheme in the knowledge base matches this complaint closely enough, so none is suggested.</Status>}
              {relevant && relevant.length > 0 && (
                <>
                  <p className="hint" style={{ marginTop: 0 }}>
                    Shown only when the complaint matches a record's <strong>complaint domains</strong> or <strong>AI matching signals</strong>. Green marks show the
                    words that matched. These may be applicable, subject to eligibility and local verification.
                  </p>
                  <div className="scheme-list">
                    {relevant.map((r) => (
                      <SchemeCard key={r.record.id} record={r.record} score={r.score} match={r.match} />
                    ))}
                  </div>
                </>
              )}

              <div className="actions">
                <Link to={`/letter?id=${encodeURIComponent(result.complaint_id)}`} className="btn">
                  <IconMail /> Draft acknowledgement letter
                </Link>
                <Link to="/advisory" className="btn btn-secondary">
                  <IconSearch /> Ask about a scheme
                </Link>
              </div>
            </section>
          )}

          {history.length > 0 && (
            <details className="card subtle">
              <summary style={{ margin: 0 }}>Your complaints in this browser ({history.length})</summary>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <tbody>
                    {[...history].reverse().map((h) => (
                      <tr key={h.complaint_id}>
                        <td className="mono">{h.complaint_id}</td>
                        <td>
                          <UrgencyBadge level={h.result.urgency} />
                        </td>
                        <td>{h.result.department}</td>
                        <td>{h.result.ward ?? '—'}</td>
                        <td>{h.result.masked_text.slice(0, 70)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>

        <aside className="stack">
          <div className="card">
            <h2>How it works</h2>
            <ol className="steps">
              <li>
                <strong>Describe the problem</strong>Plain language is fine: English, Tanglish, short or long.
              </li>
              <li>
                <strong>Automatic routing</strong>Department, ward, urgency and repeat check. No AI model is used for this step.
              </li>
              <li>
                <strong>Relevant schemes</strong>Matched only from the 148-entry knowledge base, each with its official source.
              </li>
              <li>
                <strong>Acknowledgement</strong>An officer reviews and approves a formal letter.
              </li>
            </ol>
          </div>
          <div className="card">
            <h2>
              <IconShield /> Your privacy
            </h2>
            <ul className="trust-list">
              <li>
                <IconCheck /> Phone numbers, Aadhaar-style ID numbers and emails are masked before anything is stored.
              </li>
              <li>
                <IconCheck /> Your complaint history stays in this browser only.
              </li>
              <li>
                <IconCheck /> Scheme suggestions never claim you are eligible. Verify at the official source.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  )
}
