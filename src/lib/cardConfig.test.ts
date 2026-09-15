import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CARD_CONFIG,
  isBattedFieldLocked,
  isPitchFieldLocked,
  normalizeCardConfig,
  splitIntoRows,
  toggleBattedField,
  togglePitchField,
} from './cardConfig'

describe('預設設定', () => {
  it('投球預設勾球速、轉速、轉軸（與目前交出去的格式相同）', () => {
    expect(DEFAULT_CARD_CONFIG.pitchFields).toEqual(['speed', 'spin', 'axis'])
  })

  it('擊球預設全勾', () => {
    expect(DEFAULT_CARD_CONFIG.battedFields).toEqual(['exitVelo', 'launchAngle', 'distance'])
  })
})

describe('鎖定欄位', () => {
  it('投球兩區共用勾選，所以球速與轉速都鎖定', () => {
    expect(isPitchFieldLocked('speed')).toBe(true)
    expect(isPitchFieldLocked('spin')).toBe(true)
    expect(isPitchFieldLocked('axis')).toBe(false)
    expect(isPitchFieldLocked('hBreak')).toBe(false)
  })

  it('擊球初速與擊球距離鎖定，仰角可取消', () => {
    expect(isBattedFieldLocked('exitVelo')).toBe(true)
    expect(isBattedFieldLocked('distance')).toBe(true)
    expect(isBattedFieldLocked('launchAngle')).toBe(false)
  })
})

describe('normalizeCardConfig', () => {
  it('沒有存過設定時用預設值', () => {
    expect(normalizeCardConfig(null)).toEqual(DEFAULT_CARD_CONFIG)
    expect(normalizeCardConfig(undefined)).toEqual(DEFAULT_CARD_CONFIG)
    expect(normalizeCardConfig({})).toEqual(DEFAULT_CARD_CONFIG)
  })

  it('一律照標準順序輸出，不管存進去的順序', () => {
    const c = normalizeCardConfig({ pitchFields: ['vBreak', 'axis', 'speed', 'spin'] })
    expect(c.pitchFields).toEqual(['speed', 'spin', 'axis', 'vBreak'])
  })

  it('資料被改壞、少了鎖定欄位時自動補回來', () => {
    const c = normalizeCardConfig({ pitchFields: ['axis'], battedFields: ['launchAngle'] })
    expect(c.pitchFields).toEqual(['speed', 'spin', 'axis'])
    expect(c.battedFields).toEqual(['exitVelo', 'launchAngle', 'distance'])
  })

  it('空陣列也要把鎖定欄位補回來，不會產生沒有主數據的圖卡', () => {
    const c = normalizeCardConfig({ pitchFields: [], battedFields: [] })
    expect(c.pitchFields).toEqual(['speed', 'spin'])
    expect(c.battedFields).toEqual(['exitVelo', 'distance'])
  })

  it('不認得的欄位名稱直接丟掉', () => {
    const c = normalizeCardConfig({
      pitchFields: ['speed', 'spin', 'nonsense'] as never,
    })
    expect(c.pitchFields).toEqual(['speed', 'spin'])
  })

  it('不是陣列的值當成沒設定', () => {
    expect(normalizeCardConfig({ pitchFields: 'speed' as never }).pitchFields).toEqual(
      DEFAULT_CARD_CONFIG.pitchFields,
    )
  })

  it('重複的欄位只留一份', () => {
    const c = normalizeCardConfig({ pitchFields: ['axis', 'axis', 'speed', 'spin'] })
    expect(c.pitchFields).toEqual(['speed', 'spin', 'axis'])
  })
})

describe('togglePitchField', () => {
  it('可以加上選用欄位，並維持標準順序', () => {
    const c = togglePitchField(DEFAULT_CARD_CONFIG, 'vBreak')
    expect(c.pitchFields).toEqual(['speed', 'spin', 'axis', 'vBreak'])
  })

  it('可以取消選用欄位', () => {
    const c = togglePitchField(DEFAULT_CARD_CONFIG, 'axis')
    expect(c.pitchFields).toEqual(['speed', 'spin'])
  })

  it('鎖定欄位點了也不會變', () => {
    expect(togglePitchField(DEFAULT_CARD_CONFIG, 'speed')).toEqual(DEFAULT_CARD_CONFIG)
    expect(togglePitchField(DEFAULT_CARD_CONFIG, 'spin')).toEqual(DEFAULT_CARD_CONFIG)
  })

  it('不改動原本的設定物件', () => {
    const before = [...DEFAULT_CARD_CONFIG.pitchFields]
    togglePitchField(DEFAULT_CARD_CONFIG, 'hBreak')
    expect(DEFAULT_CARD_CONFIG.pitchFields).toEqual(before)
  })
})

describe('toggleBattedField', () => {
  it('仰角可以取消', () => {
    expect(toggleBattedField(DEFAULT_CARD_CONFIG, 'launchAngle').battedFields).toEqual([
      'exitVelo',
      'distance',
    ])
  })

  it('初速與距離點了也不會變', () => {
    expect(toggleBattedField(DEFAULT_CARD_CONFIG, 'exitVelo')).toEqual(DEFAULT_CARD_CONFIG)
    expect(toggleBattedField(DEFAULT_CARD_CONFIG, 'distance')).toEqual(DEFAULT_CARD_CONFIG)
  })
})

describe('splitIntoRows — 欄位排版', () => {
  it('3 欄以內排一列', () => {
    expect(splitIntoRows(['a'])).toEqual([['a']])
    expect(splitIntoRows(['a', 'b'])).toEqual([['a', 'b']])
    expect(splitIntoRows(['a', 'b', 'c'])).toEqual([['a', 'b', 'c']])
  })

  it('4 欄排兩列各 2 欄，不留單獨一格吊在第二列', () => {
    expect(splitIntoRows(['a', 'b', 'c', 'd'])).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('任何情況下都不會有只裝一格的第二列', () => {
    for (let n = 1; n <= 5; n++) {
      const rows = splitIntoRows(Array.from({ length: n }, (_, i) => i))
      if (rows.length > 1) expect(rows[1]!.length).toBeGreaterThan(1)
    }
  })

  it('5 欄排兩列：第一列 3 欄、第二列 2 欄', () => {
    expect(splitIntoRows(['a', 'b', 'c', 'd', 'e'])).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ])
  })

  it('沒有欄位時是空的', () => {
    expect(splitIntoRows([])).toEqual([])
  })
})
