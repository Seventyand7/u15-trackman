/**
 * 整季 JSON 備份（純邏輯）。
 *
 * 用途是「Firestore 資料掉了或被我改壞」時救得回來，所以：
 *
 * 1. 匯出帶 format 與 version，之後格式改了才認得出舊檔。
 * 2. 匯入一律**建立新的一季**，把所有 id 重新對應過。
 *    不覆蓋現有資料——備份還原最怕的就是拿舊檔蓋掉新資料。
 *    還原完兩季並存，可以比對過再把不要的那季刪掉。
 * 3. 解析要很防禦：這個 JSON 可能被手改過，壞掉的欄位要說清楚哪裡壞了，
 *    不能整頁白畫面。
 */

import type {
  BattedBall,
  Game,
  Id,
  Pitch,
  Player,
  Season,
  Team,
} from '../types/models'

export const BACKUP_FORMAT = 'u15-trackman-backup'
export const BACKUP_VERSION = 1

export interface SeasonBackup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: number
  season: Season
  teams: Team[]
  players: Player[]
  games: Game[]
  pitches: Pitch[]
  battedBalls: BattedBall[]
}

export function buildSeasonBackup(data: {
  season: Season
  teams: readonly Team[]
  players: readonly Player[]
  games: readonly Game[]
  pitches: readonly Pitch[]
  battedBalls: readonly BattedBall[]
  now?: number
}): SeasonBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: data.now ?? Date.now(),
    season: data.season,
    teams: [...data.teams],
    players: [...data.players],
    games: [...data.games],
    pitches: [...data.pitches],
    battedBalls: [...data.battedBalls],
  }
}

export function backupToBlob(backup: SeasonBackup): Blob {
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
}

