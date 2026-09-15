export function Brand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid shrink-0 place-items-center rounded-lg bg-amber1 font-black text-night-950 ${
          lg ? 'h-12 w-12 text-xl' : 'h-8 w-8 text-sm'
        }`}
      >
        U15
      </div>
      <div className="leading-tight">
        <div className={`font-bold tracking-wide ${lg ? 'text-2xl' : 'text-base'}`}>迎風飛翔</div>
        <div className={`text-slate-400 ${lg ? 'text-sm' : 'text-[11px]'}`}>
          硬式棒球聯賽 · Trackman 數據庫
        </div>
      </div>
    </div>
  )
}
