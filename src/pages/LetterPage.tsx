import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CitationChip, Status } from '../components/ui.tsx'
import { NOT_FOUND_THRESHOLD } from '../lib/config.ts'
import { makeGateway } from '../lib/browser/gateway.ts'
import { loadKb } from '../lib/browser/kb.ts'
import { loadHistory } from '../lib/browser/storage.ts'
import type { SchemeRecord } from '../lib/kb/types.ts'
import { draftLetter, lintLetter, type LetterDraft } from '../lib/letter/draft.ts'
import { letterPdf } from '../lib/letter/pdf.ts'
import { toContextRecord } from '../lib/rag/ask.ts'
import { retrieveSupported } from '../lib/rag/retrieve.ts'

export default function LetterPage() {
  const history = useMemo(() => loadHistory(), [])
  const [params] = useSearchParams()
  const [selectedId, setSelectedId] = useState(params.get('id') ?? history.at(-1)?.complaint_id ?? '')
  const complaint = history.find((h) => h.complaint_id === selectedId)
  const [draft, setDraft] = useState<LetterDraft | null>(null)
  const [text, setText] = useState('')
  const [records, setRecords] = useState<SchemeRecord[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const gateway = useMemo(() => makeGateway(), [])

  async function generate() {
    if (!complaint) return
    setError(null)
    setDraft(null)
    try {
      setLoading('Finding relevant records…')
      const kb = await loadKb()
      const r = complaint.result
      const hits = (await retrieveSupported(r.masked_text, kb, { k: 3 })).filter((h) => h.score >= NOT_FOUND_THRESHOLD)
      const recs = hits.map((h) => h.record)
      setRecords(recs)
      setLoading('Drafting and self-reviewing the letter…')
      const d = await draftLetter(
        { complaint: r.masked_text, complaint_id: r.complaint_id, department: r.department, ward: r.ward, issue: r.issue, urgency: r.urgency, records: recs.map(toContextRecord) },
        gateway,
      )
      setDraft(d)
      setText(d.text)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(null)
    }
  }

  async function downloadPdf() {
    if (!complaint) return
    const bytes = await letterPdf({ complaint_id: complaint.complaint_id, date: new Date(), body: text, sources: records })
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `acknowledgement-${complaint.complaint_id}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const liveWarnings = draft ? lintLetter(text, records.map(toContextRecord)) : []

  if (history.length === 0) {
    return (
      <section>
        <h1>Acknowledgement letter</h1>
        <Status kind="empty">
          No complaints in this session yet. <Link to="/complaint">File a complaint</Link> first, then come back to draft its letter.
        </Status>
      </section>
    )
  }

  return (
    <section>
      <h1>Acknowledgement letter</h1>
      <p className="muted">Drafted for an officer to review, edit and approve. Only schemes retrieved from the knowledge base can be mentioned.</p>
      <label className="field">
        <span>Complaint</span>
        <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setDraft(null) }}>
          {[...history].reverse().map((h) => (
            <option key={h.complaint_id} value={h.complaint_id}>
              {h.complaint_id} — {h.result.masked_text.slice(0, 70)}
            </option>
          ))}
        </select>
      </label>
      {complaint && (
        <p className="card small">
          <strong>{complaint.result.department}</strong> · {complaint.result.ward ?? 'no ward'} · urgency {complaint.result.urgency}
          <br />
          {complaint.result.masked_text}
        </p>
      )}
      <button onClick={generate} disabled={!complaint || loading !== null}>
        {draft ? 'Regenerate draft' : 'Generate draft'}
      </button>

      {loading && <Status kind="loading">{loading}</Status>}
      {error && <Status kind="error">{error}</Status>}

      {draft && (
        <div className="card">
          <div className="result-head">
            <h2>Draft</h2>
            <span className="muted small">
              Prompt version: <code>{draft.prompt_version}</code> · {draft.source === 'llm' ? `LLM (${draft.stages.join(' → ')})` : 'template (LLM unavailable)'}
            </span>
          </div>
          {draft.error && <Status kind="info">{draft.error}</Status>}
          <label htmlFor="letter" className="sr-only">
            Letter text
          </label>
          <textarea id="letter" rows={16} value={text} onChange={(e) => setText(e.target.value)} />
          {liveWarnings.length > 0 ? (
            <ul className="warnings">
              {liveWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="ok small">Checks passed: no unretrieved schemes, no eligibility claims, rules not described as benefits, within 200 words.</p>
          )}
          <h3>Records cited (listed at the foot of the PDF)</h3>
          {records.length ? (
            <div className="chips">
              {records.map((r) => (
                <CitationChip key={r.id} record={r} />
              ))}
            </div>
          ) : (
            <p className="muted small">No knowledge-base record matched this complaint closely enough, so none is mentioned.</p>
          )}
          <button onClick={downloadPdf} disabled={!text.trim()}>
            Download PDF
          </button>
        </div>
      )}
    </section>
  )
}
