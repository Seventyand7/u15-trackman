import { useAuth } from '../auth/AuthProvider'
import { Brand } from './Brand'

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.7l7.8 6.1C12.3 13.6 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.2c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.1 0 19.9 0 23.5s.9 7.4 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2.1 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.2-7.9 2.2-6.4 0-11.7-4.1-13.6-9.9l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
    </svg>
  )
}

export function LoginPage() {
  const { signIn, status, error } = useAuth()

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="panel w-full max-w-sm animate-pop-in p-8">
        <div className="mb-8 flex justify-center">
          <Brand size="lg" />
        </div>

        <button
          type="button"
          onClick={() => void signIn()}
          disabled={status === 'loading'}
          className="btn w-full border border-white/15 bg-white text-[15px] font-semibold text-slate-800 hover:bg-slate-100"
        >
          <GoogleMark />
          {status === 'loading' ? '登入中…' : '使用 Google 登入'}
        </button>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">
          這是私人工具，只有授權帳號可以使用。
        </p>
      </div>
    </div>
  )
}
