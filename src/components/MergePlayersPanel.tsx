/**
 * 合併球員。
 *
 * 這是修正「同一個人被建成兩筆球員」的唯一方法——季排名會把他算成兩個人。
 * 執行前一定要看到影響筆數再確認，因為事件的 playerId 搬過去就回不來了。
 */

import { useMemo, useState } from 'react'
import { useSeason } from '../state/SeasonProvider'
import { applyMerge } from '../firebase/repo'
import { countPlayerEvents, planMergePlayers, type MergePlan } from '../lib/players'
import type { Id, Player } from '../types/models'

export function MergePlayersPanel({
  teamId,
  /** 從記錄頁的球員編輯進來時，先選好其中一位 */
  initialKeepId,
  onDone,
  onCancel,
}: {
  teamId: Id
  initialKeepId?: Id
  onDone: (message: string) => void
  onCancel: () => void
}) {
  const { players, pitches, battedBalls, teamById } = useSeason()

  const teamPlayers = useMemo(
    () =>
      players
        .filter((p) => p.teamId === teamId)
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
    [players, teamId],
  )

  const [keepId, setKeepId] = useState<Id>(initialKeepId ?? '')
  const [removeId, setRemoveId] = useState<Id>('')
  const [numberFrom, setNumberFrom] = useState<'keep' | 'remove'>('keep')
  const [nameFrom, setNameFrom] = useState<'keep' | 'remove'>('keep')
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const countFor = (id: Id) => countPlayerEvents(id, pitches, battedBalls).total

  const keep = teamPlayers.find((p) => p.id === keepId) ?? null
  const remove = teamPlayers.find((p) => p.id === removeId) ?? null

  /** 計畫算得出來就顯示影響筆數，算不出來就顯示原因（不同隊、背號被第三人佔用等）。 */
  const { plan, planError } = useMemo<{ plan: MergePlan | null; planError: string | null }>(() => {
    if (!keep || !remove || keep.id === remove.id) return { plan: null, planError: null }
    try {
      return {
        plan: planMergePlayers({
          selection: { keepId: keep.id, removeId: remove.id, numberFrom, nameFrom },
          players,
          pitches,
          battedBalls,
        }),
        planError: null,
      }
    } catch (e) {
      return { plan: null, planError: (e as Error).message }
    }
  }, [keep, remove, numberFrom, nameFrom, players, pitches, battedBalls])

  async function run() {
    if (!plan || running) return
    const message =
      `確定要合併嗎？\n\n` +
      `保留：${plan.result.number} ${plan.result.name}\n` +
      `刪除：${remove?.number} ${remove?.name}\n` +
      `會把 ${plan.affected.total} 筆紀錄（投球 ${plan.affected.pitches}、擊球 ${plan.affected.battedBalls}）改到保留的球員身上。\n\n` +
      `這個動作無法復原。`
    if (!confirm(message)) return

    setRunning(true)
    setError(null)
    try {
      await applyMerge(plan)
      onDone(`已合併：${plan.result.number} ${plan.result.name}（搬移 ${plan.affected.total} 筆紀錄）`)
    } catch (e) {
      setError(`合併失敗：${(e as Error).message}`)
      setRunning(false)
    }
  }

  return (
    <div className="animate-pop-in rounded-lg border border-amber1/40 bg-amber1/5 p-4">
      <h3 className="text-[15px] font-bold text-amber1">
        合併球員 · {teamById(teamId)?.name}
      </h3>
      <p className="mt-1 text-[13px] text-slate-400">
        兩筆其實是同一個人時用這個。所有紀錄會搬到保留的那一筆身上，另一筆刪除。
      </p>

      <div className="mt-3 flex flex-wrap gap-3">
        <PlayerSelect
          label="保留這一筆"
          value={keepId}
          onChange={setKeepId}
          exclude={removeId}
          teamPlayers={teamPlayers}
          countFor={countFor}
        />
        <PlayerSelect
          label="刪除這一筆"
          value={removeId}
          onChange={setRemoveId}
          exclude={keepId}
          teamPlayers={teamPlayers}
          countFor={countFor}
        />
      </div>

      {keep && remove && (
        <div className="mt-3 flex flex-wrap gap-4">
          <ChoiceRow
            label="合併後的背號"
            value={numberFrom}
            onChange={setNumberFrom}
            keepText={keep.number}
            removeText={remove.number}
          />
          <ChoiceRow
            label="合併後的姓名"
            value={nameFrom}
            onChange={setNameFrom}
            keepText={keep.name}
            removeText={remove.name}
          />
        </div>
      )}

      {planError && <p className="mt-3 text-sm text-red-300">{planError}</p>}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {plan && (
        <p className="mt-3 rounded-lg border border-white/10 bg-night-900/60 px-3 py-2 text-sm">
          合併後：
          <span className="font-semibold text-amber1">
            {' '}
            {plan.result.number} {plan.result.name}
          </span>
          ，並把{' '}
          <span className="font-semibold">{plan.affected.total}</span> 筆紀錄（投球{' '}
          {plan.affected.pitches}、擊球 {plan.affected.battedBalls}）改到他身上。
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => void run()}
          disabled={!plan || running}
        >
          {running ? '合併中…' : '執行合併'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={running}>
          取消
        </button>
      </div>
    </div>
  )
}

function PlayerSelect({
  label,
  value,
  onChange,
  exclude,
  teamPlayers,
  countFor,
}: {
  label: string
  value: Id
  onChange: (v: Id) => void
  exclude: Id
  teamPlayers: readonly Player[]
  countFor: (id: Id) => number
}) {
  return (
    <div className="min-w-[180px] flex-1">
      <label className="label">{label}</label>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">選擇球員…</option>
        {teamPlayers.map((p) => (
          <option key={p.id} value={p.id} disabled={p.id === exclude}>
            {p.number} {p.name}（{countFor(p.id)} 筆）
          </option>
        ))}
      </select>
    </div>
  )
}

function ChoiceRow({
  label,
  value,
  onChange,
  keepText,
  removeText,
}: {
  label: string
  value: 'keep' | 'remove'
  onChange: (v: 'keep' | 'remove') => void
  keepText: string
  removeText: string
}) {
  const options: { key: 'keep' | 'remove'; text: string }[] = [
    { key: 'keep', text: keepText },
    { key: 'remove', text: removeText },
  ]
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              value === o.key
                ? 'border-amber1 bg-amber1/15 text-amber1'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {o.text || '（空白）'}
          </button>
        ))}
      </div>
    </div>
  )
}
