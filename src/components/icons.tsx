// Small inline icons (stroke = currentColor) so the UI needs no icon library.
type P = { size?: number }
const base = (size = 16) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true })

export const IconLogo = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
  </svg>
)
export const IconFile = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
)
export const IconSearch = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)
export const IconMail = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
)
export const IconTable = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M9 4v16" />
  </svg>
)
export const IconChart = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)
export const IconShield = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
export const IconLink = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </svg>
)
export const IconInfo = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
)
export const IconCheck = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="m5 12 5 5 9-10" />
  </svg>
)
export const IconAlert = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M12 3 2 20h20zM12 10v4M12 17h.01" />
  </svg>
)
export const IconChevron = ({ size }: P) => (
  <svg {...base(size)} className="chev">
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const IconSun = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
export const IconMoon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
  </svg>
)
export const IconDownload = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
)
export const IconMenu = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)
export const IconClose = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const IconChat = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </svg>
)
export const IconPhone = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
)
export const IconExternal = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </svg>
)
export const IconCopy = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a1 1 0 0 1 1-1h10" />
  </svg>
)
export const IconGlobe = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
)
export const IconSave = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 3v5h7V3M7 21v-7h10v7" />
  </svg>
)
