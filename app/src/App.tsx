import { Routes, Route, Navigate } from 'react-router-dom'
import { PublicLayout } from './app/PublicLayout'
import { AdminLayout } from './app/AdminLayout'
import { HomePage } from './app/pages/HomePage'
import { ProjectPage } from './app/pages/ProjectPage'
import { ResumePage } from './app/pages/ResumePage'
import { RecruiterPacketPage } from './app/pages/RecruiterPacketPage'
import { AuthProvider } from './components/auth/AuthProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { getAdminPath } from './lib/adminConfig'
import {
  AdminActivityRoute,
  AdminAnswerBankRoute,
  AdminApplicationsRoute,
  AdminContactsRoute,
  AdminDashboardRoute,
  AdminInboxRoute,
  AdminJobsRoute,
  AdminProjectFormRoute,
  AdminProjectsRoute,
  AdminResumeEditorRoute,
  AdminResumePrintViewRoute,
  AdminSettingsRoute,
  AdminSkillsRoute,
  AdminWatchlistsRoute,
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
            <Route path="resume" element={<ResumePage />} />
            <Route path="packet/:token" element={<RecruiterPacketPage />} />
          </Route>

          {/* Admin Routes - path from VITE_ADMIN_PATH (default: /admin) */}
          <Route path={`${adminBase}/resume/print`} element={<AdminResumePrintViewRoute />} />
          <Route path={adminBase} element={<AdminLayout />}>
            <Route index element={<Navigate to="jobs" replace />} />
            <Route path="today" element={<AdminDashboardRoute />} />
            <Route path="projects" element={<AdminProjectsRoute />} />
            <Route path="projects/new" element={<AdminProjectFormRoute />} />
            <Route path="projects/:id/edit" element={<AdminProjectFormRoute />} />
            <Route path="skills" element={<AdminSkillsRoute />} />
            <Route path="settings" element={<AdminSettingsRoute />} />
            <Route path="activity" element={<AdminActivityRoute />} />
            <Route path="jobs" element={<AdminJobsRoute />} />
            <Route path="watchlists" element={<AdminWatchlistsRoute />} />
            <Route path="contacts" element={<AdminContactsRoute />} />
            <Route path="applications" element={<AdminApplicationsRoute />} />
            <Route path="answers" element={<AdminAnswerBankRoute />} />
            <Route path="inbox" element={<AdminInboxRoute />} />
            <Route path="resume" element={<AdminResumeEditorRoute />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
