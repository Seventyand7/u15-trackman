import { describe, expect, it } from 'vitest'
import {
  CSV_HEADERS,
  buildRankingCsv,
  csvCell,
  csvToBlob,
  excelNumber,
  rankingCsvFilename,
  seasonSlug,
  type CsvInput,
} from './csv'
import { teamTopEntries, type EventPool, type RankCategory, type RankEntry } from './ranking'
import { GAMES, SEASON, TEAM_A, TEAM_B, batted, pitch, player } from './testFixtures'
import type { Id, Team } from '../types/models'

const teams: Team[] = [
  { id: TEAM_A, seasonId: SEASON, name: '閃電女孩' },
  { id: TEAM_B, seasonId: SEASON, name: '諾娜' },
]

const players = [
  player('a1', { teamId: TEAM_A, number: '5', name: '王小明' }),
  player('a2', { teamId: TEAM_A, number: '00', name: '李大同' }),
  player('b1', { teamId: TEAM_B, number: '1', name: '張雅婷' }),
]

const pitches = [
  pitch('p1', {
    teamId: TEAM_A, playerId: 'a1', gameId: 'g1',
    speed: 135.6, spin: 2310, axis: '1:15', hBreak: '右 22', vBreak: '下 35',
  }),
  pitch('p2', { teamId: TEAM_A, playerId: 'a2', gameId: 'g2', speed: 128.4, spin: 2100 }),
  pitch('p3', { teamId: TEAM_B, playerId: 'b1', gameId: 'g1', speed: 131.0, spin: 1900 }),
]
const battedBalls = [
  batted('b1', {
    teamId: TEAM_A, playerId: 'a1', gameId: 'g1',
    exitVelo: 118.3, launchAngle: -5.2, distance: 49.95,
  }),
]

const pool: EventPool = { pitches, battedBalls, games: GAMES }

function makeInput(): CsvInput {
  const topByTeam = new Map<Id, Record<RankCategory, RankEntry[]>>()
  for (const t of teams) topByTeam.set(t.id, teamTopEntries(pool, t.id))
  return { teams, players, games: GAMES, topByTeam }
}

function rows(csv: string): string[] {
  return csv.split('\r\n')
}

