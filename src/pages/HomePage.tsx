import { motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { IconChat, IconFile, IconSearch, IconShield } from '../components/icons.tsx'
import { currentLang } from '../i18n.ts'
import { categoryLabel } from '../lib/civic/messages.ts'

const SHORTCUTS = ['roads', 'garbage', 'drainage_flooding', 'water_supply', 'streetlight', 'sewage', 'electricity', 'traffic'] as const

export default function HomePage() {
  const { t } = useTranslation()
  const lang = currentLang()
  const navigate = useNavigate()
  const [text, setText] = useState('')

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">{t('home.eyebrow')}</div>
          <h1>{t('home.headline')}</h1>
          <p className="lead">{t('home.lead')}</p>
          <div className="actions">
            <Link to="/report" className="btn">
              <IconFile /> {t('home.cta_primary')}
            </Link>
            <Link to="/schemes" className="btn btn-secondary">
              <IconSearch /> {t('home.cta_secondary')}
            </Link>
          </div>
        </div>
        <motion.form
          className="card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) navigate(`/report?text=${encodeURIComponent(text.trim())}`)
          }}
        >
          <label htmlFor="home-issue" className="field-label">
            {t('home.input_label')}
          </label>
          <textarea id="home-issue" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('home.input_placeholder')} maxLength={2000} />
          <p className="hint">{t('home.input_hint')}</p>
          <div className="actions">
            <button type="submit" disabled={text.trim().length < 5}>
              {t('home.input_submit')}
            </button>
            <Link to="/assistant" className="btn btn-ghost">
              <IconChat /> {t('home.chat_instead')}
            </Link>
          </div>
        </motion.form>
      </section>

      <section className="section">
        <h2>{t('home.shortcuts_title')}</h2>
        <div className="shortcut-grid">
          {SHORTCUTS.map((id) => (
            <Link key={id} to={`/report?category=${id}`} className="shortcut">
              {categoryLabel(id, lang)}
            </Link>
          ))}
          <Link to="/schemes" className="shortcut">
            {t('home.shortcut_schemes')}
          </Link>
          <Link to="/my-complaints" className="shortcut">
            {t('home.shortcut_followup')}
          </Link>
        </div>
      </section>

      <section className="section">
        <h2>{t('home.how_title')}</h2>
        <ol className="steps-row">
          {(['1', '2', '3', '4'] as const).map((n) => (
            <li key={n}>
              <strong>{t(`home.how.${n}.title`)}</strong>
              <span>{t(`home.how.${n}.body`)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="section grid-2">
        <div className="notice">
          <h2>
            <IconShield /> {t('home.independent_title')}
          </h2>
          <p style={{ margin: 0 }}>{t('home.independent_body')}</p>
        </div>
        <div className="card subtle">
          <h2>{t('home.what_title')}</h2>
          <ul className="list">
            <li>{t('home.what.1')}</li>
            <li>{t('home.what.2')}</li>
            <li>{t('home.what.3')}</li>
            <li>{t('home.what.4')}</li>
          </ul>
        </div>
      </section>
    </>
  )
}
