import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Lang } from '../../lib/civic/data.ts'
import { detectLanguage } from '../../lib/civic/language.ts'
import { glossQuery } from '../../lib/civic/schemeGloss.ts'
import type { SchemeRecord } from '../../lib/kb/types.ts'
import { ask, type AskResult, type Gateway } from '../../lib/rag/ask.ts'
import { matchBreakdown } from '../../lib/rag/retrieve.ts'
import { IconSearch } from '../icons.tsx'
import { SchemeCard, Status } from '../ui.tsx'

/** Renders "[1]" markers as superscript references. */
function AnswerText({ text, lang }: { text: string; lang: Lang }) {
  const parts = text.split(/(\[\d+\])/g)
  return (
    <p className="answer" lang={lang} style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((p, i) =>
        /^\[\d+\]$/.test(p) ? (
          <sup key={i} className="ref" style={{ color: 'var(--brand)', fontWeight: 700 }}>
            {p}
          </sup>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  )
}

/**
 * Answers a scheme question from the 148-record corpus. Retrieval always comes first; the AI may
 * only phrase an answer from the retrieved records (in the selected language). Without AI, the
 * records themselves are shown. Tamil/Hindi questions are mapped to English search terms by the AI
 * rewrite step, or by the bundled topic glossary when AI is unavailable.
 */
export default function SchemeAnswer({ question, lang, gateway, aiAvailable }: { question: string; lang: Lang; gateway: Gateway; aiAvailable: boolean }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'loading-model' | 'searching' | 'done' | 'error'>('loading-model')
  const [result, setResult] = useState<AskResult | null>(null)
  const [records, setRecords] = useState<Map<number, SchemeRecord>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const qLang = useMemo(() => detectLanguage(question).lang ?? 'en', [question])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { loadKb } = await import('../../lib/browser/kb.ts')
        const kb = await loadKb()
        if (cancelled) return
        setRecords(new Map(kb.records.map((r) => [r.id, r])))
        setPhase('searching')
        // Without AI, a Tamil/Hindi question is searched with glossary terms; English is searched as written.
        const searchText = qLang === 'en' ? question : `${glossQuery(question)}`.trim()
        const llm: Gateway = async (action, payload) => {
          if (!aiAvailable) {
            if (action === 'rewrite') return { text: searchText || question }
            throw new Error('AI unavailable')
          }
          return gateway(action, action === 'answer' ? { ...payload, language: lang } : payload)
        }
        const r = await ask(question, { ...kb, llm })
        if (!cancelled) {
          setResult(r)
          setPhase('done')
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message)
          setPhase('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [question, lang, gateway, aiAvailable, qLang])

  if (phase === 'loading-model') return <Status kind="loading">{t('schemes.loading_model')}</Status>
  if (phase === 'searching') return <Status kind="loading">{t('schemes.searching')}</Status>
  if (phase === 'error' || !result) return <Status kind="error">{t('schemes.load_error')} {error}</Status>

  if (!result.found) {
    return (
      <div className="card notfound" style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--muted)' }}>
          <IconSearch size={22} />
        </div>
        <h3 style={{ marginTop: 6 }}>{t('schemes.not_found_title')}</h3>
        <p className="muted">{qLang !== 'en' && !aiAvailable ? t('schemes.not_found_language') : t('schemes.not_found_body')}</p>
        <p>
          <a href="https://www.myscheme.gov.in/" target="_blank" rel="noopener noreferrer">
            myScheme
          </a>
        </p>
      </div>
    )
  }

  const matchText = `${question} ${result.rewritten_query}`
  return (
    <div className="stack">
      {result.answer ? (
        <div>
          <AnswerText text={result.answer} lang={lang} />
          <p className="hint">{t('schemes.ai_answer_note')}</p>
        </div>
      ) : (
        <Status kind="info">{t(aiAvailable ? 'schemes.answer_unavailable' : 'schemes.no_ai_records_only')}</Status>
      )}
      {result.rewritten_query !== question && <p className="hint">{t('schemes.searched_for', { query: result.rewritten_query })}</p>}
      <div className="scheme-list">
        {result.sources.map((s) => {
          const r = records.get(s.id)
          return r ? <SchemeCard key={s.id} n={s.n} record={r} score={s.score} boost={s.boost} match={matchBreakdown(matchText, r)} /> : null
        })}
      </div>
      {lang !== 'en' && <p className="hint">{t('schemes.corpus_english')}</p>}
    </div>
  )
}
