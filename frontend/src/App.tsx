import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import LaunchpadPage from './pages/LaunchpadPage'
import ProjectListPage from './pages/ProjectListPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ApplicationRegistryPage from './pages/ApplicationRegistryPage'
import ApplicationDetailPage from './pages/ApplicationDetailPage'
import AdminPage from './pages/AdminPage'
import SplashPage from './pages/SplashPage'
import TheoryOfOperationsPage from './pages/TheoryOfOperationsPage'
import DepotLayout from './pages/DepotLayout'

export default function App() {
  return (
    <Routes>
      {/* DepotLayout owns the persistent chat pane across every operational route. The splash
          page sits outside it deliberately — a one-time explainer, not a working session. */}
      <Route element={<DepotLayout />}>
        {/* The Depot is a shell now, not just the catalog — Launchpad is the landing page;
            the catalog moved to /catalog (see ApplicationRegistryPage's own history) and the
            project list moved to /projects, both now reached from inside Launchpad rather
            than being top-level nav destinations on their own. */}
        <Route path="/" element={<LaunchpadPage />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/catalog" element={<ApplicationRegistryPage />} />
        <Route path="/catalog/:applicationId" element={<ApplicationDetailPage />} />
        {/* Old paths, kept working rather than left as dead links. */}
        <Route path="/applications" element={<Navigate to="/catalog" replace />} />
        <Route path="/applications/:applicationId" element={<OldApplicationRedirect />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="/about" element={<SplashPage />} />
      <Route path="/theory-of-operations" element={<TheoryOfOperationsPage />} />
    </Routes>
  )
}

function OldApplicationRedirect() {
  const { applicationId } = useParams<{ applicationId: string }>()
  return <Navigate to={`/catalog/${applicationId}`} replace />
}
