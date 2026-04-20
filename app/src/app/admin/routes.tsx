import { lazy } from 'react'

const loadAdminDashboard = () =>
  import('./Dashboard').then((module) => ({ default: module.AdminDashboard }))

const loadAdminProjects = () =>
  import('./Projects').then((module) => ({ default: module.AdminProjects }))

const loadAdminProjectForm = () =>
  import('./ProjectForm').then((module) => ({ default: module.AdminProjectForm }))

const loadAdminSkills = () =>
  import('./Skills').then((module) => ({ default: module.AdminSkills }))

const loadAdminSettings = () =>
  import('./Settings').then((module) => ({ default: module.AdminSettings }))

const loadAdminActivity = () =>
  import('./Activity').then((module) => ({ default: module.AdminActivity }))

const loadAdminResumeEditor = () =>
  import('./ResumeEditor').then((module) => ({ default: module.AdminResumeEditor }))

const loadAdminResumePrintView = () =>
  import('../../components/admin/ResumePrintView').then((module) => ({ default: module.ResumePrintView }))

const loadAdminJobs = () =>
  import('./Jobs').then((module) => ({ default: module.AdminJobs }))

const loadAdminApplications = () =>
  import('./Applications').then((module) => ({ default: module.AdminApplications }))

const loadAdminInbox = () =>
  import('./Inbox').then((module) => ({ default: module.AdminInbox }))

const loadAdminAnswerBank = () =>
  import('./AnswerBank').then((module) => ({ default: module.AdminAnswerBank }))

const loadAdminWatchlists = () =>
  import('./Watchlists').then((module) => ({ default: module.AdminWatchlists }))

export const AdminDashboardRoute = lazy(loadAdminDashboard)
export const AdminProjectsRoute = lazy(loadAdminProjects)
export const AdminProjectFormRoute = lazy(loadAdminProjectForm)
export const AdminSkillsRoute = lazy(loadAdminSkills)
export const AdminSettingsRoute = lazy(loadAdminSettings)
export const AdminActivityRoute = lazy(loadAdminActivity)
export const AdminResumeEditorRoute = lazy(loadAdminResumeEditor)
export const AdminResumePrintViewRoute = lazy(loadAdminResumePrintView)
export const AdminJobsRoute = lazy(loadAdminJobs)
export const AdminApplicationsRoute = lazy(loadAdminApplications)
export const AdminInboxRoute = lazy(loadAdminInbox)
export const AdminAnswerBankRoute = lazy(loadAdminAnswerBank)
export const AdminWatchlistsRoute = lazy(loadAdminWatchlists)

export function preloadAdminRoutes() {
  return Promise.allSettled([
    loadAdminDashboard(),
    loadAdminProjects(),
    loadAdminProjectForm(),
    loadAdminSkills(),
    loadAdminSettings(),
    loadAdminActivity(),
    loadAdminResumeEditor(),
    loadAdminResumePrintView(),
    loadAdminJobs(),
    loadAdminApplications(),
    loadAdminInbox(),
    loadAdminAnswerBank(),
    loadAdminWatchlists(),
  ])
}
