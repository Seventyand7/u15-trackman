import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSeason } from '../state/SeasonProvider'
import {
  countSeasonContents,
  createGame,
  createSeason,
  createTeam,
  deleteGame,
  deleteSeasonCascade,
  deleteTeam,
  renameSeason,
  renameTeam,
  type SeasonContents,
} from '../firebase/repo'
import {
  compareGamesNewestFirst,
  formatGameDate,
  formatOrder,
  nextGameOrder,
  todayISO,
} from '../lib/format'
import { Empty, ErrorBanner, Panel, Spinner } from '../components/ui'

export default function SetupPage() {
  const season = useSeason()
  const [actionError, setActionError] = useState<string | null>(null)

  async function run(fn: () => Promise<unknown>) {
    setActionError(null)
    try {
      await fn()
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  if (season.loadingSeasons) return <Spinner label="載入球季…" />

  return (
    <div className="space-y-6">
      <ErrorBanner message={season.error ?? actionError} />

      <SeasonSection onRun={run} />

      {season.seasonId ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <TeamSection onRun={run} />
          <GameSection onRun={run} />
        </div>
      ) : (
        <Empty>先建立一個球季，才能新增隊伍與比賽。</Empty>
      )}
    </div>
  )
}

type Run = (fn: () => Promise<unknown>) => Promise<void>

// ---------------------------------------------------------------------------

function SeasonSection({ onRun }: { onRun: Run }) {
  const { seasons, seasonId, season, selectSeason } = useSeason()
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameText, setRenameText] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await onRun(async () => {
      const id = await createSeason(trimmed)
      selectSeason(id)
      setName('')
    })
  }

  async function saveRename() {
    const trimmed = renameText.trim()
    if (!trimmed || !seasonId) return
    await onRun(async () => {
      await renameSeason(seasonId, trimmed)
      setRenaming(false)
    })
  }

  return (
    <Panel title="球季">
      <div className="flex flex-wrap items-end gap-6">
        <div className="min-w-[220px]">
          <label className="label" htmlFor="season-select">
            目前球季
          </label>
          {seasons.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">還沒有球季</p>
          ) : renaming ? (
            <input
              autoFocus
              className="field"
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveRename()
                if (e.key === 'Escape') setRenaming(false)
              }}
            />
          ) : (
            <select
              id="season-select"
              className="field"
              value={seasonId ?? ''}
              onChange={(e) => selectSeason(e.target.value)}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {season && (
          <div className="flex gap-2">
            {renaming ? (
              <>
                <button type="button" className="btn-primary" onClick={() => void saveRename()}>
                  儲存
                </button>
                <button type="button" className="btn-ghost" onClick={() => setRenaming(false)}>
                  取消
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setRenameText(season.name)
                    setRenaming(true)
                    setDeleting(false)
                  }}
                >
                  改名
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    setDeleting(true)
                    setRenaming(false)
                  }}
                >
                  刪除
                </button>
              </>
            )}
          </div>
        )}

        <form onSubmit={submit} className="flex items-end gap-2">
          <div className="min-w-[180px]">
            <label className="label" htmlFor="season-new">
              新增球季
            </label>
            <input
              id="season-new"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="球季名稱"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            建立
          </button>
        </form>
      </div>

      {deleting && season && (
        <DeleteSeasonPanel season={season} onRun={onRun} onClose={() => setDeleting(false)} />
      )}
    </Panel>
  )
}

/**
 * 刪除整季：連同隊伍、球員、比賽、所有紀錄一起清掉，沒得復原。
 * 所以有資料時要求打出球季名稱才放行——只按一個確認太容易手滑。
 */
