import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader, Status } from '../components/ui.tsx'
import type { RoutingReport, RoutingTally } from '../../eval/routing.ts'

// Shape of public/data/eval_report.json. Every number on this page comes from that file.
export interface EvalReport {
  generated_at: string
  llm_available: boolean
  metrics: Record<string, { value: number | null; threshold: number; pass: boolean | null; note?: string }>
  failure_tests: { name: string; pass: boolean; detail: string }[]
  per_question?: { id: string; type: string; question: string; expected_id: number | null; retrieved: number[]; found: boolean; hit: boolean | null }[]
  classifier?: { accuracy: number; test_size: number; labels: string[]; matrix: number[][] }
  pipeline?: Record<string, number | string>
  routing?: { development: RoutingReport; heldout: RoutingReport; heldout_first_run: { recorded: string; total: RoutingTally; by_language: Record<string, RoutingTally> } }
  source_check?: { checked_at: string; summary: Record<string, number> } | null
}

function TallyRow({ label, t: x }: { label: string; t: RoutingTally }) {
  return (
    <tr>
      <th>{label}</th>
      <td className="mono">{x.n}</td>
      <td className="mono">{x.category_correct}</td>
      <td className="mono">{x.authority_correct}</td>
      <td className="mono">{x.silent_misroutes}</td>
      <td className="mono">{x.asked_to_clarify}</td>
    </tr>
  )
}

function RoutingTable({ title, rows }: { title: string; rows: [string, RoutingTally][] }) {
  const { t } = useTranslation()
  return (
    <>
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>n</th>
              <th>{t('evaluation.col_category')}</th>
              <th>{t('evaluation.col_authority')}</th>
              <th>{t('evaluation.col_silent')}</th>
              <th>{t('evaluation.col_asked')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([l, x]) => (
              <TallyRow key={l} label={l} t={x} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
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
  const { t } = useTranslation()
  const [report, setReport] = useState<EvalReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/data/eval_report.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(t('evaluation.no_report', { status: r.status })))))
      .then(setReport)
      .catch((e: Error) => setError(e.message))
  }, [t])

  if (error) return <Status kind="empty">{error}</Status>
  if (!report) return <Status kind="loading">{t('common.loading')}</Status>

  return (
    <>
      <PageHeader eyebrow={t('evaluation.eyebrow')} title={t('evaluation.title')}>
        {t('evaluation.intro', { date: new Date(report.generated_at).toLocaleString() })}
        {!report.llm_available && ` ${t('evaluation.no_llm')}`}
      </PageHeader>
      <Status kind="info">{t('evaluation.synthetic_notice')}</Status>
      <div className="metrics">
        {Object.entries(report.metrics).map(([k, m]) => (
          <div key={k} className={`metric ${m.pass === null ? 'skip' : m.pass ? 'pass' : 'fail'}`}>
            <div className="metric-label">{LABELS[k] ?? k}</div>
            <div className="metric-value">{m.value === null ? '—' : m.value.toFixed(2)}</div>
            <div className="metric-sub">
              {t(m.pass === null ? 'evaluation.skipped' : m.pass ? 'evaluation.meets' : 'evaluation.below', { target: m.threshold.toFixed(2) })}
            </div>
            {m.note && <div className="metric-note">{m.note}</div>}
          </div>
        ))}
      </div>

      {report.routing && (
        <section className="eval-section">
          <h2>{t('evaluation.routing_title')}</h2>
          <p className="hint">{t('evaluation.routing_intro')}</p>
          <RoutingTable
            title={t('evaluation.heldout_first', { date: report.routing.heldout_first_run.recorded })}
            rows={[...Object.entries(report.routing.heldout_first_run.by_language), [t('evaluation.total'), report.routing.heldout_first_run.total] as [string, RoutingTally]]}
          />
          <RoutingTable title={t('evaluation.heldout_now')} rows={[...Object.entries(report.routing.heldout.by_language), [t('evaluation.total'), report.routing.heldout.total]]} />
          <RoutingTable title={t('evaluation.development')} rows={[...Object.entries(report.routing.development.by_language), [t('evaluation.total'), report.routing.development.total]]} />
          <details>
            <summary>{t('evaluation.per_category')}</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>P</th>
                    <th>R</th>
                    <th>F1</th>
                    <th>n</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.routing.heldout.per_category).map(([c, m]) => (
                    <tr key={c}>
                      <th className="mono">{c}</th>
                      <td className="mono">{m.precision.toFixed(2)}</td>
                      <td className="mono">{m.recall.toFixed(2)}</td>
                      <td className="mono">{m.f1.toFixed(2)}</td>
                      <td className="mono">{m.support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      {report.source_check && (
        <section className="eval-section">
          <h2>{t('evaluation.sources_title')}</h2>
          <p className="hint">{t('evaluation.sources_intro', { date: report.source_check.checked_at.slice(0, 10) })}</p>
          <div className="stat-row">
            {Object.entries(report.source_check.summary).map(([k, n]) => (
              <div key={k} className="stat">
                <div className="stat-value">{n}</div>
                <div className="stat-label mono">{k}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <h2>{t('evaluation.failure_tests')}</h2>
      <div className="table-wrap"><table>
        <tbody>
          {report.failure_tests.map((ft) => (
            <tr key={ft.name}>
              <td>{ft.pass ? '✅' : '❌'}</td>
              <td lang="en">{ft.name}</td>
              <td className="small" lang="en">{ft.detail}</td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {report.classifier && (
        <>
          <h2>{t('evaluation.classifier', { n: report.classifier.test_size })}</h2>
          <div className="table-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th>{t('evaluation.matrix_axes')}</th>
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
          <summary>{t('evaluation.per_question', { n: report.per_question.length })}</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t('evaluation.col_type')}</th>
                  <th>{t('evaluation.col_question')}</th>
                  <th>{t('evaluation.col_expected')}</th>
                  <th>{t('evaluation.col_retrieved')}</th>
                  <th>{t('evaluation.col_result')}</th>
                </tr>
              </thead>
              <tbody>
                {report.per_question.map((q) => (
                  <tr key={q.id}>
                    <td>{q.id}</td>
                    <td>{q.type}</td>
                    <td>{q.question}</td>
                    <td>{q.expected_id ?? t('evaluation.refuse')}</td>
                    <td>{q.retrieved.join(', ') || '—'}</td>
                    <td>{q.hit === null ? '' : q.hit ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  )
}
