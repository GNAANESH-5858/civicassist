import { useMemo, useState } from 'react'
import { CitationChip, Status } from '../components/ui.tsx'
import { makeGateway } from '../lib/browser/gateway.ts'
import { loadKb } from '../lib/browser/kb.ts'
import type { SchemeRecord } from '../lib/kb/types.ts'
import { ask, type AskResult } from '../lib/rag/ask.ts'

const EXAMPLES = ['Am I eligible for help with a water connection?', 'Is there any subsidy for rooftop solar?', 'Which rule covers loud noise at night?', 'Where can a homeless person get shelter?']

/** Renders "[1]" markers in the answer as small superscript references. */
function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/g)
  return (
    <p className="answer">
      {parts.map((p, i) => (/^\[\d+\]$/.test(p) ? <sup key={i} className="ref">{p}</sup> : <span key={i}>{p}</span>))}
    </p>
  )
}

export default function AdvisoryPage() {
  const [question, setQuestion] = useState('')
  const [phase, setPhase] = useState<'idle' | 'loading-model' | 'thinking'>('idle')
  const [result, setResult] = useState<AskResult | null>(null)
  const [records, setRecords] = useState<Map<number, SchemeRecord>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const gateway = useMemo(() => makeGateway(), [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    try {
      setPhase('loading-model')
      const kb = await loadKb()
      setRecords(new Map(kb.records.map((r) => [r.id, r])))
      setPhase('thinking')
      setResult(await ask(question, { ...kb, llm: gateway }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPhase('idle')
    }
  }

  return (
    <section>
      <h1>Which scheme may apply to me?</h1>
      <p className="muted">
        Answers come only from the CivicAssist knowledge base (148 entries). Every answer shows the scheme number, name, PDF page and official source. Eligibility is never confirmed here; always verify at the official source.
      </p>
      <form onSubmit={submit}>
        <label htmlFor="q" className="sr-only">
          Question
        </label>
        <input id="q" className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about a scheme, benefit or rule" maxLength={500} />
        <button type="submit" disabled={phase !== 'idle' || !question.trim()}>
          Ask
        </button>
        <div className="examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="link-btn" onClick={() => setQuestion(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </form>

      {phase === 'loading-model' && <Status kind="loading">Loading the search model in your browser (first time only, about 25 MB)…</Status>}
      {phase === 'thinking' && <Status kind="loading">Searching the knowledge base…</Status>}
      {error && <Status kind="error">{error}</Status>}

      {result && result.error && !result.sources.length && <Status kind="error">{result.error}</Status>}

      {result && !result.found && !result.error && (
        <div className="card notfound">
          <h2>Not in my documents</h2>
          <p>I couldn't find anything in the CivicAssist knowledge base that answers this question, so I won't guess. You can search all government schemes at <a href="https://www.myscheme.gov.in/" target="_blank" rel="noopener noreferrer">myScheme</a>.</p>
        </div>
      )}

      {result && result.found && (
        <div className="card">
          {result.answer ? (
            <AnswerText text={result.answer} />
          ) : (
            <Status kind="error">
              These records matched your question, but the answer service is unavailable, so no summary is shown. Open a record below to read it directly. ({result.error})
            </Status>
          )}
          <h3>Sources</h3>
          <div className="chips">
            {result.sources.map((s) => {
              const r = records.get(s.id)
              return r ? <CitationChip key={s.id} n={s.n} record={r} score={s.score} /> : null
            })}
          </div>
          {result.rewritten_query !== question.trim() && <p className="muted small">Searched for: “{result.rewritten_query}”</p>}
        </div>
      )}
    </section>
  )
}
