import { describe, expect, it } from 'vitest'
import {
  compareEntries,
  entriesFor,
  evaluateDraft,
  gameBests,
  keepPersonalBest,
  teamThresholds,
  teamTopEntries,
  type EventPool,
  type RankCategory,
  type RankEntry,
} from './ranking'
import { applyMergePlan, planMergePlayers } from './players'
import type { BattedBall, Pitch } from '../types/models'
import { GAMES, SEASON, TEAM_A, TEAM_B, batted, ids, pitch, player } from './testFixtures'

function pool(over: Partial<EventPool> = {}): EventPool {
  return { pitches: [], battedBalls: [], games: GAMES, ...over }
}

/** 把單一事件變成排名項目，用來直接測比較器。 */
function entryOf(event: Pitch | BattedBall, category: RankCategory): RankEntry {
  const source =
    'speed' in event ? { pitches: [event as Pitch] } : { battedBalls: [event as BattedBall] }
  const e = entriesFor(pool(source), category)[0]
  if (!e) throw new Error(`事件 ${event.id} 在 ${category} 沒有第一鍵，無法建立排名項目`)
  return e
}

/**
 * 比較器必須是反對稱的：a 排在 b 前面，就等於 b 排在 a 後面。
 * 只檢查 sort 的結果不夠——元素少的時候，不一致的比較器可能剛好排出正確答案。
 */
function expectOrdered(first: RankEntry, second: RankEntry): void {
  expect(compareEntries(first, second)).toBeLessThan(0)
  expect(compareEntries(second, first)).toBeGreaterThan(0)
}

// ---------------------------------------------------------------------------

describe('entriesFor — 第一鍵為 null', () => {
  it('球速為 null 的投球不參與最快球速排名', () => {
    const p = pool({
      pitches: [
        pitch('a', { playerId: 'p1', speed: 140, spin: 2000 }),
        pitch('b', { playerId: 'p2', speed: null, spin: 3000 }),
      ],
    })
    expect(ids(entriesFor(p, 'pitchSpeed'))).toEqual(['a'])
  })

  it('但同一筆的轉速還是可以參加最快轉速排名', () => {
    const p = pool({
      pitches: [
        pitch('a', { playerId: 'p1', speed: 140, spin: 2000 }),
        pitch('b', { playerId: 'p2', speed: null, spin: 3000 }),
      ],
    })
    // b 的轉速比較高，即使它沒有球速
    expect(ids(entriesFor(p, 'pitchSpin'))).toEqual(['b', 'a'])
  })

  it('四個欄位都是 null 的事件哪一項都不參加', () => {
    const p = pool({ pitches: [pitch('empty')], battedBalls: [batted('empty2')] })
    expect(entriesFor(p, 'pitchSpeed')).toHaveLength(0)
    expect(entriesFor(p, 'pitchSpin')).toHaveLength(0)
    expect(entriesFor(p, 'exitVelo')).toHaveLength(0)
    expect(entriesFor(p, 'distance')).toHaveLength(0)
  })

  it('找不到對應比賽的事件會被跳過，不會讓排名爆掉', () => {
    const p = pool({
      pitches: [
        pitch('orphan', { gameId: 'does-not-exist', speed: 200 }),
        pitch('ok', { speed: 130 }),
      ],
    })
    expect(ids(entriesFor(p, 'pitchSpeed'))).toEqual(['ok'])
  })
})

