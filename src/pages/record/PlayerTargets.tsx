/**
 * 選到球員後顯示的四個參考數值，回答「這一球要不要記」。
 *
 * 上面兩列是這位球員自己的成績，下面兩列是要贏過的目標：
 *
 *   本場個人 / 本季個人   他現在的水準在哪。換上第二位投手時，
 *                        他的球沒破全場紀錄還是要記——季前三名是各隊各算的，
 *                        所以要看得到他自己的數字，不是只看到全場第一名。
 *   季前三門檻           贏過這個，該隊的季前三名才會變動（見 seasonTargetForPlayer）
 *   本場最佳             贏過這個，才會取代單場圖卡上那一筆（兩隊合併後的第一名）
 *
 * 選到球員的當下就顯示，不用等輸入數值——決定要不要記是在看回放的當下做的。
 */

import { useMemo } from 'react'
import { useSeason } from '../../state/SeasonProvider'
import {
  CATEGORY_META,
  gameTarget,
  playerGameBests,
  playerSeasonBests,
  seasonTargetForPlayer,
  type EventKind,
  type RankCategory,
} from '../../lib/ranking'
import { formatPrimary } from '../../lib/format'
import type { Id } from '../../types/models'

const CATEGORIES: Record<EventKind, RankCategory[]> = {
  pitch: ['pitchSpeed', 'pitchSpin'],
  battedBall: ['exitVelo', 'distance'],
}

interface Row {
  label: string
  /** 要贏過的目標（下面兩列）用不同顏色跟自己的成績分開 */
  isTarget: boolean
  values: (number | null)[]
  /** 沒有值的時候顯示什麼 */
  emptyText: string
}

export function PlayerTargets({
  kind,
  gameId,
  teamId,
  playerId,
}: {
  kind: EventKind
  gameId: Id
  teamId: Id
  playerId: Id
}) {
  const { pool } = useSeason()
  const categories = CATEGORIES[kind]

  const rows = useMemo<Row[]>(() => {
    const ownGame = playerGameBests(pool, gameId, playerId)
    const ownSeason = playerSeasonBests(pool, playerId)
    return [
      {
        label: '本場個人',
        isTarget: false,
        values: categories.map((c) => ownGame[c]?.primary ?? null),
        emptyText: '還沒有',
      },
      {
        label: '本季個人',
        isTarget: false,
        values: categories.map((c) => ownSeason[c]?.primary ?? null),
        emptyText: '還沒有',
      },
      {
        label: '季前三門檻',
        isTarget: true,
        values: categories.map((c) => seasonTargetForPlayer(pool, teamId, playerId, c)),
        emptyText: '都記',
      },
      {
        label: '本場最佳',
        isTarget: true,
        values: categories.map((c) => gameTarget(pool, gameId, c)),
        emptyText: '都記',
      },
    ]
  }, [pool, gameId, teamId, playerId, categories])

  const gridCols = `7.5rem repeat(${categories.length}, minmax(0, 1fr))`

  return (
    <div className="rounded-lg border border-white/10 bg-night-900/60 px-3 py-2.5">
      <div className="grid items-center gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: gridCols }}>
        <span />
        {categories.map((c) => (
          <span key={c} className="text-center text-[13px] font-medium text-slate-300">
            {CATEGORY_META[c].label.replace('最快', '').replace('最遠', '')}
          </span>
        ))}

        {rows.map((row) => (
          <Row key={row.label} row={row} categories={categories} />
        ))}
      </div>
    </div>
  )
}

function Row({ row, categories }: { row: Row; categories: RankCategory[] }) {
  return (
    <>
      <span
        className={`whitespace-nowrap text-[13px] ${
          row.isTarget ? 'font-medium text-amber1/80' : 'text-slate-400'
        }`}
      >
        {row.isTarget && <span className="mr-1 text-amber1/50">▸</span>}
        {row.label}
      </span>
      {categories.map((c, i) => {
        const value = row.values[i] ?? null
        return (
          <span key={c} className="text-center">
            {value === null ? (
              <span
                className={`text-[13px] ${
                  row.isTarget ? 'font-semibold text-emerald-300' : 'text-slate-600'
                }`}
              >
                {row.emptyText}
              </span>
            ) : (
              <span
                className={`font-mono text-base font-semibold tabular-nums ${
                  row.isTarget ? 'text-slate-100' : 'text-slate-300'
                }`}
              >
                {formatPrimary(c, value)}
              </span>
            )}
          </span>
        )
      })}
    </>
  )
}