describe('csvCell — 跳脫', () => {
  it('一般值原樣輸出', () => {
    expect(csvCell('王小明')).toBe('王小明')
    expect(csvCell(135.6)).toBe('135.6')
    expect(csvCell(0)).toBe('0')
  })

  it('null 與 undefined 是空白，不是 "-"', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('含逗號要加引號', () => {
    expect(csvCell('王,小明')).toBe('"王,小明"')
  })

  it('含雙引號要變成兩個並加引號', () => {
    expect(csvCell('他說"好"')).toBe('"他說""好"""')
  })

  it('含換行要加引號', () => {
    expect(csvCell('第一行\n第二行')).toBe('"第一行\n第二行"')
  })
})

describe('buildRankingCsv', () => {
  it('第一列是表頭', () => {
    expect(rows(buildRankingCsv(makeInput()))[0]).toBe(CSV_HEADERS.join(','))
  })

  it('表頭包含全部數據欄位，不受圖卡勾選影響', () => {
    for (const h of ['球速', '轉速', '轉軸', '水平位移', '垂直位移', '擊球初速', '仰角', '擊球距離']) {
      expect(CSV_HEADERS).toContain(h)
    }
  })

  it('依隊伍 → 項目 → 名次排列', () => {
    const body = rows(buildRankingCsv(makeInput())).slice(1)
    // 閃電女孩的最快球速：王小明 135.6 第一、李大同 128.4 第二
    expect(body[0]).toContain('閃電女孩,最快球速,1,王小明')
    expect(body[1]).toContain('閃電女孩,最快球速,2,李大同')
  })

  it('投球的列不會有擊球欄位的值，反之亦然', () => {
    const body = rows(buildRankingCsv(makeInput())).slice(1)
    const speedRow = body.find((r) => r.includes('最快球速,1'))!.split(',')
    // 球速有值、擊球初速留白
    expect(speedRow[5]).toBe('135.6')
    expect(speedRow[10]).toBe('')

    const veloRow = body.find((r) => r.includes('最快擊球初速,1'))!.split(',')
    expect(veloRow[5]).toBe('')
    expect(veloRow[10]).toBe('118.3')
  })

  it('數值是原始數字，沒有單位，Excel 才算得動', () => {
    const body = rows(buildRankingCsv(makeInput()))
    expect(body.join('\n')).not.toContain('km/h')
    expect(body.join('\n')).not.toContain(' 轉')
    expect(body.join('\n')).not.toContain('°')
  })

  it('負的仰角保留負號', () => {
    const body = rows(buildRankingCsv(makeInput()))
    expect(body.some((r) => r.includes('-5.2'))).toBe(true)
  })

  it('缺值是空白，不會出現破折號', () => {
    const body = rows(buildRankingCsv(makeInput()))
    // p2 沒有轉軸與位移
    const cells = body.find((r) => r.includes('李大同'))!.split(',')
    expect(cells[7]).toBe('') // 轉軸
    expect(cells[8]).toBe('') // 水平位移
    expect(cells[9]).toBe('') // 垂直位移
    expect(cells.includes('-')).toBe(false)
  })

  it('帶比賽日期與場次', () => {
    const body = rows(buildRankingCsv(makeInput())).slice(1)
    const row = body[0]!.split(',')
    expect(row[13]).toBe('2026-09-13')
    expect(row[14]).toBe('1')
  })

  it('每一隊都有自己的區段', () => {
    const csv = buildRankingCsv(makeInput())
    expect(csv).toContain('閃電女孩')
    expect(csv).toContain('諾娜')
  })

  it('沒有資料的項目不會產生列（不是空列）', () => {
    const body = rows(buildRankingCsv(makeInput())).slice(1)
    // 諾娜沒有擊球紀錄
    expect(body.some((r) => r.startsWith('諾娜,最遠擊球距離'))).toBe(false)
    expect(body.every((r) => r.trim() !== '')).toBe(true)
  })

  it('完全沒有資料時只有表頭', () => {
    const empty: CsvInput = { teams, players, games: GAMES, topByTeam: new Map() }
    expect(rows(buildRankingCsv(empty))).toHaveLength(1)
  })

  it('用 CRLF 換行（Excel 習慣）', () => {
    expect(buildRankingCsv(makeInput())).toContain('\r\n')
  })
})

describe('excelNumber — 背號欄', () => {
  it('有前置零時包成公式，Excel 才不會把零吃掉', () => {
    expect(excelNumber('00')).toBe('="00"')
    expect(excelNumber('07')).toBe('="07"')
  })

  it('一般背號維持純文字，不要沒事往 CSV 塞公式', () => {
    expect(excelNumber('5')).toBe('5')
    expect(excelNumber('15')).toBe('15')
    expect(excelNumber('0')).toBe('0')
  })

  it('空值是空白', () => {
    expect(excelNumber(undefined)).toBe('')
    expect(excelNumber('  ')).toBe('')
  })
})

describe('csvToBlob', () => {
  it('帶 UTF-8 BOM，Excel 開中文才不會亂碼', async () => {
    const blob = csvToBlob('隊伍,項目')
    // blob.text() 會依規範把 BOM 吃掉，所以要看原始 bytes
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
    expect(blob.type).toContain('charset=utf-8')
  })
})

describe('檔名', () => {
  it('去掉球季名稱裡的空白', () => {
    expect(rankingCsvFilename('2026 秋季')).toBe('2026秋季_季排名.csv')
  })

  it('去掉檔案系統不接受的字元', () => {
    expect(seasonSlug('2026/秋:季')).toBe('2026秋季')
  })

  it('名稱整個被清掉時有備案', () => {
    expect(seasonSlug('  ')).toBe('球季')
  })
})