describe('compareEntries — 直接測比較器的五條規則', () => {
  it('1. 第一鍵大到小', () => {
    expectOrdered(
      entryOf(pitch('fast', { speed: 140 }), 'pitchSpeed'),
      entryOf(pitch('slow', { speed: 130 }), 'pitchSpeed'),
    )
  })

  it('2. 第一鍵相同時，第二鍵大到小', () => {
    expectOrdered(
      entryOf(pitch('highSpin', { speed: 130, spin: 2400 }), 'pitchSpeed'),
      entryOf(pitch('lowSpin', { speed: 130, spin: 1800 }), 'pitchSpeed'),
    )
  })

  it('2b. 第二鍵為 null 視為最小，且兩個方向的比較結果一致', () => {
    expectOrdered(
      entryOf(pitch('hasSpin', { speed: 130, spin: 1 }), 'pitchSpeed'),
      entryOf(pitch('nullSpin', { speed: 130, spin: null }), 'pitchSpeed'),
    )
  })

  it('2c. 第二鍵為 0 不等於 null，0 仍然排在 null 前面', () => {
    expectOrdered(
      entryOf(pitch('zeroSpin', { speed: 130, spin: 0 }), 'pitchSpeed'),
      entryOf(pitch('nullSpin', { speed: 130, spin: null }), 'pitchSpeed'),
    )
  })

  it('3. 前兩鍵相同時，比賽日期早者優先', () => {
    expectOrdered(
      entryOf(pitch('week1', { gameId: 'g1', speed: 130, spin: 2000 }), 'pitchSpeed'),
      entryOf(pitch('week2', { gameId: 'g3', speed: 130, spin: 2000 }), 'pitchSpeed'),
    )
  })

  it('4. 同日時，場次序號小者優先', () => {
    expectOrdered(
      entryOf(pitch('game1', { gameId: 'g1', speed: 130, spin: 2000 }), 'pitchSpeed'),
      entryOf(pitch('game2', { gameId: 'g2', speed: 130, spin: 2000 }), 'pitchSpeed'),
    )
  })

  it('5. 同場時，createdAt 早者優先', () => {
    expectOrdered(
      entryOf(pitch('first', { speed: 130, spin: 2000, createdAt: 100 }), 'pitchSpeed'),
      entryOf(pitch('second', { speed: 130, spin: 2000, createdAt: 200 }), 'pitchSpeed'),
    )
  })

  it('五個條件全部相同時回傳 0', () => {
    const a = entryOf(pitch('a', { speed: 130, spin: 2000, createdAt: 100 }), 'pitchSpeed')
    const b = entryOf(pitch('b', { speed: 130, spin: 2000, createdAt: 100 }), 'pitchSpeed')
    expect(compareEntries(a, b)).toBe(0)
    expect(compareEntries(b, a)).toBe(0)
  })

  it('兩邊第二鍵都是 null 時往下一條規則比，不會回傳 NaN', () => {
    const a = entryOf(pitch('a', { speed: 130, spin: null, createdAt: 100 }), 'pitchSpeed')
    const b = entryOf(pitch('b', { speed: 130, spin: null, createdAt: 200 }), 'pitchSpeed')
    expect(compareEntries(a, b)).toBeLessThan(0)
    expect(Number.isNaN(compareEntries(a, b))).toBe(false)
  })
})

describe('第二鍵', () => {
  it('第一鍵相同時比第二鍵，大的優先', () => {
    const p = pool({
      pitches: [
        pitch('low', { playerId: 'p1', speed: 130, spin: 1800 }),
        pitch('high', { playerId: 'p2', speed: 130, spin: 2400 }),
      ],
    })
    expect(ids(entriesFor(p, 'pitchSpeed'))).toEqual(['high', 'low'])
  })

  it('第二鍵為 null 視為最小，排在所有有值的後面', () => {
    const p = pool({
      pitches: [
        pitch('nullSpin', { playerId: 'p1', speed: 130, spin: null }),
        pitch('lowSpin', { playerId: 'p2', speed: 130, spin: 1 }),
        pitch('highSpin', { playerId: 'p3', speed: 130, spin: 2400 }),
      ],
    })
    expect(ids(entriesFor(p, 'pitchSpeed'))).toEqual(['highSpin', 'lowSpin', 'nullSpin'])
  })

  it('兩邊第二鍵都是 null 時往下一個條件比，不會算出 NaN', () => {
    const p = pool({
      pitches: [
        pitch('later', { playerId: 'p1', gameId: 'g2', speed: 130, spin: null }),
        pitch('earlier', { playerId: 'p2', gameId: 'g1', speed: 130, spin: null }),
      ],
    })
    // g1 的場次序號比 g2 小，所以 earlier 優先
    expect(ids(entriesFor(p, 'pitchSpeed'))).toEqual(['earlier', 'later'])
  })

  it('擊球初速相同時比距離', () => {
    const p = pool({
      battedBalls: [
        batted('short', { playerId: 'p1', exitVelo: 120, distance: 60 }),
        batted('long', { playerId: 'p2', exitVelo: 120, distance: 90 }),
      ],
    })
    expect(ids(entriesFor(p, 'exitVelo'))).toEqual(['long', 'short'])
  })

  it('距離相同時比擊球初速', () => {
    const p = pool({
      battedBalls: [
        batted('slow', { playerId: 'p1', exitVelo: 100, distance: 80 }),
        batted('fast', { playerId: 'p2', exitVelo: 130, distance: 80 }),
      ],
    })
    expect(ids(entriesFor(p, 'distance'))).toEqual(['fast', 'slow'])
  })
})

