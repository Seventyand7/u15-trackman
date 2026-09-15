/**
 * 球員身分管理（純函式，不碰 Firebase、不碰 React）。
 *
 * 這裡要防的最大風險是：同一個人被建成兩筆球員，季排名就會把他算成兩個人。
 * 常見成因是季中換背號——所以背號衝突偵測、同名偵測、合併三件事都放在這裡。
 *
 * 事件一律以 playerId 關聯，改背號或改名不需要動事件；
 * 只有「合併」才需要把事件的 playerId 搬家。
 */

import type { BattedBall, Id, Pitch, Player } from '../types/models'

// ---------------------------------------------------------------------------
// 正規化

/**
 * 姓名比對用：去掉所有空白。
 * JS 的 \s 已經包含全形空白 U+3000，所以「王 小明」和「王小明」會視為同名。
 */
export function normalizeName(name: string): string {
  return name.replace(/\s/g, '')
}

/**
 * 背號比對用：只去前後空白。
 * 不做數值正規化——規格明講允許 "00"，所以 "00" 和 "0" 是不同背號。
 */
export function normalizeNumber(number: string): string {
  return number.trim()
}

// ---------------------------------------------------------------------------
// 查詢

export interface PlayerScope {
  seasonId: Id
  teamId: Id
}

function inScope(p: Player, scope: PlayerScope): boolean {
  return p.seasonId === scope.seasonId && p.teamId === scope.teamId
}

/** 同季同隊依背號找球員（記錄頁打背號即時帶出姓名用）。 */
export function findPlayerByNumber(
  players: readonly Player[],
  scope: PlayerScope,
  number: string,
): Player | null {
  const target = normalizeNumber(number)
  return players.find((p) => inScope(p, scope) && normalizeNumber(p.number) === target) ?? null
}

/**
 * 同季同隊背號衝突偵測。
 * excludePlayerId 用於編輯既有球員時排除他自己。
 */
export function findNumberConflict(
  players: readonly Player[],
  scope: PlayerScope,
  number: string,
  excludePlayerId?: Id,
): Player | null {
  const target = normalizeNumber(number)
  return (
    players.find(
      (p) =>
        p.id !== excludePlayerId && inScope(p, scope) && normalizeNumber(p.number) === target,
    ) ?? null
  )
}

/** 同季同隊同名球員（完全相同，或去除空白後相同）。 */
export function findSameNamePlayers(
  players: readonly Player[],
  scope: PlayerScope,
  name: string,
  excludePlayerId?: Id,
): Player[] {
  const target = normalizeName(name)
  if (target === '') return []
  return players.filter(
    (p) => p.id !== excludePlayerId && inScope(p, scope) && normalizeName(p.name) === target,
  )
}

/** 某球員關聯到的事件筆數。 */
export interface EventCounts {
  pitches: number
  battedBalls: number
  total: number
}

export function countPlayerEvents(
  playerId: Id,
  pitches: readonly Pitch[],
  battedBalls: readonly BattedBall[],
): EventCounts {
  const p = pitches.filter((e) => e.playerId === playerId).length
  const b = battedBalls.filter((e) => e.playerId === playerId).length
  return { pitches: p, battedBalls: b, total: p + b }
}

// ---------------------------------------------------------------------------
// 新增球員

/**
 * 記錄頁輸入了一個不存在的背號、要新增球員時該怎麼辦。
 *
 * - number-taken：背號已被佔用，擋下並告訴使用者是誰佔用（理論上記錄頁不會走到，
 *   因為背號存在就會直接帶出球員；留著是為了資料管理頁的批次新增共用同一套判斷）
 * - same-name：同隊已有同名球員，很可能是換背號 → 問「是同一人還是不同人」
 * - create：直接新增
 */
export type AddPlayerPlan =
  | { kind: 'number-taken'; occupiedBy: Player }
  | { kind: 'same-name'; candidates: Player[] }
  | { kind: 'create' }

export function planAddPlayer(
  players: readonly Player[],
  scope: PlayerScope,
  input: { number: string; name: string },
): AddPlayerPlan {
  const occupiedBy = findNumberConflict(players, scope, input.number)
  if (occupiedBy) return { kind: 'number-taken', occupiedBy }

  const candidates = findSameNamePlayers(players, scope, input.name)
  if (candidates.length > 0) return { kind: 'same-name', candidates }

  return { kind: 'create' }
}

// ---------------------------------------------------------------------------
// 編輯球員（改背號／改名）

/**
 * 就地編輯的檢查結果。
 * ok 會附上影響筆數，給「將同步更新此球員所有歷史紀錄（共 N 筆）」這句提示用。
 */
export type EditPlayerPlan =
  | { kind: 'number-taken'; occupiedBy: Player }
  | { kind: 'empty-name' }
  | { kind: 'ok'; affected: EventCounts }

export function planEditPlayer(args: {
  player: Player
  nextNumber: string
  nextName: string
  players: readonly Player[]
  pitches: readonly Pitch[]
  battedBalls: readonly BattedBall[]
}): EditPlayerPlan {
  const { player, nextNumber, nextName, players, pitches, battedBalls } = args
  const scope: PlayerScope = { seasonId: player.seasonId, teamId: player.teamId }

  if (normalizeName(nextName) === '') return { kind: 'empty-name' }

  const occupiedBy = findNumberConflict(players, scope, nextNumber, player.id)
  if (occupiedBy) return { kind: 'number-taken', occupiedBy }

  return { kind: 'ok', affected: countPlayerEvents(player.id, pitches, battedBalls) }
}

