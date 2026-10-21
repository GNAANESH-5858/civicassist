import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconSearch } from '../components/icons.tsx'
import SchemeAnswer from '../components/schemes/SchemeAnswer.tsx'
import { PageHeader, Status } from '../components/ui.tsx'
import { currentLang } from '../i18n.ts'
import { aiMarkedUnavailable, guarded } from '../lib/browser/ai.ts'
import { makeGateway } from '../lib/browser/gateway.ts'

export default function SchemesPage() {
  const { t } = useTranslation()
  const lang = currentLang()
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState<{ q: string; n: number } | null>(null)
  const gateway = useMemo(() => guarded(makeGateway()), [])
  const aiAvailable = !aiMarkedUnavailable()
  const examples = t('schemes.examples', { returnObjects: true }) as string[]

  return (
    <>
      <PageHeader eyebrow={t('schemes.eyebrow')} title={t('schemes.title')}>
        {t('schemes.intro')}
      </PageHeader>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          if (question.trim()) setAsked({ q: question.trim(), n: (asked?.n ?? 0) + 1 })
        }}
      >
        <label htmlFor="scheme-q" className="field-label">
          {t('schemes.question_label')}
        </label>
        <div className="inline-form">
          <input id="scheme-q" className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('schemes.question_placeholder')} maxLength={500} />
          <button type="submit" disabled={!question.trim()}>
            <IconSearch /> {t('schemes.search')}
          </button>
        </div>
        <div className="chips" style={{ marginTop: 12 }}>
          {Array.isArray(examples) &&
            examples.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => setQuestion(ex)}>
                {ex}
              </button>
            ))}
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          {t('schemes.disclaimer')}
        </p>
      </form>
      {!aiAvailable && <Status kind="info">{t('common.ai_unavailable_notice')}</Status>}
      {asked && (
        <section className="card" style={{ marginTop: 16 }}>
          <SchemeAnswer key={`${asked.n}-${lang}`} question={asked.q} lang={lang} gateway={gateway} aiAvailable={aiAvailable} />
        </section>
      )}
    </>
  )
}
