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
  '上面選日期，再選要記的那場比賽。',
  '選隊伍，打背號。沒有這個背號就會就地長出姓名欄，打完直接新增。',
  '看「超過就要記」那一行——畫面上的數字超過它才需要記下來。',
  '打數值，按 Enter 送出。送出後隊伍與背號會留著，可以連續記同一位。',
  '送出前下面會直接寫「要記」或「可以略過」，不用自己比對。',
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
        怎麼用
        {!open && <span className="text-[13px] font-normal text-slate-500">（點開看流程）</span>}
      </button>

      {open && (
        <div className="mt-3 space-y-2 text-[14px] leading-relaxed text-slate-300">
          <ol className="list-decimal space-y-1 pl-5">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="text-[13px] text-slate-400">
            <Kbd>Alt</Kbd>+<Kbd>1</Kbd> 投球　<Kbd>Alt</Kbd>+<Kbd>2</Kbd> 擊球
            <Kbd>Tab</Kbd> 換欄　<Kbd>Esc</Kbd> 清空
            　·　時間碼與轉軸只打數字，冒號會自己長出來
          </p>
        </div>
      )}
    </div>
  )
}
