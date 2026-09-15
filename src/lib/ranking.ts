/**
 * 排名邏輯（純函式，不碰 Firebase、不碰 React）。
 *
 * 排序規則（四個項目共用）：
 *   1. 第一鍵大到小；第一鍵為 null 的事件不參與該項目排名
 *   2. 第二鍵大到小；null 視為最小
 *   3. 比賽日期早者優先
 *   4. 同日 game.order 小者優先
 *   5. createdAt 早者優先
 *
 * 「單場最佳」＝該場全部事件（兩隊合併）排序後的第一名。
 * 「各隊季前三名」＝該隊事件中，每位球員只留他在該項目的個人最佳一筆，再取前三。
 */

import type { BattedBall, Game, Id, Pitch } from '../types/models'

export type RankCategory = 'pitchSpeed' | 'pitchSpin' | 'exitVelo' | 'distance'
export type EventKind = 'pitch' | 'battedBall'

export interface CategoryMeta {
  key: RankCategory
  label: string
  kind: EventKind
}

export const RANK_CATEGORIES = [
  { key: 'pitchSpeed', label: '最快球速', kind: 'pitch' },
  { key: 'pitchSpin', label: '最快轉速', kind: 'pitch' },
  { key: 'exitVelo', label: '最快擊球初速', kind: 'battedBall' },
  { key: 'distance', label: '最遠擊球距離', kind: 'battedBall' },
] as const satisfies readonly CategoryMeta[]

export const CATEGORY_META: Record<RankCategory, CategoryMeta> = {
  pitchSpeed: RANK_CATEGORIES[0],
  pitchSpin: RANK_CATEGORIES[1],
  exitVelo: RANK_CATEGORIES[2],
  distance: RANK_CATEGORIES[3],
}

type PitchCategory = Extract<RankCategory, 'pitchSpeed' | 'pitchSpin'>
type BattedCategory = Extract<RankCategory, 'exitVelo' | 'distance'>

interface Keys<E> {
  primary: (e: E) => number | null
  secondary: (e: E) => number | null
}

const PITCH_KEYS: Record<PitchCategory, Keys<Pitch>> = {
  pitchSpeed: { primary: (p) => p.speed, secondary: (p) => p.spin },
  pitchSpin: { primary: (p) => p.spin, secondary: (p) => p.speed },
}

const BATTED_KEYS: Record<BattedCategory, Keys<BattedBall>> = {
  exitVelo: { primary: (b) => b.exitVelo, secondary: (b) => b.distance },
  distance: { primary: (b) => b.distance, secondary: (b) => b.exitVelo },
}

export function isPitchCategory(category: RankCategory): category is PitchCategory {
  return CATEGORY_META[category].kind === 'pitch'
}

// ---------------------------------------------------------------------------
// 排名項目

interface RankEntryBase {
  category: RankCategory
  playerId: Id
  teamId: Id
  gameId: Id
  /** 第一鍵。已經排除 null，所以這裡一定有值。 */
  primary: number
  /** 第二鍵，可能是 null（視為最小） */
  secondary: number | null
  /** 來自 game，排序用 */
  gameDate: string
  gameOrder: number
  createdAt: number
}

/** kind 是 discriminator，圖卡要拿 event 的其他欄位時可以直接 narrow。 */
export type RankEntry =
  | (RankEntryBase & { kind: 'pitch'; event: Pitch })
  | (RankEntryBase & { kind: 'battedBall'; event: BattedBall })

/**
 * 單一球季的全部事件。
 * 呼叫端已經依 seasonId 篩過（選定季後整季載入記憶體），這裡不再過濾球季。
 */
export interface EventPool {
  pitches: readonly Pitch[]
  battedBalls: readonly BattedBall[]
  games: readonly Game[]
}

export const EMPTY_POOL: EventPool = { pitches: [], battedBalls: [], games: [] }

