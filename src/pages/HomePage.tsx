import { motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { IconArrow, IconBolt, IconBulb, IconChat, IconCheck, IconClose, IconDroplet, IconRoad, IconSearch, IconShield, IconSparkle, IconTrash, IconWaves, IconClock } from '../components/icons.tsx'
import { ComplaintInput, EASE, GradientText, Reveal, SectionHeading, Stagger, StaggerItem } from '../components/kit.tsx'
import { currentLang } from '../i18n.ts'
import { categoryLabel } from '../lib/civic/messages.ts'

// The demo runs the routing engine and letter composer, so it loads after the hero text.
const JourneyPreview = lazy(() => import('../components/home/JourneyPreview.tsx'))

/** Hero chips: each starts the real report flow with that category. "other" starts it without one. */
const CHIPS = ['roads', 'garbage', 'water_supply', 'drainage_flooding', 'streetlight', 'other'] as const

const ICONS: Record<string, ReactNode> = {
  roads: <IconRoad />,
  garbage: <IconTrash />,
  drainage_flooding: <IconWaves />,
  water_supply: <IconDroplet />,
  streetlight: <IconBulb />,
  sewage: <IconWaves />,
  electricity: <IconBolt />,
  traffic: <IconRoad />,
}
const SHORTCUTS = ['roads', 'garbage', 'drainage_flooding', 'water_supply', 'streetlight', 'sewage', 'electricity', 'traffic'] as const

export type ReportPrefill = { text?: string; category?: string | null }

export default function HomePage() {
  const { t } = useTranslation()
  const lang = currentLang()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [text, setText] = useState('')

  // Complaint text travels in router state, never in the URL.
  const start = (prefill: ReportPrefill) => navigate('/report', { state: { prefill } })
  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: EASE } })

  return (
    <>
      <section className="hero bleed" aria-labelledby="hero-title">
        <div className="hero-grid">
          <div>
            <motion.div className="eyebrow" {...rise(0)}>
              {t('home.eyebrow')}
            </motion.div>
            <motion.h1 id="hero-title" className="hero-title" {...rise(0.05)}>
              {t('home.headline_a')} <GradientText>{t('home.headline_b')}</GradientText>
            </motion.h1>
            <motion.p className="lead" {...rise(0.12)}>
              {t('home.lead')}
            </motion.p>
            <motion.div {...rise(0.2)}>
              <ComplaintInput
                id="home-issue"
                value={text}
                onChange={setText}
                onSubmit={() => start({ text: text.trim() })}
                label={t('home.input_label')}
                placeholder={t('home.input_placeholder')}
                hint={t('home.input_hint')}
                submitLabel={t('home.cta_primary')}
              />
              <div className="chips hero-chips" role="group" aria-label={t('home.chips_label')}>
                {CHIPS.map((id) => (
                  <button key={id} type="button" className="chip" onClick={() => start({ text: text.trim(), category: id === 'other' ? null : id })}>
                    {t(`home.chip.${id}`)}
                  </button>
                ))}
              </div>
              <div className="hero-links">
                <Link to="/schemes">
                  <IconSearch /> {t('home.cta_secondary')}
                </Link>
                <Link to="/assistant">
                  <IconChat /> {t('home.chat_instead')}
                </Link>
              </div>
              <p className="trust-line">
                <IconShield size={15} /> {t('home.trust')}
              </p>
            </motion.div>
          </div>
          <motion.div {...(reduce ? {} : { initial: { opacity: 0, y: 24, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.8, delay: 0.25, ease: EASE } })}>
            <Suspense fallback={<div className="journey-frame skeleton" style={{ minHeight: 440 }} aria-hidden />}>
              <JourneyPreview />
            </Suspense>
          </motion.div>
        </div>
      </section>

      <section className="section" aria-labelledby="how-title">
        <Reveal>
          <SectionHeading eyebrow={t('home.how_eyebrow')} title={t('home.how_title')}>
            {t('home.how_intro')}
          </SectionHeading>
        </Reveal>
        <Stagger as="ol" className="steps-row">
          {(['1', '2', '3', '4'] as const).map((n) => (
            <StaggerItem as="li" key={n}>
              <strong>{t(`home.how.${n}.title`)}</strong>
              <span>{t(`home.how.${n}.body`)}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="section" aria-labelledby="shortcuts-title">
        <Reveal>
          <SectionHeading eyebrow={t('home.shortcuts_eyebrow')} title={t('home.shortcuts_title')} />
        </Reveal>
        <Stagger className="shortcut-grid">
          {SHORTCUTS.map((id) => (
            <StaggerItem key={id}>
              <button type="button" className="shortcut" style={{ width: '100%', boxShadow: 'none' }} onClick={() => start({ category: id })}>
                <span className="ico" aria-hidden>
                  {ICONS[id]}
                </span>
                {categoryLabel(id, lang)}
                <IconArrow className="go" size={15} />
              </button>
            </StaggerItem>
          ))}
          <StaggerItem>
            <Link to="/schemes" className="shortcut">
              <span className="ico" aria-hidden>
                <IconSparkle />
              </span>
              {t('home.shortcut_schemes')}
              <IconArrow className="go" size={15} />
            </Link>
          </StaggerItem>
          <StaggerItem>
            <Link to="/my-complaints" className="shortcut">
              <span className="ico" aria-hidden>
                <IconClock />
              </span>
              {t('home.shortcut_followup')}
              <IconArrow className="go" size={15} />
            </Link>
          </StaggerItem>
        </Stagger>
      </section>

      <section className="section split">
        <Reveal className="notice">
          <h2>
            <IconShield /> {t('home.independent_title')}
          </h2>
          <p style={{ margin: 0 }}>{t('home.independent_body')}</p>
          <p style={{ margin: '12px 0 0' }}>
            <Link to="/about">{t('nav.about')}</Link>
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 style={{ fontSize: '1rem' }}>{t('home.what_title')}</h2>
          <ul className="check-list">
            <li>
              <IconCheck /> {t('home.what.1')}
            </li>
            <li>
              <IconCheck /> {t('home.what.2')}
            </li>
            <li className="no">
              <IconClose /> {t('home.what.3')}
            </li>
            <li>
              <IconCheck /> {t('home.what.4')}
            </li>
          </ul>
        </Reveal>
      </section>
    </>
  )
}
