import { useEffect, useMemo, useState } from 'react'
import { useSeason } from '../state/SeasonProvider'
import {
  compareGamesNewestFirst,
  formatGameDate,
  formatGameTitle,
} from '../lib/format'
import { Empty, ErrorBanner, Kbd, Spinner } from '../components/ui'
import { EventForm } from './record/EventForm'
import { EventTable } from './record/EventTable'
import { SidePanel } from './record/SidePanel'
import type { EventKind } from '../lib/ranking'

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

      {/* 選比賽 */}
      <div className="panel flex flex-wrap items-center gap-4 px-4 py-3">
        <select
          className="field max-w-md"
          value={game?.id ?? ''}
          onChange={(e) => selectGame(e.target.value)}
          aria-label="選擇比賽"
        >
          {sortedGames.map((g) => (
            <option key={g.id} value={g.id}>
              {formatGameDate(g.date)} {formatGameTitle(g, teams)}
            </option>
          ))}
        </select>

        {game && (
          <h1 className="text-lg font-bold tracking-wide">
            <span className="text-slate-400">{formatGameDate(game.date)}</span>{' '}
            <span className="text-amber1">{formatGameTitle(game, teams)}</span>
          </h1>
        )}

        {game?.youtubeUrl && (
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
              />
              <EventForm
                kind="battedBall"
                game={game}
                teamA={teamA}
                teamB={teamB}
                active={activePanel === 'battedBall'}
                onActivate={() => setActivePanel('battedBall')}
                shortcutLabel="Alt+2"
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