describe('完全同分的後續條件', () => {
  it('兩鍵都相同時，比賽日期早者優先', () => {
    const p = pool({
      pitches: [
        pitch('week2', { playerId: 'p1', gameId: 'g3', speed: 130, spin: 2000 }),
        pitch('week1', { playerId: 'p2', gameId: 'g1', speed: 130, spin: 2000 }),
      ],
    })
    expect(ids(entriesFor(p, 'pitchSpeed'))).toEqual(['week1', 'week2'])
  })

  it('同日時，場次序號小者優先', () => {
    const p = pool({
      pitches: [
        pitch('game2', { playerId: 'p1', gameId: 'g2', speed: 130, spin: 2000 }),
        pitch('game1', { playerId: 'p2', gameId: 'g1', speed: 130, spin: 2000 }),
      ],
    })
    expect(ids(entriesFor(p, 'pitchSpeed'))).toEqual(['game1', 'game2'])
  })

  it('同場時，createdAt 早者優先', () => {
    const p = pool({
      pitches: [
        pitch('typedSecond', { playerId: 'p1', speed: 130, spin: 2000, createdAt: 200 }),
        pitch('typedFirst', { playerId: 'p2', speed: 130, spin: 2000, createdAt: 100 }),
      ],
    })
    expect(ids(entriesFor(p, 'pitchSpeed'))).toEqual(['typedFirst', 'typedSecond'])
  })

  it('五個條件全部相同時維持輸入順序（穩定排序）', () => {
    const p = pool({
      pitches: [
        pitch('first', { playerId: 'p1', speed: 130, spin: 2000, createdAt: 100 }),
        pitch('second', { playerId: 'p2', speed: 130, spin: 2000, createdAt: 100 }),
      ],
    })
    expect(ids(entriesFor(p, 'pitchSpeed'))).toEqual(['first', 'second'])
  })
})

describe('gameBests — 單場最佳', () => {
  it('兩隊合併後取第一名', () => {
    const p = pool({
      pitches: [
        pitch('aPitch', { teamId: TEAM_A, playerId: 'p1', speed: 128.4, spin: 2100 }),
        pitch('bPitch', { teamId: TEAM_B, playerId: 'p9', speed: 131.2, spin: 1900 }),
      ],
      battedBalls: [
        batted('aHit', { teamId: TEAM_A, playerId: 'p2', exitVelo: 118.0, distance: 70.5 }),
      ],
    })
    const best = gameBests(p, 'g1')
    expect(best.pitchSpeed?.event.id).toBe('bPitch') // 客隊贏球速
    expect(best.pitchSpin?.event.id).toBe('aPitch') // 主隊贏轉速
    expect(best.exitVelo?.event.id).toBe('aHit')
    expect(best.distance?.event.id).toBe('aHit')
  })

  it('該場沒資料的項目回傳 null（圖卡要顯示「無資料」）', () => {
    const p = pool({ pitches: [pitch('only', { speed: 130 })] })
    const best = gameBests(p, 'g1')
    expect(best.pitchSpeed?.event.id).toBe('only')
    expect(best.exitVelo).toBeNull()
    expect(best.distance).toBeNull()
  })

  it('只看指定的那一場，不會混到別場', () => {
    const p = pool({
      pitches: [
        pitch('fastInG3', { gameId: 'g3', playerId: 'p1', speed: 145 }),
        pitch('slowInG1', { gameId: 'g1', playerId: 'p2', speed: 120 }),
      ],
    })
    expect(gameBests(p, 'g1').pitchSpeed?.event.id).toBe('slowInG1')
  })

  it('同一筆事件可以同時是多個項目的最佳', () => {
    const p = pool({
      pitches: [
        pitch('monster', { playerId: 'p1', speed: 140, spin: 2600 }),
        pitch('normal', { playerId: 'p2', speed: 125, spin: 1800 }),
      ],
    })
    const best = gameBests(p, 'g1')
    expect(best.pitchSpeed?.event.id).toBe('monster')
    expect(best.pitchSpin?.event.id).toBe('monster')
  })
})

