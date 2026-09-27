import { useEffect, useState } from 'react'
import { Status } from '../components/ui.tsx'

// Shape of public/data/eval_report.json. Every number on this page comes from that file.
export interface EvalReport {
  generated_at: string
  llm_available: boolean
  metrics: Record<string, { value: number | null; threshold: number; pass: boolean | null; note?: string }>
  failure_tests: { name: string; pass: boolean; detail: string }[]
  per_question?: { id: string; type: string; question: string; expected_id: number | null; retrieved: number[]; found: boolean; hit: boolean | null }[]
  classifier?: { accuracy: number; test_size: number; labels: string[]; matrix: number[][] }
  pipeline?: Record<string, number | string>
}

const LABELS: Record<string, string> = {
  recall_at_4: 'Recall@4',
  precision_at_4: 'Precision@4',
  mrr: 'MRR',
  faithfulness: 'Faithfulness',
  answer_relevance: 'Answer relevance',
  department_accuracy: 'Department accuracy',
  duplicate_f1: 'Repeat detection F1',
  out_of_scope_refusal: 'Out-of-scope refusal',
}

export default function EvaluationPage() {
  const [report, setReport] = useState<EvalReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/data/eval_report.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`No evaluation report yet (HTTP ${r.status}). Run the eval workflow to generate it.`))))
      .then(setReport)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <Status kind="empty">{error}</Status>
  if (!report) return <Status kind="loading">Loading evaluation report…</Status>

  return (
    <section>
      <h1>Evaluation</h1>
      <p className="muted">
        Generated {new Date(report.generated_at).toLocaleString()} from <code>eval/questions.json</code> and the synthetic complaint set.
        {!report.llm_available && ' No LLM key was available for this run, so model-judged metrics were skipped.'}
      </p>
      <div className="metrics">
        {Object.entries(report.metrics).map(([k, m]) => (
          <div key={k} className={`metric ${m.pass === null ? 'skip' : m.pass ? 'pass' : 'fail'}`}>
            <div className="metric-label">{LABELS[k] ?? k}</div>
            <div className="metric-value">{m.value === null ? '—' : m.value.toFixed(2)}</div>
            <div className="metric-sub">
              {m.pass === null ? 'skipped' : m.pass ? 'meets' : 'below'} target {m.threshold.toFixed(2)}
            </div>
            {m.note && <div className="metric-note">{m.note}</div>}
          </div>
        ))}
      </div>

      <h2>Failure-mode tests</h2>
      <table>
        <tbody>
          {report.failure_tests.map((t) => (
            <tr key={t.name}>
              <td>{t.pass ? '✅' : '❌'}</td>
              <td>{t.name}</td>
              <td className="small">{t.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {report.classifier && (
        <>
          <h2>Department classifier (held-out {report.classifier.test_size})</h2>
          <div className="table-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th>actual \ predicted</th>
                  {report.classifier.labels.map((l) => (
                    <th key={l} title={l}>
                      {l.split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.classifier.matrix.map((row, i) => (
                  <tr key={i}>
                    <th>{report.classifier!.labels[i]}</th>
                    {row.map((n, j) => (
                      <td key={j} className={n ? (i === j ? 'diag' : 'off') : ''}>
                        {n || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {report.per_question && (
        <details>
          <summary>Per-question retrieval ({report.per_question.length})</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Question</th>
                  <th>Expected</th>
                  <th>Retrieved</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {report.per_question.map((q) => (
                  <tr key={q.id}>
                    <td>{q.id}</td>
                    <td>{q.type}</td>
                    <td>{q.question}</td>
                    <td>{q.expected_id ?? 'refuse'}</td>
                    <td>{q.retrieved.join(', ') || '—'}</td>
                    <td>{q.hit === null ? '' : q.hit ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}
