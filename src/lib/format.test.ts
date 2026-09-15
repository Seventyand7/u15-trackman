import { describe, expect, it } from 'vitest'
import {
  compactDate,
  compareGamesNewestFirst,
  formatAngle,
  formatDistance,
  formatGameDate,
  formatGameTitle,
  formatOrder,
  formatPlayer,
  formatSpeed,
  formatSpin,
  formatTeamPlayer,
  formatText,
  nextGameOrder,
  parseISODate,
} from './format'
import type { Game, Team } from '../types/models'
import { GAMES, TEAM_A, TEAM_B, player } from './testFixtures'

const teams: Team[] = [
  { id: TEAM_A, seasonId: 'season-2026', name: '閃電女孩' },
  { id: TEAM_B, seasonId: 'season-2026', name: '諾娜' },
]

describe('parseISODate', () => {
  it('依本地時區解析，不會因為時區差一天', () => {
    const d = parseISODate('2026-09-13')
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(8) // 0 起算
    expect(d?.getDate()).toBe(13)
  })

  it('格式不對回傳 null', () => {
    expect(parseISODate('2026/09/13')).toBeNull()
    expect(parseISODate('')).toBeNull()
  })

  it('不存在的日期回傳 null，不會自動進位到 3 月', () => {
    expect(parseISODate('2026-02-31')).toBeNull()
  })
})

describe('formatGameDate', () => {
  it('加上星期', () => {
    expect(formatGameDate('2026-09-13')).toBe('2026.09.13（日）')
    expect(formatGameDate('2026-09-14')).toBe('2026.09.14（一）')
    expect(formatGameDate('2026-09-19')).toBe('2026.09.19（六）')
  })

  it('格式不對就原樣顯示，不要炸掉整個畫面', () => {
    expect(formatGameDate('壞掉的日期')).toBe('壞掉的日期')
  })
})

describe('compactDate / formatOrder', () => {
  it('檔名用的日期', () => {
    expect(compactDate('2026-09-13')).toBe('20260913')
  })

  it('場次序號補零', () => {
    expect(formatOrder(1)).toBe('01')
    expect(formatOrder(12)).toBe('12')
  })
})

describe('數值格式', () => {
  it('球速一位小數加單位', () => {
    expect(formatSpeed(95.7)).toBe('95.7 km/h')
    expect(formatSpeed(120)).toBe('120.0 km/h')
  })

  it('轉速取整數', () => {
    expect(formatSpin(1701)).toBe('1701 轉')
    expect(formatSpin(1700.6)).toBe('1701 轉')
  })

  it('仰角一位小數，可為負', () => {
    expect(formatAngle(24.6)).toBe('24.6°')
    expect(formatAngle(-5)).toBe('-5.0°')
  })

  it('距離兩位小數', () => {
    expect(formatDistance(49.95)).toBe('49.95 m')
    expect(formatDistance(50)).toBe('50.00 m')
  })

  it('文字欄位原樣顯示', () => {
    expect(formatText('30 cm 偏右')).toBe('30 cm 偏右')
  })

  it('缺值一律顯示破折號', () => {
    expect(formatSpeed(null)).toBe('-')
    expect(formatSpin(null)).toBe('-')
    expect(formatAngle(null)).toBe('-')
    expect(formatDistance(null)).toBe('-')
    expect(formatText(null)).toBe('-')
    expect(formatText('   ')).toBe('-')
  })

  it('0 不是缺值', () => {
    expect(formatSpin(0)).toBe('0 轉')
    expect(formatAngle(0)).toBe('0.0°')
  })
})

describe('名稱格式', () => {
  it('球員是「背號 姓名」', () => {
    expect(formatPlayer(player('a', { number: '5', name: '王小明' }))).toBe('5 王小明')
  })

  it('保留背號的前置零', () => {
    expect(formatPlayer(player('a', { number: '00', name: '李大同' }))).toBe('00 李大同')
  })

  it('圖卡左欄是「隊名 背號 姓名」', () => {
    const p = player('a', { number: '5', name: '王小明' })
    expect(formatTeamPlayer(teams[0], p)).toBe('閃電女孩 5 王小明')
  })

  it('球員不存在時顯示破折號', () => {
    expect(formatPlayer(null)).toBe('-')
  })

  it('場次標題', () => {
    expect(formatGameTitle(GAMES[0]!, teams)).toBe('01. 閃電女孩 vs 諾娜')
    expect(formatGameTitle(GAMES[1]!, teams)).toBe('02. 閃電女孩 vs 諾娜')
  })

  it('找不到隊伍時用問號佔位，不會整頁壞掉', () => {
    expect(formatGameTitle(GAMES[0]!, [])).toBe('01. ? vs ?')
  })
})

describe('比賽排序', () => {
  it('日期新的在前，同日場次序號小的在前', () => {
    const sorted = [...GAMES].sort(compareGamesNewestFirst)
    expect(sorted.map((g) => g.id)).toEqual(['g3', 'g1', 'g2'])
  })
})

describe('nextGameOrder', () => {
  it('同一天的下一個序號', () => {
    expect(nextGameOrder(GAMES, '2026-09-13')).toBe(3)
  })

  it('那天還沒有比賽就從 1 開始', () => {
    expect(nextGameOrder(GAMES, '2026-10-01')).toBe(1)
  })

  it('序號有跳號時接在最大值後面', () => {
    const gapped: Game[] = [{ ...GAMES[0]!, order: 5 }]
    expect(nextGameOrder(gapped, '2026-09-13')).toBe(6)
  })
})