export interface EntryFilter {
  gameId?: Id
  teamId?: Id
  playerId?: Id
}

// ---------------------------------------------------------------------------
// 比較

/**
 * 排序比較器：回傳負數代表 a 排在 b 前面。
 * 一律用大小比較而不是相減，避免把 null 當成 ±Infinity 再相減而產生 NaN。
 */
export function compareEntries(a: RankEntry, b: RankEntry): number {
  // 1. 第一鍵大到小
  if (a.primary !== b.primary) return a.primary > b.primary ? -1 : 1

  // 2. 第二鍵大到小，null 視為最小
  const as = a.secondary
  const bs = b.secondary
  if (as !== bs) {
    if (as === null) return 1
    if (bs === null) return -1
    return as > bs ? -1 : 1
  }

  // 3. 比賽日期早者優先（YYYY-MM-DD 可以直接比字串大小）
  if (a.gameDate !== b.gameDate) return a.gameDate < b.gameDate ? -1 : 1

  // 4. 同日場次序號小者優先
  if (a.gameOrder !== b.gameOrder) return a.gameOrder - b.gameOrder

  // 5. createdAt 早者優先
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt

  return 0
}

/** 排序（不改動輸入陣列）。 */
export function rankEntries(entries: readonly RankEntry[]): RankEntry[] {
  return [...entries].sort(compareEntries)
}

// ---------------------------------------------------------------------------
// 取出排名項目

function gameIndex(games: readonly Game[]): Map<Id, Game> {
  return new Map(games.map((g) => [g.id, g]))
}

function matches(e: { gameId: Id; teamId: Id; playerId: Id }, filter: EntryFilter): boolean {
  if (filter.gameId !== undefined && e.gameId !== filter.gameId) return false
  if (filter.teamId !== undefined && e.teamId !== filter.teamId) return false
  if (filter.playerId !== undefined && e.playerId !== filter.playerId) return false
  return true
}

/**
 * 把事件轉成某個項目的排名項目，並依規則排序。
 * 第一鍵為 null 的事件會被排除；找不到對應 game 的事件也會被排除（資料不一致時不炸掉）。
 */
export function entriesFor(
  pool: EventPool,
  category: RankCategory,
  filter: EntryFilter = {},
): RankEntry[] {
  const games = gameIndex(pool.games)
  const out: RankEntry[] = []

  if (isPitchCategory(category)) {
    const keys = PITCH_KEYS[category]
    for (const event of pool.pitches) {
      if (!matches(event, filter)) continue
      const game = games.get(event.gameId)
      if (!game) continue
      const primary = keys.primary(event)
      if (primary === null) continue
      out.push({
        kind: 'pitch',
        event,
        category,
        playerId: event.playerId,
        teamId: event.teamId,
        gameId: event.gameId,
        primary,
        secondary: keys.secondary(event),
        gameDate: game.date,
        gameOrder: game.order,
        createdAt: event.createdAt,
      })
    }
  } else {
    const keys = BATTED_KEYS[category]
    for (const event of pool.battedBalls) {
      if (!matches(event, filter)) continue
      const game = games.get(event.gameId)
      if (!game) continue
      const primary = keys.primary(event)
      if (primary === null) continue
      out.push({
        kind: 'battedBall',
        event,
        category,
        playerId: event.playerId,
        teamId: event.teamId,
        gameId: event.gameId,
        primary,
        secondary: keys.secondary(event),
        gameDate: game.date,
        gameOrder: game.order,
        createdAt: event.createdAt,
      })
    }
  }

  return out.sort(compareEntries)
}

/** 每位球員只留他排最前面的那一筆（輸入必須是已排序的結果）。 */
export function keepPersonalBest(sorted: readonly RankEntry[]): RankEntry[] {
  const seen = new Set<Id>()
  const out: RankEntry[] = []
  for (const entry of sorted) {
    if (seen.has(entry.playerId)) continue
    seen.add(entry.playerId)
    out.push(entry)
  }
  return out
}

