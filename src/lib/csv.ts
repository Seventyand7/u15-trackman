/**
 * 季排名的 CSV 匯出（純函式）。
 *
 * 跟圖卡不一樣：CSV 一律帶全部數據欄位，不受圖卡勾選影響——
 * 圖卡是給人看的，CSV 是要進 Excel 的，欄位少了就補不回來。
 *
 * 數值用原始數字不加單位（95.7 而不是 "95.7 km/h"），
 * 這樣在 Excel 裡才排得了序、算得了平均。缺值是空白，不是 "-"。
 */

import type { RankCategory, RankEntry } from './ranking'
import { CATEGORY_META, RANK_CATEGORIES } from './ranking'
import type { BattedBall, Game, Id, Pitch, Player, Team } from '../types/models'

export const CSV_HEADERS = [
  '隊伍',
  '項目',
  '名次',
  '姓名',
  '背號',
  '球速',
  '轉速',
  '轉軸',
  '水平位移',
  '垂直位移',
  '擊球初速',
  '仰角',
  '擊球距離',
  '比賽日期',
  '場次',
] as const

/**
 * 一個欄位的 CSV 表示。
 * 逗號、雙引號、換行都要用雙引號包起來，雙引號本身要變成兩個。
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s === '') return ''
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function csvRow(cells: readonly (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(',')
}

/**
 * 背號欄。
 *
 * 背號允許 "00"、"07" 這種前置零，但 Excel 會把它當數字而吃掉零。
 * 只有在真的有前置零時才包成 ="00" 這種公式寫法讓 Excel 當文字處理——
 * 其餘情況維持純文字，不要沒事就往 CSV 裡塞公式。
 */
export function excelNumber(number: string | undefined): string {
  if (!number) return ''
  const trimmed = number.trim()
  if (trimmed === '') return ''
  return /^0\d/.test(trimmed) || /^00+$/.test(trimmed) ? `="${trimmed}"` : trimmed
}

export interface CsvInput {
  teams: readonly Team[]
  players: readonly Player[]
  games: readonly Game[]
  /** 每隊每個項目的前三名，teamId → category → entries */
  topByTeam: ReadonlyMap<Id, Record<RankCategory, RankEntry[]>>
}

function rowFor(
  entry: RankEntry,
  rank: number,
  category: RankCategory,
  input: CsvInput,
): (string | number | null)[] {
  const team = input.teams.find((t) => t.id === entry.teamId)
  const player = input.players.find((p) => p.id === entry.playerId)
  const game = input.games.find((g) => g.id === entry.gameId)

  const pitch = entry.kind === 'pitch' ? (entry.event as Pitch) : null
  const batted = entry.kind === 'battedBall' ? (entry.event as BattedBall) : null

  return [
    team?.name ?? '',
    CATEGORY_META[category].label,
    rank,
    player?.name ?? '',
    excelNumber(player?.number),
    pitch?.speed ?? null,
    pitch?.spin ?? null,
    pitch?.axis ?? null,
    pitch?.hBreak ?? null,
    pitch?.vBreak ?? null,
    batted?.exitVelo ?? null,
    batted?.launchAngle ?? null,
    batted?.distance ?? null,
    game?.date ?? '',
    game?.order ?? null,
  ]
}

/**
 * 產生 CSV 內容。
 * 順序：依隊伍（傳進來的順序）→ 項目（固定四項）→ 名次。
 */
export function buildRankingCsv(input: CsvInput): string {
  const lines: string[] = [csvRow(CSV_HEADERS)]

  for (const team of input.teams) {
    const top = input.topByTeam.get(team.id)
    if (!top) continue
    for (const meta of RANK_CATEGORIES) {
      top[meta.key].forEach((entry, i) => {
        lines.push(csvRow(rowFor(entry, i + 1, meta.key, input)))
      })
    }
  }

  return lines.join('\r\n')
}

/**
 * 轉成可下載的 Blob。
 *
 * 開頭要加 BOM：Excel 開沒有 BOM 的 UTF-8 CSV 會把中文變成亂碼。
 * 換行用 CRLF，也是為了 Excel。
 */
export function csvToBlob(csv: string): Blob {
  return new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
}

/** '2026 秋季' → '2026秋季_季排名.csv' */
export function rankingCsvFilename(seasonName: string): string {
  return `${seasonSlug(seasonName)}_季排名.csv`
}

/** 檔名用：去掉空白與檔案系統不接受的字元。 */
export function seasonSlug(seasonName: string): string {
  return seasonName.replace(/[\\/:*?"<>|\s]/g, '') || '球季'
}
