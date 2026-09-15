import { useMemo, useRef, useState } from 'react'
import { useSeason } from '../state/SeasonProvider'
import {
  createPlayersBatch,
  deletePlayer,
  importSeasonAsNew,
  updatePlayer,
} from '../firebase/repo'
import {
  countPlayerEvents,
  findNumberConflict,
  normalizeName,
  planDeletePlayer,
} from '../lib/players'
import { describeRosterStatus, planRosterImport } from '../lib/roster'
import {
  backupFilename,
  backupToBlob,
  buildSeasonBackup,
  parseSeasonBackup,
  summarizeBackup,
  type SeasonBackup,
} from '../lib/backup'
import { downloadBlob } from '../lib/exportImage'
import { MergePlayersPanel } from '../components/MergePlayersPanel'
import { Empty, ErrorBanner, Kbd, Panel, Spinner } from '../components/ui'
import type { Id, Player } from '../types/models'

export default function DataPage() {
  const season = useSeason()
  const [flash, setFlash] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (season.loadingSeasons) return <Spinner label="載入球季…" />
  if (!season.seasonId) return <Empty>還沒有球季。請先到「設定」建立球季。</Empty>
  if (season.loadingData) return <Spinner label="載入本季資料…" />

  return (
    <div className="space-y-6">
      <ErrorBanner message={season.error ?? actionError} />
      {flash && (
        <p className="animate-pop-in rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {flash}
        </p>
      )}

      <RosterSection onFlash={setFlash} onError={setActionError} />
      <BackupSection onFlash={setFlash} onError={setActionError} />
    </div>
  )
}

type Notify = (m: string | null) => void

// ---------------------------------------------------------------------------
// 球員名單

function RosterSection({ onFlash, onError }: { onFlash: Notify; onError: Notify }) {
  const { teams, players, pitches, battedBalls } = useSeason()
  const [mergeTeamId, setMergeTeamId] = useState<Id | null>(null)
  const [mergeKeepId, setMergeKeepId] = useState<Id | undefined>(undefined)
  const [pasteTeamId, setPasteTeamId] = useState<Id | null>(null)

  if (teams.length === 0) {
    return (
      <Panel title="球員名單">
        <Empty>這一季還沒有隊伍。請先到「設定」新增隊伍。</Empty>
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      {teams.map((team) => {
        const roster = players
          .filter((p) => p.teamId === team.id)
          .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))

        return (
          <Panel
            key={team.id}
            title={team.name}
            right={
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{roster.length} 位</span>
                <button
                  type="button"
                  className="btn-ghost !py-1 text-xs"
                  onClick={() => {
                    setPasteTeamId(pasteTeamId === team.id ? null : team.id)
                    setMergeTeamId(null)
                  }}
                >
                  貼上名單
                </button>
                <button
                  type="button"
                  className="btn-ghost !py-1 text-xs"
                  onClick={() => {
                    setMergeTeamId(mergeTeamId === team.id ? null : team.id)
                    setMergeKeepId(undefined)
                    setPasteTeamId(null)
                  }}
                  disabled={roster.length < 2}
                  title={roster.length < 2 ? '至少要有兩位球員才能合併' : undefined}
                >
                  合併球員
                </button>
              </span>
            }
          >
            {mergeTeamId === team.id && (
              <div className="mb-4">
                <MergePlayersPanel
                  teamId={team.id}
                  initialKeepId={mergeKeepId}
                  onDone={(m) => {
                    onFlash(m)
                    onError(null)
                    setMergeTeamId(null)
                  }}
                  onCancel={() => setMergeTeamId(null)}
                />
              </div>
            )}

            {pasteTeamId === team.id && (
              <div className="mb-4">
                <PastePanel
                  teamId={team.id}
                  onDone={(m) => {
                    onFlash(m)
                    onError(null)
                    setPasteTeamId(null)
                  }}
                  onCancel={() => setPasteTeamId(null)}
                />
              </div>
            )}

            {roster.length === 0 ? (
              <Empty>這一隊還沒有球員。用「貼上名單」批次新增，或直接到記錄頁邊記邊建。</Empty>
            ) : (
              <ul className="divide-y divide-white/5">
                {roster.map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    events={countPlayerEvents(p.id, pitches, battedBalls)}
                    onError={onError}
                    onFlash={onFlash}
                    onMerge={() => {
                      setMergeTeamId(team.id)
                      setMergeKeepId(p.id)
                      setPasteTeamId(null)
                    }}
                  />
                ))}
              </ul>
            )}
          </Panel>
        )
      })}
    </div>
  )
}

