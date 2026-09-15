/**
 * 單場圖卡的白底版型。仿照目前交出去的格式——主管已經看習慣了，不要亂改。
 *
 * 這裡的樣式刻意全部寫死顏色與尺寸，不吃介面的深色主題：
 * 這個節點會被 html-to-image 依電腦上算出來的樣式直接畫成 PNG，
 * 所見即所得，畫面上的預覽跟輸出的圖必須一模一樣。
 */

import { forwardRef } from 'react'
import {
  DASH,
  formatAngle,
  formatDistance,
  formatGameDate,
  formatGameTitle,
  formatSpeed,
  formatSpin,
  formatText,
} from '../../lib/format'
import { PRIMARY_FIELD, splitIntoRows } from '../../lib/cardConfig'
import {
  BATTED_FIELD_LABELS,
  PITCH_FIELD_LABELS,
} from '../../lib/cardConfig'
import { RANK_CATEGORIES, type RankCategory, type RankEntry } from '../../lib/ranking'
import type {
  BattedBall,
  BattedField,
  CardConfig,
  Game,
  Pitch,
  PitchField,
  Player,
  Team,
} from '../../types/models'

export const CARD_WIDTH = 490

type AnyField = PitchField | BattedField

function fieldLabel(field: AnyField): string {
  return field in PITCH_FIELD_LABELS
    ? PITCH_FIELD_LABELS[field as PitchField]
    : BATTED_FIELD_LABELS[field as BattedField]
}

function fieldValue(entry: RankEntry, field: AnyField): string {
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

// ---------------------------------------------------------------------------

function CategoryBlock({
  category,
  label,
  entry,
  fields,
  lookups,
}: {
  category: RankCategory
  label: string
  entry: RankEntry | null
  fields: readonly AnyField[]
  lookups: CardLookups
}) {
  const primary = PRIMARY_FIELD[category]
  const rows = splitIntoRows(fields)

  const player = entry ? lookups.players.find((p) => p.id === entry.playerId) : undefined
  const team = entry ? lookups.teams.find((t) => t.id === entry.teamId) : undefined

  return (
    <div>
      <div
        style={{
          background: '#EDEEF2',
          color: '#33363D',
          padding: '5px 0',
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>

      {!entry ? (
        <div
          style={{
            padding: '14px 0',
            textAlign: 'center',
            fontSize: 13,
            color: '#8A8F9C',
            borderBottom: '1px solid #E2E4EA',
          }}
        >
          無資料
        </div>
      ) : (
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E4EA' }}>
          {/* 左欄：隊名 背號 姓名（可換行） */}
          <div
            style={{
              width: 148,
              flexShrink: 0,
              padding: '8px 6px',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.35,
              color: '#33363D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {`${team?.name ?? DASH} ${player?.number ?? DASH} ${player?.name ?? DASH}`}
          </div>

          {/* 右側：小灰字標籤列 + 數值列 */}
          <div style={{ flex: 1, borderLeft: '1px solid #E2E4EA', minWidth: 0 }}>
            {rows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                style={{
                  display: 'flex',
                  borderTop: rowIndex === 0 ? 'none' : '1px solid #E2E4EA',
                }}
              >
                {row.map((field, cellIndex) => {
                  const isPrimary = field === primary
                  return (
                    <div
                      key={field}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: '6px 4px',
                        textAlign: 'center',
                        borderLeft: cellIndex === 0 ? 'none' : '1px solid #E2E4EA',
                      }}
                    >
                      <div style={{ fontSize: 10, color: '#8A8F9C', lineHeight: 1.4 }}>
                        {fieldLabel(field)}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          lineHeight: 1.35,
                          fontWeight: 700,
                          color: isPrimary ? '#C0392B' : '#33363D',
                          wordBreak: 'break-word',
                        }}
                      >
                        {fieldValue(entry, field)}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

/** 一場比賽的區塊：場次標題列 + 四個項目。合併圖會重複用這個。 */
export function GameBlock({
  game,
  bests,
  config,
  lookups,
}: {
  game: Game
  bests: Record<RankCategory, RankEntry | null>
  config: CardConfig
  lookups: CardLookups
}) {
  return (
    <div>
      <div
        style={{
          background: '#2B3450',
          color: '#FFFFFF',
          padding: '7px 10px',
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '0.03em',
        }}
      >
        {formatGameTitle(game, lookups.teams)}
      </div>

      {RANK_CATEGORIES.map((meta) => (
        <CategoryBlock
          key={meta.key}
          category={meta.key}
          label={meta.label}
          entry={bests[meta.key]}
          fields={meta.kind === 'pitch' ? config.pitchFields : config.battedFields}
          lookups={lookups}
        />
      ))}
    </div>
  )
}

export interface GameCardProps {
  /** 最上方的日期。合併圖只在最上面出現一次，所以由外面決定。 */
  date: string
  games: readonly {
    game: Game
    bests: Record<RankCategory, RankEntry | null>
  }[]
  config: CardConfig
  lookups: CardLookups
}

/**
 * 完整的一張圖卡。單場就是 games 只有一筆；合併圖是多筆，日期仍然只出現一次。
 * ref 指向最外層節點，html-to-image 就是拍這個節點。
 */
export const GameCard = forwardRef<HTMLDivElement, GameCardProps>(function GameCard(
  { date, games, config, lookups },
  ref,
) {
  return (
    <div
      ref={ref}
      style={{
        width: CARD_WIDTH,
        background: '#FFFFFF',
        fontFamily: '"Noto Sans TC", system-ui, sans-serif',
        color: '#33363D',
      }}
    >
      <div
        style={{
          padding: '12px 0 10px',
          textAlign: 'center',
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}
      >
        {formatGameDate(date)}
      </div>

      {games.map(({ game, bests }) => (
        <GameBlock key={game.id} game={game} bests={bests} config={config} lookups={lookups} />
      ))}
    </div>
  )
})
