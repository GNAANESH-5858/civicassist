import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { IconAlert, IconCheck, IconDownload, IconFile, IconInfo, IconLink, IconMail } from '../components/icons.tsx'
import { PageHeader, SchemeCard, Status, UrgencyBadge } from '../components/ui.tsx'
import { makeGateway } from '../lib/browser/gateway.ts'
import { loadKb } from '../lib/browser/kb.ts'
import { loadHistory } from '../lib/browser/storage.ts'
import { SUBMISSION_CHANNELS } from '../lib/config.ts'
import { draftLetter, lintLetter, type LetterDraft } from '../lib/letter/draft.ts'
import { DRAFT_LABEL, letterPdf } from '../lib/letter/pdf.ts'
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
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')
  const gateway = useMemo(() => makeGateway(), [])
  const records = relevant.map((r) => r.record)

  async function generate() {
    if (!complaint) return
    setError(null)
    setDraft(null)
    setCopied('idle')
    try {
      setLoading('Finding relevant records in the knowledge base…')
      const r = complaint.result
      const rel = await findRelevant(r.masked_text, await loadKb())
      setRelevant(rel)
      setLoading('Drafting and self-reviewing your letter…')
      // Only the masked complaint text is sent; name, address and contact stay as placeholders.
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
    const bytes = await letterPdf({ complaint_id: complaint.complaint_id, body: text, sources: records })
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `complaint-letter-${complaint.complaint_id}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('ok')
    } catch {
      // Clipboard API unavailable (e.g. insecure context): select the text so the user can copy it.
      const ta = document.getElementById('letter') as HTMLTextAreaElement | null
      ta?.select()
      setCopied('fail')
    }
  }

  const warnings = draft ? lintLetter(text, records.map(toContextRecord)) : []
  const banner = (
    <div className="sample-banner" role="note">
      <IconAlert /> {DRAFT_LABEL}
    </div>
  )

  if (history.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Step 3 · Write" title="Your complaint letter" />
        {banner}
        <Status kind="empty">
          No complaints in this browser yet. <Link to="/complaint">File a complaint</Link> first, then come back to draft its letter.
        </Status>
      </>
    )
  }

  return (
    <>
      <PageHeader eyebrow="Step 3 · Write" title="Your complaint letter">
        A formal letter from you to the Greater Chennai Corporation, ready for you to check, sign and submit. It can only mention programmes retrieved from the
        knowledge base for this complaint.
      </PageHeader>
      {banner}

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
                <IconMail /> {draft ? 'Redraft letter' : 'Draft my letter'}
              </button>
            </div>
          </div>

          {loading && <Status kind="loading">{loading}</Status>}
          {error && <Status kind="error">{error}</Status>}

          {draft && (
            <div className="card">
              <div className="card-title">
                <h2>Your draft</h2>
                <span className="hint">
                  Prompt <code>{draft.prompt_version}</code> · {draft.source === 'llm' ? `AI draft, ${draft.stages.join(' → ')}` : 'Rule-based template (AI unavailable)'}
                </span>
              </div>
              {draft.error && <Status kind="info">{draft.source === 'template' ? 'The AI service is not available, so a rule-safe template letter was used.' : draft.error}</Status>}
              <label htmlFor="letter" className="sr-only">
                Letter text
              </label>
              <textarea id="letter" className="letter-paper" rows={22} value={text} onChange={(e) => setText(e.target.value)} />
              <p className="hint">Replace [Your name], [Your address] and [Your contact number] by hand before signing. These details are never sent anywhere.</p>
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
                    <IconCheck /> Written by you, addressed to the Corporation
                  </li>
                  <li>
                    <IconCheck /> Mentions only programmes retrieved for this complaint, with no claim of entitlement
                  </li>
                  <li>
                    <IconCheck /> Within 250 words
                  </li>
                </ul>
              )}
            </div>
          )}

          {draft && (
            <div className="card submit-panel">
              <h2>How to submit this</h2>
              <div className="submit-note">
                <IconInfo /> This application prepares your complaint. You submit it yourself through the official channels below.
              </div>
              <ol className="submit-steps">
                <li>
                  <strong>Download the letter</strong>
                  <button onClick={downloadPdf} disabled={!text.trim()}>
                    <IconDownload /> Download PDF
                  </button>
                </li>
                <li>
                  <strong>Or copy the text</strong>
                  <button className="btn-secondary" onClick={copyText} disabled={!text.trim()}>
                    <IconFile /> Copy letter text
                  </button>
                  {copied === 'ok' && <span className="ok small"> Copied.</span>}
                  {copied === 'fail' && <span className="warn small"> Copy isn't available here; the text is selected, so press Ctrl+C.</span>}
                </li>
                <li>
                  <strong>File it through an official channel</strong>
                  <ul className="channels">
                    {SUBMISSION_CHANNELS.map((c) => (
                      <li key={c.label}>
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noopener noreferrer">
                            <IconLink size={13} /> {c.label}
                          </a>
                        ) : (
                          <span>{c.label}</span>
                        )}
                        {c.note && <span className="hint"> · {c.note}</span>}
                        {c.url && <span className="hint mono"> {c.url}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
                <li>
                  <strong>Keep the complaint ID for follow-up.</strong> <span className="mono">{complaint?.complaint_id}</span>
                </li>
              </ol>
            </div>
          )}
        </div>

        <aside className="stack">
          <div className="card">
            <h2>Programmes cited</h2>
            {!draft ? (
              <p className="hint">Draft the letter to see which knowledge-base records it may cite as supporting grounds.</p>
            ) : relevant.length ? (
              <div className="scheme-list">
                {relevant.map((r) => (
                  <SchemeCard key={r.record.id} record={r.record} score={r.score} boost={r.boost} match={r.match} />
                ))}
              </div>
            ) : (
              <p className="hint">No record matched this complaint closely enough, so the letter cites none.</p>
            )}
            <p className="hint">Official source links are printed at the foot of the PDF.</p>
          </div>
        </aside>
      </div>
    </>
  )
}
