/**
 * 回答「這一球要不要記」的參考數值。
 *
 * 最上面一行是結論：超過這個數字就要記。它是「季前三門檻」與「本場最佳」取低的那個——
 * 超過其中任何一個就有意義，所以只要盯一個數字，不用自己在腦袋裡比兩次。
 *
 * 下面幾列是拆開來的細節，平常不用看，想知道為什麼是這個數字的時候才看：
 *   本場個人 / 本季個人   這位球員現在的水準。換上第二位投手時，
 *                        他的球沒破全場紀錄還是要記——季前三名是各隊各算的。
 *   季前三門檻           贏過這個，該隊的季前三名才會變動
 *   本場最佳             贏過這個，才會取代單場圖卡上那一筆
 *
 * 還沒選到球員也會顯示（打者還沒上來、背號還沒看清楚），這時候以「一位新球員」估算。
 */

import { useMemo } from 'react'
import { useSeason } from '../../state/SeasonProvider'
import {
  CATEGORY_META,
  gameTarget,
  playerGameBests,
  playerSeasonBests,
  recordThreshold,
  seasonTargetForPlayer,
  teamSeasonCutoff,
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
  values: (number | null)[]
  emptyText: string
}

export function RecordTargets({
  kind,
  gameId,
  teamId,
  playerId,
}: {
  kind: EventKind
  gameId: Id
  teamId: Id
  /** 還沒選到球員時是 null */
  playerId: Id | null
}) {
  const { pool } = useSeason()
  const categories = CATEGORIES[kind]

  const headline = useMemo(
    () => categories.map((c) => recordThreshold(pool, gameId, teamId, playerId, c)),
    [pool, gameId, teamId, playerId, categories],
  )

  const details = useMemo<Row[]>(() => {
    const rows: Row[] = []
    if (playerId) {
      const ownGame = playerGameBests(pool, gameId, playerId)
      const ownSeason = playerSeasonBests(pool, playerId)
      rows.push(
        {
          label: '本場個人',
          values: categories.map((c) => ownGame[c]?.primary ?? null),
          emptyText: '還沒有',
        },
        {
          label: '本季個人',
          values: categories.map((c) => ownSeason[c]?.primary ?? null),
          emptyText: '還沒有',
        },
      )
    }
    rows.push(
      {
        label: '季前三門檻',
        values: categories.map((c) =>
          playerId
            ? seasonTargetForPlayer(pool, teamId, playerId, c)
            : teamSeasonCutoff(pool, teamId, c),
        ),
        emptyText: '未滿 3 人',
      },
      {
        label: '本場最佳',
        values: categories.map((c) => gameTarget(pool, gameId, c)),
        emptyText: '還沒有',
      },
    )
    return rows
  }, [pool, gameId, teamId, playerId, categories])

  const gridCols = `7.5rem repeat(${categories.length}, minmax(0, 1fr))`

  return (
    <div className="overflow-hidden rounded-lg border border-amber1/25">
      {/* 結論：只要盯這一行 */}
      <div className="bg-amber1/10 px-3 py-2.5">
        <div className="grid items-center gap-x-3" style={{ gridTemplateColumns: gridCols }}>
          <span className="text-[13px] font-semibold text-amber1">超過就要記</span>
          {categories.map((c, i) => (
            <div key={c} className="text-center">
              <div className="text-[12px] text-slate-400">
                {CATEGORY_META[c].label.replace('最快', '').replace('最遠', '')}
              </div>
              {headline[i] === null || headline[i] === undefined ? (
                <div className="text-base font-bold text-emerald-300">都要記</div>
              ) : (
                <div className="font-mono text-xl font-bold tabular-nums text-amber1">
                  {formatPrimary(c, headline[i]!)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 細節 */}
      <div className="bg-night-900/60 px-3 py-2">
        <div className="mb-1 text-[12px] text-slate-500">
          {playerId ? '這位球員的細節' : '還沒選球員，以新球員估算'}
        </div>
        <div className="grid items-center gap-x-3 gap-y-1" style={{ gridTemplateColumns: gridCols }}>
          {details.map((row) => (
            <DetailRow key={row.label} row={row} categories={categories} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ row, categories }: { row: Row; categories: RankCategory[] }) {
  return (
    <>
      <span className="whitespace-nowrap text-[13px] text-slate-400">{row.label}</span>
      {categories.map((c, i) => {
        const value = row.values[i] ?? null
        return (
          <span key={c} className="text-center">
            {value === null ? (
              <span className="text-[13px] text-slate-600">{row.emptyText}</span>
            ) : (
              <span className="font-mono text-[15px] font-semibold tabular-nums text-slate-300">
                {formatPrimary(c, value)}
              </span>
            )}
          </span>
        )
      })}
    </>
  )
}
