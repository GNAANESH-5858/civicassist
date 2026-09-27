import { Navigate, Route, Routes } from 'react-router-dom'
import DemoBanner from './components/DemoBanner.tsx'
import NavBar from './components/NavBar.tsx'
import AdvisoryPage from './pages/AdvisoryPage.tsx'
import ComplaintPage from './pages/ComplaintPage.tsx'
import EvaluationPage from './pages/EvaluationPage.tsx'
import LetterPage from './pages/LetterPage.tsx'
import OfficerPage from './pages/OfficerPage.tsx'

export default function App() {
  return (
    <>
      <DemoBanner />
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/complaint" replace />} />
          <Route path="/complaint" element={<ComplaintPage />} />
          <Route path="/advisory" element={<AdvisoryPage />} />
          <Route path="/letter" element={<LetterPage />} />
          <Route path="/officer" element={<OfficerPage />} />
          <Route path="/evaluation" element={<EvaluationPage />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  )
}
