import { Component, lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { CampaignPage } from './features/campaign/CampaignPage.jsx'
import { AppHeader } from './features/workspace/AppHeader.jsx'
import { usePlayerStore } from './store/playerStore.js'
import { Toaster } from './ui/index.js'

const TutorialsPage = lazy(() => import('./features/tutorials/TutorialsPage.jsx'))
const TutorialPage = lazy(() => import('./features/tutorials/TutorialPage.jsx'))
const WorkspacePage = lazy(() => import('./features/workspace/WorkspacePage.jsx'))
const SandboxPage = lazy(() => import('./features/sandbox/SandboxPage.jsx'))
const ShowcasePage = lazy(() => import('./features/showcase/ShowcasePage.jsx'))
const ShowcaseProjectPage = lazy(() => import('./features/showcase/ShowcaseProjectPage.jsx'))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage.jsx'))
const LeaderboardPage = lazy(() => import('./features/profile/LeaderboardPage.jsx'))

class AppErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return <main className="p-8"><h1 className="text-xl font-semibold">The lab could not open</h1><p role="alert" className="my-3">{this.state.error.message}</p><p>Your saved projects and local drafts remain available.</p><button className="mt-4 rounded border p-2" onClick={() => window.location.reload()}>Reload the lab</button></main>
    return this.props.children
  }
}

export default function App() {
  useEffect(() => { void usePlayerStore.getState().ensureGuest() }, [])
  const expired = usePlayerStore(s => s.authExpired)
  return (
    <AppErrorBoundary>{expired && <div role="alert" className="bg-amber-50 p-2 text-center text-sm">Your session expired. <Link className="underline" to="/profile#account">Log in to sync your progress.</Link></div>}<Suspense fallback={<p role="status" className="p-8 text-slate-600">Loading the lab…</p>}><Routes>
      <Route path="/" element={<CampaignPage />} />
      <Route path="/tutorials" element={<TutorialsPage />} />
      <Route path="/tutorials/:tutorialId" element={<TutorialPage />} />
      <Route path="/play/:levelId" element={<WorkspacePage />} />
      <Route path="/sandbox" element={<SandboxPage />} />
      <Route path="/sandbox/:projectId" element={<SandboxPage />} />
      <Route path="/showcase" element={<ShowcasePage />} />
      <Route path="/showcase/:slug" element={<ShowcaseProjectPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="*" element={<div><AppHeader /><main className="p-8"><h1 className="text-xl font-semibold">Page not found</h1><Link className="mt-4 inline-block text-brand-700 underline" to="/">Back to the campaign</Link></main></div>} />
    </Routes></Suspense><Toaster /></AppErrorBoundary>
  )
}
