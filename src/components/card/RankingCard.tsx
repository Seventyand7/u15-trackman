/**
 * 季排名圖卡：一隊一張，四個項目各列前三名。
 * 版型與單場圖卡共用 cardParts.tsx，只差在多了名次欄、一個項目有多列。
 */

import { forwardRef } from 'react'
import { RANK_CATEGORIES, type RankCategory, type RankEntry } from '../../lib/ranking'
import type { CardConfig, Team } from '../../types/models'
import {
  CardTitle,
  DataRow,
  HeaderBar,
  NoData,
  SectionTitle,
  cardRootStyle,
  playerOnlyLabel,
  type CardLookups,
} from './cardParts'

export interface RankingCardProps {
  /** 最上方置中的球季名稱 */
  seasonName: string
  team: Team
  /** 該隊四個項目的前三名 */
  top: Record<RankCategory, RankEntry[]>
  config: CardConfig
  lookups: CardLookups
}

export const RankingCard = forwardRef<HTMLDivElement, RankingCardProps>(function RankingCard(
  { seasonName, team, top, config, lookups },
  ref,
) {
  return (
    <div ref={ref} style={cardRootStyle}>
      <CardTitle>{seasonName}</CardTitle>
      <HeaderBar>{team.name}</HeaderBar>

      {RANK_CATEGORIES.map((meta) => {
        const entries = top[meta.key]
        const fields = meta.kind === 'pitch' ? config.pitchFields : config.battedFields
        return (
          <div key={meta.key}>
            <SectionTitle>{meta.label}</SectionTitle>
            {entries.length === 0 ? (
              <NoData />
            ) : (
              entries.map((entry, i) => (
                <DataRow
                  key={entry.event.id}
                  rank={i + 1}
                  label={playerOnlyLabel(entry, lookups)}
                  entry={entry}
                  category={meta.key}
                  fields={fields}
                />
              ))
            )}
          </div>
        )
      })}
    </div>
  )
})
