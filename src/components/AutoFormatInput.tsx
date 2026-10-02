/**
 * 會自動補分隔符號的輸入欄（時間碼、轉軸）。
 *
 * 為什麼需要一個專門的元件而不是直接在 onChange 裡格式化：
 *
 * 格式化之後的字串長度會跟打進去的不一樣（打 3 個字變成 4 個字），
 * 這種情況下 React 重設 input.value 之後游標會停在哪裡是不保證的。
 * 只要游標沒有停在最後面，下一個字就會插到字串中間，值就毀了——
 * 實測在時間碼欄打「0 6 3 3」會變成「63:30:63」。
 *
 * 所以每次值因為打字而改變，就把游標釘回最後面。
 * 這類欄位本來就只會從後面往前補，釘在最後是對的行為。
 */

import { useLayoutEffect, useRef } from 'react'

export interface AutoFormatInputProps {
  value: string
  onChange: (next: string) => void
  /** 把使用者打進去的原始字串整理成要顯示的樣子 */
  format: (raw: string) => string
  id?: string
  className?: string
  placeholder?: string
  onKeyDown?: (e: React.KeyboardEvent) => void
  autoFocus?: boolean
}

export function AutoFormatInput({
  value,
  onChange,
  format,
  id,
  className,
  placeholder,
  onKeyDown,
  autoFocus,
}: AutoFormatInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    // 只在這個欄位正在被輸入時才動游標；
    // 沒有 focus 的時候動它會把畫面捲過來，而且也沒必要。
    if (!el || document.activeElement !== el) return
    const end = el.value.length
    if (el.selectionStart !== end || el.selectionEnd !== end) {
      el.setSelectionRange(end, end)
    }
  }, [value])

  return (
    <input
      ref={ref}
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(format(e.target.value))}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete="off"
      inputMode="numeric"
    />
  )
}
