/**
 * 圖卡欄位勾選設定（純邏輯）。
 *
 * 「主數據」是那個區塊排名所依據的欄位，一定要顯示，不然那張圖卡沒有意義：
 *   最快球速區 → 球速　最快轉速區 → 轉速
 *   最快擊球初速區 → 擊球初速　最遠擊球距離區 → 擊球距離
 *
 * 但投球的兩個區共用同一組勾選（擊球的兩個區也是），
 * 所以實際上球速與轉速在投球區都鎖定，初速與距離在擊球區都鎖定。
 */

import type { BattedField, CardConfig, PitchField } from '../types/models'
import type { RankCategory } from './ranking'

/** 勾選與顯示都照這個順序 */
export const PITCH_FIELD_ORDER = ['speed', 'spin', 'axis', 'hBreak', 'vBreak'] as const
export const BATTED_FIELD_ORDER = ['exitVelo', 'launchAngle', 'distance'] as const

export const PITCH_FIELD_LABELS: Record<PitchField, string> = {
  speed: '球速',
  spin: '轉速',
  axis: '轉軸',
  hBreak: '水平位移',
  vBreak: '垂直位移',
}

export const BATTED_FIELD_LABELS: Record<BattedField, string> = {
  exitVelo: '擊球初速',
  launchAngle: '仰角',
  distance: '擊球距離',
}

/** 預設與目前交出去的格式相同 */
export const DEFAULT_CARD_CONFIG: CardConfig = {
  pitchFields: ['speed', 'spin', 'axis'],
  battedFields: ['exitVelo', 'launchAngle', 'distance'],
}

export const LOCKED_PITCH_FIELDS: readonly PitchField[] = ['speed', 'spin']
export const LOCKED_BATTED_FIELDS: readonly BattedField[] = ['exitVelo', 'distance']

export function isPitchFieldLocked(field: PitchField): boolean {
  return LOCKED_PITCH_FIELDS.includes(field)
}

export function isBattedFieldLocked(field: BattedField): boolean {
  return LOCKED_BATTED_FIELDS.includes(field)
}

/** 每個排名項目的主數據欄位（圖卡上用紅色粗體的那一格）。 */
export const PRIMARY_FIELD: Record<RankCategory, PitchField | BattedField> = {
  pitchSpeed: 'speed',
  pitchSpin: 'spin',
  exitVelo: 'exitVelo',
  distance: 'distance',
}

// ---------------------------------------------------------------------------

function sanitize<T extends string>(
  raw: unknown,
  order: readonly T[],
  locked: readonly T[],
  fallback: readonly T[],
): T[] {
  const requested = Array.isArray(raw) ? raw : null
  const picked = new Set<T>(
    requested === null
      ? fallback
      : (requested.filter((v): v is T => order.includes(v as T)) as T[]),
  )
  // 鎖定欄位一定要在，就算 Firestore 裡的資料被改壞了也一樣
  for (const f of locked) picked.add(f)
  // 一律照標準順序輸出，不管存進去的順序是什麼
  return order.filter((f) => picked.has(f))
}

/**
 * 把 Firestore 讀回來的設定整理成可用的形狀。
 * 舊資料、壞資料、被手動改過的資料都要能吃進來，不能讓圖卡頁整個爆掉。
 */
export function normalizeCardConfig(raw: Partial<CardConfig> | null | undefined): CardConfig {
  return {
    pitchFields: sanitize(
      raw?.pitchFields,
      PITCH_FIELD_ORDER,
      LOCKED_PITCH_FIELDS,
      DEFAULT_CARD_CONFIG.pitchFields,
    ),
    battedFields: sanitize(
      raw?.battedFields,
      BATTED_FIELD_ORDER,
      LOCKED_BATTED_FIELDS,
      DEFAULT_CARD_CONFIG.battedFields,
    ),
  }
}

/** 勾選／取消一個投球欄位（鎖定的不動）。 */
export function togglePitchField(config: CardConfig, field: PitchField): CardConfig {
  if (isPitchFieldLocked(field)) return config
  const has = config.pitchFields.includes(field)
  const next = has
    ? config.pitchFields.filter((f) => f !== field)
    : [...config.pitchFields, field]
  return normalizeCardConfig({ ...config, pitchFields: next })
}

export function toggleBattedField(config: CardConfig, field: BattedField): CardConfig {
  if (isBattedFieldLocked(field)) return config
  const has = config.battedFields.includes(field)
  const next = has
    ? config.battedFields.filter((f) => f !== field)
    : [...config.battedFields, field]
  return normalizeCardConfig({ ...config, battedFields: next })
}

/**
 * 欄位排版：3 欄以內排一列；4–5 欄排兩列（第一列 3 欄、第二列其餘）。
 * 每一列裡的格寬平均分配。
 */
export function splitIntoRows<T>(fields: readonly T[]): T[][] {
  if (fields.length === 0) return []
  if (fields.length <= 3) return [[...fields]]
  return [fields.slice(0, 3), fields.slice(3)]
}