/** 套用編輯，回傳新的球員陣列（不改動輸入）。 */
export function applyEditPlayer(
  players: readonly Player[],
  playerId: Id,
  next: { number: string; name: string },
  now: number,
): Player[] {
  return players.map((p) =>
    p.id === playerId
      ? { ...p, number: normalizeNumber(next.number), name: next.name.trim(), updatedAt: now }
      : p,
  )
}

// ---------------------------------------------------------------------------
// 刪除球員

/** 有事件關聯的球員禁止直接刪除，要改用合併。 */
export type DeletePlayerPlan =
  | { kind: 'blocked'; affected: EventCounts }
  | { kind: 'ok' }

export function planDeletePlayer(
  playerId: Id,
  pitches: readonly Pitch[],
  battedBalls: readonly BattedBall[],
): DeletePlayerPlan {
  const affected = countPlayerEvents(playerId, pitches, battedBalls)
  return affected.total > 0 ? { kind: 'blocked', affected } : { kind: 'ok' }
}

// ---------------------------------------------------------------------------
// 合併球員

export interface MergeSelection {
  /** 要保留的那筆球員 */
  keepId: Id
  /** 要刪掉的那筆球員 */
  removeId: Id
  /** 合併後用誰的背號 */
  numberFrom: 'keep' | 'remove'
  /** 合併後用誰的姓名 */
  nameFrom: 'keep' | 'remove'
}

export interface MergePlan {
  keep: Player
  remove: Player
  /** 合併後保留球員會變成的背號與姓名 */
  result: { number: string; name: string }
  /** 要把 playerId 改到 keep 身上的投球事件 */
  pitchIds: Id[]
  /** 要把 playerId 改到 keep 身上的擊球事件 */
  battedBallIds: Id[]
  /** 影響筆數，給執行前的確認畫面顯示 */
  affected: EventCounts
}

/**
 * 產生合併計畫。結構上不可能的組合直接 throw——UI 本來就不該讓使用者選到。
 * 實際寫入（Firestore batch/transaction）由呼叫端負責，這裡只算出要改什麼。
 */
export function planMergePlayers(args: {
  selection: MergeSelection
  players: readonly Player[]
  pitches: readonly Pitch[]
  battedBalls: readonly BattedBall[]
}): MergePlan {
  const { selection, players, pitches, battedBalls } = args

  if (selection.keepId === selection.removeId) {
    throw new Error('不能把球員合併到自己身上')
  }

  const keep = players.find((p) => p.id === selection.keepId)
  if (!keep) throw new Error(`找不到球員：${selection.keepId}`)
  const remove = players.find((p) => p.id === selection.removeId)
  if (!remove) throw new Error(`找不到球員：${selection.removeId}`)

  if (keep.seasonId !== remove.seasonId) {
    throw new Error('不同球季的球員不能合併')
  }
  if (keep.teamId !== remove.teamId) {
    throw new Error('不同隊伍的球員不能合併，請先確認是不是同一隊')
  }

  const number = normalizeNumber(
    selection.numberFrom === 'keep' ? keep.number : remove.number,
  )
  const name = (selection.nameFrom === 'keep' ? keep.name : remove.name).trim()

  // remove 會被刪掉，所以它原本佔的背號可以拿來用；
  // 但如果有第三位球員佔著這個背號（資料不一致），就要擋下來。
  const scope: PlayerScope = { seasonId: keep.seasonId, teamId: keep.teamId }
  const blocker = players.find(
    (p) =>
      p.id !== keep.id &&
      p.id !== remove.id &&
      inScope(p, scope) &&
      normalizeNumber(p.number) === number,
  )
  if (blocker) {
    throw new Error(`背號 ${number} 已經被 ${blocker.name} 使用，請先處理背號衝突`)
  }

  const pitchIds = pitches.filter((e) => e.playerId === remove.id).map((e) => e.id)
  const battedBallIds = battedBalls.filter((e) => e.playerId === remove.id).map((e) => e.id)

  return {
    keep,
    remove,
    result: { number, name },
    pitchIds,
    battedBallIds,
    affected: {
      pitches: pitchIds.length,
      battedBalls: battedBallIds.length,
      total: pitchIds.length + battedBallIds.length,
    },
  }
}

export interface MergedState {
  players: Player[]
  pitches: Pitch[]
  battedBalls: BattedBall[]
}

/**
 * 套用合併計畫，回傳合併後的資料（不改動輸入）。
 * 正式寫入走 Firestore batch；這個函式讓合併結果可以直接被測試，
 * 階段 6 的 JSON 匯入／匯出也用得到。
 */
export function applyMergePlan(
  plan: MergePlan,
  state: {
    players: readonly Player[]
    pitches: readonly Pitch[]
    battedBalls: readonly BattedBall[]
  },
  now: number,
): MergedState {
  const { keep, remove, result } = plan

  const players = state.players
    .filter((p) => p.id !== remove.id)
    .map((p) =>
      p.id === keep.id
        ? { ...p, number: result.number, name: result.name, updatedAt: now }
        : p,
    )

  const pitches = state.pitches.map((e) =>
    e.playerId === remove.id ? { ...e, playerId: keep.id } : e,
  )
  const battedBalls = state.battedBalls.map((e) =>
    e.playerId === remove.id ? { ...e, playerId: keep.id } : e,
  )

  return { players, pitches, battedBalls }
}