function byCategory<T>(fn: (meta: CategoryMeta) => T): Record<RankCategory, T> {
  return {
    pitchSpeed: fn(CATEGORY_META.pitchSpeed),
    pitchSpin: fn(CATEGORY_META.pitchSpin),
    exitVelo: fn(CATEGORY_META.exitVelo),
    distance: fn(CATEGORY_META.distance),
  }
}

// ---------------------------------------------------------------------------
// 單場最佳

/** 單場四個項目的最佳（兩隊合併）。該場該項目沒資料時為 null。 */
export function gameBests(pool: EventPool, gameId: Id): Record<RankCategory, RankEntry | null> {
  return byCategory((meta) => entriesFor(pool, meta.key, { gameId })[0] ?? null)
}

/**
 * 某一隊在這場比賽的各項目最佳。
 *
 * 記錄的時候需要分隊看：強隊打弱隊時，合併的「本場最佳」會整欄被強隊佔滿，
 * 弱隊現在最好的是多少完全看不到。
 */
export function teamGameBests(
  pool: EventPool,
  gameId: Id,
  teamId: Id,
): Record<RankCategory, RankEntry | null> {
  return byCategory((meta) => entriesFor(pool, meta.key, { gameId, teamId })[0] ?? null)
}

/**
 * 這位球員在這場比賽的各項目最佳。
 *
 * 換上第二位投手時，他的球速就算沒破全場紀錄還是要記——季前三名是各隊各算的。
 * 所以要看得到他自己現在的水準在哪，而不是只看到全場第一名那個數字。
 */
export function playerGameBests(
  pool: EventPool,
  gameId: Id,
  playerId: Id,
): Record<RankCategory, RankEntry | null> {
  return byCategory((meta) => entriesFor(pool, meta.key, { gameId, playerId })[0] ?? null)
}

/** 這位球員這一季的各項目最佳（跨場次）。 */
export function playerSeasonBests(
  pool: EventPool,
  playerId: Id,
): Record<RankCategory, RankEntry | null> {
  return byCategory((meta) => entriesFor(pool, meta.key, { playerId })[0] ?? null)
}

// ---------------------------------------------------------------------------
// 「這一球要贏過多少才有意義」

/**
 * 這位球員要超過多少，這一筆才會動到該隊的季排名。
 * null 代表「怎樣都會進榜」——名單還沒滿而且他還沒有任何紀錄。
 *
 * 為什麼是這個數字：季排名每位球員只留個人最佳，所以
 *   已經在前 N 名的人 → 要贏過自己原本那筆，名次才會動
 *   還沒進前 N 名的人 → 要贏過第 N 名才擠得進去
 * 而在榜上的人他的個人最佳一定 >= 第 N 名，所以兩種情況合起來就是取大的那個。
 */
export function seasonTargetForPlayer(
  pool: EventPool,
  teamId: Id,
  playerId: Id,
  category: RankCategory,
  limit = 3,
): number | null {
  const best = keepPersonalBest(entriesFor(pool, category, { teamId }))
  const own = best.find((e) => e.playerId === playerId)
  const cutoff = best.length >= limit ? best[limit - 1] : undefined

  if (!own && !cutoff) return null
  if (!own) return cutoff!.primary
  if (!cutoff) return own.primary
  return Math.max(own.primary, cutoff.primary)
}

/** 這一筆要超過多少才會成為本場該項目的最佳（兩隊合併）。null 代表本場還沒有資料。 */
export function gameTarget(
  pool: EventPool,
  gameId: Id,
  category: RankCategory,
): number | null {
  return entriesFor(pool, category, { gameId })[0]?.primary ?? null
}

// ---------------------------------------------------------------------------
// 各隊季排名

/**
 * 該隊該季各項目前 N 名。
 * 每位球員只取個人最佳，所以名單裡必定是不同球員；不足 N 人就回傳實際筆數。
 */
