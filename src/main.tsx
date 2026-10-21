import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/inter'
import '@fontsource/noto-sans-tamil/400.css'
import '@fontsource/noto-sans-tamil/600.css'
import '@fontsource/noto-sans-devanagari/400.css'
import '@fontsource/noto-sans-devanagari/600.css'
import './i18n.ts'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* "user" disables transform/layout animations for people who prefer reduced motion. */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)
