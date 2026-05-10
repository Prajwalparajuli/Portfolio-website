import { lazy } from 'react'

const loadAdminProjects = () =>
  import('./Projects').then((module) => ({ default: module.AdminProjects }))

const loadAdminProjectForm = () =>
  import('./ProjectForm').then((module) => ({ default: module.AdminProjectForm }))

const loadAdminSkills = () =>
  import('./Skills').then((module) => ({ default: module.AdminSkills }))

const loadAdminSettings = () =>
  import('./Settings').then((module) => ({ default: module.AdminSettings }))

const loadAdminResumeEditor = () =>
  import('./ResumeEditor').then((module) => ({ default: module.AdminResumeEditor }))

const loadAdminResumePrintView = () =>
  import('../../components/admin/ResumePrintView').then((module) => ({ default: module.ResumePrintView }))

const loadAdminQuickTailor = () =>
  import('./QuickTailor').then((module) => ({ default: module.AdminQuickTailor }))

export const AdminProjectsRoute = lazy(loadAdminProjects)
export const AdminProjectFormRoute = lazy(loadAdminProjectForm)
export const AdminSkillsRoute = lazy(loadAdminSkills)
export const AdminSettingsRoute = lazy(loadAdminSettings)
export const AdminResumeEditorRoute = lazy(loadAdminResumeEditor)
export const AdminResumePrintViewRoute = lazy(loadAdminResumePrintView)
export const AdminQuickTailorRoute = lazy(loadAdminQuickTailor)

export function preloadAdminRoutes() {
  return Promise.allSettled([
    loadAdminProjects(),
    loadAdminProjectForm(),
    loadAdminSkills(),
    loadAdminSettings(),
    loadAdminResumeEditor(),
    loadAdminResumePrintView(),
    loadAdminQuickTailor(),
  ])
}