function DeleteSeasonPanel({
  season,
  onRun,
  onClose,
}: {
  season: { id: string; name: string }
  onRun: Run
  onClose: () => void
}) {
  const [contents, setContents] = useState<SeasonContents | null>(null)
  const [countError, setCountError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [progress, setProgress] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let alive = true
    setContents(null)
    setCountError(null)
    countSeasonContents(season.id)
      .then((c) => {
        if (alive) setContents(c)
      })
      .catch((e: Error) => {
        // 清點失敗（離線或權限問題）不能卡在「清點中」，
        // 但也不能假設這一季是空的——當成有資料處理，一律要求打出名稱。
        if (alive) setCountError(e.message)
      })
    return () => {
      alive = false
    }
  }, [season.id])

  const isEmpty = contents !== null && contents.total === 0
  const nameConfirmed = typed.trim() === season.name
  /**
   * 空的球季按一下就能刪；有資料的要打出名稱。
   * 清點失敗時也要求打名稱——不知道裡面有什麼，就不能當它是空的。
   */
  const needsNameConfirm = countError !== null || (contents !== null && !isEmpty)
  const canDelete = needsNameConfirm ? nameConfirmed : isEmpty

  async function run() {
    if (!canDelete || running) return
    setRunning(true)
    await onRun(async () => {
      await deleteSeasonCascade(season.id, (p) => setProgress(`${p.done}/${p.total}`))
      onClose()
    })
    setRunning(false)
    setProgress(null)
  }

  return (
    <div className="mt-4 animate-pop-in rounded-lg border border-red-500/40 bg-red-500/5 p-4">
      <h3 className="text-sm font-bold text-red-300">刪除球季「{season.name}」</h3>

      {countError !== null ? (
        <p className="mt-2 text-sm text-red-300">
          清點不到這一季有多少資料（{countError}）。可能是離線或權限問題。
          還是可以刪除，但看不到會刪掉什麼，請先確認網路正常再決定。
        </p>
      ) : contents === null ? (
        <p className="mt-2 text-sm text-slate-400">正在清點這一季的資料…</p>
      ) : isEmpty ? (
        <p className="mt-2 text-sm text-slate-300">這一季是空的，可以直接刪除。</p>
      ) : (
        <p className="mt-2 text-sm text-slate-300">
          會一併刪除 <Count n={contents.teams} /> 支隊伍、
          <Count n={contents.players} /> 位球員、
          <Count n={contents.games} /> 場比賽、
          <Count n={contents.pitches + contents.battedBalls} /> 筆紀錄。
          <span className="font-semibold">這個動作沒有辦法復原。</span>
        </p>
      )}

      {needsNameConfirm && (
        <>
          <p className="mt-2 text-xs text-amber-300">
            💡 刪除前建議先到「資料管理」匯出一份 JSON 備份，之後還能匯回來。
          </p>
          <div className="mt-3">
            <label className="label" htmlFor="confirm-season-name">
              確認請輸入球季名稱：{season.name}
            </label>
            <input
              id="confirm-season-name"
              className="field max-w-xs"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={season.name}
              autoComplete="off"
            />
          </div>
        </>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn-danger"
          onClick={() => void run()}
          disabled={!canDelete || running}
        >
          {running ? `刪除中 ${progress ?? ''}` : '確定刪除'}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose} disabled={running}>
          取消
        </button>
      </div>
    </div>
  )
}

function Count({ n }: { n: number }) {
  return <span className="font-semibold text-red-300">{n}</span>
}

// ---------------------------------------------------------------------------

