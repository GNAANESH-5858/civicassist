import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DemoBanner from './components/DemoBanner.tsx'
import NavBar from './components/NavBar.tsx'
import { Status } from './components/ui.tsx'
import ComplaintPage from './pages/ComplaintPage.tsx'

// Advisory and Letter pull in the in-browser embedding model; load them only when visited.
const AdvisoryPage = lazy(() => import('./pages/AdvisoryPage.tsx'))
const LetterPage = lazy(() => import('./pages/LetterPage.tsx'))
const OfficerPage = lazy(() => import('./pages/OfficerPage.tsx'))
const EvaluationPage = lazy(() => import('./pages/EvaluationPage.tsx'))

export default function App() {
  return (
    <>
      <DemoBanner />
      <NavBar />
      <main className="container">
        <Suspense fallback={<Status kind="loading">Loading page…</Status>}>
          <Routes>
            <Route path="/" element={<Navigate to="/complaint" replace />} />
            <Route path="/complaint" element={<ComplaintPage />} />
            <Route path="/advisory" element={<AdvisoryPage />} />
            <Route path="/letter" element={<LetterPage />} />
            <Route path="/officer" element={<OfficerPage />} />
            <Route path="/evaluation" element={<EvaluationPage />} />
            <Route path="*" element={<p>Page not found.</p>} />
          </Routes>
        </Suspense>
      </main>
    </>
  )
}
