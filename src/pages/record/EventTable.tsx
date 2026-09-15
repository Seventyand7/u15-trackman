/**
 * 本場已記錄的事件。新的在上，可行內編輯與刪除。
 *
 * 投球和擊球分成兩張表，不混在一起：欄位差太多，混在一起會有一半是空格，
 * 行內編輯也會變得很難用。實際記錄時本來就是一段時間記投球、一段時間記擊球。
 */

import { useMemo, useState } from 'react'
import { useSeason } from '../../state/SeasonProvider'
import {
  deleteBattedBall,
  deletePitch,
  updateBattedBall,
  updatePitch,
} from '../../firebase/repo'
import {
  DASH,
  formatAngle,
  formatDistance,
  formatSpeed,
  formatSpin,
  formatText,
} from '../../lib/format'
import { toNumber, toText } from '../../lib/validation'
import type { BattedBall, Game, Id, Pitch } from '../../types/models'
import { Empty, Panel } from '../../components/ui'

export function EventTable({ game }: { game: Game }) {
  const { pitches, battedBalls } = useSeason()

  const gamePitches = useMemo(
    () => pitches.filter((p) => p.gameId === game.id).sort((a, b) => b.createdAt - a.createdAt),
    [pitches, game.id],
  )
  const gameBatted = useMemo(
    () => battedBalls.filter((b) => b.gameId === game.id).sort((a, b) => b.createdAt - a.createdAt),
    [battedBalls, game.id],
  )

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel
        title="投球紀錄"
        right={<span className="text-xs text-slate-500">{gamePitches.length} 筆</span>}
      >
        {gamePitches.length === 0 ? (
          <Empty>這場還沒有投球紀錄</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-3 font-medium">球員</th>
                  <th className="pb-2 pr-3 font-medium">球速</th>
                  <th className="pb-2 pr-3 font-medium">轉速</th>
                  <th className="pb-2 pr-3 font-medium">轉軸</th>
                  <th className="pb-2 pr-3 font-medium">水平</th>
                  <th className="pb-2 pr-3 font-medium">垂直</th>
                  <th className="pb-2 pr-3 font-medium">時間碼</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {gamePitches.map((p) => (
                  <PitchRow key={p.id} pitch={p} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="擊球紀錄"
        right={<span className="text-xs text-slate-500">{gameBatted.length} 筆</span>}
      >
        {gameBatted.length === 0 ? (
          <Empty>這場還沒有擊球紀錄</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-3 font-medium">球員</th>
                  <th className="pb-2 pr-3 font-medium">初速</th>
                  <th className="pb-2 pr-3 font-medium">仰角</th>
                  <th className="pb-2 pr-3 font-medium">距離</th>
                  <th className="pb-2 pr-3 font-medium">時間碼</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {gameBatted.map((b) => (
                  <BattedRow key={b.id} ball={b} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

// ---------------------------------------------------------------------------

function PlayerCell({ teamId, playerId }: { teamId: Id; playerId: Id }) {
  const { teamById, playerById } = useSeason()
  const team = teamById(teamId)
  const player = playerById(playerId)
  return (
    <td className="py-2 pr-3">
      <div className="whitespace-nowrap">
        <span className="text-xs text-slate-500">{team?.name ?? DASH}</span>{' '}
        <span className="font-mono font-semibold">{player?.number ?? DASH}</span>{' '}
        <span>{player?.name ?? '（已刪除）'}</span>
      </div>
    </td>
  )
}

function RowActions({
  editing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  editing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  return (
    <td className="py-2">
      <div className="flex justify-end gap-1">
        {editing ? (
          <>
            <button type="button" className="btn-primary !px-2 !py-1 text-xs" onClick={onSave}>
              儲存
            </button>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={onCancel}>
              取消
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={onEdit}>
              ✏️
            </button>
            <button type="button" className="btn-danger !px-2 !py-1 text-xs" onClick={onDelete}>
              刪除
            </button>
          </>
        )}
      </div>
    </td>
  )
}

function EditCell({
  value,
  onChange,
  onKeyDown,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  autoFocus?: boolean
}) {
  return (
    <td className="py-1.5 pr-3">
      <input
        autoFocus={autoFocus}
        className="field w-24 !py-1 font-mono text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </td>
  )
}

// ---------------------------------------------------------------------------

function PitchRow({ pitch }: { pitch: Pitch }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  function startEdit() {
    setDraft({
      speed: pitch.speed?.toString() ?? '',
      spin: pitch.spin?.toString() ?? '',
      axis: pitch.axis ?? '',
      hBreak: pitch.hBreak ?? '',
      vBreak: pitch.vBreak ?? '',
      videoTime: pitch.videoTime ?? '',
    })
    setEditing(true)
  }

  async function save() {
    const speed = toNumber(draft.speed ?? '')
    const spin = toNumber(draft.spin ?? '')
    await updatePitch(pitch.id, {
      speed: speed === null || Number.isNaN(speed) ? null : speed,
      spin: spin === null || Number.isNaN(spin) ? null : spin,
      axis: toText(draft.axis ?? ''),
      hBreak: toText(draft.hBreak ?? ''),
      vBreak: toText(draft.vBreak ?? ''),
      videoTime: toText(draft.videoTime ?? ''),
    })
    setEditing(false)
  }

  async function remove() {
    if (!confirm('確定要刪除這筆投球紀錄？')) return
    await deletePitch(pitch.id)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void save()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setEditing(false)
    }
  }

  const set = (k: string) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))

  if (editing) {
    return (
      <tr className="bg-amber1/5">
        <PlayerCell teamId={pitch.teamId} playerId={pitch.playerId} />
        <EditCell autoFocus value={draft.speed ?? ''} onChange={set('speed')} onKeyDown={onKeyDown} />
        <EditCell value={draft.spin ?? ''} onChange={set('spin')} onKeyDown={onKeyDown} />
        <EditCell value={draft.axis ?? ''} onChange={set('axis')} onKeyDown={onKeyDown} />
        <EditCell value={draft.hBreak ?? ''} onChange={set('hBreak')} onKeyDown={onKeyDown} />
        <EditCell value={draft.vBreak ?? ''} onChange={set('vBreak')} onKeyDown={onKeyDown} />
        <EditCell value={draft.videoTime ?? ''} onChange={set('videoTime')} onKeyDown={onKeyDown} />
        <RowActions
          editing
          onEdit={startEdit}
          onSave={() => void save()}
          onCancel={() => setEditing(false)}
          onDelete={() => void remove()}
        />
      </tr>
    )
  }

  return (
    <tr className="hover:bg-white/[0.03]">
      <PlayerCell teamId={pitch.teamId} playerId={pitch.playerId} />
      <td className="py-2 pr-3 font-mono tabular-nums">{formatSpeed(pitch.speed)}</td>
      <td className="py-2 pr-3 font-mono tabular-nums">{formatSpin(pitch.spin)}</td>
      <td className="py-2 pr-3 font-mono">{formatText(pitch.axis)}</td>
      <td className="py-2 pr-3 text-xs text-slate-400">{formatText(pitch.hBreak)}</td>
      <td className="py-2 pr-3 text-xs text-slate-400">{formatText(pitch.vBreak)}</td>
      <td className="py-2 pr-3 font-mono text-xs text-slate-500">{formatText(pitch.videoTime)}</td>
      <RowActions
        editing={false}
        onEdit={startEdit}
        onSave={() => void save()}
        onCancel={() => setEditing(false)}
        onDelete={() => void remove()}
      />
    </tr>
  )
}

// ---------------------------------------------------------------------------

function BattedRow({ ball }: { ball: BattedBall }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  function startEdit() {
    setDraft({
      exitVelo: ball.exitVelo?.toString() ?? '',
      launchAngle: ball.launchAngle?.toString() ?? '',
      distance: ball.distance?.toString() ?? '',
      videoTime: ball.videoTime ?? '',
    })
    setEditing(true)
  }

  async function save() {
    const num = (k: string) => {
      const v = toNumber(draft[k] ?? '')
      return v === null || Number.isNaN(v) ? null : v
    }
    await updateBattedBall(ball.id, {
      exitVelo: num('exitVelo'),
      launchAngle: num('launchAngle'),
      distance: num('distance'),
      videoTime: toText(draft.videoTime ?? ''),
    })
    setEditing(false)
  }

  async function remove() {
    if (!confirm('確定要刪除這筆擊球紀錄？')) return
    await deleteBattedBall(ball.id)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void save()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setEditing(false)
    }
  }

  const set = (k: string) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))

  if (editing) {
    return (
      <tr className="bg-amber1/5">
        <PlayerCell teamId={ball.teamId} playerId={ball.playerId} />
        <EditCell
          autoFocus
          value={draft.exitVelo ?? ''}
          onChange={set('exitVelo')}
          onKeyDown={onKeyDown}
        />
        <EditCell
          value={draft.launchAngle ?? ''}
          onChange={set('launchAngle')}
          onKeyDown={onKeyDown}
        />
        <EditCell value={draft.distance ?? ''} onChange={set('distance')} onKeyDown={onKeyDown} />
        <EditCell value={draft.videoTime ?? ''} onChange={set('videoTime')} onKeyDown={onKeyDown} />
        <RowActions
          editing
          onEdit={startEdit}
          onSave={() => void save()}
          onCancel={() => setEditing(false)}
          onDelete={() => void remove()}
        />
      </tr>
    )
  }

  return (
    <tr className="hover:bg-white/[0.03]">
      <PlayerCell teamId={ball.teamId} playerId={ball.playerId} />
      <td className="py-2 pr-3 font-mono tabular-nums">{formatSpeed(ball.exitVelo)}</td>
      <td className="py-2 pr-3 font-mono tabular-nums">{formatAngle(ball.launchAngle)}</td>
      <td className="py-2 pr-3 font-mono tabular-nums">{formatDistance(ball.distance)}</td>
      <td className="py-2 pr-3 font-mono text-xs text-slate-500">{formatText(ball.videoTime)}</td>
      <RowActions
        editing={false}
        onEdit={startEdit}
        onSave={() => void save()}
        onCancel={() => setEditing(false)}
        onDelete={() => void remove()}
      />
    </tr>
  )
}