/** '2026 秋季' → '2026秋季_20260915_備份.json' */
export function backupFilename(seasonName: string, now = new Date()): string {
  const slug = seasonName.replace(/[\\/:*?"<>|\s]/g, '') || '球季'
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${slug}_${y}${m}${d}_備份.json`
}

// ---------------------------------------------------------------------------
// 解析

export type ParseResult =
  | { ok: true; backup: SeasonBackup }
  | { ok: false; error: string }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function requireArray(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`備份檔的 ${field} 不是陣列`)
  return v
}

function str(row: Record<string, unknown>, key: string, where: string): string {
  const v = row[key]
  if (typeof v !== 'string' || v === '') throw new Error(`${where} 缺少 ${key}`)
  return v
}

function num(row: Record<string, unknown>, key: string, where: string): number {
  const v = row[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${where} 的 ${key} 不是數字`)
  return v
}

/** 數據欄位：可以是 null，但不能是 undefined 或別的型別。 */
function numOrNull(row: Record<string, unknown>, key: string): number | null {
  const v = row[key]
  if (v === null || v === undefined) return null
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function textOrNull(row: Record<string, unknown>, key: string): string | null {
  const v = row[key]
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

function rows(v: unknown, field: string): Record<string, unknown>[] {
  return requireArray(v, field).map((r, i) => {
    if (!isObject(r)) throw new Error(`${field} 第 ${i + 1} 筆不是物件`)
    return r
  })
}

export function parseSeasonBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: '這不是合法的 JSON 檔' }
  }

  if (!isObject(raw)) return { ok: false, error: '備份檔的最外層不是物件' }
  if (raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: '這不是這個工具匯出的備份檔（format 對不上）' }
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { ok: false, error: `備份檔版本太新（${String(raw.version)}），請更新這個網站` }
  }

  try {
    const seasonRaw = raw.season
    if (!isObject(seasonRaw)) throw new Error('備份檔缺少 season')

    const season: Season = {
      id: str(seasonRaw, 'id', '球季'),
      name: str(seasonRaw, 'name', '球季'),
      createdAt: numOrNull(seasonRaw, 'createdAt') ?? 0,
    }

    const teams: Team[] = rows(raw.teams, 'teams').map((r, i) => ({
      id: str(r, 'id', `隊伍第 ${i + 1} 筆`),
      seasonId: str(r, 'seasonId', `隊伍第 ${i + 1} 筆`),
      name: str(r, 'name', `隊伍第 ${i + 1} 筆`),
    }))

    const players: Player[] = rows(raw.players, 'players').map((r, i) => ({
      id: str(r, 'id', `球員第 ${i + 1} 筆`),
      seasonId: str(r, 'seasonId', `球員第 ${i + 1} 筆`),
      teamId: str(r, 'teamId', `球員第 ${i + 1} 筆`),
      // 背號允許 "0"，所以不能用 str()（它會擋空字串以外也擋不到 "0"，但型別要放寬）
      number: typeof r.number === 'string' ? r.number : String(r.number ?? ''),
      name: str(r, 'name', `球員第 ${i + 1} 筆`),
      createdAt: numOrNull(r, 'createdAt') ?? 0,
      updatedAt: numOrNull(r, 'updatedAt') ?? 0,
    }))

    const games: Game[] = rows(raw.games, 'games').map((r, i) => ({
      id: str(r, 'id', `比賽第 ${i + 1} 筆`),
      seasonId: str(r, 'seasonId', `比賽第 ${i + 1} 筆`),
      date: str(r, 'date', `比賽第 ${i + 1} 筆`),
      order: num(r, 'order', `比賽第 ${i + 1} 筆`),
      teamAId: str(r, 'teamAId', `比賽第 ${i + 1} 筆`),
      teamBId: str(r, 'teamBId', `比賽第 ${i + 1} 筆`),
      youtubeUrl: textOrNull(r, 'youtubeUrl'),
    }))

    const pitches: Pitch[] = rows(raw.pitches, 'pitches').map((r, i) => ({
      id: str(r, 'id', `投球第 ${i + 1} 筆`),
      seasonId: str(r, 'seasonId', `投球第 ${i + 1} 筆`),
      gameId: str(r, 'gameId', `投球第 ${i + 1} 筆`),
      teamId: str(r, 'teamId', `投球第 ${i + 1} 筆`),
      playerId: str(r, 'playerId', `投球第 ${i + 1} 筆`),
      speed: numOrNull(r, 'speed'),
      spin: numOrNull(r, 'spin'),
      axis: textOrNull(r, 'axis'),
      hBreak: textOrNull(r, 'hBreak'),
      vBreak: textOrNull(r, 'vBreak'),
      videoTime: textOrNull(r, 'videoTime'),
      createdAt: numOrNull(r, 'createdAt') ?? 0,
    }))

    const battedBalls: BattedBall[] = rows(raw.battedBalls, 'battedBalls').map((r, i) => ({
      id: str(r, 'id', `擊球第 ${i + 1} 筆`),
      seasonId: str(r, 'seasonId', `擊球第 ${i + 1} 筆`),
      gameId: str(r, 'gameId', `擊球第 ${i + 1} 筆`),
      teamId: str(r, 'teamId', `擊球第 ${i + 1} 筆`),
      playerId: str(r, 'playerId', `擊球第 ${i + 1} 筆`),
      exitVelo: numOrNull(r, 'exitVelo'),
      launchAngle: numOrNull(r, 'launchAngle'),
      distance: numOrNull(r, 'distance'),
      videoTime: textOrNull(r, 'videoTime'),
      createdAt: numOrNull(r, 'createdAt') ?? 0,
    }))

    return {
      ok: true,
      backup: {
        format: BACKUP_FORMAT,
        version: raw.version,
        exportedAt: numOrNull(raw, 'exportedAt') ?? 0,
        season,
        teams,
        players,
        games,
        pitches,
        battedBalls,
      },
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** 匯入前給人看的摘要。 */
export interface BackupSummary {
  seasonName: string
  exportedAt: number
  teams: number
  players: number
  games: number
  pitches: number
  battedBalls: number
  /** 指到不存在的隊伍／球員／比賽的事件筆數 */
  orphanEvents: number
}

export function summarizeBackup(backup: SeasonBackup): BackupSummary {
  const teamIds = new Set(backup.teams.map((t) => t.id))
  const playerIds = new Set(backup.players.map((p) => p.id))
  const gameIds = new Set(backup.games.map((g) => g.id))

  const isOrphan = (e: { teamId: Id; playerId: Id; gameId: Id }) =>
    !teamIds.has(e.teamId) || !playerIds.has(e.playerId) || !gameIds.has(e.gameId)

  return {
    seasonName: backup.season.name,
    exportedAt: backup.exportedAt,
    teams: backup.teams.length,
    players: backup.players.length,
    games: backup.games.length,
    pitches: backup.pitches.length,
    battedBalls: backup.battedBalls.length,
    orphanEvents:
      backup.pitches.filter(isOrphan).length + backup.battedBalls.filter(isOrphan).length,
  }
}
