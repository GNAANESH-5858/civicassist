// Product demonstration for the home page. Every value shown is computed by the real engine
// (frame, routing, questions, letter composer) from a fixed example sentence, and the panel is
// labelled as an example. Nothing here is a real complaint, and nothing is submitted.
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLang } from '../../i18n.ts'
import { pick } from '../../lib/civic/data.ts'
import { buildFrame } from '../../lib/civic/frame.ts'
import { categoryLabel, renderMessage } from '../../lib/civic/messages.ts'
import { nextQuestions } from '../../lib/civic/questions.ts'
import { route } from '../../lib/civic/routing.ts'
import { composeLetter } from '../../lib/letter/compose.ts'
import { IconBuilding, IconCheck, IconClock, IconExternal, IconFile, IconInfo, IconPin, IconSparkle } from '../icons.tsx'
import { EASE } from '../kit.tsx'
import { VerificationBadge } from '../ui.tsx'

const STAGES = ['describe', 'understand', 'authority', 'prepare', 'submit'] as const
type Stage = (typeof STAGES)[number]
const STAGE_MS = 4200

export default function JourneyPreview() {
  const { t } = useTranslation()
  const lang = currentLang()
  const reduce = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const inView = useInView(root, { amount: 0.4 })
  const [stage, setStage] = useState<Stage>('describe')
  const [auto, setAuto] = useState(true)
  const [paused, setPaused] = useState(false)
  const playing = auto && !reduce && inView && !paused

  const example = t('home.demo.example')
  const demo = useMemo(() => {
    const frame = buildFrame(example)
    const routing = route(frame)
    const missing = nextQuestions(frame, {}, 3).map((q) => t(`guidance:question.${q.id}.short`))
    const letter = composeLetter({ language: lang, date: new Date(), authority: routing.authority.id, department: routing.department, category: routing.category, location: frame.locality?.name ?? '', description: frame.text, since: frame.duration })
    return { frame, routing, missing, letter }
  }, [example, lang, t])

  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => setStage((s) => STAGES[(STAGES.indexOf(s) + 1) % STAGES.length]), STAGE_MS)
    return () => window.clearTimeout(id)
  }, [playing, stage])

  function choose(s: Stage) {
    setAuto(false)
    setStage(s)
  }
  function onKey(e: KeyboardEvent) {
    const i = STAGES.indexOf(stage)
    if (e.key === 'ArrowRight') choose(STAGES[(i + 1) % STAGES.length])
    else if (e.key === 'ArrowLeft') choose(STAGES[(i + STAGES.length - 1) % STAGES.length])
    else return
    e.preventDefault()
    document.getElementById(`journey-tab-${STAGES[(i + (e.key === 'ArrowRight' ? 1 : STAGES.length - 1)) % STAGES.length]}`)?.focus()
  }

  const { frame, routing, missing, letter } = demo
  const duration = frame.duration ? t('report.duration_value', { value: frame.duration.value, unit: t(`common.unit.${frame.duration.unit}`, { count: frame.duration.value }) }) : t('common.not_given')

  return (
    <div className="journey" ref={root} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="journey-frame">
        <div className="journey-top">
          <div className="journey-dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <span className="badge badge-outline">
            <IconInfo size={12} /> {t('home.demo.badge')}
          </span>
        </div>
        <ul className="journey-tabs" role="tablist" aria-label={t('home.demo.label')} onKeyDown={onKey}>
          {STAGES.map((s, i) => (
            <li key={s} role="presentation">
              <button
                id={`journey-tab-${s}`}
                role="tab"
                type="button"
                className="journey-tab"
                aria-selected={stage === s}
                aria-controls="journey-panel"
                tabIndex={stage === s ? 0 : -1}
                onClick={() => choose(s)}
              >
                <span className="n">{i + 1}</span>
                <span className="label">{t(`home.demo.stage.${s}`)}</span>
                <span className="bar" aria-hidden>
                  {stage === s && <motion.i key={`${s}-${playing}`} initial={{ scaleX: playing ? 0 : 1 }} animate={{ scaleX: 1 }} transition={{ duration: playing ? STAGE_MS / 1000 : 0, ease: 'linear' }} />}
                  {STAGES.indexOf(stage) > i && <i style={{ transform: 'scaleX(1)' }} />}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="journey-body" id="journey-panel" role="tabpanel" aria-labelledby={`journey-tab-${stage}`} aria-live={auto ? 'off' : 'polite'}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={stage + lang} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE }}>
              {stage === 'describe' && (
                <>
                  <div className="journey-kicker">{t('home.demo.k_describe')}</div>
                  <p className="journey-quote" lang={lang}>
                    “{example}”
                  </p>
                  <p className="hint" style={{ marginTop: 12 }}>
                    {t('home.demo.describe_note')}
                  </p>
                </>
              )}
              {stage === 'understand' && (
                <>
                  <div className="journey-kicker">{t('home.demo.k_understand')}</div>
                  <Row icon={<IconSparkle />} label={t('report.category')} value={categoryLabel(frame.category, lang)} />
                  <Row icon={<IconPin />} tone="cyan" label={t('report.location')} value={frame.locality?.name ?? t('common.not_given')} />
                  <Row icon={<IconClock />} tone="violet" label={t('report.duration')} value={duration} />
                  {missing.length > 0 && <Row icon={<IconInfo />} tone="violet" label={t('home.demo.still_needed')} value={missing.join(', ')} />}
                </>
              )}
              {stage === 'authority' && (
                <>
                  <div className="journey-kicker">{t('home.demo.k_authority')}</div>
                  <Row icon={<IconBuilding />} label={t('report.likely_authority')} value={<span lang="en">{routing.authority.name}</span>} />
                  {routing.department && <Row icon={<IconFile />} tone="cyan" label={t('report.department')} value={<span lang="en">{routing.department}</span>} />}
                  <p className="hint" style={{ margin: '10px 0 6px' }}>
                    {renderMessage(routing.reasons[0], lang, t)}
                  </p>
                  {routing.primary && <VerificationBadge status={routing.primary.status} source={routing.primary.source} />}
                </>
              )}
              {stage === 'prepare' && (
                <>
                  <div className="journey-kicker">{t('home.demo.k_prepare')}</div>
                  <div className="journey-doc" lang={lang} aria-label={t('letter.preview')}>
                    {letter.text.split('\n').slice(0, 14).join('\n')}
                  </div>
                </>
              )}
              {stage === 'submit' && routing.primary && (
                <>
                  <div className="journey-kicker">{t('home.demo.k_submit')}</div>
                  <Row icon={<IconExternal />} label={t(`guidance:channel_kind.${routing.primary.kind}`)} value={pick(routing.primary.label, lang)} />
                  <div style={{ margin: '14px 0 12px' }}>
                    <span className="journey-fake-btn" aria-hidden>
                      {t('guidance:channel_action.online_portal')} <IconExternal size={14} />
                    </span>
                  </div>
                  <p className="hint" style={{ display: 'flex', gap: 8, margin: 0 }}>
                    <IconCheck /> {t('home.demo.submit_note')}
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="journey-foot">
          <span>{t('home.demo.foot')}</span>
          {!reduce && (
            <button type="button" className="btn-ghost" style={{ minHeight: 30, padding: '4px 8px', fontSize: '0.78rem' }} onClick={() => setAuto(!auto)}>
              {auto ? t('home.demo.pause') : t('home.demo.play')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: 'cyan' | 'violet' }) {
  return (
    <div className="journey-row">
      <span className={`journey-ico ${tone ?? ''}`} aria-hidden>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="journey-label">{label}</div>
        <div className="journey-value">{value}</div>
      </div>
    </div>
  )
}
