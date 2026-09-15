import { describe, expect, it } from 'vitest'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFilename,
  buildSeasonBackup,
  parseSeasonBackup,
  summarizeBackup,
} from './backup'
import { GAMES, SEASON, TEAM_A, TEAM_B, batted, pitch, player } from './testFixtures'
import type { Season, Team } from '../types/models'

const season: Season = { id: SEASON, name: '2026 秋季', createdAt: 1000 }
const teams: Team[] = [
  { id: TEAM_A, seasonId: SEASON, name: '閃電女孩' },
  { id: TEAM_B, seasonId: SEASON, name: '諾娜' },
]
const players = [
  player('a1', { teamId: TEAM_A, number: '5', name: '王小明' }),
  player('a2', { teamId: TEAM_A, number: '00', name: '陳小華' }),
]
const pitches = [
  pitch('p1', { gameId: 'g1', teamId: TEAM_A, playerId: 'a1', speed: 135.6, spin: 2310, axis: '1:15' }),
  pitch('p2', { gameId: 'g1', teamId: TEAM_A, playerId: 'a2', speed: null, spin: 2000 }),
]
const battedBalls = [
  batted('b1', { gameId: 'g1', teamId: TEAM_A, playerId: 'a1', exitVelo: 118.3, launchAngle: -5.2, distance: 49.95 }),
]

function makeBackup() {
  return buildSeasonBackup({
    season,
    teams,
    players,
    games: GAMES,
    pitches,
    battedBalls,
    now: 2000,
  })
}

function roundTrip() {
  const result = parseSeasonBackup(JSON.stringify(makeBackup()))
  if (!result.ok) throw new Error(`解析失敗：${result.error}`)
  return result.backup
}

describe('buildSeasonBackup', () => {
  it('帶 format 與 version，之後才認得出舊檔', () => {
    const b = makeBackup()
    expect(b.format).toBe(BACKUP_FORMAT)
    expect(b.version).toBe(BACKUP_VERSION)
    expect(b.exportedAt).toBe(2000)
  })

  it('把整季的東西都裝進去', () => {
    const b = makeBackup()
    expect(b.teams).toHaveLength(2)
    expect(b.players).toHaveLength(2)
    expect(b.games).toHaveLength(3)
    expect(b.pitches).toHaveLength(2)
    expect(b.battedBalls).toHaveLength(1)
  })
})

describe('parseSeasonBackup — 來回一趟不會掉東西', () => {
  it('球季、隊伍、球員都還原得回來', () => {
    const b = roundTrip()
    expect(b.season).toEqual(season)
    expect(b.teams).toEqual(teams)
    expect(b.players).toEqual(players)
  })

  it('事件的數值與 null 都保留原樣', () => {
    const b = roundTrip()
    expect(b.pitches[0]).toEqual(pitches[0])
    // p2 的球速是 null，不能變成 0 或 undefined
    expect(b.pitches[1]?.speed).toBeNull()
    expect(b.pitches[1]?.axis).toBeNull()
  })

  it('負的仰角保留負號', () => {
    expect(roundTrip().battedBalls[0]?.launchAngle).toBe(-5.2)
  })

  it('背號 "00" 不會被轉成數字', () => {
    expect(roundTrip().players[1]?.number).toBe('00')
  })

  it('比賽的 youtubeUrl 是 null 時保持 null', () => {
    expect(roundTrip().games[0]?.youtubeUrl).toBeNull()
  })
})

describe('parseSeasonBackup — 壞掉的檔案要說清楚哪裡壞了', () => {
  it('不是 JSON', () => {
    const r = parseSeasonBackup('這不是 json')
    expect(r).toEqual({ ok: false, error: '這不是合法的 JSON 檔' })
  })

  it('不是這個工具的備份檔', () => {
    const r = parseSeasonBackup('{"format":"something-else"}')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('format')
  })

  it('版本比程式還新', () => {
    const r = parseSeasonBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99 }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('版本太新')
  })

  it('最外層不是物件', () => {
    expect(parseSeasonBackup('[]').ok).toBe(false)
  })

  it('缺少 season', () => {
    const r = parseSeasonBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1 }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('season')
  })

  it('collection 不是陣列時指出是哪一個', () => {
    const broken = { ...makeBackup(), teams: 'oops' }
    const r = parseSeasonBackup(JSON.stringify(broken))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('teams')
  })

  it('某一筆缺欄位時指出是第幾筆', () => {
    const b = makeBackup()
    const broken = { ...b, players: [b.players[0], { id: 'x', seasonId: SEASON, teamId: TEAM_A }] }
    const r = parseSeasonBackup(JSON.stringify(broken))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('球員第 2 筆')
      expect(r.error).toContain('name')
    }
  })

  it('數據欄位是奇怪的型別時當成沒填，不讓整個匯入失敗', () => {
    const b = makeBackup()
    const broken = { ...b, pitches: [{ ...b.pitches[0], speed: '很快' }] }
    const r = parseSeasonBackup(JSON.stringify(broken))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.backup.pitches[0]?.speed).toBeNull()
  })
})

describe('summarizeBackup', () => {
  it('數出各類筆數', () => {
    const s = summarizeBackup(makeBackup())
    expect(s).toMatchObject({
      seasonName: '2026 秋季',
      teams: 2,
      players: 2,
      games: 3,
      pitches: 2,
      battedBalls: 1,
      orphanEvents: 0,
    })
  })

  it('抓出指向不存在球員的事件', () => {
    const b = makeBackup()
    b.pitches.push(pitch('ghost', { gameId: 'g1', teamId: TEAM_A, playerId: '不存在' }))
    expect(summarizeBackup(b).orphanEvents).toBe(1)
  })

  it('抓出指向不存在比賽的事件', () => {
    const b = makeBackup()
    b.battedBalls.push(batted('ghost', { gameId: '不存在', teamId: TEAM_A, playerId: 'a1' }))
    expect(summarizeBackup(b).orphanEvents).toBe(1)
  })
})

describe('backupFilename', () => {
  it('球季名稱去空白加上日期', () => {
    expect(backupFilename('2026 秋季', new Date(2026, 8, 15))).toBe('2026秋季_20260915_備份.json')
  })

  it('名稱整個被清掉時有備案', () => {
    expect(backupFilename('   ', new Date(2026, 8, 15))).toBe('球季_20260915_備份.json')
  })
})