function PlayerRow({
  player,
  events,
  onError,
  onFlash,
  onMerge,
}: {
  player: Player
  events: { pitches: number; battedBalls: number; total: number }
  onError: Notify
  onFlash: Notify
  onMerge: () => void
}) {
  const { players, pitches, battedBalls } = useSeason()
  const [editing, setEditing] = useState(false)
  const [number, setNumber] = useState(player.number)
  const [name, setName] = useState(player.name)
  const [rowError, setRowError] = useState<string | null>(null)

  function startEdit() {
    setNumber(player.number)
    setName(player.name)
    setRowError(null)
    setEditing(true)
  }

  async function save() {
    if (normalizeName(name) === '') {
      setRowError('姓名不能空白')
      return
    }
    const conflict = findNumberConflict(
      players,
      { seasonId: player.seasonId, teamId: player.teamId },
      number,
      player.id,
    )
    if (conflict) {
      setRowError(`背號 ${number.trim()} 已經被 ${conflict.name} 使用`)
      return
    }
    try {
      await updatePlayer(player.id, { number, name })
      setEditing(false)
      onFlash(`已更新 ${number.trim()} ${name.trim()}`)
    } catch (e) {
      setRowError((e as Error).message)
    }
  }

  async function remove() {
    const plan = planDeletePlayer(player.id, pitches, battedBalls)
    if (plan.kind === 'blocked') {
      alert(
        `${player.number} ${player.name} 還有 ${plan.affected.total} 筆紀錄` +
          `（投球 ${plan.affected.pitches}、擊球 ${plan.affected.battedBalls}），不能直接刪除。\n\n` +
          '如果這一筆是重複建立的同一個人，請改用「合併球員」。',
      )
      return
    }
    if (!confirm(`確定要刪除 ${player.number} ${player.name}？`)) return
    try {
      await deletePlayer(player.id)
      onFlash(`已刪除 ${player.number} ${player.name}`)
    } catch (e) {
      onError((e as Error).message)
    }
  }

  if (editing) {
    return (
      <li className="py-2.5">
        <div
          className="flex flex-wrap items-end gap-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void save()
            }
            if (e.key === 'Escape') setEditing(false)
          }}
        >
          <div>
            <label className="label">背號</label>
            <input
              autoFocus
              className="field w-20 text-center"
              value={number}
              onChange={(e) => {
                setNumber(e.target.value)
                setRowError(null)
              }}
            />
          </div>
          <div>
            <label className="label">姓名</label>
            <input
              className="field w-40"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setRowError(null)
              }}
            />
          </div>
          <button type="button" className="btn-primary !py-1.5 text-xs" onClick={() => void save()}>
            儲存
          </button>
          <button
            type="button"
            className="btn-ghost !py-1.5 text-xs"
            onClick={() => setEditing(false)}
          >
            取消
          </button>
          <span className="pb-2 text-xs text-slate-500">
            將同步更新 {events.total} 筆紀錄　<Kbd>Enter</Kbd> 儲存 <Kbd>Esc</Kbd> 取消
          </span>
        </div>
        {rowError && <p className="mt-1 text-xs text-red-300">{rowError}</p>}
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
      <span className="w-12 shrink-0 text-center font-mono font-semibold text-amber1">
        {player.number}
      </span>
      <span className="font-medium">{player.name}</span>
      <span className="text-xs text-slate-500">
        {events.total === 0 ? '尚無紀錄' : `${events.pitches} 投 · ${events.battedBalls} 擊`}
      </span>
      <div className="ml-auto flex gap-1">
        <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={startEdit}>
          ✏️ 編輯
        </button>
        <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={onMerge}>
          合併
        </button>
        <button
          type="button"
          className="btn-danger !px-2 !py-1 text-xs"
          onClick={() => void remove()}
          title={events.total > 0 ? '有紀錄的球員不能刪除，請改用合併' : undefined}
        >
          刪除
        </button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// 貼上名單

