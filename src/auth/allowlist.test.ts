import { describe, expect, it } from 'vitest'
import { isAllowed } from './allowlist'

describe('isAllowed', () => {
  it('放行白名單內、已驗證的信箱', () => {
    expect(isAllowed('xhk1997@gmail.com', true)).toBe(true)
  })

  it('不分大小寫、忽略前後空白', () => {
    expect(isAllowed('  XHK1997@Gmail.com ', true)).toBe(true)
  })

  it('擋掉沒驗證過的信箱（Rules 也會擋）', () => {
    expect(isAllowed('xhk1997@gmail.com', false)).toBe(false)
  })

  it('擋掉白名單外的信箱與空值', () => {
    expect(isAllowed('someone@example.com', true)).toBe(false)
    expect(isAllowed(null, true)).toBe(false)
    expect(isAllowed(undefined, true)).toBe(false)
  })
})
