import { Routes, Route } from 'react-router-dom'
import { PublicLayout } from './app/PublicLayout'
import { AdminLayout } from './app/AdminLayout'
import { HomePage } from './app/pages/HomePage'
import { ProjectPage } from './app/pages/ProjectPage'
import { StatsPage } from './app/pages/StatsPage'
import { AuthProvider } from './components/auth/AuthProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { getAdminPath } from './lib/adminConfig'
import {
  AdminActivityRoute,
  AdminApplicationsRoute,
  AdminDashboardRoute,
  AdminJobsRoute,
  AdminProjectFormRoute,
  AdminProjectsRoute,
  AdminResumeEditorRoute,
  AdminResumePrintViewRoute,
  AdminSettingsRoute,
  AdminSkillsRoute,
} from './app/admin/routes'
import './App.css'

const adminBase = getAdminPath()

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="projects/:slug" element={<ProjectPage />} />
            <Route path="stats" element={<StatsPage />} />
          </Route>

          {/* Admin Routes - path from VITE_ADMIN_PATH (default: /admin) */}
          <Route path={adminBase} element={<AdminLayout />}>
            <Route index element={<AdminDashboardRoute />} />
            <Route path="projects" element={<AdminProjectsRoute />} />
            <Route path="projects/new" element={<AdminProjectFormRoute />} />
            <Route path="projects/:id/edit" element={<AdminProjectFormRoute />} />
            <Route path="skills" element={<AdminSkillsRoute />} />
            <Route path="settings" element={<AdminSettingsRoute />} />
            <Route path="activity" element={<AdminActivityRoute />} />
            <Route path="jobs" element={<AdminJobsRoute />} />
            <Route path="applications" element={<AdminApplicationsRoute />} />
            <Route path="resume/print" element={<AdminResumePrintViewRoute />} />
            <Route path="resume" element={<AdminResumeEditorRoute />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
