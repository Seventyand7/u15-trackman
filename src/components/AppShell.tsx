import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Brand } from './Brand'

const NAV = [
  { to: '/record', label: '記錄' },
  { to: '/cards', label: '圖卡' },
  { to: '/ranking', label: '季排名' },
  { to: '/setup', label: '設定' },
  { to: '/data', label: '資料管理' },
]

export function AppShell() {
  const { user, signOutNow } = useAuth()

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-night-900/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
          <Brand />

          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-amber1/15 text-amber1'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">{user?.email}</span>
            <button type="button" onClick={() => void signOutNow()} className="btn-ghost !py-1.5 text-xs">
              登出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
