import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/complaint', label: 'Complaint' },
  { to: '/advisory', label: 'Advisory' },
  { to: '/letter', label: 'Letter' },
  { to: '/officer', label: 'Officer' },
  { to: '/evaluation', label: 'Evaluation' },
]

export default function NavBar() {
  return (
    <nav className="nav">
      <span className="brand">CivicAssist</span>
      <ul>
        {LINKS.map((l) => (
          <li key={l.to}>
            <NavLink to={l.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
