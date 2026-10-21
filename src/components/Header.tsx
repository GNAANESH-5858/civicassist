import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { readJson, writeJson } from '../lib/browser/storage.ts'
import { IconClose, IconLogo, IconMenu, IconMoon, IconSun } from './icons.tsx'
import LanguageSelect from './LanguageSelect.tsx'

const LINKS = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/report', key: 'nav.report' },
  { to: '/assistant', key: 'nav.assistant' },
  { to: '/schemes', key: 'nav.schemes' },
  { to: '/my-complaints', key: 'nav.my_complaints' },
  { to: '/about', key: 'nav.about' },
]

type Theme = 'light' | 'dark'
const THEME_KEY = 'civicassist.theme'

export default function Header() {
  const { t } = useTranslation()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => readJson<Theme | null>(THEME_KEY, null) ?? 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => setOpen(false), [location.pathname])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    writeJson(THEME_KEY, next)
  }

  return (
    <header className="site-header">
      <a href="#main" className="skip-link">
        {t('nav.skip')}
      </a>
      <div className="container bar">
        <Link to="/" className="brand" aria-label={t('brand.home_label')}>
          <span className="brand-mark" aria-hidden>
            <IconLogo />
          </span>
          <span>
            <span className="brand-name">CivicAssist</span>
            <span className="brand-sub">{t('brand.tagline')}</span>
          </span>
        </Link>
        <nav aria-label={t('nav.label')} style={{ display: 'contents' }}>
          <ul className={`nav ${open ? 'open' : ''}`} id="main-nav">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  {t(l.key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="header-tools">
          <LanguageSelect />
          <button className="icon-btn" onClick={toggleTheme} aria-label={t(theme === 'dark' ? 'nav.light_theme' : 'nav.dark_theme')} title={t(theme === 'dark' ? 'nav.light_theme' : 'nav.dark_theme')}>
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button className="icon-btn menu-btn" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)} aria-label={t(open ? 'nav.close_menu' : 'nav.open_menu')}>
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>
    </header>
  )
}