export function teamTopEntries(
  pool: EventPool,
  teamId: Id,
  limit = 3,
): Record<RankCategory, RankEntry[]> {
  return byCategory((meta) =>
    keepPersonalBest(entriesFor(pool, meta.key, { teamId })).slice(0, limit),
  )
}

/** 季前三名門檻：滿 N 人時是第 N 名那筆，不足時代表「都記」。 */
export type Threshold =
  | { kind: 'open'; playerCount: number }
  | { kind: 'cutoff'; entry: RankEntry }

export function teamThresholds(
  pool: EventPool,
  teamId: Id,
  limit = 3,
): Record<RankCategory, Threshold> {
  return byCategory((meta) => {
    const best = keepPersonalBest(entriesFor(pool, meta.key, { teamId }))
    const cutoff = best[limit - 1]
    return cutoff ? { kind: 'cutoff', entry: cutoff } : { kind: 'open', playerCount: best.length }
  })
}

// ---------------------------------------------------------------------------
// 送出前的即時提示

/** 草稿事件用的暫時 id，不會寫進 Firestore。 */
export const DRAFT_EVENT_ID = '__draft__'

export type DraftEvent =
  | { kind: 'pitch'; event: Pitch }
  | { kind: 'battedBall'; event: BattedBall }

export interface DraftImpact {
  category: RankCategory
  label: string
  /** 這筆會成為本場該項目的第一名 */
  isGameBest: boolean
  /** 這筆在該隊季排名的名次（1 起算）；沒進前三為 null */
  seasonRank: number | null
  /** true＝取代自己原本的名次；false＝擠掉別人或填進空位 */
  replacesOwnEntry: boolean
}

/**
 * 判斷「如果現在送出這筆，排名會不會變」。
 *
 * 做法就是把草稿加進事件池重算一次排名，看草稿有沒有出現在結果裡——
 * 因為季排名本來就只留每位球員的個人最佳，所以「該球員已經在前三」的情況
 * 會自動被處理成取代他自己那一筆，而不是多佔一個名額。
 *
 * 草稿的 createdAt 一律視為最大值，代表「剛剛才建立」，
 * 所以跟既有紀錄完全同分時草稿排在後面——同分不會擠掉既有紀錄。
 *
 * 只回傳「有影響」的項目（成為本場第一，或進入該隊季前 N）。
 */
export function evaluateDraft(pool: EventPool, draft: DraftEvent, limit = 3): DraftImpact[] {
  const stamped = { ...draft.event, id: DRAFT_EVENT_ID, createdAt: Number.MAX_SAFE_INTEGER }
  const next: EventPool =
    draft.kind === 'pitch'
      ? { ...pool, pitches: [...pool.pitches, stamped as Pitch] }
      : { ...pool, battedBalls: [...pool.battedBalls, stamped as BattedBall] }

  const impacts: DraftImpact[] = []

  for (const meta of RANK_CATEGORIES) {
    if (meta.kind !== draft.kind) continue

    const isGameBest =
      entriesFor(next, meta.key, { gameId: stamped.gameId })[0]?.event.id === DRAFT_EVENT_ID

    const before = keepPersonalBest(
      entriesFor(pool, meta.key, { teamId: stamped.teamId }),
    ).slice(0, limit)
    const after = keepPersonalBest(
      entriesFor(next, meta.key, { teamId: stamped.teamId }),
    ).slice(0, limit)
    const index = after.findIndex((e) => e.event.id === DRAFT_EVENT_ID)

    if (!isGameBest && index === -1) continue

    impacts.push({
      category: meta.key,
      label: meta.label,
      isGameBest,
      seasonRank: index === -1 ? null : index + 1,
      replacesOwnEntry: index !== -1 && before.some((e) => e.playerId === stamped.playerId),
    })
  }

  return impacts
}