describe('teamTopEntries — 各隊季前三名', () => {
  it('同一位球員包辦前三時只留他最好的那一筆', () => {
    const p = pool({
      pitches: [
        pitch('ace1', { playerId: 'ace', speed: 140 }),
        pitch('ace2', { playerId: 'ace', speed: 138 }),
        pitch('ace3', { playerId: 'ace', speed: 136 }),
        pitch('other1', { playerId: 'p2', speed: 130 }),
        pitch('other2', { playerId: 'p3', speed: 125 }),
      ],
    })
    const top = teamTopEntries(p, TEAM_A).pitchSpeed
    expect(ids(top)).toEqual(['ace1', 'other1', 'other2'])
    expect(new Set(top.map((e) => e.playerId)).size).toBe(3) // 必定三位不同球員
  })

  it('個人最佳的判定也用同一套比較規則（球速同分時比轉速）', () => {
    const p = pool({
      pitches: [
        pitch('lowSpin', { playerId: 'ace', speed: 140, spin: 1800 }),
        pitch('highSpin', { playerId: 'ace', speed: 140, spin: 2500 }),
      ],
    })
    expect(ids(teamTopEntries(p, TEAM_A).pitchSpeed)).toEqual(['highSpin'])
  })

  it('不足三人就回傳實際人數', () => {
    const p = pool({
      pitches: [
        pitch('a', { playerId: 'p1', speed: 130 }),
        pitch('b', { playerId: 'p2', speed: 125 }),
      ],
    })
    expect(ids(teamTopEntries(p, TEAM_A).pitchSpeed)).toEqual(['a', 'b'])
  })

  it('完全沒資料時是空陣列', () => {
    expect(teamTopEntries(pool(), TEAM_A).pitchSpeed).toEqual([])
  })

  it('只算該隊的事件，不會混到對手', () => {
    const p = pool({
      pitches: [
        pitch('mine', { teamId: TEAM_A, playerId: 'p1', speed: 120 }),
        pitch('theirs', { teamId: TEAM_B, playerId: 'p9', speed: 150 }),
      ],
    })
    expect(ids(teamTopEntries(p, TEAM_A).pitchSpeed)).toEqual(['mine'])
    expect(ids(teamTopEntries(p, TEAM_B).pitchSpeed)).toEqual(['theirs'])
  })

  it('跨場次累積整季', () => {
    const p = pool({
      pitches: [
        pitch('g1p', { gameId: 'g1', playerId: 'p1', speed: 130 }),
        pitch('g2p', { gameId: 'g2', playerId: 'p2', speed: 135 }),
        pitch('g3p', { gameId: 'g3', playerId: 'p3', speed: 128 }),
      ],
    })
    expect(ids(teamTopEntries(p, TEAM_A).pitchSpeed)).toEqual(['g2p', 'g1p', 'g3p'])
  })
})

describe('keepPersonalBest', () => {
  it('保留每位球員第一次出現的那一筆，順序不變', () => {
    const p = pool({
      pitches: [
        pitch('a', { playerId: 'p1', speed: 140 }),
        pitch('b', { playerId: 'p2', speed: 135 }),
        pitch('c', { playerId: 'p1', speed: 130 }),
      ],
    })
    expect(ids(keepPersonalBest(entriesFor(p, 'pitchSpeed')))).toEqual(['a', 'b'])
  })
})

describe('teamThresholds — 季前三名門檻', () => {
  it('滿三人時回傳第三名那筆', () => {
    const p = pool({
      pitches: [
        pitch('a', { playerId: 'p1', speed: 140 }),
        pitch('b', { playerId: 'p2', speed: 135 }),
        pitch('c', { playerId: 'p3', speed: 130 }),
        pitch('d', { playerId: 'p4', speed: 125 }),
      ],
    })
    const t = teamThresholds(p, TEAM_A).pitchSpeed
    expect(t.kind).toBe('cutoff')
    if (t.kind === 'cutoff') {
      expect(t.entry.event.id).toBe('c')
      expect(t.entry.primary).toBe(130)
    }
  })

  it('不足三人時回傳 open 與目前人數（畫面顯示「未滿 3 人，都記」）', () => {
    const p = pool({
      pitches: [
        pitch('a', { playerId: 'p1', speed: 140 }),
        pitch('b', { playerId: 'p2', speed: 135 }),
      ],
    })
    const t = teamThresholds(p, TEAM_A).pitchSpeed
    expect(t).toEqual({ kind: 'open', playerCount: 2 })
  })

  it('同一球員的多筆紀錄不會湊足三人', () => {
    const p = pool({
      pitches: [
        pitch('a', { playerId: 'solo', speed: 140 }),
        pitch('b', { playerId: 'solo', speed: 135 }),
        pitch('c', { playerId: 'solo', speed: 130 }),
      ],
    })
    expect(teamThresholds(p, TEAM_A).pitchSpeed).toEqual({ kind: 'open', playerCount: 1 })
  })

  it('完全沒資料時是 0 人', () => {
    expect(teamThresholds(pool(), TEAM_A).distance).toEqual({ kind: 'open', playerCount: 0 })
  })
})

