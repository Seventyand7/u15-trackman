import { useAuth } from '../auth/AuthProvider'
import { Brand } from './Brand'

export function DeniedPage() {
  const { deniedEmail, signIn } = useAuth()

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="panel w-full max-w-sm animate-pop-in p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Brand size="lg" />
        </div>

        <div className="mb-2 text-4xl">🚫</div>
        <h1 className="text-lg font-bold text-red-300">無權限</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          帳號 <span className="font-mono text-slate-200">{deniedEmail}</span> 不在允許名單內，
          已自動登出。
        </p>

        <button type="button" onClick={() => void signIn()} className="btn-ghost mt-6 w-full">
          改用其他帳號登入
        </button>
      </div>
    </div>
  )
}
