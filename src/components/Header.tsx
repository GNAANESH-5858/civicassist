import { motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { readJson, writeJson } from '../lib/browser/storage.ts'
import { IconArrow, IconClose, IconLogo, IconMenu, IconMoon, IconSun } from './icons.tsx'
import LanguageSelect from './LanguageSelect.tsx'

const LINKS = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/report', key: 'nav.report' },
  { to: '/assistant', key: 'nav.assistant' },
  { to: '/schemes', key: 'nav.schemes' },
  { to: '/my-complaints', key: 'nav.my_complaints' },
]

type Theme = 'light' | 'dark'
const THEME_KEY = 'civicassist.theme'

export default function Header() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => readJson<Theme | null>(THEME_KEY, null) ?? 'light')
  const [openedAt, setOpenedAt] = useState(location.pathname)

  // Close the mobile menu when the route changes (derived during render, no effect needed).
  if (openedAt !== location.pathname) {
    setOpenedAt(location.pathname)
    if (open) setOpen(false)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Collapse the links into the menu whenever they do not fit. The full width is measured with the
  // links laid out (it changes with the language), then compared with the space available.
  const bar = useRef<HTMLDivElement>(null)
  const needed = useRef(0)
  const [compact, setCompact] = useState(false)
  const [measuredFor, setMeasuredFor] = useState<string | null>(null)
  if (measuredFor !== null && measuredFor !== i18n.language) {
    setMeasuredFor(null)
    setCompact(false)
  }
  useLayoutEffect(() => {
    const el = bar.current
    if (!el) return
    if (measuredFor === null) {
      // Natural width of logo + links + tools, plus the gaps and side padding of the bar.
      const css = getComputedStyle(el)
      const parts = [el.querySelector('.brand'), el.querySelector('.nav'), el.querySelector('.header-tools')] as HTMLElement[]
      needed.current = parts.reduce((w, p) => w + (p?.offsetWidth ?? 0), 0) + 2 * parseFloat(css.columnGap || '0') + parseFloat(css.paddingLeft) + parseFloat(css.paddingRight)
      setMeasuredFor(i18n.language)
      setCompact(needed.current > Math.min(el.clientWidth, document.documentElement.clientWidth) + 1)
    }
    // documentElement.clientWidth is the real viewport even when a phone browser widens the layout to fit overflow.
    const check = () => setCompact(needed.current > Math.min(el.clientWidth, document.documentElement.clientWidth) + 1)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    window.addEventListener('resize', check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [measuredFor, i18n.language])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    writeJson(THEME_KEY, next)
  }

  return (
    <header className={`site-header ${scrolled || open ? 'scrolled' : ''} ${compact ? 'compact' : ''}`}>
      <a href="#main" className="skip-link">
        {t('nav.skip')}
      </a>
      <div className="container bar" ref={bar}>
        <Link to="/" className="brand" aria-label={t('brand.home_label')}>
          <span className="brand-mark" aria-hidden>
            <IconLogo size={18} />
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
                  {({ isActive }) => (
                    <>
                      {isActive && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                      {t(l.key)}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
            <li className="mobile-cta">
              <Link to="/report" className="btn">
                {t('nav.cta')}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="header-tools">
          <LanguageSelect />
          <button className="icon-btn" onClick={toggleTheme} aria-label={t(theme === 'dark' ? 'nav.light_theme' : 'nav.dark_theme')} title={t(theme === 'dark' ? 'nav.light_theme' : 'nav.dark_theme')}>
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <Link to="/report" className="btn header-cta">
            {t('nav.cta')} <IconArrow className="arrow" size={15} />
          </Link>
          <button className="icon-btn menu-btn" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)} aria-label={t(open ? 'nav.close_menu' : 'nav.open_menu')}>
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>
    </header>
  )
}
