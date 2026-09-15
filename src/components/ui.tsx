import type { ReactNode } from 'react'

export function Panel({
  title,
  right,
  children,
  className = '',
}: {
  title: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <span>{title}</span>
        {right && <span className="ml-auto font-normal">{right}</span>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-400">
      {children}
    </p>
  )
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  )
}

export function Spinner({ label = '載入中…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-8 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-amber1" />
      {label}
    </div>
  )
}

/** 鍵盤提示用的小按鍵樣式 */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
      {children}
    </kbd>
  )
}
