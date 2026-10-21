import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import LetterBuilder from '../components/letter/LetterBuilder.tsx'
import { CategoryPicker } from '../components/civic/QuestionField.tsx'
import { PageHeader, Status } from '../components/ui.tsx'
import { aiMarkedUnavailable, guarded } from '../lib/browser/ai.ts'
import { makeGateway } from '../lib/browser/gateway.ts'
import { buildFrame } from '../lib/civic/frame.ts'
import { route } from '../lib/civic/routing.ts'
import { loadReport } from '../lib/civic/session.ts'

/** Standalone letter builder. Uses the current guided report if one exists, else a short form. */
export default function LetterPage() {
  const { t } = useTranslation()
  const report = useMemo(() => loadReport(), [])
  const gateway = useMemo(() => guarded(makeGateway()), [])
  const [text, setText] = useState(report.frame ? report.text : '')
  const [category, setCategory] = useState<string | null>(report.frame?.category ?? null)
  const [location, setLocation] = useState(report.answers.location ?? report.frame?.locality?.name ?? '')
  const [started, setStarted] = useState(Boolean(report.frame))

  const frame = useMemo(() => (text.trim() ? buildFrame(text, { userCategory: category }) : null), [text, category])
  const routing = useMemo(() => (frame ? route(frame, report.frame ? report.answers : {}) : null), [frame, report])

  return (
    <>
      <PageHeader eyebrow={t('letter.eyebrow')} title={t('letter.title')}>
        {t('letter.intro')}
      </PageHeader>
      {!started && (
        <section className="card">
          <p>
            {t('letter.standalone_hint')} <Link to="/report">{t('letter.use_report')}</Link>
          </p>
          <label className="field-label" htmlFor="lp-text">
            {t('report.describe_label')}
          </label>
          <textarea id="lp-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={t('report.describe_placeholder')} />
          <div className="field" style={{ marginTop: 12 }}>
            <label className="field-label" htmlFor="lp-loc">
              {t('letter.location')}
            </label>
            <input id="lp-loc" className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} />
          </div>
          <h3>{t('report.pick_category')}</h3>
          <CategoryPicker candidates={frame?.candidates.map((c) => c.id) ?? []} selected={category ?? frame?.category} onPick={setCategory} />
          <div className="actions">
            <button disabled={!frame || !location.trim()} onClick={() => setStarted(true)}>
              {t('report.continue')}
            </button>
          </div>
        </section>
      )}
      {started && frame && routing && (
        <>
          <Status kind="info">{t('letter.recipient_note', { authority: routing.authority.name })}</Status>
          <LetterBuilder
            aiAvailable={!aiMarkedUnavailable()}
            gateway={gateway}
            seed={{
              authority: routing.authority.id,
              department: routing.department,
              category: routing.category,
              description: frame.text,
              descriptionLanguage: frame.language,
              location: location || frame.locality?.name || '',
              landmark: report.answers.landmark ?? frame.landmark,
              since: frame.duration,
              previous_reference: report.answers.previous_complaint ?? frame.previous_reference,
              complaint_id: report.complaintId ?? undefined,
            }}
          />
          <div className="actions">
            <Link to="/report" className="btn btn-secondary">
              {t('letter.to_submission')}
            </Link>
          </div>
        </>
      )}
    </>
  )
}
