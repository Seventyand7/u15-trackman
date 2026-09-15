/**
 * 輸入驗證（純函式）。
 *
 * 原則：只警告，不擋。Trackman 偶爾會顯示超出常理的數字，
 * 我看到什麼就該記得下什麼，工具不該替我判斷那筆是不是壞掉。
 * 唯一真的擋下來的是「整筆都沒有數據」。
 */

import type { BattedBall, Id, Pitch } from '../types/models'

export interface FieldWarning {
  field: string
  message: string
}

/** 記錄頁投球面板的原始輸入（全部都是字串） */
export interface PitchInput {
  speed: string
  spin: string
  axis: string
  hBreak: string
  vBreak: string
  videoTime: string
}

/** 記錄頁擊球面板的原始輸入 */
export interface BattedInput {
  exitVelo: string
  launchAngle: string
  distance: string
  videoTime: string
}

export const EMPTY_PITCH_INPUT: PitchInput = {
  speed: '',
  spin: '',
  axis: '',
  hBreak: '',
  vBreak: '',
  videoTime: '',
}

export const EMPTY_BATTED_INPUT: BattedInput = {
  exitVelo: '',
  launchAngle: '',
  distance: '',
  videoTime: '',
}

// ---------------------------------------------------------------------------
// 解析

/** 空字串 → null；不是數字 → NaN（交給警告處理）。 */
export function toNumber(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  return Number(t)
}

/** 空字串 → null，其餘去前後空白。 */
export function toText(raw: string): string | null {
  const t = raw.trim()
  return t === '' ? null : t
}

/** 寫進 Firestore 前把 NaN 當成沒填，不要把 NaN 存進資料庫。 */
function clean(v: number | null): number | null {
  return v === null || Number.isNaN(v) ? null : v
}

/** 轉軸格式 H:MM，H 為 1–12，MM 為 00–59。 */
export const AXIS_PATTERN = /^([1-9]|1[0-2]):[0-5][0-9]$/

// ---------------------------------------------------------------------------
// 警告規則

interface RangeRule {
  field: string
  label: string
  min: number
  max: number
}

const PITCH_RANGES: RangeRule[] = [
  { field: 'speed', label: '球速', min: 40, max: 160 },
  { field: 'spin', label: '轉速', min: 0, max: 4000 },
]

const BATTED_RANGES: RangeRule[] = [
  { field: 'exitVelo', label: '擊球初速', min: 40, max: 160 },
  { field: 'launchAngle', label: '仰角', min: -90, max: 90 },
  { field: 'distance', label: '擊球距離', min: 0, max: 150 },
]

function checkRange(raw: string, rule: RangeRule, out: FieldWarning[]): void {
  const t = raw.trim()
  if (t === '') return
  const n = Number(t)
  if (Number.isNaN(n)) {
    out.push({ field: rule.field, message: `${rule.label}不是數字，送出後這欄會留白` })
    return
  }
  if (n < rule.min || n > rule.max) {
    out.push({
      field: rule.field,
      message: `${rule.label} ${t} 超出常見範圍（${rule.min}–${rule.max}），確認一下沒看錯`,
    })
  }
}

export function warnPitch(input: PitchInput): FieldWarning[] {
  const out: FieldWarning[] = []
  for (const rule of PITCH_RANGES) {
    checkRange(input[rule.field as 'speed' | 'spin'], rule, out)
  }
  const axis = input.axis.trim()
  if (axis !== '' && !AXIS_PATTERN.test(axis)) {
    out.push({ field: 'axis', message: '轉軸格式應為 H:MM，H 是 1–12（例如 1:30）' })
  }
  return out
}

export function warnBatted(input: BattedInput): FieldWarning[] {
  const out: FieldWarning[] = []
  for (const rule of BATTED_RANGES) {
    checkRange(input[rule.field as 'exitVelo' | 'launchAngle' | 'distance'], rule, out)
  }
  return out
}

// ---------------------------------------------------------------------------
// 至少要有一個數據欄

/** 時間碼不算數據欄——只填時間碼等於沒記到東西。 */
export function pitchHasData(input: PitchInput): boolean {
  return [input.speed, input.spin, input.axis, input.hBreak, input.vBreak].some(
    (v) => v.trim() !== '',
  )
}

export function battedHasData(input: BattedInput): boolean {
  return [input.exitVelo, input.launchAngle, input.distance].some((v) => v.trim() !== '')
}

// ---------------------------------------------------------------------------
// 轉成要寫進 Firestore 的資料

export type NewPitch = Omit<Pitch, 'id'>
export type NewBattedBall = Omit<BattedBall, 'id'>

export interface EventRefs {
  seasonId: Id
  gameId: Id
  teamId: Id
  playerId: Id
  createdAt: number
}

export function buildPitch(input: PitchInput, refs: EventRefs): NewPitch {
  return {
    ...refs,
    speed: clean(toNumber(input.speed)),
    spin: clean(toNumber(input.spin)),
    axis: toText(input.axis),
    hBreak: toText(input.hBreak),
    vBreak: toText(input.vBreak),
    videoTime: toText(input.videoTime),
  }
}

export function buildBattedBall(input: BattedInput, refs: EventRefs): NewBattedBall {
  return {
    ...refs,
    exitVelo: clean(toNumber(input.exitVelo)),
    launchAngle: clean(toNumber(input.launchAngle)),
    distance: clean(toNumber(input.distance)),
    videoTime: toText(input.videoTime),
  }
}

// ---------------------------------------------------------------------------
// 重複偵測

/**
 * 同場、同球員、數據完全相同 → 可能是同一球記了兩次。
 * 不比時間碼：時間碼不同代表真的是不同球，但兩次都沒填時間碼才是最容易重複的情況。
 */
export function findDuplicatePitch(
  pitches: readonly Pitch[],
  candidate: NewPitch,
): Pitch | null {
  return (
    pitches.find(
      (p) =>
        p.gameId === candidate.gameId &&
        p.playerId === candidate.playerId &&
        p.speed === candidate.speed &&
        p.spin === candidate.spin &&
        p.axis === candidate.axis &&
        p.hBreak === candidate.hBreak &&
        p.vBreak === candidate.vBreak,
    ) ?? null
  )
}

export function findDuplicateBattedBall(
  battedBalls: readonly BattedBall[],
  candidate: NewBattedBall,
): BattedBall | null {
  return (
    battedBalls.find(
      (b) =>
        b.gameId === candidate.gameId &&
        b.playerId === candidate.playerId &&
        b.exitVelo === candidate.exitVelo &&
        b.launchAngle === candidate.launchAngle &&
        b.distance === candidate.distance,
    ) ?? null
  )
}
