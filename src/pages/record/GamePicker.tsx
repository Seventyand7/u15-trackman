/**
 * 選比賽：先選日期，再從當天的比賽裡挑。
 *
 * 不用下拉式選單——一季會累積到六七十場，那時候下拉選單根本不能用。
 * 日期才是我腦中的索引（我是照週次看回放的），而一天最多四場，
 * 所以當天的比賽直接攤開成按鈕，一眼看完。
 *
 * ◀ ▶ 跳的是「前／後一個有比賽的日子」，不是前一天——
 * 中間沒比賽的日子按了也沒意義。
 */

import { useEffect, useMemo, useState } from 'react'
import {
  formatGameDate,
  formatMatchup,
  formatOrder,
  gameDates,
  needsOrderLabel,
  todayISO,
} from '../../lib/format'
import type { Game, Team } from '../../types/models'

export function GamePicker({
  games,
  teams,
  current,
  onSelect,
}: {
  games: readonly Game[]
  teams: readonly Team[]
  current: Game | null
  onSelect: (id: string) => void
}) {
  const dates = useMemo(() => gameDates(games), [games])
  const [viewDate, setViewDate] = useState(() => current?.date ?? dates[0] ?? todayISO())

  // 比賽被外部換掉時（換季、記住的比賽失效），日期跟著跳過去
  useEffect(() => {
    if (current) setViewDate(current.date)
  }, [current?.id])

  const dayGames = useMemo(
    () => games.filter((g) => g.date === viewDate).sort((a, b) => a.order - b.order),
    [games, viewDate],
  )
  const showOrder = needsOrderLabel(dayGames)

  // dates 是新到舊，所以往「前一個比賽日」是索引 +1
  const index = dates.indexOf(viewDate)
  const olderDate = index === -1 ? dates[0] : dates[index + 1]
  const newerDate = index <= 0 ? undefined : dates[index - 1]

  return (
    <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-ghost !px-2.5 !py-2"
          onClick={() => olderDate && setViewDate(olderDate)}
          disabled={!olderDate}
          title="前一個比賽日"
          aria-label="前一個比賽日"
        >
          ◀
        </button>

        <div className="relative">
          <input
            type="date"
            className="field w-[150px] font-mono"
            value={viewDate}
            onChange={(e) => e.target.value && setViewDate(e.target.value)}
            aria-label="比賽日期"
          />
        </div>

        <button
          type="button"
          className="btn-ghost !px-2.5 !py-2"
          onClick={() => newerDate && setViewDate(newerDate)}
          disabled={!newerDate}
          title="後一個比賽日"
          aria-label="後一個比賽日"
        >
          ▶
        </button>
      </div>

      <span className="font-mono text-sm text-slate-400">{formatGameDate(viewDate)}</span>

      <div className="flex flex-wrap items-center gap-2">
        {dayGames.length === 0 ? (
          <span className="text-sm text-slate-500">這天沒有比賽</span>
        ) : (
          dayGames.map((g) => {
            const selected = g.id === current?.id
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelect(g.id)}
                className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber1/70 ${
                  selected
                    ? 'border-amber1 bg-amber1/15 text-amber1'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {showOrder && (
                  <span className="mr-1.5 font-mono text-xs text-slate-500">
                    {formatOrder(g.order)}
                  </span>
                )}
                {formatMatchup(g, teams)}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
