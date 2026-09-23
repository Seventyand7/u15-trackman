/**
 * 回答「這一球要不要記」的參考數值。
 *
 * 分兩種狀態：
 *
 * 只選了隊伍（打者還沒上來、或還沒看清楚背號）
 *   顯示這一隊的季前三門檻與本場最佳。數據先出來、人還沒確定的情況很常見，
 *   這時候就要能先判斷這球值不值得記，再回頭去看是誰。
 *
 * 已經選到球員
 *   多顯示他自己的本場與本季最佳。換上第二位投手時，他的球沒破全場紀錄還是要記——
 *   季前三名是各隊各算的，所以要看得到他自己的水準在哪。
 *   季前三門檻這時候也換成針對他的（見 seasonTargetForPlayer）。
 *
 * 上面幾列是「現況」，下面兩列是「要贏過的目標」，用琥珀色與 ▸ 區隔。
 */

import { useMemo } from 'react'
import { useSeason } from '../../state/SeasonProvider'
import {
  CATEGORY_META,
  gameTarget,
  playerGameBests,
  playerSeasonBests,
  seasonTargetForPlayer,
  teamThresholds,
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
  /** 要贏過的目標用琥珀色，跟「現況」分開 */
  isTarget: boolean
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
  /** 還沒選到球員時是 null，這時候顯示隊伍層級的門檻 */
  playerId: Id | null
}) {
  const { pool } = useSeason()
  const categories = CATEGORIES[kind]

  const rows = useMemo<Row[]>(() => {
    const teamCutoffs = teamThresholds(pool, teamId)

    const targets: Row[] = [
      {
        label: '季前三門檻',
        isTarget: true,
        values: categories.map((c) => {
          if (playerId) return seasonTargetForPlayer(pool, teamId, playerId, c)
          const t = teamCutoffs[c]
          return t.kind === 'cutoff' ? t.entry.primary : null
        }),
        emptyText: '都記',
      },
      {
        label: '本場最佳',
        isTarget: true,
        values: categories.map((c) => gameTarget(pool, gameId, c)),
        emptyText: '都記',
      },
    ]

    if (!playerId) return targets

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
      ...targets,
    ]
  }, [pool, gameId, teamId, playerId, categories])

  return (
    <div className="rounded-lg border border-white/10 bg-night-900/60 px-3 py-2.5">
      <div
        className="grid items-center gap-x-3 gap-y-1.5"
        style={{ gridTemplateColumns: `7.5rem repeat(${categories.length}, minmax(0, 1fr))` }}
      >
        <span className="text-[12px] text-slate-500">{playerId ? '這位球員' : '這一隊'}</span>
        {categories.map((c) => (
          <span key={c} className="text-center text-[13px] font-medium text-slate-300">
            {CATEGORY_META[c].label.replace('最快', '').replace('最遠', '')}
          </span>
        ))}

        {rows.map((row) => (
          <TargetRow key={row.label} row={row} categories={categories} />
        ))}
      </div>
    </div>
  )
}

function TargetRow({ row, categories }: { row: Row; categories: RankCategory[] }) {
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
