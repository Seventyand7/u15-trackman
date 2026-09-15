/**
 * 單場圖卡。仿照目前交出去的格式——主管已經看習慣了，不要亂改。
 * 版型零件放在 cardParts.tsx，與季排名圖卡共用。
 */

import { forwardRef } from 'react'
import { formatGameDate, formatGameTitle } from '../../lib/format'
import { RANK_CATEGORIES, type RankCategory, type RankEntry } from '../../lib/ranking'
import type { CardConfig, Game } from '../../types/models'
import {
  CardTitle,
  DataRow,
  HeaderBar,
  NoData,
  SectionTitle,
  cardRootStyle,
  playerLabel,
  type CardLookups,
} from './cardParts'

export { CARD_WIDTH } from './cardParts'
export type { CardLookups } from './cardParts'

/** 一場比賽的區塊：場次標題列 + 四個項目。合併長圖會重複用這個。 */
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
      <HeaderBar>{formatGameTitle(game, lookups.teams)}</HeaderBar>

      {RANK_CATEGORIES.map((meta) => {
        const entry = bests[meta.key]
        return (
          <div key={meta.key}>
            <SectionTitle>{meta.label}</SectionTitle>
            {entry ? (
              <DataRow
                label={playerLabel(entry, lookups)}
                entry={entry}
                category={meta.key}
                fields={meta.kind === 'pitch' ? config.pitchFields : config.battedFields}
              />
            ) : (
              <NoData />
            )}
          </div>
        )
      })}
    </div>
  )
}

export interface GameCardProps {
  /** 最上方的日期。合併長圖只在最上面出現一次，所以由外面決定。 */
  date: string
  games: readonly {
    game: Game
    bests: Record<RankCategory, RankEntry | null>
  }[]
  config: CardConfig
  lookups: CardLookups
}

/**
 * 完整的一張圖卡。單場就是 games 只有一筆；合併長圖是多筆，日期仍然只出現一次。
 * ref 指向最外層節點，html-to-image 就是拍這個節點。
 */
export const GameCard = forwardRef<HTMLDivElement, GameCardProps>(function GameCard(
  { date, games, config, lookups },
  ref,
) {
  return (
    <div ref={ref} style={cardRootStyle}>
      <CardTitle>{formatGameDate(date)}</CardTitle>
      {games.map(({ game, bests }) => (
        <GameBlock key={game.id} game={game} bests={bests} config={config} lookups={lookups} />
      ))}
    </div>
  )
})
