import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import ChannelCard from '../components/civic/ChannelCard.tsx'
import { CategoryPicker, QuestionField } from '../components/civic/QuestionField.tsx'
import { SafetyPanel } from '../components/civic/Recommendation.tsx'
import { IconLogo, IconRefresh, IconSend } from '../components/icons.tsx'
import { AutoTextarea, TypingIndicator } from '../components/kit.tsx'
import { nextQuestions } from '../lib/civic/questions.ts'
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
      <div className="chat-shell">
        <section className="card chat" aria-label={t('assistant.title')}>
          <div className="chat-head">
            <span className="avatar" aria-hidden>
              <IconLogo size={16} />
            </span>
            <div>
              <div className="who">{t('assistant.guide_label')}</div>
              <div className="sub">{t('assistant.guide_sub')}</div>
            </div>
            <span className="spacer" />
            <button className="btn-ghost" onClick={() => dispatch({ type: 'restart' })}>
              <IconRefresh /> {t('assistant.restart')}
            </button>
          </div>
          <div className="chat-log" ref={logRef} aria-live="polite">
            <AnimatePresence initial={false}>
              {state.turns.map((turn, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }} className={`msg ${turn.role}`}>
                  {turn.role === 'user' ? (
                    turn.text
                  ) : (
                    <>
                      <span className="avatar sm" aria-hidden>
                        <IconLogo size={13} />
                      </span>
                      <div className="bubble">
                        <BotTurn turn={turn} state={state} active={i === lastPendingIndex} dispatch={dispatch} onOpenReport={openReport} gateway={gateway} aiAvailable={aiAvailable} />
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {thinking && (
              <div className="msg bot">
                <span className="avatar sm" aria-hidden>
                  <IconLogo size={13} />
                </span>
                <TypingIndicator label={t('assistant.thinking')} />
              </div>
            )}
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
            <AutoTextarea
              id="chat-text"
              value={input}
              maxLength={2000}
              placeholder={t('assistant.input_placeholder')}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <button type="submit" disabled={!input.trim() || thinking} aria-label={t('assistant.send')}>
              <IconSend />
            </button>
          </form>
        </section>
        <aside className="chat-side stack">
          <div className="card subtle">
            <h2>{t('assistant.side_title')}</h2>
            <div className="stack" style={{ gap: 8 }}>
              {[t('home.demo.example'), ...((t('schemes.examples', { returnObjects: true }) as string[]) ?? []).slice(0, 2)].map((q) => (
                <button key={q} type="button" className="chip" style={{ textAlign: 'left', justifyContent: 'flex-start', borderRadius: 12, padding: '10px 12px' }} onClick={() => setInput(q)}>
                  {q}
                </button>
              ))}
            </div>
            <p className="hint" style={{ margin: '14px 0 0' }}>
              {t('assistant.side_note')}
            </p>
          </div>
          <Link to="/report" className="btn btn-secondary">
            {t('assistant.use_form')}
          </Link>
        </aside>
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
      const missing = nextQuestions(f, state.answers, 3).map((q) => t(`guidance:question.${q.id}.short`))
      return (
        <div>
          <div className="guide-section">
            <h4>{t('assistant.sec_understanding')}</h4>
            <p style={{ margin: 0 }}>
              {t('assistant.understood', { category: categoryLabel(f.category, lang) })}
              {f.locality && ` ${t('assistant.understood_place', { place: f.locality.name })}`}
            </p>
          </div>
          <div className="guide-section accent">
            <h4>{t('assistant.sec_authority')}</h4>
            <strong lang="en" style={{ color: 'var(--text)' }}>
              {r.authority.name}
            </strong>
            {r.department && (
              <span className="hint" lang="en">
                {' '}
                · {r.department}
              </span>
            )}
            <p className="hint" style={{ margin: '4px 0 0' }}>
              {renderMessage(r.reasons[0], lang, t)}
            </p>
            {r.uncertainties.slice(0, 2).map((u, i) => (
              <p key={i} className="hint" style={{ margin: '4px 0 0' }}>
                {renderMessage(u, lang, t)}
              </p>
            ))}
          </div>
          {missing.length > 0 && (
            <div className="guide-section">
              <h4>{t('assistant.sec_missing')}</h4>
              <p style={{ margin: 0 }}>{missing.join(', ')}</p>
            </div>
          )}
          <div className="guide-section">
            <h4>{t('assistant.sec_links')}</h4>
            <div className="stack" style={{ gap: 10 }}>
              {r.primary && <ChannelCard channel={r.primary} primary />}
              {r.fallback && <ChannelCard channel={r.fallback} showInstructions={false} />}
              {!r.primary && <p style={{ margin: 0 }}>{t('guidance:uncertain.no_channel', { authority: r.authority.name })}</p>}
            </div>
          </div>
        </div>
      )
    }
    case 'offer_next': {
      const r = f ? route(f, state.answers) : null
      return (
        <>
          <p>{t('assistant.offer_next')}</p>
          <div className="actions" style={{ marginTop: 0, marginBottom: 10 }}>
            <button onClick={() => onOpenReport('letter')}>{t('assistant.prepare_my_letter')}</button>
            <button className="btn-secondary" onClick={() => onOpenReport('recommend')}>
              {t('assistant.full_guidance')}
            </button>
          </div>
          <div className="chips">
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
            <button onClick={() => onOpenReport('letter')}>{t('assistant.prepare_my_letter')}</button>
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
