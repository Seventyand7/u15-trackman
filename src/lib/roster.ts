/**
 * 批次貼上名單（純邏輯）。
 *
 * 一行一位球員，格式是「背號 姓名」。分隔可以是空白、全形空白、tab 或逗號——
 * 從 Excel 或 LINE 複製過來的東西不會只有一種樣子。
 *
 * 背號衝突的列會被標示出來且不寫入（規格要求），其餘的照寫。
 * 同名只是警告不擋：同隊真的可能有兩個同名的人，但更常見的是同一個人換了背號，
 * 所以標出來讓人自己判斷，不要替他決定。
 */

import { findNumberConflict, findSameNamePlayers, normalizeName, normalizeNumber } from './players'
import type { Player } from '../types/models'
import type { PlayerScope } from './players'

export interface ParsedLine {
  /** 1 起算，對應貼上的文字第幾行 */
  lineNo: number
  raw: string
  number: string
  name: string
}

/** 空白行直接忽略，不算錯誤。 */
export function parseRosterText(text: string): ParsedLine[] {
  const out: ParsedLine[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (line === '') return
    // 第一段是背號，其餘全部算姓名（姓名中間可能有空白）
    const m = /^([^\s,、\t]+)[\s,、\t]+(.+)$/.exec(line)
    out.push({
      lineNo: i + 1,
      raw: line,
      number: m ? normalizeNumber(m[1]!) : normalizeNumber(line),
      name: m ? m[2]!.trim() : '',
    })
  })
  return out
}

export type RosterRowStatus =
  /** 可以新增 */
  | { kind: 'ok' }
  /** 同隊已有同名球員——可能是換背號，警告但仍然會新增 */
  | { kind: 'same-name'; existing: Player[] }
  /** 只有背號沒有姓名 */
  | { kind: 'missing-name' }
  /** 背號被同隊現有球員佔用 */
  | { kind: 'number-taken'; occupiedBy: Player }
  /** 貼上的內容裡自己就重複了 */
  | { kind: 'duplicate-in-paste'; firstLineNo: number }

export interface RosterRow extends ParsedLine {
  status: RosterRowStatus
  /** 只有這個為 true 的列會被寫入 */
  willCreate: boolean
}

export interface RosterPlan {
  rows: RosterRow[]
  createCount: number
  blockedCount: number
  warnCount: number
}

export function planRosterImport(
  text: string,
  players: readonly Player[],
  scope: PlayerScope,
): RosterPlan {
  const parsed = parseRosterText(text)
  const seen = new Map<string, number>()
  const rows: RosterRow[] = []

  for (const line of parsed) {
    let status: RosterRowStatus

    const firstLineNo = seen.get(line.number)
    if (normalizeName(line.name) === '') {
      status = { kind: 'missing-name' }
    } else if (firstLineNo !== undefined) {
      status = { kind: 'duplicate-in-paste', firstLineNo }
    } else {
      const occupiedBy = findNumberConflict(players, scope, line.number)
      if (occupiedBy) {
        status = { kind: 'number-taken', occupiedBy }
      } else {
        const existing = findSameNamePlayers(players, scope, line.name)
        status = existing.length > 0 ? { kind: 'same-name', existing } : { kind: 'ok' }
      }
    }

    // 只有真的會建立的列才佔住背號，被擋下的列不影響後面
    const willCreate = status.kind === 'ok' || status.kind === 'same-name'
    if (willCreate) seen.set(line.number, line.lineNo)

    rows.push({ ...line, status, willCreate })
  }

  return {
    rows,
    createCount: rows.filter((r) => r.willCreate).length,
    blockedCount: rows.filter((r) => !r.willCreate).length,
    warnCount: rows.filter((r) => r.status.kind === 'same-name').length,
  }
}

/** 給畫面顯示用的說明文字。 */
export function describeRosterStatus(status: RosterRowStatus): string {
  switch (status.kind) {
    case 'ok':
      return '將新增'
    case 'same-name':
      return `同隊已有同名球員（${status.existing.map((p) => p.number).join('、')} 號），仍會新增`
    case 'missing-name':
      return '這一行只有背號沒有姓名，不會寫入'
    case 'number-taken':
      return `背號已被 ${status.occupiedBy.name} 使用，不會寫入`
    case 'duplicate-in-paste':
      return `跟第 ${status.firstLineNo} 行背號重複，不會寫入`
  }
}
