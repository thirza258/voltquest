import { lazy, Suspense } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { CampaignPage } from './features/campaign/CampaignPage.jsx'
import { AppHeader } from './features/workspace/AppHeader.jsx'

const TutorialsPage = lazy(() => import('./features/tutorials/TutorialsPage.jsx'))
const TutorialPage = lazy(() => import('./features/tutorials/TutorialPage.jsx'))

function Placeholder({ name }) {
  return (
    <div className="min-h-screen bg-surface-page"><AppHeader /><main className="p-8"><h1 className="text-xl font-semibold">{name}</h1><p className="mt-2 text-ink-secondary">This area is coming soon. The guided tutorial lab is ready to explore.</p><Link to="/tutorials" className="mt-4 inline-block text-brand-700 underline">Explore interactive tutorials</Link></main></div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<p role="status" className="p-8 text-slate-600">Loading the lab…</p>}><Routes>
      <Route path="/" element={<CampaignPage />} />
      <Route path="/tutorials" element={<TutorialsPage />} />
      <Route path="/tutorials/:tutorialId" element={<TutorialPage />} />
      <Route path="/play/:levelId" element={<Placeholder name="Workspace" />} />
      <Route path="/sandbox" element={<Placeholder name="Sandbox" />} />
      <Route path="/sandbox/:projectId" element={<Placeholder name="Sandbox" />} />
      <Route path="/showcase" element={<Placeholder name="Showcase" />} />
      <Route path="/showcase/:slug" element={<Placeholder name="Showcase item" />} />
      <Route path="/profile" element={<Placeholder name="Profile" />} />
      <Route path="/leaderboard" element={<Placeholder name="Leaderboard" />} />
      <Route path="*" element={<Placeholder name="Not found" />} />
    </Routes></Suspense>
  )
}
