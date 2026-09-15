import { describe, expect, it } from 'vitest'
import { describeRosterStatus, parseRosterText, planRosterImport } from './roster'
import { SEASON, TEAM_A, TEAM_B, player } from './testFixtures'

const scope = { seasonId: SEASON, teamId: TEAM_A }

const existing = [
  player('a1', { teamId: TEAM_A, number: '5', name: '王小明' }),
  player('a2', { teamId: TEAM_A, number: '7', name: '李大同' }),
  player('b1', { teamId: TEAM_B, number: '5', name: '別隊的人' }),
]

function statuses(text: string) {
  return planRosterImport(text, existing, scope).rows.map((r) => r.status.kind)
}

describe('parseRosterText', () => {
  it('一行一位，空白分隔', () => {
    expect(parseRosterText('5 王小明\n15 李大同')).toEqual([
      { lineNo: 1, raw: '5 王小明', number: '5', name: '王小明' },
      { lineNo: 2, raw: '15 李大同', number: '15', name: '李大同' },
    ])
  })

  it('tab 分隔（從 Excel 複製過來）', () => {
    expect(parseRosterText('5\t王小明')[0]).toMatchObject({ number: '5', name: '王小明' })
  })

  it('全形空白分隔', () => {
    expect(parseRosterText('5　王小明')[0]).toMatchObject({ number: '5', name: '王小明' })
  })

  it('逗號與頓號分隔', () => {
    expect(parseRosterText('5,王小明')[0]).toMatchObject({ number: '5', name: '王小明' })
    expect(parseRosterText('5、王小明')[0]).toMatchObject({ number: '5', name: '王小明' })
  })

  it('姓名中間有空白時整段都算姓名', () => {
    expect(parseRosterText('5 王 小明')[0]).toMatchObject({ number: '5', name: '王 小明' })
  })

  it('保留背號的前置零', () => {
    expect(parseRosterText('00 陳小華')[0]).toMatchObject({ number: '00' })
  })

  it('空白行直接忽略，但行號照原文計算', () => {
    const parsed = parseRosterText('5 王小明\n\n\n15 李大同')
    expect(parsed).toHaveLength(2)
    expect(parsed[1]?.lineNo).toBe(4)
  })

  it('Windows 換行也吃得下', () => {
    expect(parseRosterText('5 王小明\r\n15 李大同')).toHaveLength(2)
  })

  it('只有背號時姓名是空的', () => {
    expect(parseRosterText('5')[0]).toMatchObject({ number: '5', name: '' })
  })

  it('完全空白的輸入是空陣列', () => {
    expect(parseRosterText('   \n\n')).toEqual([])
  })
})

describe('planRosterImport', () => {
  it('沒衝突的列可以新增', () => {
    const plan = planRosterImport('15 陳小華\n23 林佳穎', existing, scope)
    expect(plan.rows.every((r) => r.willCreate)).toBe(true)
    expect(plan.createCount).toBe(2)
    expect(plan.blockedCount).toBe(0)
  })

  it('背號被現有球員佔用時標示出來且不寫入', () => {
    const plan = planRosterImport('5 新來的', existing, scope)
    expect(plan.rows[0]?.status).toEqual({ kind: 'number-taken', occupiedBy: existing[0] })
    expect(plan.rows[0]?.willCreate).toBe(false)
    expect(plan.blockedCount).toBe(1)
  })

  it('別隊佔用同背號不算衝突', () => {
    // b1 是 TEAM_B 的 5 號，但我們現在匯入 TEAM_B 的名單
    const plan = planRosterImport('9 新人', existing, { seasonId: SEASON, teamId: TEAM_B })
    expect(plan.rows[0]?.willCreate).toBe(true)
  })

  it('貼上的內容裡自己重複時，第二行起被擋下', () => {
    expect(statuses('15 甲\n15 乙')).toEqual(['ok', 'duplicate-in-paste'])
  })

  it('重複的列會指出是跟第幾行撞號', () => {
    const plan = planRosterImport('15 甲\n16 乙\n15 丙', existing, scope)
    expect(plan.rows[2]?.status).toEqual({ kind: 'duplicate-in-paste', firstLineNo: 1 })
  })

  it('被擋下的列不會佔住背號，後面同號的列仍可新增', () => {
    // 第一行只有背號沒姓名被擋 → 第二行的 15 號還是可以用
    expect(statuses('15\n15 乙')).toEqual(['missing-name', 'ok'])
  })

  it('只有背號沒有姓名的列被擋下', () => {
    expect(statuses('15')).toEqual(['missing-name'])
  })

  it('同名只是警告，仍然會新增', () => {
    const plan = planRosterImport('15 王小明', existing, scope)
    expect(plan.rows[0]?.status.kind).toBe('same-name')
    expect(plan.rows[0]?.willCreate).toBe(true)
    expect(plan.warnCount).toBe(1)
  })

  it('去掉空白後同名也會警告（換背號最常見的情況）', () => {
    expect(statuses('15 王 小明')).toEqual(['same-name'])
  })

  it('背號衝突優先於同名判斷', () => {
    // 5 號已經是王小明，這行又寫 5 號王小明 → 先報背號衝突
    expect(statuses('5 王小明')).toEqual(['number-taken'])
  })

  it('混合情況的統計正確', () => {
    const plan = planRosterImport(
      ['15 陳小華', '5 撞號的', '15 又撞號', '9 王小明', '20'].join('\n'),
      existing,
      scope,
    )
    expect(plan.rows.map((r) => r.status.kind)).toEqual([
      'ok',
      'number-taken',
      'duplicate-in-paste',
      'same-name',
      'missing-name',
    ])
    expect(plan.createCount).toBe(2)
    expect(plan.blockedCount).toBe(3)
    expect(plan.warnCount).toBe(1)
  })

  it('空輸入沒有任何列', () => {
    const plan = planRosterImport('', existing, scope)
    expect(plan.rows).toEqual([])
    expect(plan.createCount).toBe(0)
  })
})

describe('describeRosterStatus', () => {
  it('每一種狀態都有說明，而且說得出原因', () => {
    const plan = planRosterImport(
      ['15 陳小華', '5 撞號的', '15 又撞號', '9 王小明', '20'].join('\n'),
      existing,
      scope,
    )
    const texts = plan.rows.map((r) => describeRosterStatus(r.status))
    expect(texts[0]).toBe('將新增')
    expect(texts[1]).toContain('王小明')
    expect(texts[2]).toContain('第 1 行')
    expect(texts[3]).toContain('同名')
    expect(texts[4]).toContain('沒有姓名')
  })
})
