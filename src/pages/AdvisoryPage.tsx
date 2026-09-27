import { useMemo, useState } from 'react'
import { IconSearch } from '../components/icons.tsx'
import { PageHeader, SchemeCard, Status } from '../components/ui.tsx'
import { makeGateway } from '../lib/browser/gateway.ts'
import { loadKb } from '../lib/browser/kb.ts'
import type { SchemeRecord } from '../lib/kb/types.ts'
import { ask, type AskResult } from '../lib/rag/ask.ts'
import { matchBreakdown } from '../lib/rag/retrieve.ts'

const EXAMPLES = ['Am I eligible for help with a water connection?', 'Is there any subsidy for rooftop solar?', 'Which rule covers loud noise at night?', 'Where can a homeless person get shelter?']

/** Renders "[1]" markers in the answer as superscript references. */
function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/g)
  return (
    <p className="answer">
      {parts.map((p, i) =>
        /^\[\d+\]$/.test(p) ? (
          <sup key={i} className="ref">
            {p}
          </sup>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  )
}

export default function AdvisoryPage() {
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState('')
  const [phase, setPhase] = useState<'idle' | 'loading-model' | 'thinking'>('idle')
  const [result, setResult] = useState<AskResult | null>(null)
  const [records, setRecords] = useState<Map<number, SchemeRecord>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const gateway = useMemo(() => makeGateway(), [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setAsked(question.trim())
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

  const matchText = result ? `${asked} ${result.rewritten_query}` : ''

  return (
    <>
      <PageHeader eyebrow="Step 2 · Find help" title="Which scheme may apply to me?">
        Answers come only from the CivicAssist knowledge base of 148 schemes and rules. Every answer shows the scheme number, name, PDF page and official source.
        Eligibility is never confirmed here.
      </PageHeader>

      <form className="card" onSubmit={submit}>
        <label htmlFor="q" className="field-label">
          Your question
        </label>
        <div className="inline-form">
          <input id="q" className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about a scheme, benefit or rule" maxLength={500} />
          <button type="submit" disabled={phase !== 'idle' || !question.trim()}>
            <IconSearch /> Search
          </button>
        </div>
        <div className="examples">
          <span className="hint">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="example" onClick={() => setQuestion(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </form>

      {phase === 'loading-model' && <Status kind="loading">Loading the search model in your browser (first time only, about 25 MB)…</Status>}
      {phase === 'thinking' && <Status kind="loading">Searching the knowledge base…</Status>}
      {error && <Status kind="error">{error}</Status>}
      {result?.error && !result.sources.length && <Status kind="error">{result.error}</Status>}

      {result && !result.found && !result.error && (
        <div className="card notfound" style={{ marginTop: 16 }}>
          <div className="icon">
            <IconSearch size={22} />
          </div>
          <h2>Not in my documents</h2>
          <p className="muted" style={{ maxWidth: 520, margin: '0 auto' }}>
            Nothing in the CivicAssist knowledge base answers this question closely enough, so no guess is made. You can search all government schemes on{' '}
            <a href="https://www.myscheme.gov.in/" target="_blank" rel="noopener noreferrer">
              myScheme
            </a>
            .
          </p>
        </div>
      )}

      {result && result.found && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">
            <h2>Answer</h2>
            {result.rewritten_query !== asked && <span className="hint">Searched for “{result.rewritten_query}”</span>}
          </div>
          {result.answer ? (
            <AnswerText text={result.answer} />
          ) : (
            <Status kind="info">These records match your question, but the answer service is unavailable, so no summary is written. Open a record below to read it directly.</Status>
          )}
          <h3>Sources from the knowledge base</h3>
          <p className="hint" style={{ marginTop: 0 }}>
            Each source matched your words in its complaint domains or AI matching signals. Open one to see every section and its official source.
          </p>
          <div className="scheme-list">
            {result.sources.map((s) => {
              const r = records.get(s.id)
              return r ? <SchemeCard key={s.id} n={s.n} record={r} score={s.score} match={matchBreakdown(matchText, r)} /> : null
            })}
          </div>
        </div>
      )}
    </>
  )
}
