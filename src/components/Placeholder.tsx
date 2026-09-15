export function Placeholder({ title, stage, children }: { title: string; stage: string; children?: React.ReactNode }) {
  return (
    <div className="panel p-8">
      <div className="text-xs font-semibold uppercase tracking-widest text-amber1">{stage}</div>
      <h1 className="mt-1 text-xl font-bold">{title}</h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-slate-400">{children}</p>
    </div>
  )
}
