import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth, googleProvider } from '../firebase/app'
import { isAllowed } from './allowlist'

export type AuthStatus =
  /** 還在向 Firebase 確認目前登入狀態 */
  | 'loading'
  /** 沒有登入 */
  | 'signed-out'
  /** 登入成功，而且在白名單內 */
  | 'allowed'
  /** 登入成功，但不在白名單內（已自動登出） */
  | 'denied'

type AuthContextValue = {
  status: AuthStatus
  user: User | null
  /** status === 'denied' 時，被拒絕的那個信箱，用來顯示在畫面上 */
  deniedEmail: string | null
  error: string | null
  signIn: () => Promise<void>
  signOutNow: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth(), (u) => {
      if (!u) {
        setUser(null)
        // 「被拒絕」的狀態要留著給畫面顯示，不能被自動登出事件清掉。
        setStatus((prev) => (prev === 'denied' ? 'denied' : 'signed-out'))
        return
      }
      if (isAllowed(u.email, u.emailVerified)) {
        setUser(u)
        setDeniedEmail(null)
        setStatus('allowed')
      } else {
        // 不在白名單：立刻登出，不讓他停在已登入狀態。
        setDeniedEmail(u.email ?? '(沒有 email)')
        setUser(null)
        setStatus('denied')
        void signOut(auth())
      }
    })
  }, [])

  const signIn = useCallback(async () => {
    setError(null)
    setDeniedEmail(null)
    setStatus('loading')
    try {
      await signInWithPopup(auth(), googleProvider)
      // 後續狀態由 onAuthStateChanged 決定
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      setStatus('signed-out')
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError(null)
      } else if (code === 'auth/unauthorized-domain') {
        setError('這個網域沒有被授權。請到 Firebase Console → Authentication → Settings → Authorized domains 把它加進去。')
      } else if (code === 'auth/popup-blocked') {
        setError('瀏覽器擋掉了登入視窗，請允許此網站的彈出視窗後再試一次。')
      } else {
        setError(`登入失敗：${(e as Error).message}`)
      }
    }
  }, [])

  const signOutNow = useCallback(async () => {
    await signOut(auth())
    setDeniedEmail(null)
    setStatus('signed-out')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, deniedEmail, error, signIn, signOutNow }),
    [status, user, deniedEmail, error, signIn, signOutNow],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必須在 <AuthProvider> 內使用')
  return ctx
}
