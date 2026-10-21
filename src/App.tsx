import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Footer from './components/Footer.tsx'
import Header from './components/Header.tsx'
import { Status } from './components/ui.tsx'
import HomePage from './pages/HomePage.tsx'

// Pages that load the in-browser search model or PDF engine are split out and loaded on demand.
const ReportPage = lazy(() => import('./pages/ReportPage.tsx'))
const AssistantPage = lazy(() => import('./pages/AssistantPage.tsx'))
const SchemesPage = lazy(() => import('./pages/SchemesPage.tsx'))
const LetterPage = lazy(() => import('./pages/LetterPage.tsx'))
const MyComplaintsPage = lazy(() => import('./pages/MyComplaintsPage.tsx'))
const AboutPage = lazy(() => import('./pages/AboutPage.tsx'))
const OfficerPage = lazy(() => import('./pages/OfficerPage.tsx'))
const EvaluationPage = lazy(() => import('./pages/EvaluationPage.tsx'))

function NotFound() {
  const { t } = useTranslation()
  return <Status kind="empty">{t('common.not_found')}</Status>
}

export default function App() {
  const location = useLocation()
  const { t } = useTranslation()
  return (
    <>
      <Header />
      <main className="page" id="main" tabIndex={-1}>
        <div className="container">
          <Suspense fallback={<Status kind="loading">{t('common.loading_page')}</Status>}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                <Routes location={location}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/report" element={<ReportPage />} />
                  <Route path="/complaint" element={<Navigate to="/report" replace />} />
                  <Route path="/assistant" element={<AssistantPage />} />
                  <Route path="/schemes" element={<SchemesPage />} />
                  <Route path="/advisory" element={<Navigate to="/schemes" replace />} />
                  <Route path="/letter" element={<LetterPage />} />
                  <Route path="/my-complaints" element={<MyComplaintsPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/officer" element={<OfficerPage />} />
                  <Route path="/evaluation" element={<EvaluationPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  )
}
