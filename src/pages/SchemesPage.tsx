import { motion } from 'motion/react'
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

  const ask = (q: string) => {
    if (q.trim()) setAsked({ q: q.trim(), n: (asked?.n ?? 0) + 1 })
  }

  return (
    <>
      <PageHeader eyebrow={t('schemes.eyebrow')} title={t('schemes.title')}>
        {t('schemes.intro')}
      </PageHeader>
      <section className="search-hero">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            ask(question)
          }}
        >
          <label htmlFor="scheme-q" className="field-label">
            {t('schemes.question_label')}
          </label>
          <div className="search-box">
            <IconSearch size={18} />
            <input id="scheme-q" className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('schemes.question_placeholder')} maxLength={500} />
            <button type="submit" disabled={!question.trim()}>
              {t('schemes.search')}
            </button>
          </div>
        </form>
        <div className="chips" style={{ marginTop: 14 }}>
          {Array.isArray(examples) &&
            examples.map((ex) => (
              <button
                key={ex}
                type="button"
                className="chip"
                onClick={() => {
                  setQuestion(ex)
                  ask(ex)
                }}
              >
                {ex}
              </button>
            ))}
        </div>
        <p className="hint" style={{ margin: '14px 0 0' }}>
          {t('schemes.disclaimer')}
        </p>
      </section>
      {!aiAvailable && <Status kind="info">{t('common.ai_unavailable_notice')}</Status>}
      {asked && (
        <motion.section key={`${asked.n}-${lang}`} style={{ marginTop: 24 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} aria-live="polite">
          <SchemeAnswer question={asked.q} lang={lang} gateway={gateway} aiAvailable={aiAvailable} />
        </motion.section>
      )}
    </>
  )
}
