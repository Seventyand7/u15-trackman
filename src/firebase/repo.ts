/**
 * Firestore 存取層。UI 只透過這裡讀寫，不直接碰 firebase SDK。
 *
 * 幾個刻意的決定：
 *
 * 1. 查詢一律只用 `where('seasonId','==',id)`，排序在前端做。
 *    這樣不需要建任何複合索引——Firestore 的單欄位索引是自動的。
 *    資料量一季幾千筆，前端排序完全不是問題。
 *
 * 2. createdAt 用瀏覽器的 Date.now()，不用 serverTimestamp()。
 *    serverTimestamp() 在離線時是 null，要等伺服器回應才有值，
 *    而排名的最後一個決勝條件就是 createdAt——不能讓它暫時是 null。
 *    這個工具只有一個人在用，時鐘是一致的。
 *
 * 3. 寫入一律帶明確的 null，不用 undefined（Firestore 會拒絕 undefined）。
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './app'
import type { MergePlan } from '../lib/players'
import type {
  BattedBall,
  Game,
  Id,
  Pitch,
  Player,
  Season,
  Team,
} from '../types/models'
import type { NewBattedBall, NewPitch } from '../lib/validation'
import type { CardConfig } from '../types/models'
import type { SeasonBackup } from '../lib/backup'

export const COLLECTIONS = {
  seasons: 'seasons',
  teams: 'teams',
  players: 'players',
  games: 'games',
  pitches: 'pitches',
  battedBalls: 'battedBalls',
} as const

function col(name: string) {
  return collection(db(), name)
}

function withId<T>(id: string, data: Record<string, unknown>): T {
  return { id, ...data } as T
}

/** Firestore 一個 batch 最多 500 個操作，留一點餘裕。 */
const BATCH_LIMIT = 450

// ---------------------------------------------------------------------------
// 訂閱

/** 球季清單（不分季，全部載入——一年也就幾筆）。 */
export function subscribeSeasons(
  onData: (rows: Season[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    col(COLLECTIONS.seasons),
    (snap) => onData(snap.docs.map((d) => withId<Season>(d.id, d.data()))),
    onError,
  )
}

/** 某一季的某個 collection。選定季之後整季載入記憶體，排名在前端算。 */
export function subscribeBySeason<T>(
  collectionName: string,
  seasonId: Id,
  onData: (rows: T[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(col(collectionName), where('seasonId', '==', seasonId)),
    (snap) => onData(snap.docs.map((d) => withId<T>(d.id, d.data()))),
    onError,
  )
}

// ---------------------------------------------------------------------------
// 球季／隊伍／比賽

export async function createSeason(name: string): Promise<Id> {
  const ref = await addDoc(col(COLLECTIONS.seasons), { name: name.trim(), createdAt: Date.now() })
  return ref.id
}

export async function renameSeason(id: Id, name: string): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.seasons, id), { name: name.trim() })
}

/** 刪除球季前先算出會連帶刪掉多少東西，給確認畫面顯示。 */
export interface SeasonContents {
  teams: number
  players: number
  games: number
  pitches: number
  battedBalls: number
  total: number
}

export async function countSeasonContents(seasonId: Id): Promise<SeasonContents> {
  const [teams, players, games, pitches, battedBalls] = await Promise.all([
    fetchAllBySeason<{ id: Id }>(COLLECTIONS.teams, seasonId),
    fetchAllBySeason<{ id: Id }>(COLLECTIONS.players, seasonId),
    fetchAllBySeason<{ id: Id }>(COLLECTIONS.games, seasonId),
    fetchAllBySeason<{ id: Id }>(COLLECTIONS.pitches, seasonId),
    fetchAllBySeason<{ id: Id }>(COLLECTIONS.battedBalls, seasonId),
  ])
  return {
    teams: teams.length,
    players: players.length,
    games: games.length,
    pitches: pitches.length,
    battedBalls: battedBalls.length,
    total:
      teams.length + players.length + games.length + pitches.length + battedBalls.length,
  }
}

/**
 * 刪除球季，連同該季的隊伍、球員、比賽、投球、擊球全部清掉。
 *
 * 事件先刪、球季最後刪：萬一中途失敗，球季還在，可以重跑一次；
 * 反過來的話會留下一堆連不回任何球季的孤兒資料，比較難清。
 *
 * 這個動作沒得復原，呼叫端一定要先確認過。
 */
export async function deleteSeasonCascade(
  seasonId: Id,
  onProgress?: (p: ImportProgress) => void,
): Promise<void> {
  const order = [
    COLLECTIONS.pitches,
    COLLECTIONS.battedBalls,
    COLLECTIONS.games,
    COLLECTIONS.players,
    COLLECTIONS.teams,
  ]

  const refs: DocumentReference[] = []
  for (const name of order) {
    const rows = await fetchAllBySeason<{ id: Id }>(name, seasonId)
    for (const row of rows) refs.push(doc(db(), name, row.id))
  }

  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    const chunk = refs.slice(i, i + BATCH_LIMIT)
    for (const ref of chunk) batch.delete(ref)
    await batch.commit()
    onProgress?.({ done: Math.min(i + chunk.length, refs.length), total: refs.length })
  }

  await deleteDoc(doc(db(), COLLECTIONS.seasons, seasonId))
}

