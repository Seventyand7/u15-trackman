/**
 * 記錄頁右側資訊欄：本場四項最佳，以及兩隊的季前三名門檻。
 *
 * 門檻要醒目——這是決定「這球要不要記」的依據，
 * 我一邊看回放一邊掃這一欄，所以數字要大、未滿三人要一眼看得出來。
 */

import { useSeason } from '../../state/SeasonProvider'
import {
  RANK_CATEGORIES,
  gameBests,
  teamThresholds,
  type RankEntry,
  type Threshold,
} from '../../lib/ranking'
import { DASH, formatPrimary } from '../../lib/format'
import type { Game, Team } from '../../types/models'
import { Panel } from '../../components/ui'

export function SidePanel({ game, teamA, teamB }: { game: Game; teamA: Team; teamB: Team }) {
  const { pool } = useSeason()
  const bests = gameBests(pool, game.id)

  return (
    <div className="space-y-4">
      <Panel title="本場目前最佳">
        <ul className="space-y-2.5">
          {RANK_CATEGORIES.map((meta) => (
            <BestRow key={meta.key} label={meta.label} entry={bests[meta.key]} />
          ))}
        </ul>
      </Panel>

      <ThresholdPanel team={teamA} />
      <ThresholdPanel team={teamB} />
    </div>
  )
}

function BestRow({ label, entry }: { label: string; entry: RankEntry | null }) {
  const { teamById, playerById } = useSeason()
  const player = playerById(entry?.playerId)
  const team = teamById(entry?.teamId)

  return (
    <li className="flex items-baseline gap-2">
      <span className="w-20 shrink-0 text-xs text-slate-400">{label}</span>
      {entry ? (
        <>
          <span className="font-mono text-base font-bold text-amber1">
            {formatPrimary(entry.category, entry.primary)}
          </span>
          <span className="truncate text-xs text-slate-400">
            {team?.name} {player?.number} {player?.name}
          </span>
        </>
      ) : (
        <span className="text-sm text-slate-600">{DASH}</span>
      )}
    </li>
  )
}

function ThresholdPanel({ team }: { team: Team }) {
  const { pool } = useSeason()
  const thresholds = teamThresholds(pool, team.id)

  return (
    <Panel
      title={
        <span>
          <span className="text-slate-500">季前三門檻 ·</span> {team.name}
        </span>
      }
    >
      <ul className="space-y-2">
        {RANK_CATEGORIES.map((meta) => (
          <ThresholdRow key={meta.key} label={meta.label} threshold={thresholds[meta.key]} />
        ))}
      </ul>
    </Panel>
  )
}

function ThresholdRow({ label, threshold }: { label: string; threshold: Threshold }) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      {threshold.kind === 'open' ? (
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
          未滿 3 人，都記
        </span>
      ) : (
        <span className="font-mono text-lg font-bold tabular-nums text-slate-100">
          {formatPrimary(threshold.entry.category, threshold.entry.primary)}
        </span>
      )}
    </li>
  )
}
