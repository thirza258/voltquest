import { useI18n } from './i18n/index.jsx'
import { Component, lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Link, useSearchParams } from 'react-router-dom'
import { LandingPage } from './features/landing/LandingPage.jsx'
import { CampaignPage } from './features/campaign/CampaignPage.jsx'
import { AppHeader } from './features/workspace/AppHeader.jsx'
import { usePlayerStore } from './store/playerStore.js'
import { Toaster } from './ui/index.js'

const TutorialsPage = lazy(() => import('./features/tutorials/TutorialsPage.jsx'))
const TutorialPage = lazy(() => import('./features/tutorials/TutorialPage.jsx'))
const VisionPage = lazy(() => import('./features/vision/VisionPage.jsx'))
const HpcPage = lazy(() => import('./features/hpc/HpcPage.jsx'))
const MatlabPage = lazy(() => import('./features/matlab/MatlabPage.jsx'))
const AgentsPage = lazy(() => import('./features/agents/AgentsPage.jsx'))
const ComputerPage = lazy(() => import('./features/computer/ComputerPage.jsx'))
const AvrPage = lazy(() => import('./features/computer/AvrPage.jsx'))
const CudaPage = lazy(() => import('./features/cuda/CudaPage.jsx'))
const PytorchPage = lazy(() => import('./features/pytorch/PytorchPage.jsx'))
const KernelPage = lazy(() => import('./features/kernel/KernelPage.jsx'))
const LoadBalancerPage = lazy(() => import('./features/loadbalancer/LoadBalancerPage.jsx'))
const DistributedPage = lazy(() => import('./features/distributed/DistributedPage.jsx'))
const KubernetesPage = lazy(() => import('./features/kubernetes/KubernetesPage.jsx'))
const GameModdingPage = lazy(() => import('./features/gamemodding/GameModdingPage.jsx'))
const IotCPage = lazy(() => import('./features/iot-c/IotCPage.jsx'))
const ExcelPage = lazy(() => import('./features/excel/ExcelPage.jsx'))
const QtPage = lazy(() => import('./features/qt/QtPage.jsx'))
const WinuiPage = lazy(() => import('./features/winui/WinuiPage.jsx'))
const CybersecurityPage = lazy(() => import('./features/cybersecurity/CybersecurityPage.jsx'))
const RoboticsPage = lazy(() => import('./features/robotics/RoboticsPage.jsx'))
const CoursesPage = lazy(() => import('./features/courses/CoursesPage.jsx'))
const CoursePage = lazy(() => import('./features/courses/CoursePage.jsx'))
const CertificatesPage = lazy(() => import('./features/courses/CertificatesPage.jsx'))
const WorkspacePage = lazy(() => import('./features/workspace/WorkspacePage.jsx'))
const SandboxPage = lazy(() => import('./features/sandbox/SandboxPage.jsx'))
const CommunityPage = lazy(() => import('./features/community/CommunityPage.jsx'))
import SeoManager from './ui/SeoManager.jsx'
const ThreadPage = lazy(() => import('./features/community/ThreadPage.jsx'))
const ShowcasePage = lazy(() => import('./features/showcase/ShowcasePage.jsx'))
const ShowcaseProjectPage = lazy(() => import('./features/showcase/ShowcaseProjectPage.jsx'))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage.jsx'))
const LeaderboardPage = lazy(() => import('./features/profile/LeaderboardPage.jsx'))

function SandboxRoute() {
  const [search] = useSearchParams()
  if (search.get('bench') === 'avr' || (search.get('bench') === 'computer' && search.get('asm'))) return <AvrPage sandbox />
  if (search.get('bench') === 'computer') return <ComputerPage sandbox />
  if (search.get('bench') === 'ai-agents') return <AgentsPage sandbox />
  if (search.get('bench') === 'matlab') return <MatlabPage sandbox />
  if (search.get('bench') === 'excel') return <ExcelPage sandbox />
  if (search.get('bench') === 'cybersecurity') return <CybersecurityPage sandbox />
  if (search.get('bench') === 'hpc') return <HpcPage sandbox />
  if (search.get('bench') === 'vision') return <VisionPage sandbox />
  return search.get('bench') === 'robotics' ? <RoboticsPage sandbox /> : <SandboxPage />
}

class AppErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return <main className="p-8"><h1 className="text-xl font-semibold">The lab could not open</h1><p role="alert" className="my-3">{this.state.error.message}</p><p>Your saved projects and local drafts remain available.</p><button className="mt-4 rounded border p-2" onClick={() => window.location.reload()}>Reload the lab</button></main>
    return this.props.children
  }
}

