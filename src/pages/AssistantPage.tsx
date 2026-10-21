import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import ChannelCard from '../components/civic/ChannelCard.tsx'
import { CategoryPicker, QuestionField } from '../components/civic/QuestionField.tsx'
import { SafetyPanel } from '../components/civic/Recommendation.tsx'
import { IconChat } from '../components/icons.tsx'
import SchemeAnswer from '../components/schemes/SchemeAnswer.tsx'
import { PageHeader, Status } from '../components/ui.tsx'
import i18n, { currentLang, LANG_KEY, LANGUAGES } from '../i18n.ts'
import { aiMarkedUnavailable, guarded, makeExtractor } from '../lib/browser/ai.ts'
import { makeGateway } from '../lib/browser/gateway.ts'
import { assistFrame } from '../lib/civic/assist.ts'
import { ESCALATION, pick } from '../lib/civic/data.ts'
import { detectIntent, initialState, reduce, type DialogueEvent, type DialogueState, type QuickStart, type Turn } from '../lib/civic/dialogue.ts'
import { detectLanguage } from '../lib/civic/language.ts'
import { categoryLabel, renderMessage } from '../lib/civic/messages.ts'
import { route } from '../lib/civic/routing.ts'
import { emptyReport, saveReport } from '../lib/civic/session.ts'

const STORE = 'civicassist.chat.v1'
const QUICK: QuickStart[] = ['roads', 'garbage', 'drainage_flooding', 'water_supply', 'streetlight', 'sewage', 'electricity', 'traffic', 'schemes', 'followup', 'letter']

function loadChat(): DialogueState {
  try {
    const raw = sessionStorage.getItem(STORE)
    return raw ? (JSON.parse(raw) as DialogueState) : initialState()
  } catch {
    return initialState()
  }
}

function explicitLanguageChosen(): boolean {
  try {
    return localStorage.getItem(LANG_KEY) !== null
  } catch {
    return false
  }
}

