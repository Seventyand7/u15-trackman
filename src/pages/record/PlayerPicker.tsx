/**
 * 記錄頁的球員選擇：打背號 → 即時帶出姓名。
 *
 * 三種狀態，全部在原地切換，不跳頁也不開 modal：
 *   1. 背號存在 → 顯示姓名與 ✏️（可就地改背號／改名）
 *   2. 背號不存在 → 就地長出「姓名」欄位，直接新增
 *   3. 正在編輯 → 行內小表單，Enter 儲存、Esc 取消
 */

import { forwardRef, useEffect, useRef, useState } from 'react'
import { useSeason } from '../../state/SeasonProvider'
import { updatePlayer } from '../../firebase/repo'
import {
  countPlayerEvents,
  findNumberConflict,
  findPlayerByNumber,
  normalizeName,
} from '../../lib/players'
import type { Id, Player } from '../../types/models'
import { Kbd } from '../../components/ui'

export interface PlayerPickerProps {
  /** 點「合併球員」時交給記錄頁開面板 */
  onRequestMerge?: (player: Player) => void
  seasonId: Id
  teamId: Id | null
  number: string
  onNumberChange: (v: string) => void
  newName: string
  onNewNameChange: (v: string) => void
  /** 解析出來的球員（背號存在時） */
  resolved: Player | null
  /** 背號欄按 Enter 時，把焦點交給下一個欄位 */
  onAdvance: () => void
}

export const PlayerPicker = forwardRef<HTMLInputElement, PlayerPickerProps>(
  function PlayerPicker(props, numberRef) {
    const { seasonId, teamId, number, onNumberChange, newName, onNewNameChange, resolved, onRequestMerge } = props
    const { players, pitches, battedBalls } = useSeason()
    const [editing, setEditing] = useState(false)
    const nameRef = useRef<HTMLInputElement>(null)

    // 換隊或清空背號時，把新增球員的姓名一起清掉，免得殘留上一次的輸入
    useEffect(() => {
      setEditing(false)
    }, [teamId, number])

    const needsNewPlayer = teamId !== null && number.trim() !== '' && resolved === null

    return (
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor={`number-${seasonId}`}>
            背號
          </label>
          <input
            ref={numberRef}
            id={`number-${seasonId}`}
            className="field w-24 text-center text-lg font-semibold placeholder:text-slate-700"
            value={number}
            onChange={(e) => onNumberChange(e.target.value)}
            placeholder="—"
            autoComplete="off"
            disabled={teamId === null}
          />
        </div>

        {resolved && !editing && (
          <div className="flex items-center gap-2 pb-2">
            <span className="text-lg font-semibold text-amber1">{resolved.name}</span>
            <button
              type="button"
              className="btn-ghost !px-2 !py-1 text-xs"
              title="修改背號或姓名"
              onClick={() => setEditing(true)}
            >
              ✏️
            </button>
          </div>
        )}

        {resolved && editing && (
          <PlayerEditForm
            player={resolved}
            players={players}
            eventCount={countPlayerEvents(resolved.id, pitches, battedBalls).total}
            onDone={() => setEditing(false)}
            onRequestMerge={
              onRequestMerge ? () => { setEditing(false); onRequestMerge(resolved) } : undefined
            }
          />
        )}

        {needsNewPlayer && (
          <div>
            <label className="label" htmlFor={`newname-${seasonId}`}>
              姓名（新球員）
            </label>
            <input
              ref={nameRef}
              id={`newname-${seasonId}`}
              className="field w-40 placeholder:text-slate-600"
              value={newName}
              onChange={(e) => onNewNameChange(e.target.value)}
              placeholder={`${number.trim()} 號是誰？`}
              autoComplete="off"
            />
          </div>
        )}
      </div>
    )
  },
)

// ---------------------------------------------------------------------------

function PlayerEditForm({
  player,
  players,
  eventCount,
  onDone,
  onRequestMerge,
}: {
  player: Player
  players: readonly Player[]
  eventCount: number
  onDone: () => void
  onRequestMerge?: () => void
}) {
  const [number, setNumber] = useState(player.number)
  const [name, setName] = useState(player.name)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (saving) return
    if (normalizeName(name) === '') {
      setError('姓名不能空白')
      return
    }
    const conflict = findNumberConflict(
      players,
      { seasonId: player.seasonId, teamId: player.teamId },
      number,
      player.id,
    )
    if (conflict) {
      setError(`背號 ${number.trim()} 已經被 ${conflict.name} 使用`)
      return
    }
    setSaving(true)
    try {
      await updatePlayer(player.id, { number, name })
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      void save()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onDone()
    }
  }

  return (
    <div
      className="animate-pop-in rounded-lg border border-amber1/30 bg-amber1/5 p-3"
      onKeyDown={onKeyDown}
    >
      <div className="flex items-end gap-2">
        <div>
          <label className="label">背號</label>
          <input
            autoFocus
            className="field w-20 text-center"
            value={number}
            onChange={(e) => {
              setNumber(e.target.value)
              setError(null)
            }}
          />
        </div>
        <div>
          <label className="label">姓名</label>
          <input
            className="field w-36"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
          />
        </div>
        <button type="button" className="btn-primary !py-1.5 text-xs" onClick={() => void save()}>
          儲存
        </button>
        <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={onDone}>
          取消
        </button>
        {onRequestMerge && (
          <button
            type="button"
            className="btn-ghost !py-1.5 text-xs"
            onClick={onRequestMerge}
            title="這一筆其實跟另一位球員是同一個人時用這個"
          >
            合併球員…
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-400">
        將同步更新此球員所有歷史紀錄（共 {eventCount} 筆）　<Kbd>Enter</Kbd> 儲存 <Kbd>Esc</Kbd> 取消
      </p>

      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------

/** 同名偵測的選擇面板：是換背號的同一人，還是真的另一個人。 */
export function SameNameDecision({
  candidates,
  number,
  name,
  onSamePerson,
  onDifferentPerson,
  onCancel,
}: {
  candidates: Player[]
  number: string
  name: string
  onSamePerson: (player: Player) => void
  onDifferentPerson: () => void
  onCancel: () => void
}) {
  return (
    <div className="animate-pop-in rounded-lg border border-amber1/40 bg-amber1/10 p-4">
      <p className="text-sm font-semibold text-amber1">
        要新增「{number} {name}」，但同隊已經有同名球員了——是同一個人嗎？
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {candidates.map((c) => (
          <button
            key={c.id}
            type="button"
            className="btn-primary text-xs"
            onClick={() => onSamePerson(c)}
          >
            是同一人，將 {c.number} 號改為 {number} 號
          </button>
        ))}
        <button type="button" className="btn-ghost text-xs" onClick={onDifferentPerson}>
          是不同人，新增 {number} 號 {name}
        </button>
        <button type="button" className="btn-ghost text-xs" onClick={onCancel}>
          取消
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        選錯的話，之後可以在資料管理頁合併球員修正。
      </p>
    </div>
  )
}

/** 給表單用的解析函式，跟 PlayerPicker 共用同一套規則。 */
export function resolvePlayer(
  players: readonly Player[],
  seasonId: Id,
  teamId: Id | null,
  number: string,
): Player | null {
  if (!teamId || number.trim() === '') return null
  return findPlayerByNumber(players, { seasonId, teamId }, number)
}