export default function App() {
  const { t } = useI18n()
  useEffect(() => { void usePlayerStore.getState().ensureGuest() }, [])
  const expired = usePlayerStore(s => s.authExpired)
  return (
    <AppErrorBoundary>
      <SeoManager />
      {expired && <div role="alert" className="bg-amber-50 p-2 text-center text-sm">{t("Your session expired. ")}<Link className="underline" to="/profile#account">{t("Log in to sync your progress.")}</Link></div>}<Suspense fallback={<p role="status" className="p-8 text-slate-600">{t("Loading the lab…")}</p>}><Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/campaign" element={<CampaignPage />} />
      <Route path="/tutorials" element={<TutorialsPage />} />
      <Route path="/tutorials/:tutorialId" element={<TutorialPage />} />
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/courses/:courseId" element={<CoursePage />} />
      <Route path="/certificates" element={<CertificatesPage />} />
      <Route path="/certificates/:certificateId" element={<CertificatesPage />} />
      <Route path="/computer-architecture" element={<ComputerPage />} />
      <Route path="/computer-architecture/:lessonId" element={<ComputerPage />} />
      <Route path="/avr" element={<AvrPage />} />
      <Route path="/avr/:lessonId" element={<AvrPage />} />
      <Route path="/cuda" element={<CudaPage />} />
      <Route path="/cuda/:lessonId" element={<CudaPage />} />
      <Route path="/pytorch" element={<PytorchPage />} />
      <Route path="/pytorch/:lessonId" element={<PytorchPage />} />
      <Route path="/kernel" element={<KernelPage />} />
      <Route path="/kernel/:lessonId" element={<KernelPage />} />
      <Route path="/loadbalancer" element={<LoadBalancerPage />} />
      <Route path="/loadbalancer/:lessonId" element={<LoadBalancerPage />} />
      <Route path="/distributed" element={<DistributedPage />} />
      <Route path="/distributed/:lessonId" element={<DistributedPage />} />
      <Route path="/kubernetes" element={<KubernetesPage />} />
      <Route path="/kubernetes/:lessonId" element={<KubernetesPage />} />
      <Route path="/game-modding" element={<GameModdingPage />} />
      <Route path="/game-modding/:lessonId" element={<GameModdingPage />} />
      <Route path="/iot-c" element={<IotCPage />} />
      <Route path="/iot-c/:lessonId" element={<IotCPage />} />
      <Route path="/excel" element={<ExcelPage />} />
      <Route path="/excel/:lessonId" element={<ExcelPage />} />
      <Route path="/qt" element={<QtPage />} />
      <Route path="/qt/:lessonId" element={<QtPage />} />
      <Route path="/winui" element={<WinuiPage />} />
      <Route path="/winui/:lessonId" element={<WinuiPage />} />
      <Route path="/hpc" element={<HpcPage />} />
      <Route path="/hpc/:lessonId" element={<HpcPage />} />
      <Route path="/matlab" element={<MatlabPage />} />
      <Route path="/matlab/:lessonId" element={<MatlabPage />} />
      <Route path="/ai-agents" element={<AgentsPage />} />
      <Route path="/ai-agents/:lessonId" element={<AgentsPage />} />
      <Route path="/ai-agents/:lessonId/tutorial" element={<AgentsPage tutorial />} />
      <Route path="/cybersecurity" element={<CybersecurityPage />} />
      <Route path="/cybersecurity/:lessonId" element={<CybersecurityPage />} />
      <Route path="/play/:levelId" element={<WorkspacePage />} />
      <Route path="/sandbox" element={<SandboxRoute />} />
      <Route path="/vision" element={<VisionPage />} />
      <Route path="/vision/:lessonId" element={<VisionPage />} />
      <Route path="/robotics" element={<RoboticsPage />} />
      <Route path="/robotics/:lessonId" element={<RoboticsPage />} />
      <Route path="/sandbox/:projectId" element={<SandboxPage />} />
      <Route path="/showcase" element={<ShowcasePage />} />
      <Route path="/showcase/:slug" element={<ShowcaseProjectPage />} />
      <Route path="/community" element={<CommunityPage />} />
      <Route path="/community/:threadId" element={<ThreadPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="*" element={<div><AppHeader /><main className="p-8"><h1 className="text-xl font-semibold">{t("Page not found")}</h1><Link className="mt-4 inline-block text-brand-700 underline" to="/">{t("Back to the campaign")}</Link></main></div>} />
    </Routes></Suspense><Toaster /></AppErrorBoundary>
  )
}