function PastePanel({
  teamId,
  onDone,
  onCancel,
}: {
  teamId: Id
  onDone: (m: string) => void
  onCancel: () => void
}) {
  const { seasonId, players } = useSeason()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plan = useMemo(
    () => planRosterImport(text, players, { seasonId: seasonId ?? '', teamId }),
    [text, players, seasonId, teamId],
  )

  async function save() {
    if (!seasonId || plan.createCount === 0 || saving) return
    setSaving(true)
    setError(null)
    try {
      const count = await createPlayersBatch(
        plan.rows
          .filter((r) => r.willCreate)
          .map((r) => ({ seasonId, teamId, number: r.number, name: r.name })),
      )
      onDone(`已新增 ${count} 位球員`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-night-900/60 p-4">
      <label className="label" htmlFor="roster-paste">
        一行一位，格式「背號 姓名」
      </label>
      <textarea
        id="roster-paste"
        className="field h-32 font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'5 王小明\n15 李大同\n00 陳小華'}
      />
      <p className="mt-1 text-xs text-slate-500">
        分隔可以是空白、tab 或逗號。從 Excel 直接複製貼上也可以。
      </p>

      {plan.rows.length > 0 && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              {plan.rows.map((r) => (
                <tr key={r.lineNo} className={r.willCreate ? '' : 'bg-red-500/5'}>
                  <td className="w-10 py-1.5 pl-3 text-xs text-slate-600">{r.lineNo}</td>
                  <td className="w-16 py-1.5 font-mono font-semibold">{r.number}</td>
                  <td className="py-1.5">{r.name}</td>
                  <td
                    className={`py-1.5 pr-3 text-right text-xs ${
                      r.status.kind === 'ok'
                        ? 'text-emerald-300'
                        : r.willCreate
                          ? 'text-amber-300'
                          : 'text-red-300'
                    }`}
                  >
                    {describeRosterStatus(r.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => void save()}
          disabled={plan.createCount === 0 || saving}
        >
          {saving ? '寫入中…' : `新增 ${plan.createCount} 位`}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
          取消
        </button>
        {plan.blockedCount > 0 && (
          <span className="text-xs text-red-300">{plan.blockedCount} 列被擋下，不會寫入</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// JSON 備份

function BackupSection({ onFlash, onError }: { onFlash: Notify; onError: Notify }) {
  const { season, teams, players, games, pitches, battedBalls, selectSeason } = useSeason()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<SeasonBackup | null>(null)
  const [importName, setImportName] = useState('')
  const [progress, setProgress] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  function exportJson() {
    if (!season) return
    const backup = buildSeasonBackup({ season, teams, players, games, pitches, battedBalls })
    const name = backupFilename(season.name)
    downloadBlob(backupToBlob(backup), name)
    onFlash(`已下載 ${name}`)
    onError(null)
  }

  async function pickFile(file: File) {
    onError(null)
    onFlash(null)
    const result = parseSeasonBackup(await file.text())
    if (!result.ok) {
      onError(`備份檔讀不進來：${result.error}`)
      setPending(null)
      return
    }
    setPending(result.backup)
    setImportName(`${result.backup.season.name}（還原）`)
  }

  async function runImport() {
    if (!pending || importing) return
    setImporting(true)
    onError(null)
    try {
      const newId = await importSeasonAsNew(pending, importName.trim() || '還原的球季', (p) =>
        setProgress(`${p.done}/${p.total}`),
      )
      selectSeason(newId)
      onFlash(`已匯入成新的一季「${importName.trim()}」，目前球季已切換過去`)
      setPending(null)
    } catch (e) {
      onError(`匯入失敗：${(e as Error).message}`)
    } finally {
      setImporting(false)
      setProgress(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const summary = pending ? summarizeBackup(pending) : null

  return (
    <Panel title="整季備份">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={exportJson} disabled={!season}>
          匯出 JSON
        </button>
        <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
          選擇備份檔匯入…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void pickFile(f)
          }}
        />
        <span className="text-xs text-slate-500">
          目前這一季：{teams.length} 隊 · {players.length} 位球員 · {games.length} 場 ·{' '}
          {pitches.length + battedBalls.length} 筆紀錄
        </span>
      </div>

      {summary && (
        <div className="mt-4 animate-pop-in rounded-lg border border-amber1/40 bg-amber1/5 p-4">
          <h3 className="text-sm font-bold text-amber1">準備匯入</h3>
          <p className="mt-2 text-sm text-slate-300">
            備份內容：{summary.teams} 隊 · {summary.players} 位球員 · {summary.games} 場 ·{' '}
            {summary.pitches + summary.battedBalls} 筆紀錄
            {summary.exportedAt > 0 && (
              <span className="text-slate-500">
                （匯出於 {new Date(summary.exportedAt).toLocaleString('zh-TW')}）
              </span>
            )}
          </p>

          {summary.orphanEvents > 0 && (
            <p className="mt-2 text-xs text-amber-300">
              ⚠️ 有 {summary.orphanEvents} 筆紀錄指向備份檔裡不存在的球員或比賽，匯入後會變成孤兒資料。
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="import-season-name">
                新球季名稱
              </label>
              <input
                id="import-season-name"
                className="field w-64"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void runImport()}
              disabled={importing || importName.trim() === ''}
            >
              {importing ? `匯入中 ${progress ?? ''}` : '匯入'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setPending(null)}
              disabled={importing}
            >
              取消
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            匯入一律<span className="font-semibold text-slate-200">建立新的一季</span>
            ，現有的資料不會被動到。還原後兩季並存，比對確認過再把不要的那一季刪掉就好。
          </p>
        </div>
      )}
    </Panel>
  )
}
