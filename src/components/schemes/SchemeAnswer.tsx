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
  const [kind, setKind] = useState<'all' | 'scheme' | 'regulatory'>('all')

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
  const found = result.sources.map((s) => ({ s, r: records.get(s.id) })).filter((x): x is { s: (typeof result.sources)[number]; r: SchemeRecord } => Boolean(x.r))
  const kinds = new Set(found.map((x) => x.r.kind))
  const shown = found.filter((x) => kind === 'all' || x.r.kind === kind)
  return (
    <div className="stack">
      {result.answer ? (
        <div className="answer-block">
          <div className="provenance">
            <span className="badge badge-brand">{t('schemes.generated')}</span>
          </div>
          <AnswerText text={result.answer} lang={lang} />
          <p className="hint" style={{ margin: 0 }}>
            {t('schemes.ai_answer_note')}
          </p>
        </div>
      ) : (
        <Status kind="info">{t(aiAvailable ? 'schemes.answer_unavailable' : 'schemes.no_ai_records_only')}</Status>
      )}
      {result.rewritten_query !== question && <p className="hint" style={{ margin: 0 }}>{t('schemes.searched_for', { query: result.rewritten_query })}</p>}
      <div className="filter-bar">
        <h2 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          {t('schemes.results')} <span className="badge badge-ok">{t('schemes.from_kb')}</span>
        </h2>
        {kinds.size > 1 && (
          <div className="chips" role="group" aria-label={t('schemes.filter_label')}>
            {(['all', 'scheme', 'regulatory'] as const).map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {t(k === 'all' ? 'schemes.filter_all' : k === 'scheme' ? 'schemes.filter_schemes' : 'schemes.filter_rules')}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="scheme-list">
        {shown.map(({ s, r }) => (
          <SchemeCard key={s.id} n={s.n} record={r} score={s.score} boost={s.boost} match={matchBreakdown(matchText, r)} />
        ))}
      </div>
      {lang !== 'en' && <p className="hint">{t('schemes.corpus_english')}</p>}
    </div>
  )
}