export async function createTeam(seasonId: Id, name: string): Promise<Id> {
  const ref = await addDoc(col(COLLECTIONS.teams), { seasonId, name: name.trim() })
  return ref.id
}

export async function renameTeam(id: Id, name: string): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.teams, id), { name: name.trim() })
}

export async function deleteTeam(id: Id): Promise<void> {
  await deleteDoc(doc(db(), COLLECTIONS.teams, id))
}

export type NewGame = Omit<Game, 'id'>

export async function createGame(input: NewGame): Promise<Id> {
  const ref = await addDoc(col(COLLECTIONS.games), { ...input })
  return ref.id
}

export async function updateGame(id: Id, patch: Partial<NewGame>): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.games, id), patch)
}

export async function deleteGame(id: Id): Promise<void> {
  await deleteDoc(doc(db(), COLLECTIONS.games, id))
}

// ---------------------------------------------------------------------------
// 球員

export interface NewPlayerInput {
  seasonId: Id
  teamId: Id
  number: string
  name: string
}

export async function createPlayer(input: NewPlayerInput): Promise<Id> {
  const now = Date.now()
  const ref = await addDoc(col(COLLECTIONS.players), {
    seasonId: input.seasonId,
    teamId: input.teamId,
    number: input.number.trim(),
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
  })
  return ref.id
}

/**
 * 改背號或改名。
 * 事件是用 playerId 關聯的，所以這裡不用動任何事件——歷史紀錄會自動跟著顯示新的背號姓名。
 */
export async function updatePlayer(
  id: Id,
  patch: { number?: string; name?: string },
): Promise<void> {
  const next: { updatedAt: number; number?: string; name?: string } = { updatedAt: Date.now() }
  if (patch.number !== undefined) next.number = patch.number.trim()
  if (patch.name !== undefined) next.name = patch.name.trim()
  await updateDoc(doc(db(), COLLECTIONS.players, id), next)
}

export async function deletePlayer(id: Id): Promise<void> {
  await deleteDoc(doc(db(), COLLECTIONS.players, id))
}

// ---------------------------------------------------------------------------
// 事件

export async function createPitch(input: NewPitch): Promise<Id> {
  const ref = await addDoc(col(COLLECTIONS.pitches), { ...input })
  return ref.id
}

export async function updatePitch(id: Id, patch: Partial<NewPitch>): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.pitches, id), patch)
}

export async function deletePitch(id: Id): Promise<void> {
  await deleteDoc(doc(db(), COLLECTIONS.pitches, id))
}

export async function createBattedBall(input: NewBattedBall): Promise<Id> {
  const ref = await addDoc(col(COLLECTIONS.battedBalls), { ...input })
  return ref.id
}

export async function updateBattedBall(id: Id, patch: Partial<NewBattedBall>): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.battedBalls, id), patch)
}

export async function deleteBattedBall(id: Id): Promise<void> {
  await deleteDoc(doc(db(), COLLECTIONS.battedBalls, id))
}

// ---------------------------------------------------------------------------
// 合併球員

/**
 * 執行合併：所有事件的 playerId 改到保留者身上、更新保留者的背號姓名、刪掉另一筆。
 * 超過 batch 上限就分批；刪除球員一定放在最後一批，
 * 這樣萬一中途失敗，兩筆球員都還在，可以重跑一次，不會變成孤兒事件。
 */
export async function applyMerge(plan: MergePlan): Promise<void> {
  const ops: { collection: string; id: Id }[] = [
    ...plan.pitchIds.map((id) => ({ collection: COLLECTIONS.pitches, id })),
    ...plan.battedBallIds.map((id) => ({ collection: COLLECTIONS.battedBalls, id })),
  ]

  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      batch.update(doc(db(), op.collection, op.id), { playerId: plan.keep.id })
    }
    await batch.commit()
  }

  const finalBatch = writeBatch(db())
  finalBatch.update(doc(db(), COLLECTIONS.players, plan.keep.id), {
    number: plan.result.number,
    name: plan.result.name,
    updatedAt: Date.now(),
  })
  finalBatch.delete(doc(db(), COLLECTIONS.players, plan.remove.id))
  await finalBatch.commit()
}

// ---------------------------------------------------------------------------
// 批次新增球員（資料管理頁的貼上名單）

export async function createPlayersBatch(inputs: readonly NewPlayerInput[]): Promise<number> {
  const now = Date.now()
  let written = 0
  for (let i = 0; i < inputs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    for (const input of inputs.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(col(COLLECTIONS.players)), {
        seasonId: input.seasonId,
        teamId: input.teamId,
        number: input.number.trim(),
        name: input.name.trim(),
        createdAt: now,
        updatedAt: now,
      })
      written += 1
    }
    await batch.commit()
  }
  return written
}

