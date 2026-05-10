import { Routes, Route, Navigate } from 'react-router-dom'
import { PublicLayout } from './app/PublicLayout'
import { AdminLayout } from './app/AdminLayout'
import { HomePage } from './app/pages/HomePage'
import { ProjectPage } from './app/pages/ProjectPage'
import { AllProjectsPage } from './app/pages/AllProjectsPage'
import { ResumePage } from './app/pages/ResumePage'
import { RecruiterPacketPage } from './app/pages/RecruiterPacketPage'
import { AuthProvider } from './components/auth/AuthProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { getAdminPath } from './lib/adminConfig'
import {
  AdminProjectFormRoute,
  AdminProjectsRoute,
  AdminQuickTailorRoute,
  AdminResumeEditorRoute,
  AdminResumePrintViewRoute,
  AdminSettingsRoute,
  AdminSkillsRoute,
  AdminTrackerRoute,
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
            <Route path="projects" element={<AllProjectsPage />} />
            <Route path="projects/:slug" element={<ProjectPage />} />
            <Route path="resume" element={<ResumePage />} />
            <Route path="packet/:token" element={<RecruiterPacketPage />} />
          </Route>

          {/* Admin Routes */}
          <Route path={`${adminBase}/resume/print`} element={<AdminResumePrintViewRoute />} />
          <Route path={adminBase} element={<AdminLayout />}>
            <Route index element={<Navigate to="resume" replace />} />
            <Route path="resume" element={<AdminResumeEditorRoute />} />
            <Route path="tailor" element={<AdminQuickTailorRoute />} />
            <Route path="tracker" element={<AdminTrackerRoute />} />
            <Route path="projects" element={<AdminProjectsRoute />} />
            <Route path="projects/new" element={<AdminProjectFormRoute />} />
            <Route path="projects/:id/edit" element={<AdminProjectFormRoute />} />
            <Route path="skills" element={<AdminSkillsRoute />} />
            <Route path="settings" element={<AdminSettingsRoute />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
