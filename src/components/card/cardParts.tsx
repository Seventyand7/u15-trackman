/**
 * 圖卡的共用零件。單場圖卡與季排名圖卡都用這裡的樣式，
 * 這樣兩種卡片一定長得一樣，不會改了一邊忘了另一邊。
 *
 * 顏色與尺寸全部寫死，不吃介面的深色主題：
 * 這些節點會被 html-to-image 依算出來的樣式直接畫成 PNG，所見即所得。
 */

import type { CSSProperties, ReactNode } from 'react'
import {
  DASH,
  formatAngle,
  formatDistance,
  formatSpeed,
  formatSpin,
  formatText,
} from '../../lib/format'
import {
  BATTED_FIELD_LABELS,
  PITCH_FIELD_LABELS,
  PRIMARY_FIELD,
  splitIntoRows,
} from '../../lib/cardConfig'
import type { RankCategory, RankEntry } from '../../lib/ranking'
import type { BattedBall, BattedField, Pitch, PitchField, Player, Team } from '../../types/models'

export const CARD_WIDTH = 490

export const CARD = {
  white: '#FFFFFF',
  header: '#2B3450',
  sectionBg: '#EDEEF2',
  rule: '#E2E4EA',
  label: '#8A8F9C',
  text: '#33363D',
  accent: '#C0392B',
} as const

export const cardRootStyle: CSSProperties = {
  width: CARD_WIDTH,
  background: CARD.white,
  fontFamily: '"Noto Sans TC", system-ui, sans-serif',
  color: CARD.text,
}

export type AnyField = PitchField | BattedField

export function fieldLabel(field: AnyField): string {
  return field in PITCH_FIELD_LABELS
    ? PITCH_FIELD_LABELS[field as PitchField]
    : BATTED_FIELD_LABELS[field as BattedField]
}

export function fieldValue(entry: RankEntry, field: AnyField): string {
  if (entry.kind === 'pitch') {
    const p = entry.event as Pitch
    switch (field as PitchField) {
      case 'speed':
        return formatSpeed(p.speed)
      case 'spin':
        return formatSpin(p.spin)
      case 'axis':
        return formatText(p.axis)
      case 'hBreak':
        return formatText(p.hBreak)
      case 'vBreak':
        return formatText(p.vBreak)
    }
  }
  const b = entry.event as BattedBall
  switch (field as BattedField) {
    case 'exitVelo':
      return formatSpeed(b.exitVelo)
    case 'launchAngle':
      return formatAngle(b.launchAngle)
    case 'distance':
      return formatDistance(b.distance)
  }
  return DASH
}

export interface CardLookups {
  teams: readonly Team[]
  players: readonly Player[]
}

/**
 * 圖卡上一律顯示球員「目前」的背號與姓名。
 *
 * 單場圖卡兩隊混在一起，所以要帶隊名。
 * 季排名卡是一隊一張、隊名就在上方標題列，每列再寫一次只是重複，
 * 還會把姓名欄擠到換行——所以那邊用 playerOnlyLabel。
 */
export function playerLabel(entry: RankEntry, lookups: CardLookups): string {
  const team = lookups.teams.find((t) => t.id === entry.teamId)
  return `${team?.name ?? DASH} ${playerOnlyLabel(entry, lookups)}`
}

/** '5 王小明' */
export function playerOnlyLabel(entry: RankEntry, lookups: CardLookups): string {
  const player = lookups.players.find((p) => p.id === entry.playerId)
  return `${player?.number ?? DASH} ${player?.name ?? DASH}`
}

// ---------------------------------------------------------------------------

/** 最上方置中的那一行（單場圖卡是日期，季排名圖卡是球季名稱）。 */
export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '12px 0 10px',
        textAlign: 'center',
        fontSize: 17,
        fontWeight: 700,
        letterSpacing: '0.05em',
      }}
    >
      {children}
    </div>
  )
}

/** 深海軍藍底白色粗體（單場圖卡是場次，季排名圖卡是隊名）。 */
export function HeaderBar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: CARD.header,
        color: CARD.white,
        padding: '7px 10px',
        textAlign: 'center',
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: '0.03em',
      }}
    >
      {children}
    </div>
  )
}

/** 項目標題：淺灰底置中粗體。 */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: CARD.sectionBg,
        color: CARD.text,
        padding: '5px 0',
        textAlign: 'center',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </div>
  )
}

export function NoData({ text = '無資料' }: { text?: string }) {
  return (
    <div
      style={{
        padding: '14px 0',
        textAlign: 'center',
        fontSize: 13,
        color: CARD.label,
        borderBottom: `1px solid ${CARD.rule}`,
      }}
    >
      {text}
    </div>
  )
}

/** 右側的欄位格：小灰字標籤列加數值列，主數據紅色粗體。 */
export function FieldCells({
  entry,
  category,
  fields,
}: {
  entry: RankEntry
  category: RankCategory
  fields: readonly AnyField[]
}) {
  const primary = PRIMARY_FIELD[category]
  const rows = splitIntoRows(fields)

  return (
    <div style={{ flex: 1, borderLeft: `1px solid ${CARD.rule}`, minWidth: 0 }}>
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: 'flex',
            borderTop: rowIndex === 0 ? 'none' : `1px solid ${CARD.rule}`,
          }}
        >
          {row.map((field, cellIndex) => (
            <div
              key={field}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 4px',
                textAlign: 'center',
                borderLeft: cellIndex === 0 ? 'none' : `1px solid ${CARD.rule}`,
              }}
            >
              <div style={{ fontSize: 10, color: CARD.label, lineHeight: 1.4 }}>
                {fieldLabel(field)}
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.35,
                  fontWeight: 700,
                  color: field === primary ? CARD.accent : CARD.text,
                  wordBreak: 'break-word',
                }}
              >
                {fieldValue(entry, field)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** 一筆內容列：左邊是球員（季排名卡前面多一個名次欄），右邊是欄位格。 */
export function DataRow({
  rank,
  label,
  entry,
  category,
  fields,
}: {
  /** 季排名卡才有名次；單場圖卡不傳 */
  rank?: number
  label: string
  entry: RankEntry
  category: RankCategory
  fields: readonly AnyField[]
}) {
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${CARD.rule}` }}>
      {rank !== undefined && (
        <div
          style={{
            width: 28,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: CARD.label,
          }}
        >
          {rank}
        </div>
      )}
      <div
        style={{
          width: rank === undefined ? 148 : 134,
          flexShrink: 0,
          padding: '8px 6px',
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.35,
          color: CARD.text,
          // 中文預設可以在任何字之間斷行，會出現「李大 / 同」這種難看的斷法。
          // keep-all 讓它整個名字一起換行。
          wordBreak: 'keep-all',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {label}
      </div>
      <FieldCells entry={entry} category={category} fields={fields} />
    </div>
  )
}