// ---------------------------------------------------------------------------
// 匯入整季備份
//
// 一律建立「新的一季」，所有 id 重新產生後把關聯重新對應。
// 不覆蓋任何現有資料——備份還原最怕的就是拿舊檔蓋掉新資料。

export interface ImportProgress {
  done: number
  total: number
}

export async function importSeasonAsNew(
  backup: SeasonBackup,
  seasonName: string,
  onProgress?: (p: ImportProgress) => void,
): Promise<Id> {
  const now = Date.now()
  const seasonId = await createSeason(seasonName)

  // 舊 id → 新 id。隊伍、球員、比賽要先配好，事件才對應得過去。
  const teamIds = new Map<Id, Id>()
  const playerIds = new Map<Id, Id>()
  const gameIds = new Map<Id, Id>()

  type Write = { ref: DocumentReference; data: Record<string, unknown> }
  const writes: Write[] = []

  function plan(collectionName: string, oldId: Id, ids: Map<Id, Id>): DocumentReference {
    const ref = doc(col(collectionName))
    ids.set(oldId, ref.id)
    return ref
  }

  for (const t of backup.teams) {
    writes.push({
      ref: plan(COLLECTIONS.teams, t.id, teamIds),
      data: { seasonId, name: t.name },
    })
  }

  for (const p of backup.players) {
    writes.push({
      ref: plan(COLLECTIONS.players, p.id, playerIds),
      data: {
        seasonId,
        teamId: teamIds.get(p.teamId) ?? '',
        number: p.number,
        name: p.name,
        createdAt: p.createdAt || now,
        updatedAt: now,
      },
    })
  }

  for (const g of backup.games) {
    writes.push({
      ref: plan(COLLECTIONS.games, g.id, gameIds),
      data: {
        seasonId,
        date: g.date,
        order: g.order,
        teamAId: teamIds.get(g.teamAId) ?? '',
        teamBId: teamIds.get(g.teamBId) ?? '',
        youtubeUrl: g.youtubeUrl,
      },
    })
  }

  const remap = (e: { teamId: Id; playerId: Id; gameId: Id }) => ({
    seasonId,
    teamId: teamIds.get(e.teamId) ?? '',
    playerId: playerIds.get(e.playerId) ?? '',
    gameId: gameIds.get(e.gameId) ?? '',
  })

  for (const e of backup.pitches) {
    writes.push({
      ref: doc(col(COLLECTIONS.pitches)),
      data: {
        ...remap(e),
        speed: e.speed,
        spin: e.spin,
        axis: e.axis,
        hBreak: e.hBreak,
        vBreak: e.vBreak,
        videoTime: e.videoTime,
        createdAt: e.createdAt || now,
      },
    })
  }

  for (const e of backup.battedBalls) {
    writes.push({
      ref: doc(col(COLLECTIONS.battedBalls)),
      data: {
        ...remap(e),
        exitVelo: e.exitVelo,
        launchAngle: e.launchAngle,
        distance: e.distance,
        videoTime: e.videoTime,
        createdAt: e.createdAt || now,
      },
    })
  }

  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    const chunk = writes.slice(i, i + BATCH_LIMIT)
    for (const w of chunk) batch.set(w.ref, w.data)
    await batch.commit()
    onProgress?.({ done: Math.min(i + chunk.length, writes.length), total: writes.length })
  }

  return seasonId
}

// ---------------------------------------------------------------------------
// 圖卡欄位勾選設定
//
// 不分球季，單場圖卡與季排名圖卡共用同一份，所以是固定的一個文件。

const CARD_CONFIG_PATH = ['settings', 'cardConfig'] as const

export function subscribeCardConfig(
  onData: (raw: Partial<CardConfig> | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db(), CARD_CONFIG_PATH[0], CARD_CONFIG_PATH[1]),
    (snap) => onData(snap.exists() ? (snap.data() as Partial<CardConfig>) : null),
    onError,
  )
}

export async function saveCardConfig(config: CardConfig): Promise<void> {
  await setDoc(doc(db(), CARD_CONFIG_PATH[0], CARD_CONFIG_PATH[1]), {
    pitchFields: config.pitchFields,
    battedFields: config.battedFields,
    updatedAt: Date.now(),
  })
}

// ---------------------------------------------------------------------------
// 一次性讀取（備份匯出用，階段 6）

export async function fetchAllBySeason<T>(collectionName: string, seasonId: Id): Promise<T[]> {
  const snap = await getDocs(query(col(collectionName), where('seasonId', '==', seasonId)))
  return snap.docs.map((d) => withId<T>(d.id, d.data()))
}

export type { BattedBall, Game, Pitch, Player, Season, Team }
