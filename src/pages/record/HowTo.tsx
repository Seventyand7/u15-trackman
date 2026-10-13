/**
 * 記錄頁的使用說明。預設展開，收起來之後會記住，不用每次關。
 * 內容刻意很短——會一直看的人不需要它，第一次用的人只需要知道流程。
 */

import { useState } from 'react'
import { Kbd } from '../../components/ui'

const STORAGE_KEY = 'u15.howtoOpen'

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

const STEPS = [
  '選擇日期與比賽場次。',
  '選擇隊伍並輸入背號；若該背號尚無球員，欄位旁會出現姓名欄，填入即可新增。',
  '參考「記錄門檻」一列：Trackman 的數值超過門檻才需要記錄。',
  '輸入數值後按 Enter 送出。送出後保留隊伍與背號，可連續記錄同一位球員。',
  '送出前下方會顯示本筆是否達到門檻，不需自行比對。',
]

export function HowTo() {
  const [open, setOpen] = useState(readOpen)

  function toggle() {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // 記不住就算了
    }
  }

  return (
    <div className="panel px-4 py-2.5">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 text-left text-[15px] font-semibold text-slate-200"
      >
        <span className={`text-amber1 transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        操作說明
        {!open && <span className="text-[13px] font-normal text-slate-500">（展開）</span>}
      </button>

      {open && (
        <div className="mt-3 space-y-2 text-[14px] leading-relaxed text-slate-300">
          <ol className="list-decimal space-y-1 pl-5">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {/*
            每個項目各自一個 span 用 gap 隔開，不靠文字裡的空白——
            JSX 會把換行處的空白吃掉，用空白字元排版會黏在一起。
          */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-400">
            <span>
              <Kbd>Alt</Kbd>+<Kbd>1</Kbd> 投球
            </span>
            <span>
              <Kbd>Alt</Kbd>+<Kbd>2</Kbd> 擊球
            </span>
            <span>
              <Kbd>Tab</Kbd> 換欄
            </span>
            <span>
              <Kbd>Esc</Kbd> 清空
            </span>
            <span>時間碼與轉軸僅需輸入數字，冒號自動帶入</span>
          </div>
        </div>
      )}
    </div>
  )
}
