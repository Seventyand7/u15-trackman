/**
 * 「這一球要贏過多少才有意義」。
 *
 * 選到球員的當下就顯示，不用等輸入數值——決定要不要記是在看回放的當下做的，
 * 而且換投手之後門檻就換了一組，記在腦袋裡很容易記錯。
 *
 * 兩個門檻的意義不一樣：
 *   季排名：贏過這個數字，該隊的季前三名才會變動（見 seasonTargetForPlayer）
 *   本場最佳：贏過這個數字，才會取代單場圖卡上那一筆（兩隊合併後的第一名）
 */

import { useMemo } from 'react'
import { useSeason } from '../../state/SeasonProvider'
import {
  CATEGORY_META,
  gameTarget,
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

  const rows = useMemo(
    () =>
      CATEGORIES[kind].map((category) => ({
        category,
        label: CATEGORY_META[category].label,
        season: seasonTargetForPlayer(pool, teamId, playerId, category),
        game: gameTarget(pool, gameId, category),
      })),
    [kind, pool, teamId, playerId, gameId],
  )

  return (
    <div className="rounded-lg border border-white/10 bg-night-900/50 px-3 py-2">
      {/*
        標題要寫「這位球員」：側欄的季前三門檻是整隊的，隊上名額沒滿時會寫「都記」，
        但如果這位球員自己已經在榜上，打出比他自己差的成績其實什麼都不會變。
        兩個數字都對，只是問的問題不一樣，標題講清楚才不會看起來互相矛盾。
      */}
      <p className="mb-1 text-[11px] text-slate-500">這位球員要贏過</p>
      <div
        className="grid gap-x-3 gap-y-1"
        style={{ gridTemplateColumns: `auto repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        <span />
        {rows.map((r) => (
          <span key={r.category} className="text-center text-[11px] text-slate-400">
            {r.label.replace('最快', '').replace('最遠', '')}
          </span>
        ))}

        <span className="self-center whitespace-nowrap text-[11px] text-slate-500">季排名</span>
        {rows.map((r) => (
          <Target key={r.category} category={r.category} value={r.season} />
        ))}

        <span className="self-center whitespace-nowrap text-[11px] text-slate-500">本場最佳</span>
        {rows.map((r) => (
          <Target key={r.category} category={r.category} value={r.game} />
        ))}
      </div>
    </div>
  )
}

function Target({ category, value }: { category: RankCategory; value: number | null }) {
  if (value === null) {
    return (
      <span className="text-center text-xs font-semibold text-emerald-300">都記</span>
    )
  }
  return (
    <span className="text-center font-mono text-sm font-semibold tabular-nums text-slate-200">
      {formatPrimary(category, value)}
    </span>
  )
}
