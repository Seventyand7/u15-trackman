/**
 * Firestore 扁平 collection 的資料模型。
 *
 * 時間欄位（createdAt / updatedAt）在領域模型裡一律是 epoch 毫秒（number），
 * 不是 Firestore 的 Timestamp。轉換放在 Firestore 存取層（階段 3），
 * 這樣 ranking.ts / players.ts 這類純邏輯就不用依賴 firebase SDK，測試也好寫。
 */

export type Id = string

export interface Season {
  id: Id
  /** 例如 "2026 秋季" */
  name: string
  createdAt: number
}

export interface Team {
  id: Id
  seasonId: Id
  name: string
}

export interface Player {
  id: Id
  seasonId: Id
  teamId: Id
  /** 字串，允許 "00"、"07" 這種前置零 */
  number: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface Game {
  id: Id
  seasonId: Id
  /** YYYY-MM-DD */
  date: string
  /** 當日場次序號，1 起算 */
  order: number
  teamAId: Id
  teamBId: Id
  youtubeUrl: string | null
}

/**
 * 投球事件。
 * 除了關聯欄位（seasonId / gameId / teamId / playerId）以外都可以是 null
 * ——Trackman 不是每球都抓得到，抓到了也可能缺欄位。
 */
export interface Pitch {
  id: Id
  seasonId: Id
  gameId: Id
  teamId: Id
  playerId: Id
  /** 球速 km/h，一位小數 */
  speed: number | null
  /** 轉速（轉），整數 */
  spin: number | null
  /** 轉軸 "H:MM"，H 為 1–12 */
  axis: string | null
  /** 水平位移，純文字原樣保存 */
  hBreak: string | null
  /** 垂直位移，純文字原樣保存 */
  vBreak: string | null
  /** 影片時間碼 "1:23:45" */
  videoTime: string | null
  createdAt: number
}

/** 擊球事件。同樣除了關聯欄位以外都可以是 null。 */
export interface BattedBall {
  id: Id
  seasonId: Id
  gameId: Id
  teamId: Id
  playerId: Id
  /** 擊球初速 km/h，一位小數 */
  exitVelo: number | null
  /** 仰角 °，一位小數，可為負 */
  launchAngle: number | null
  /** 擊球距離 m，兩位小數 */
  distance: number | null
  videoTime: string | null
  createdAt: number
}

/** 圖卡欄位勾選設定（settings/cardConfig），階段 4 使用。 */
export interface CardConfig {
  /** 投球區顯示哪些欄位（球速與轉速鎖定，一定在裡面） */
  pitchFields: PitchField[]
  /** 擊球區顯示哪些欄位（初速與距離鎖定） */
  battedFields: BattedField[]
}

export type PitchField = 'speed' | 'spin' | 'axis' | 'hBreak' | 'vBreak'
export type BattedField = 'exitVelo' | 'launchAngle' | 'distance'