describe('evaluateDraft — 送出前的即時提示', () => {
  // createdAt 刻意給非 0 的值：草稿的 createdAt 視為最大，同分時才驗得出來它排在後面。
  const existing = pool({
    pitches: [
      pitch('e1', { playerId: 'p1', speed: 135, spin: 2200, createdAt: 100 }),
      pitch('e2', { playerId: 'p2', speed: 130, spin: 2100, createdAt: 200 }),
      pitch('e3', { playerId: 'p3', speed: 125, spin: 2000, createdAt: 300 }),
    ],
  })

  it('比所有人都快時，同時標示本場最佳與季第一', () => {
    const impacts = evaluateDraft(existing, {
      kind: 'pitch',
      event: pitch('draft', { playerId: 'p4', speed: 145, spin: 2300 }),
    })
    const speed = impacts.find((i) => i.category === 'pitchSpeed')
    expect(speed).toMatchObject({
      label: '最快球速',
      isGameBest: true,
      seasonRank: 1,
      replacesOwnEntry: false,
    })
  })

  it('沒有任何影響時回傳空陣列', () => {
    const impacts = evaluateDraft(existing, {
      kind: 'pitch',
      event: pitch('draft', { playerId: 'p4', speed: 100, spin: 900 }),
    })
    expect(impacts).toEqual([])
  })

  it('跟既有紀錄完全同分時不會擠掉對方（createdAt 視為最新）', () => {
    const impacts = evaluateDraft(existing, {
      kind: 'pitch',
      event: pitch('draft', { playerId: 'p4', speed: 135, spin: 2200 }),
    })
    const speed = impacts.find((i) => i.category === 'pitchSpeed')
    expect(speed?.isGameBest).toBe(false)
    expect(speed?.seasonRank).toBe(2) // 排在 e1 後面，仍然進前三
  })

  it('球員原本就在前三時，標示為取代自己的名次', () => {
    const impacts = evaluateDraft(existing, {
      kind: 'pitch',
      event: pitch('draft', { playerId: 'p3', speed: 140, spin: 2400 }),
    })
    const speed = impacts.find((i) => i.category === 'pitchSpeed')
    expect(speed).toMatchObject({ seasonRank: 1, replacesOwnEntry: true })
  })

  it('球員原本在前三、但這筆比他自己的最佳差，就不進榜', () => {
    const impacts = evaluateDraft(existing, {
      kind: 'pitch',
      event: pitch('draft', { playerId: 'p1', speed: 128, spin: 1000 }),
    })
    expect(impacts.find((i) => i.category === 'pitchSpeed')).toBeUndefined()
  })

  it('一筆草稿可以同時對球速與轉速兩個項目有影響', () => {
    const impacts = evaluateDraft(existing, {
      kind: 'pitch',
      event: pitch('draft', { playerId: 'p4', speed: 150, spin: 3000 }),
    })
    expect(impacts.map((i) => i.category).sort()).toEqual(['pitchSpeed', 'pitchSpin'])
    expect(impacts.every((i) => i.isGameBest && i.seasonRank === 1)).toBe(true)
  })

  it('投球草稿不會去評估擊球項目', () => {
    const impacts = evaluateDraft(existing, {
      kind: 'pitch',
      event: pitch('draft', { playerId: 'p4', speed: 150 }),
    })
    expect(impacts.some((i) => i.category === 'exitVelo' || i.category === 'distance')).toBe(false)
  })

  it('擊球草稿正常評估初速與距離', () => {
    const p = pool({
      battedBalls: [batted('e1', { playerId: 'p1', exitVelo: 120, distance: 80 })],
    })
    const impacts = evaluateDraft(p, {
      kind: 'battedBall',
      event: batted('draft', { playerId: 'p2', exitVelo: 130, distance: 95.5 }),
    })
    expect(impacts.map((i) => i.category).sort()).toEqual(['distance', 'exitVelo'])
  })

  it('空的球季裡第一筆資料就是第一名', () => {
    const impacts = evaluateDraft(pool(), {
      kind: 'pitch',
      event: pitch('draft', { playerId: 'p1', speed: 110 }),
    })
    expect(impacts.find((i) => i.category === 'pitchSpeed')).toMatchObject({
      isGameBest: true,
      seasonRank: 1,
    })
  })

  it('不會改動原本的事件池', () => {
    const before = existing.pitches.length
    evaluateDraft(existing, {
      kind: 'pitch',
      event: pitch('draft', { playerId: 'p4', speed: 160 }),
    })
    expect(existing.pitches).toHaveLength(before)
  })
})

