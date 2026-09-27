import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { readJson, writeJson } from '../lib/browser/storage.ts'
import { IconChart, IconFile, IconLogo, IconMail, IconMoon, IconSearch, IconSun, IconTable } from './icons.tsx'

const LINKS = [
  { to: '/complaint', label: 'Complaint', icon: <IconFile /> },
  { to: '/advisory', label: 'Advisory', icon: <IconSearch /> },
  { to: '/letter', label: 'Letter', icon: <IconMail /> },
  { to: '/officer', label: 'Officer', icon: <IconTable /> },
  { to: '/evaluation', label: 'Evaluation', icon: <IconChart /> },
]

type Theme = 'light' | 'dark'
const THEME_KEY = 'civicassist.theme'

function systemTheme(): Theme {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function NavBar() {
  const [theme, setTheme] = useState<Theme>(() => readJson<Theme | null>(THEME_KEY, null) ?? systemTheme())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    writeJson(THEME_KEY, next)
  }

  return (
    <header className="site-header">
      <div className="container">
        <Link to="/complaint" className="brand" aria-label="CivicAssist home">
          <span className="brand-mark">
            <IconLogo />
          </span>
          <span>
            <span className="brand-name">CivicAssist</span>
            <br />
            <span className="brand-sub">Grievance &amp; scheme assistant · Chennai</span>
          </span>
        </Link>
        <nav aria-label="Main" style={{ flex: 1, minWidth: 0 }}>
          <ul className="nav">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  {l.icon}
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button className="theme-toggle" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme">
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
      </div>
    </header>
  )
}
