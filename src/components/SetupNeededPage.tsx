/** src/firebase/config.ts 還沒填真實值時顯示，避免只看到一片白畫面。 */
export function SetupNeededPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="panel w-full max-w-xl p-8">
        <h1 className="text-lg font-bold text-amber1">還差一步：填入 Firebase 設定</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          請打開 <code className="rounded bg-night-900 px-1.5 py-0.5 font-mono text-amber1">src/firebase/config.ts</code>
          ，把裡面的 <code className="rounded bg-night-900 px-1.5 py-0.5 font-mono">REPLACE_ME</code> 換成你自己
          Firebase 專案的設定值。
        </p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-400">
          <li>到 Firebase Console 開一個專案</li>
          <li>Authentication → Sign-in method → 啟用 Google</li>
          <li>Firestore Database → 建立資料庫</li>
          <li>專案設定 → 一般 → 你的應用程式 → SDK 設定與配置 → 複製 config</li>
        </ol>
        <p className="mt-5 text-sm text-slate-400">
          完整步驟在 README 的「初次設定」一節。
        </p>
      </div>
    </div>
  )
}
