import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { DeniedPage } from './components/DeniedPage'
import { LoginPage } from './components/LoginPage'
import { SetupNeededPage } from './components/SetupNeededPage'
import { isFirebaseConfigured } from './firebase/config'
import { SeasonProvider } from './state/SeasonProvider'
import CardsPage from './pages/CardsPage'
import DataPage from './pages/DataPage'
import RankingPage from './pages/RankingPage'
import RecordPage from './pages/RecordPage'
import SetupPage from './pages/SetupPage'

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-amber1" />
    </div>
  )
}

function Gate() {
  const { status } = useAuth()

  if (status === 'loading') return <Splash />
  if (status === 'denied') return <DeniedPage />
  if (status === 'signed-out') return <LoginPage />

  // 登入且在白名單內：GitHub Pages 不能處理 SPA 的 history 路由，所以用 HashRouter。
  return (
    <SeasonProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/record" element={<RecordPage />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="*" element={<Navigate to="/record" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </SeasonProvider>
  )
}

export default function App() {
  if (!isFirebaseConfigured) return <SetupNeededPage />
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