export default function AssistantPage() {
  const { t } = useTranslation()
  const lang = currentLang()
  const navigate = useNavigate()
  const [state, setState] = useState<DialogueState>(loadChat)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [suggestLang, setSuggestLang] = useState<string | null>(null)
  const gateway = useMemo(() => guarded(makeGateway()), [])
  const [aiAvailable, setAiAvailable] = useState(() => !aiMarkedUnavailable())
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(state))
    } catch {
      // storage unavailable: the conversation lasts until the page is closed
    }
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [state])

  const dispatch = (e: DialogueEvent) => setState((s) => reduce(s, e))

  async function send() {
    const text = input.trim()
    if (!text) return
    setInput('')
    // Respond in the user's language: switch automatically unless they chose a language explicitly.
    const detected = detectLanguage(text).lang
    if (detected && detected !== lang) {
      if (explicitLanguageChosen()) setSuggestLang(detected)
      else void i18n.changeLanguage(detected)
    }
    // Free-text complaint descriptions may be improved by optional AI extraction first.
    if (!state.pending && state.mode === 'complaint' && detectIntent(text) === 'complaint' && aiAvailable) {
      setThinking(true)
      const frame = await assistFrame(`${state.description} ${text}`.trim(), { userCategory: state.userCategory }, makeExtractor(gateway))
      if (frame.ai_error) setAiAvailable(false)
      setThinking(false)
      dispatch({ type: 'user_text', text, frame })
    } else dispatch({ type: 'user_text', text })
  }

  function openReport(step: 'recommend' | 'letter') {
    if (!state.frame) return
    saveReport({ ...emptyReport(), text: state.description, userCategory: state.userCategory, frame: { ...state.frame, ai_used: false, ai_fields: [], english_summary: null, ai_error: null }, answers: state.answers, step })
    navigate('/report')
  }

  const lastPendingIndex = state.pending ? state.turns.map((t) => t.role === 'bot' && (t.kind === 'question' || t.kind === 'question_retry')).lastIndexOf(true) : -1

  return (
    <>
      <PageHeader eyebrow={t('assistant.eyebrow')} title={t('assistant.title')}>
        {t('assistant.intro')}
      </PageHeader>
      {!aiAvailable && <Status kind="info">{t('common.ai_unavailable_notice')}</Status>}
      {suggestLang && (
        <Status kind="info">
          {t('assistant.switch_language', { language: LANGUAGES.find((l) => l.code === suggestLang)?.native })}{' '}
          <button
            className="btn-ghost"
            onClick={() => {
              void i18n.changeLanguage(suggestLang)
              setSuggestLang(null)
            }}
          >
            {t('assistant.switch')}
          </button>
          <button className="btn-ghost" onClick={() => setSuggestLang(null)}>
            {t('assistant.keep')}
          </button>
        </Status>
      )}
      <section className="card chat" aria-label={t('assistant.title')}>
        <div className="chat-log" ref={logRef} aria-live="polite">
          <AnimatePresence initial={false}>
            {state.turns.map((turn, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`msg ${turn.role}`}>
                {turn.role === 'user' ? (
                  turn.text
                ) : (
                  <>
                    <div className="label">CivicAssist Guide</div>
                    <div className="bubble">
                      <BotTurn turn={turn} state={state} active={i === lastPendingIndex} dispatch={dispatch} onOpenReport={openReport} gateway={gateway} aiAvailable={aiAvailable} />
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {thinking && <Status kind="loading">{t('assistant.thinking')}</Status>}
        </div>
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <label htmlFor="chat-text" className="sr-only">
            {t('assistant.input_label')}
          </label>
          <textarea
            id="chat-text"
            value={input}
            maxLength={2000}
            placeholder={t('assistant.input_placeholder')}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <button type="submit" disabled={!input.trim() || thinking} aria-label={t('assistant.send')}>
            <IconChat /> <span className="sr-only">{t('assistant.send')}</span>
          </button>
        </form>
      </section>
      <div className="actions">
        <button className="btn-ghost" onClick={() => dispatch({ type: 'restart' })}>
          {t('assistant.restart')}
        </button>
        <Link to="/report" className="btn btn-ghost">
          {t('assistant.use_form')}
        </Link>
      </div>
    </>
  )
}

function BotTurn({
  turn,
  state,
  active,
  dispatch,
  onOpenReport,
  gateway,
  aiAvailable,
}: {
  turn: Extract<Turn, { role: 'bot' }>
  state: DialogueState
  active: boolean
  dispatch: (e: DialogueEvent) => void
  onOpenReport: (step: 'recommend' | 'letter') => void
  gateway: ReturnType<typeof guarded>
  aiAvailable: boolean
}) {
  const { t } = useTranslation()
  const lang = currentLang()
  const f = state.frame
  switch (turn.kind) {
    case 'greeting':
      return (
        <>
          <p>{t('assistant.greeting')}</p>
          <div className="chips">
            {QUICK.map((q) => (
              <button key={q} type="button" className="chip" onClick={() => dispatch({ type: 'quick_start', id: q })}>
                {t(`assistant.quick.${q}`)}
              </button>
            ))}
          </div>
        </>
      )
    case 'ask_describe':
      return <p style={{ margin: 0 }}>{t('assistant.ask_describe')}</p>
    case 'ask_describe_category':
      return <p style={{ margin: 0 }}>{t('assistant.ask_describe_category', { category: categoryLabel(String(turn.data?.category), lang) })}</p>
    case 'emergency':
      return f ? <SafetyPanel frame={f} answers={state.answers} /> : null
    case 'understood':
      return f ? (
        <p style={{ margin: 0 }}>
          {t('assistant.understood', { category: categoryLabel(f.category, lang) })}
          {f.locality && ` ${t('assistant.understood_place', { place: f.locality.name })}`}
          {f.duration && ` ${t('assistant.understood_duration', { value: f.duration.value, unit: t(`common.unit.${f.duration.unit}`, { count: f.duration.value }) })}`}
          {'ai_used' in f && (f as { ai_used?: boolean }).ai_used ? ` ${t('assistant.ai_helped')}` : ''}
        </p>
      ) : null
    case 'ask_category':
      return (
        <>
          <p>{t('assistant.ask_category')}</p>
          <CategoryPicker candidates={(turn.data?.candidates as string[]) ?? []} onPick={(id) => dispatch({ type: 'choose_category', category: id })} />
        </>
      )
    case 'question':
    case 'question_retry': {
      const id = turn.data?.id as Parameters<typeof QuestionField>[0]['id']
      return (
        <>
          {turn.kind === 'question_retry' && <p className="hint">{t('assistant.noted')}</p>}
          {active ? <QuestionField id={id} onAnswer={(v) => dispatch({ type: 'answer', question: id, value: v })} onSkip={() => dispatch({ type: 'skip' })} /> : <p style={{ margin: 0 }}>{t(`guidance:question.${id}.label`)}</p>}
        </>
      )
    }
    case 'recommendation': {
      if (!f) return null
      const r = route(f, state.answers)
      return (
        <div className="stack">
          <div>
            <div className="eyebrow">{t('report.likely_authority')}</div>
            <strong lang="en">{r.authority.name}</strong>
            {r.department && (
              <span className="hint" lang="en">
                {' '}
                · {r.department}
              </span>
            )}
            <p className="hint" style={{ margin: '4px 0 0' }}>
              {renderMessage(r.reasons[0], lang, t)}
            </p>
          </div>
          {r.uncertainties.slice(0, 2).map((u, i) => (
            <p key={i} className="hint" style={{ margin: 0 }}>
              ⚠ {renderMessage(u, lang, t)}
            </p>
          ))}
          {r.primary && <ChannelCard channel={r.primary} primary />}
          {r.fallback && <ChannelCard channel={r.fallback} showInstructions={false} />}
        </div>
      )
    }
    case 'offer_next': {
      const r = f ? route(f, state.answers) : null
      return (
        <>
          <p>{t('assistant.offer_next')}</p>
          <div className="chips">
            <button className="chip" onClick={() => onOpenReport('recommend')}>
              {t('assistant.full_guidance')}
            </button>
            <button className="chip" onClick={() => onOpenReport('letter')}>
              {t('assistant.prepare_letter')}
            </button>
            {r?.primary?.href.startsWith('https://') && (
              <a className="chip" href={r.primary.href} target="_blank" rel="noopener noreferrer">
                {t('guidance:channel_action.online_portal')}
              </a>
            )}
            <button className="chip" onClick={() => dispatch({ type: 'quick_start', id: 'followup' })}>
              {t('assistant.quick.followup')}
            </button>
            <button className="chip" onClick={() => dispatch({ type: 'correct', field: 'category' })}>
              {t('report.change_category')}
            </button>
            <button className="chip" onClick={() => dispatch({ type: 'correct', field: 'location' })}>
              {t('assistant.change_location')}
            </button>
          </div>
        </>
      )
    }
    case 'scheme_query': {
      const q = turn.data?.query as string | undefined
      if (!q) return <p style={{ margin: 0 }}>{t('assistant.ask_scheme')}</p>
      return <SchemeAnswer question={q} lang={lang} gateway={gateway} aiAvailable={aiAvailable} />
    }
    case 'followup_help': {
      const r = f ? route(f, state.answers) : null
      return (
        <div className="stack">
          <p style={{ margin: 0 }}>{t('assistant.followup_intro')}</p>
          <ul className="list">
            {pick(ESCALATION.general_follow_up, lang).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          {r && r.escalation.length > 0 && (
            <>
              <strong lang="en">{r.authority.name}</strong>
              <ol className="list">
                {r.escalation.map((e) => (
                  <li key={e.channel.id}>{pick(e.text, lang)}</li>
                ))}
              </ol>
            </>
          )}
          <p className="hint" style={{ margin: 0 }}>
            {pick(ESCALATION.timeline_note, lang)}
          </p>
          <Link to="/my-complaints">{t('assistant.track_link')}</Link>
        </div>
      )
    }
    case 'letter_help':
      return (
        <>
          <p>{t('assistant.letter_help')}</p>
          {f ? (
            <button className="chip" onClick={() => onOpenReport('letter')}>
              {t('assistant.prepare_letter')}
            </button>
          ) : (
            <Link to="/letter">{t('assistant.open_letter')}</Link>
          )}
        </>
      )
    case 'correction':
      return <p style={{ margin: 0 }}>{t('assistant.correction', { category: categoryLabel(String(turn.data?.category), lang) })}</p>
    default:
      return null
  }
}
