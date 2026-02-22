import { Routes, Route } from 'react-router-dom'
import { PublicLayout } from './app/PublicLayout'
import { AdminLayout } from './app/AdminLayout'
import { HomePage } from './app/pages/HomePage'
import { ProjectPage } from './app/pages/ProjectPage'
import { StatsPage } from './app/pages/StatsPage'
import { AdminDashboard } from './app/admin/Dashboard'
import { AdminProjects } from './app/admin/Projects'
import { AdminProjectForm } from './app/admin/ProjectForm'
import { AdminSkills } from './app/admin/Skills'
import { AdminSettings } from './app/admin/Settings'
import { AdminActivity } from './app/admin/Activity'
import { AdminResumeEditor } from './app/admin/ResumeEditor'
import { AuthProvider } from './components/auth/AuthProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { getAdminPath } from './lib/adminConfig'
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
          <Route index element={<AdminDashboard />} />
          <Route path="projects" element={<AdminProjects />} />
          <Route path="projects/new" element={<AdminProjectForm />} />
          <Route path="projects/:id/edit" element={<AdminProjectForm />} />
          <Route path="skills" element={<AdminSkills />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route path="resume" element={<AdminResumeEditor />} />
        </Route>
      </Routes>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