describe('球員合併後排名正確', () => {
  it('同一人被建成兩筆時會佔掉兩個名額，合併後只剩一筆，第四人遞補', () => {
    // 5 號王小明季中換 15 號，被誤建成兩筆球員
    const players = [
      player('dup-5', { number: '5', name: '王小明' }),
      player('dup-15', { number: '15', name: '王小明' }),
      player('other-a', { number: '7', name: '李大同' }),
      player('other-b', { number: '9', name: '陳小華' }),
    ]
    const pitches = [
      pitch('fast', { playerId: 'dup-15', speed: 140 }),
      pitch('second', { playerId: 'dup-5', speed: 138 }),
      pitch('third', { playerId: 'other-a', speed: 132 }),
      pitch('fourth', { playerId: 'other-b', speed: 128 }),
    ]

    const before = teamTopEntries(pool({ pitches }), TEAM_A).pitchSpeed
    // 合併前：同一個人佔了第一、第二名，陳小華被擠出前三
    expect(ids(before)).toEqual(['fast', 'second', 'third'])

    const plan = planMergePlayers({
      selection: { keepId: 'dup-5', removeId: 'dup-15', numberFrom: 'remove', nameFrom: 'keep' },
      players,
      pitches,
      battedBalls: [],
    })
    expect(plan.affected.total).toBe(1)
    expect(plan.result).toEqual({ number: '15', name: '王小明' })

    const merged = applyMergePlan(plan, { players, pitches, battedBalls: [] }, 1_000)
    const after = teamTopEntries(pool({ pitches: merged.pitches }), TEAM_A).pitchSpeed

    // 合併後：王小明只留最快的那筆，陳小華遞補進第三
    expect(ids(after)).toEqual(['fast', 'third', 'fourth'])
    expect(after.every((e) => e.playerId !== 'dup-15')).toBe(true)
    expect(after[0]?.playerId).toBe('dup-5')
  })

  it('合併後單場最佳指向保留的那筆球員', () => {
    const players = [
      player('keep', { number: '5', name: '王小明' }),
      player('gone', { number: '15', name: '王小明' }),
    ]
    const pitches = [pitch('best', { playerId: 'gone', speed: 141 })]

    const plan = planMergePlayers({
      selection: { keepId: 'keep', removeId: 'gone', numberFrom: 'remove', nameFrom: 'keep' },
      players,
      pitches,
      battedBalls: [],
    })
    const merged = applyMergePlan(plan, { players, pitches, battedBalls: [] }, 1_000)

    const best = gameBests(pool({ pitches: merged.pitches }), 'g1').pitchSpeed
    expect(best?.playerId).toBe('keep')
    expect(merged.players).toHaveLength(1)
    expect(merged.players[0]).toMatchObject({ id: 'keep', number: '15', name: '王小明' })
  })

  it('投球與擊球事件都要跟著搬家', () => {
    const players = [player('keep', { number: '5' }), player('gone', { number: '15' })]
    const pitches = [pitch('p', { playerId: 'gone', speed: 130 })]
    const battedBalls = [batted('b', { playerId: 'gone', exitVelo: 120, distance: 85 })]

    const plan = planMergePlayers({
      selection: { keepId: 'keep', removeId: 'gone', numberFrom: 'keep', nameFrom: 'keep' },
      players,
      pitches,
      battedBalls,
    })
    expect(plan.affected).toEqual({ pitches: 1, battedBalls: 1, total: 2 })

    const merged = applyMergePlan(plan, { players, pitches, battedBalls }, 1_000)
    expect(teamTopEntries(pool(merged), TEAM_A).distance[0]?.playerId).toBe('keep')
    expect(merged.pitches[0]?.playerId).toBe('keep')
  })
})

describe('球季隔離', () => {
  it('事件池只放單季資料，排名不跨季（呼叫端負責篩 seasonId）', () => {
    const p = pool({
      pitches: [pitch('thisSeason', { seasonId: SEASON, playerId: 'p1', speed: 130 })],
    })
    expect(ids(entriesFor(p, 'pitchSpeed'))).toEqual(['thisSeason'])
  })
})
