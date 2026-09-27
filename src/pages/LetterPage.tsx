import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { IconAlert, IconCheck, IconDownload, IconMail } from '../components/icons.tsx'
import { PageHeader, SchemeCard, Status, UrgencyBadge } from '../components/ui.tsx'
import { makeGateway } from '../lib/browser/gateway.ts'
import { loadKb } from '../lib/browser/kb.ts'
import { loadHistory } from '../lib/browser/storage.ts'
import { draftLetter, lintLetter, type LetterDraft } from '../lib/letter/draft.ts'
import { letterPdf } from '../lib/letter/pdf.ts'
import { toContextRecord } from '../lib/rag/ask.ts'
import { findRelevant, type RelevantRecord } from '../lib/rag/relevant.ts'

export default function LetterPage() {
  const history = useMemo(() => loadHistory(), [])
  const [params] = useSearchParams()
  const [selectedId, setSelectedId] = useState(params.get('id') ?? history.at(-1)?.complaint_id ?? '')
  const complaint = history.find((h) => h.complaint_id === selectedId)
  const [draft, setDraft] = useState<LetterDraft | null>(null)
  const [text, setText] = useState('')
  const [relevant, setRelevant] = useState<RelevantRecord[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const gateway = useMemo(() => makeGateway(), [])
  const records = relevant.map((r) => r.record)

  async function generate() {
    if (!complaint) return
    setError(null)
    setDraft(null)
    try {
      setLoading('Finding relevant records in the knowledge base…')
      const r = complaint.result
      const rel = await findRelevant(r.masked_text, await loadKb())
      setRelevant(rel)
      setLoading('Drafting and self-reviewing the letter…')
      const d = await draftLetter(
        { complaint: r.masked_text, complaint_id: r.complaint_id, department: r.department, ward: r.ward, issue: r.issue, urgency: r.urgency, records: rel.map((x) => toContextRecord(x.record)) },
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

  const warnings = draft ? lintLetter(text, records.map(toContextRecord)) : []

  if (history.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Step 3 · Acknowledge" title="Acknowledgement letter" />
        <Status kind="empty">
          No complaints in this browser yet. <Link to="/complaint">File a complaint</Link> first, then come back to draft its letter.
        </Status>
      </>
    )
  }

  return (
    <>
      <PageHeader eyebrow="Step 3 · Acknowledge" title="Acknowledgement letter">
        A formal letter drafted for an officer to review, edit and approve. It can only mention schemes that were retrieved from the knowledge base for this
        complaint.
      </PageHeader>

      <div className="layout-2">
        <div className="stack">
          <div className="card">
            <label htmlFor="complaint-select" className="field-label">
              Complaint
            </label>
            <select
              id="complaint-select"
              style={{ width: '100%' }}
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value)
                setDraft(null)
                setRelevant([])
              }}
            >
              {[...history].reverse().map((h) => (
                <option key={h.complaint_id} value={h.complaint_id}>
                  {h.complaint_id}: {h.result.masked_text.slice(0, 70)}
                </option>
              ))}
            </select>
            {complaint && (
              <>
                <div className="result-tiles" style={{ marginTop: 12 }}>
                  <div className="tile">
                    <div className="tile-label">Department</div>
                    <div className="tile-value">{complaint.result.department}</div>
                  </div>
                  <div className="tile">
                    <div className="tile-label">Ward</div>
                    <div className="tile-value">{complaint.result.ward ?? '—'}</div>
                  </div>
                  <div className="tile">
                    <div className="tile-label">Urgency</div>
                    <div className="tile-value">
                      <UrgencyBadge level={complaint.result.urgency} />
                    </div>
                  </div>
                </div>
                <p className="quote">{complaint.result.masked_text}</p>
              </>
            )}
            <div className="actions">
              <button onClick={generate} disabled={!complaint || loading !== null}>
                <IconMail /> {draft ? 'Regenerate draft' : 'Generate draft'}
              </button>
            </div>
          </div>

          {loading && <Status kind="loading">{loading}</Status>}
          {error && <Status kind="error">{error}</Status>}

          {draft && (
            <div className="card">
              <div className="card-title">
                <h2>Draft for review</h2>
                <span className="hint">
                  Prompt <code>{draft.prompt_version}</code> · {draft.source === 'llm' ? `AI draft, ${draft.stages.join(' → ')}` : 'Rule-based template (AI unavailable)'}
                </span>
              </div>
              {draft.error && <Status kind="info">{draft.source === 'template' ? 'The AI service is not configured, so a rule-safe template letter was used.' : draft.error}</Status>}
              <label htmlFor="letter" className="sr-only">
                Letter text
              </label>
              <textarea id="letter" className="letter-paper" rows={16} value={text} onChange={(e) => setText(e.target.value)} />
              {warnings.length > 0 ? (
                <ul className="checks warn">
                  {warnings.map((w) => (
                    <li key={w}>
                      <IconAlert /> {w}
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="checks ok">
                  <li>
                    <IconCheck /> Mentions only schemes retrieved for this complaint
                  </li>
                  <li>
                    <IconCheck /> Makes no eligibility claims; rules are not described as benefits
                  </li>
                  <li>
                    <IconCheck /> Within 200 words
                  </li>
                </ul>
              )}
              <div className="actions">
                <button onClick={downloadPdf} disabled={!text.trim()}>
                  <IconDownload /> Download PDF
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="stack">
          <div className="card">
            <h2>Records cited</h2>
            {!draft ? (
              <p className="hint">Generate a draft to see which knowledge-base records it may cite.</p>
            ) : relevant.length ? (
              <div className="scheme-list">
                {relevant.map((r) => (
                  <SchemeCard key={r.record.id} record={r.record} score={r.score} match={r.match} />
                ))}
              </div>
            ) : (
              <p className="hint">No record matched this complaint's domains or signals closely enough, so the letter mentions none.</p>
            )}
            <p className="hint">Official source links are printed at the foot of the PDF.</p>
          </div>
        </aside>
      </div>
    </>
  )
}