function TeamSection({ onRun }: { onRun: Run }) {
  const { seasonId, teams, players, games } = useSeason()
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !seasonId) return
    if (teams.some((t) => t.name === trimmed)) {
      alert(`已經有一支隊伍叫「${trimmed}」了`)
      return
    }
    await onRun(async () => {
      await createTeam(seasonId, trimmed)
      setName('')
    })
  }

  async function saveEdit(id: string) {
    const trimmed = editName.trim()
    if (!trimmed) return
    await onRun(async () => {
      await renameTeam(id, trimmed)
      setEditingId(null)
    })
  }

  /** 已經有球員或比賽的隊伍不給刪，免得留下孤兒資料。 */
  function usage(teamId: string) {
    return {
      players: players.filter((p) => p.teamId === teamId).length,
      games: games.filter((g) => g.teamAId === teamId || g.teamBId === teamId).length,
    }
  }

  async function remove(id: string, teamName: string) {
    const u = usage(id)
    if (u.players > 0 || u.games > 0) {
      alert(
        `「${teamName}」還有 ${u.players} 位球員、${u.games} 場比賽，不能刪除。\n` +
          '請先處理掉那些資料再刪隊伍。',
      )
      return
    }
    if (!confirm(`確定要刪除隊伍「${teamName}」？`)) return
    await onRun(() => deleteTeam(id))
  }

  return (
    <Panel title="隊伍" right={<span className="text-xs text-slate-500">{teams.length} 支</span>}>
      <form onSubmit={add} className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <label className="label" htmlFor="team-new">
            新增隊伍
          </label>
          <input
            id="team-new"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="隊伍名稱"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          新增
        </button>
      </form>

      {teams.length === 0 ? (
        <Empty>還沒有隊伍</Empty>
      ) : (
        <ul className="divide-y divide-white/5">
          {teams.map((t) => {
            const u = usage(t.id)
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                {editingId === t.id ? (
                  <input
                    autoFocus
                    className="field !py-1.5"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveEdit(t.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-slate-500">
                      {u.players} 位球員 · {u.games} 場
                    </span>
                    <div className="ml-auto flex gap-1">
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1 text-xs"
                        onClick={() => {
                          setEditingId(t.id)
                          setEditName(t.name)
                        }}
                      >
                        改名
                      </button>
                      <button
                        type="button"
                        className="btn-danger !px-2 !py-1 text-xs"
                        onClick={() => void remove(t.id, t.name)}
                      >
                        刪除
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------------

function GameSection({ onRun }: { onRun: Run }) {
  const { seasonId, teams, games, pitches, battedBalls } = useSeason()
  const [date, setDate] = useState(todayISO())
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')

  // 場次序號自動帶入當日的下一號，換日期就跟著變
  const order = useMemo(() => nextGameOrder(games, date), [games, date])
  const sorted = useMemo(() => [...games].sort(compareGamesNewestFirst), [games])

  const canSubmit = Boolean(seasonId && date && teamAId && teamBId && teamAId !== teamBId)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || !seasonId) return
    await onRun(async () => {
      await createGame({
        seasonId,
        date,
        order,
        teamAId,
        teamBId,
        youtubeUrl: youtubeUrl.trim() || null,
      })
      setYoutubeUrl('')
    })
  }

  function eventCount(gameId: string) {
    return (
      pitches.filter((p) => p.gameId === gameId).length +
      battedBalls.filter((b) => b.gameId === gameId).length
    )
  }

  async function remove(gameId: string, label: string) {
    const count = eventCount(gameId)
    if (count > 0) {
      alert(`這場已經有 ${count} 筆紀錄，不能刪除。\n請先到記錄頁把紀錄刪掉。`)
      return
    }
    if (!confirm(`確定要刪除「${label}」？`)) return
    await onRun(() => deleteGame(gameId))
  }

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '?'

  return (
    <Panel title="比賽" right={<span className="text-xs text-slate-500">{games.length} 場</span>}>
      {teams.length < 2 ? (
        <Empty>至少要有兩支隊伍才能建立比賽</Empty>
      ) : (
        <form onSubmit={add} className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="game-date">
              日期
            </label>
            <input
              id="game-date"
              type="date"
              className="field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="game-order">
              場次
            </label>
            <input
              id="game-order"
              className="field bg-night-950/60 text-slate-400"
              value={formatOrder(order)}
              readOnly
              title="自動帶入當日的下一個場次序號"
            />
          </div>

          <div>
            <label className="label" htmlFor="game-team-a">
              隊伍 A
            </label>
            <select
              id="game-team-a"
              className="field"
              value={teamAId}
              onChange={(e) => setTeamAId(e.target.value)}
            >
              <option value="">選擇…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="game-team-b">
              隊伍 B
            </label>
            <select
              id="game-team-b"
              className="field"
              value={teamBId}
              onChange={(e) => setTeamBId(e.target.value)}
            >
              <option value="">選擇…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} disabled={t.id === teamAId}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2 sm:col-span-3">
            <label className="label" htmlFor="game-yt">
              YouTube 網址（選填）
            </label>
            <input
              id="game-yt"
              className="field"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtu.be/…"
            />
          </div>

          <div className="col-span-2 flex items-end sm:col-span-1">
            <button type="submit" className="btn-primary w-full" disabled={!canSubmit}>
              新增比賽
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <Empty>還沒有比賽</Empty>
      ) : (
        <ul className="divide-y divide-white/5">
          {sorted.map((g) => {
            const label = `${formatOrder(g.order)}. ${teamName(g.teamAId)} vs ${teamName(g.teamBId)}`
            const count = eventCount(g.id)
            return (
              <li key={g.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-36 shrink-0 font-mono text-xs text-slate-400">
                  {formatGameDate(g.date)}
                </span>
                <span className="font-medium">{label}</span>
                <span className="text-xs text-slate-500">{count} 筆紀錄</span>
                {g.youtubeUrl && (
                  <a
                    href={g.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-amber1 hover:underline"
                  >
                    YT
                  </a>
                )}
                <button
                  type="button"
                  className="btn-danger ml-auto !px-2 !py-1 text-xs"
                  onClick={() => void remove(g.id, label)}
                >
                  刪除
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
