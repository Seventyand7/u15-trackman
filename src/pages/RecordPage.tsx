import { useEffect, useMemo, useState } from 'react'
import { useSeason } from '../state/SeasonProvider'
import { compareGamesNewestFirst, formatGameDate, formatMatchup } from '../lib/format'
import { Empty, ErrorBanner, Kbd, Spinner } from '../components/ui'
import { EventForm } from './record/EventForm'
import { EventTable } from './record/EventTable'
import { SidePanel } from './record/SidePanel'
import { GamePicker } from './record/GamePicker'
import { HowTo } from './record/HowTo'
import { MergePlayersPanel } from '../components/MergePlayersPanel'
import type { EventKind } from '../lib/ranking'
import type { Id, Player } from '../types/models'

const GAME_STORAGE_KEY = 'u15.currentGameId'

export default function RecordPage() {
  const { loadingSeasons, loadingData, error, seasonId, games, teams, teamById } = useSeason()

  const [gameId, setGameId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(GAME_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [activePanel, setActivePanel] = useState<EventKind>('pitch')
  /** 從球員編輯選單進來的合併 */
  const [merge, setMerge] = useState<{ teamId: Id; keepId: Id } | null>(null)
  const [mergeFlash, setMergeFlash] = useState<string | null>(null)

  const sortedGames = useMemo(() => [...games].sort(compareGamesNewestFirst), [games])
  const game = sortedGames.find((g) => g.id === gameId) ?? null

  // 記住的比賽如果不在這一季（換季或被刪掉），就退回最新一場
  useEffect(() => {
    if (loadingData) return
    if (game) return
    const fallback = sortedGames[0]?.id ?? null
    setGameId(fallback)
    try {
      if (fallback) localStorage.setItem(GAME_STORAGE_KEY, fallback)
      else localStorage.removeItem(GAME_STORAGE_KEY)
    } catch {
      // 記不住就算了
    }
  }, [loadingData, game, sortedGames])

  // Alt+1 / Alt+2 切換投球／擊球面板
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return
      if (e.key === '1') {
        e.preventDefault()
        setActivePanel('pitch')
        document.getElementById('pitch-speed')?.focus()
      }
      if (e.key === '2') {
        e.preventDefault()
        setActivePanel('battedBall')
        document.getElementById('battedBall-exitVelo')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function requestMerge(player: Player, teamId: Id) {
    setMerge({ teamId, keepId: player.id })
    setMergeFlash(null)
  }

  function selectGame(id: string) {
    setGameId(id)
    try {
      localStorage.setItem(GAME_STORAGE_KEY, id)
    } catch {
      // 記不住就算了
    }
  }

  if (loadingSeasons) return <Spinner label="載入球季…" />

  if (!seasonId) {
    return <Empty>還沒有球季。請先到「設定」建立一個球季、隊伍與比賽。</Empty>
  }

  if (loadingData) return <Spinner label="載入本季資料…" />

  if (sortedGames.length === 0) {
    return <Empty>這一季還沒有比賽。請先到「設定」新增比賽。</Empty>
  }

  const teamA = teamById(game?.teamAId)
  const teamB = teamById(game?.teamBId)

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      <HowTo />

      <GamePicker games={sortedGames} teams={teams} current={game} onSelect={selectGame} />

      {game && (
        <div className="flex flex-wrap items-center gap-4 px-1">
          <h1 className="text-lg font-bold tracking-wide">
            <span className="text-slate-400">{formatGameDate(game.date)}</span>{' '}
            <span className="text-amber1">{formatMatchup(game, teams)}</span>
          </h1>

          {game.youtubeUrl && (
            <a
              href={game.youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost !py-1.5 text-xs"
            >
              開啟 YouTube ↗
            </a>
          )}

          <span className="ml-auto text-xs text-slate-500">
            <Kbd>Alt</Kbd>+<Kbd>1</Kbd> 投球　<Kbd>Alt</Kbd>+<Kbd>2</Kbd> 擊球
          </span>
        </div>
      )}

      {mergeFlash && (
        <p className="animate-pop-in rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {mergeFlash}
        </p>
      )}

      {merge && (
        <MergePlayersPanel
          teamId={merge.teamId}
          initialKeepId={merge.keepId}
          onDone={(m) => {
            setMergeFlash(m)
            setMerge(null)
          }}
          onCancel={() => setMerge(null)}
        />
      )}

      {!game || !teamA || !teamB ? (
        <Empty>這場比賽的隊伍資料不完整，請到「設定」檢查。</Empty>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4 2xl:grid-cols-2">
              <EventForm
                kind="pitch"
                game={game}
                teamA={teamA}
                teamB={teamB}
                active={activePanel === 'pitch'}
                onActivate={() => setActivePanel('pitch')}
                shortcutLabel="Alt+1"
                onRequestMerge={requestMerge}
              />
              <EventForm
                kind="battedBall"
                game={game}
                teamA={teamA}
                teamB={teamB}
                active={activePanel === 'battedBall'}
                onActivate={() => setActivePanel('battedBall')}
                shortcutLabel="Alt+2"
                onRequestMerge={requestMerge}
              />
            </div>

            <SidePanel game={game} teamA={teamA} teamB={teamB} />
          </div>

          <EventTable game={game} />
        </>
      )}
    </div>
  )
}
