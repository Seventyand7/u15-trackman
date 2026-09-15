/**
 * 記錄頁右側資訊欄。
 *
 * 「本場最佳」分兩隊並排，不是兩隊合併成一欄——
 * 強隊打弱隊時，合併的那一欄會整排被強隊佔滿，弱隊現在最好的是多少完全看不到，
 * 就只能自己記在腦袋裡。合併後的第一名用琥珀色標出來。
 *
 * 「季前三門檻」是決定這球要不要記的依據，數字要大、未滿三人要一眼看得出來。
 */

import { useSeason } from '../../state/SeasonProvider'
import {
  RANK_CATEGORIES,
  gameBests,
  teamGameBests,
  teamThresholds,
  type RankCategory,
  type RankEntry,
  type Threshold,
} from '../../lib/ranking'
import { DASH, formatPrimary } from '../../lib/format'
import type { Game, Team } from '../../types/models'
import { Panel } from '../../components/ui'

export function SidePanel({ game, teamA, teamB }: { game: Game; teamA: Team; teamB: Team }) {
  const { pool } = useSeason()
  const overall = gameBests(pool, game.id)
  const bestsA = teamGameBests(pool, game.id, teamA.id)
  const bestsB = teamGameBests(pool, game.id, teamB.id)

  return (
    <div className="space-y-4">
      <Panel title="本場最佳">
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-1">
          <span />
          <span className="truncate pb-1 text-center text-[13px] font-semibold text-slate-200">
            {teamA.name}
          </span>
          <span className="truncate pb-1 text-center text-[13px] font-semibold text-slate-200">
            {teamB.name}
          </span>

          {RANK_CATEGORIES.map((meta) => (
            <BestRow
              key={meta.key}
              label={meta.label}
              category={meta.key}
              a={bestsA[meta.key]}
              b={bestsB[meta.key]}
              overall={overall[meta.key]}
            />
          ))}
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
          琥珀色是兩隊合併後的本場第一，會上單場圖卡。
        </p>
      </Panel>

      <ThresholdPanel team={teamA} />
      <ThresholdPanel team={teamB} />
    </div>
  )
}

function BestRow({
  label,
  category,
  a,
  b,
  overall,
}: {
  label: string
  category: RankCategory
  a: RankEntry | null
  b: RankEntry | null
  overall: RankEntry | null
}) {
  return (
    <>
      <span className="self-center whitespace-nowrap text-[13px] text-slate-300">{label}</span>
      <BestCell entry={a} category={category} isOverall={a !== null && a === overall} />
      <BestCell entry={b} category={category} isOverall={b !== null && b === overall} />
    </>
  )
}

function BestCell({
  entry,
  category,
  isOverall,
}: {
  entry: RankEntry | null
  category: RankCategory
  isOverall: boolean
}) {
  const { playerById } = useSeason()
  const player = playerById(entry?.playerId)

  if (!entry) {
    return (
      <span className="rounded bg-white/[0.02] py-1 text-center text-base text-slate-600">
        {DASH}
      </span>
    )
  }

  return (
    <span
      className={`rounded px-1 py-0.5 text-center leading-tight ${
        isOverall ? 'bg-amber1/10' : 'bg-white/[0.02]'
      }`}
    >
      <span
        className={`block font-mono text-base font-bold tabular-nums ${
          isOverall ? 'text-amber1' : 'text-slate-100'
        }`}
      >
        {formatPrimary(category, entry.primary)}
      </span>
      <span className="block truncate text-xs text-slate-400">
        {player ? `${player.number} ${player.name}` : DASH}
      </span>
    </span>
  )
}

function ThresholdPanel({ team }: { team: Team }) {
  const { pool } = useSeason()
  const thresholds = teamThresholds(pool, team.id)

  return (
    <Panel
      title={
        <span>
          <span className="text-slate-400">季前三門檻 ·</span> {team.name}
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
      <span className="text-[13px] text-slate-300">{label}</span>
      {threshold.kind === 'open' ? (
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[13px] font-semibold text-emerald-300">
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
