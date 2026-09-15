/**
 * 顯示格式（純函式）。記錄頁、圖卡、CSV 共用同一套，
 * 免得畫面上看到的數字和輸出的圖卡不一致。
 */

import type { Game, Player, Team } from '../types/models'
import type { RankCategory } from './ranking'

/** 缺值一律顯示這個 */
export const DASH = '-'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

/**
 * 'YYYY-MM-DD' → Date（本地時區）。
 * 不用 new Date('2026-09-13')，那會被當成 UTC 午夜，在某些時區算出來會差一天。
 */
export function parseISODate(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const parsed = new Date(y, mo - 1, d)
  // 擋掉 2026-02-31 這種會被 Date 自動進位的日期
  if (parsed.getFullYear() !== y || parsed.getMonth() !== mo - 1 || parsed.getDate() !== d) {
    return null
  }
  return parsed
}

/** '2026-09-13' → '2026.09.13（日）' */
export function formatGameDate(date: string): string {
  const d = parseISODate(date)
  if (!d) return date
  const weekday = WEEKDAYS[d.getDay()] ?? ''
  return `${date.replace(/-/g, '.')}（${weekday}）`
}

/** '2026-09-13' → '20260913'（檔名用） */
export function compactDate(date: string): string {
  return date.replace(/-/g, '')
}

/** 場次序號補零：1 → '01' */
export function formatOrder(order: number): string {
  return String(order).padStart(2, '0')
}

/** 今天的 'YYYY-MM-DD'（本地時區） */
export function todayISO(): string {
  const d = new Date()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mo}-${day}`
}

// ---------------------------------------------------------------------------
// 數值

/** 95.7 → '95.7 km/h' */
export function formatSpeed(v: number | null): string {
  return v === null ? DASH : `${v.toFixed(1)} km/h`
}

/** 1701 → '1701 轉' */
export function formatSpin(v: number | null): string {
  return v === null ? DASH : `${Math.round(v)} 轉`
}

/** 24.6 → '24.6°'（可為負） */
export function formatAngle(v: number | null): string {
  return v === null ? DASH : `${v.toFixed(1)}°`
}

/** 49.95 → '49.95 m' */
export function formatDistance(v: number | null): string {
  return v === null ? DASH : `${v.toFixed(2)} m`
}

/** 轉軸與位移都是原樣顯示的文字 */
export function formatText(v: string | null): string {
  const t = v?.trim() ?? ''
  return t === '' ? DASH : t
}

/** 某個排名項目的主數據該怎麼顯示（圖卡紅字的那個數字）。 */
export function formatPrimary(category: RankCategory, value: number | null): string {
  switch (category) {
    case 'pitchSpeed':
      return formatSpeed(value)
    case 'pitchSpin':
      return formatSpin(value)
    case 'exitVelo':
      return formatSpeed(value)
    case 'distance':
      return formatDistance(value)
  }
}

// ---------------------------------------------------------------------------
// 名稱

/** '5 王小明' */
export function formatPlayer(player: Player | null | undefined): string {
  return player ? `${player.number} ${player.name}` : DASH
}

/** '閃電女孩 5 王小明' */
export function formatTeamPlayer(
  team: Team | null | undefined,
  player: Player | null | undefined,
): string {
  const t = team?.name ?? DASH
  return `${t} ${formatPlayer(player)}`
}

/** '閃電女孩 vs 諾娜'——沒有場次序號，給記錄頁選比賽用。 */
export function formatMatchup(game: Game, teams: readonly Team[]): string {
  const a = teams.find((t) => t.id === game.teamAId)?.name ?? '?'
  const b = teams.find((t) => t.id === game.teamBId)?.name ?? '?'
  return `${a} vs ${b}`
}

/** '01. 閃電女孩 vs 諾娜'——圖卡的場次標題列與檔名用。 */
export function formatGameTitle(game: Game, teams: readonly Team[]): string {
  return `${formatOrder(game.order)}. ${formatMatchup(game, teams)}`
}

/**
 * 同一天有兩場對戰組合完全相同（雙重賽）時，只寫隊名分不出來，
 * 這種情況才需要把場次序號顯示出來。
 */
export function needsOrderLabel(sameDayGames: readonly Game[]): boolean {
  const keys = sameDayGames.map((g) => `${g.teamAId}|${g.teamBId}`)
  return new Set(keys).size !== keys.length
}

/** 所有有比賽的日期，新的在前。 */
export function gameDates(games: readonly Game[]): string[] {
  return [...new Set(games.map((g) => g.date))].sort().reverse()
}

/** '2026.09.13（日） 01. 閃電女孩 vs 諾娜' */
export function formatGameFull(game: Game, teams: readonly Team[]): string {
  return `${formatGameDate(game.date)} ${formatGameTitle(game, teams)}`
}

// ---------------------------------------------------------------------------
// 排序

/** 比賽排序：日期新的在前，同日場次序號小的在前。 */
export function compareGamesNewestFirst(a: Game, b: Game): number {
  if (a.date !== b.date) return a.date > b.date ? -1 : 1
  return a.order - b.order
}

/** 比賽排序：日期舊的在前，同日場次序號小的在前。 */
export function compareGamesOldestFirst(a: Game, b: Game): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return a.order - b.order
}

/** 同一天的下一個場次序號。 */
export function nextGameOrder(games: readonly Game[], date: string): number {
  const sameDay = games.filter((g) => g.date === date)
  return sameDay.reduce((max, g) => Math.max(max, g.order), 0) + 1
}
