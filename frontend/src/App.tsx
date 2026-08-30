import { Route, Routes } from 'react-router-dom'
import ProjectListPage from './pages/ProjectListPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ApplicationRegistryPage from './pages/ApplicationRegistryPage'
import GuidePage from './pages/GuidePage'
import DepotLayout from './pages/DepotLayout'

export default function App() {
  return (
    <Routes>
      {/* DepotLayout owns the persistent chat pane across every operational route. The Guide
          page sits outside it deliberately — a one-time explainer, not a working session. */}
      <Route element={<DepotLayout />}>
        <Route path="/" element={<ProjectListPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/applications" element={<ApplicationRegistryPage />} />
      </Route>
      <Route path="/guide" element={<GuidePage />} />
    </Routes>
  )
}
