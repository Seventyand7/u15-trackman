/**
 * 目前球季的所有資料。
 *
 * 選定一季之後把該季的隊伍／球員／比賽／投球／擊球全部訂閱進記憶體，
 * 排名與各種查詢都在前端算。搭配 Firestore 的離線快取，
 * 第二次之後開啟幾乎是瞬間顯示，網路斷了也還能繼續 key。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { COLLECTIONS, subscribeBySeason, subscribeSeasons } from '../firebase/repo'
import type { EventPool } from '../lib/ranking'
import type { BattedBall, Game, Id, Pitch, Player, Season, Team } from '../types/models'

const SEASON_STORAGE_KEY = 'u15.currentSeasonId'

interface SeasonContextValue {
  /** 球季清單載入中 */
  loadingSeasons: boolean
  /** 目前球季的資料載入中 */
  loadingData: boolean
  error: string | null

  seasons: Season[]
  seasonId: Id | null
  season: Season | null
  selectSeason: (id: Id) => void

  teams: Team[]
  players: Player[]
  games: Game[]
  pitches: Pitch[]
  battedBalls: BattedBall[]

  /** 給 ranking.ts 用的事件池 */
  pool: EventPool

  teamById: (id: Id | null | undefined) => Team | null
  playerById: (id: Id | null | undefined) => Player | null
  gameById: (id: Id | null | undefined) => Game | null
}

const SeasonContext = createContext<SeasonContextValue | null>(null)

function readStoredSeasonId(): Id | null {
  try {
    return localStorage.getItem(SEASON_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeSeasonId(id: Id | null): void {
  try {
    if (id) localStorage.setItem(SEASON_STORAGE_KEY, id)
    else localStorage.removeItem(SEASON_STORAGE_KEY)
  } catch {
    // 無痕視窗之類的情境，記不住就算了，不影響功能
  }
}

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loadingSeasons, setLoadingSeasons] = useState(true)
  const [seasonId, setSeasonId] = useState<Id | null>(readStoredSeasonId)
  const [error, setError] = useState<string | null>(null)

  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [pitches, setPitches] = useState<Pitch[]>([])
  const [battedBalls, setBattedBalls] = useState<BattedBall[]>([])
  const [loadedParts, setLoadedParts] = useState(0)

  const fail = useCallback((e: Error) => {
    // 權限錯誤最可能的原因是 Security Rules 沒部署，直接講清楚
    const message = e.message.includes('permission')
      ? '沒有讀取權限。請確認 firestore.rules 已經部署到 Firebase（見 README 第 6 步）。'
      : `讀取資料失敗：${e.message}`
    setError(message)
  }, [])

  // 球季清單
  useEffect(() => {
    return subscribeSeasons((rows) => {
      rows.sort((a, b) => b.createdAt - a.createdAt)
      setSeasons(rows)
      setLoadingSeasons(false)
      setError(null)
    }, fail)
  }, [fail])

  // 記住的球季如果已經被刪掉，就退回最新的一季
  useEffect(() => {
    if (loadingSeasons) return
    if (seasonId && seasons.some((s) => s.id === seasonId)) return
    const fallback = seasons[0]?.id ?? null
    setSeasonId(fallback)
    storeSeasonId(fallback)
  }, [loadingSeasons, seasons, seasonId])

  // 目前球季的全部資料
  useEffect(() => {
    if (!seasonId) {
      setTeams([])
      setPlayers([])
      setGames([])
      setPitches([])
      setBattedBalls([])
      setLoadedParts(0)
      return
    }

    setLoadedParts(0)
    let settled = 0
    const markLoaded = () => {
      settled += 1
      setLoadedParts(settled)
    }

    const subs = [
      subscribeBySeason<Team>(COLLECTIONS.teams, seasonId, (rows) => {
        rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
        setTeams(rows)
        markLoaded()
      }, fail),
      subscribeBySeason<Player>(COLLECTIONS.players, seasonId, (rows) => {
        setPlayers(rows)
        markLoaded()
      }, fail),
      subscribeBySeason<Game>(COLLECTIONS.games, seasonId, (rows) => {
        setGames(rows)
        markLoaded()
      }, fail),
      subscribeBySeason<Pitch>(COLLECTIONS.pitches, seasonId, (rows) => {
        setPitches(rows)
        markLoaded()
      }, fail),
      subscribeBySeason<BattedBall>(COLLECTIONS.battedBalls, seasonId, (rows) => {
        setBattedBalls(rows)
        markLoaded()
      }, fail),
    ]

    return () => subs.forEach((unsub) => unsub())
  }, [seasonId, fail])

  const selectSeason = useCallback((id: Id) => {
    setSeasonId(id)
    storeSeasonId(id)
  }, [])

  const pool = useMemo<EventPool>(
    () => ({ pitches, battedBalls, games }),
    [pitches, battedBalls, games],
  )

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const gameMap = useMemo(() => new Map(games.map((g) => [g.id, g])), [games])

  const value = useMemo<SeasonContextValue>(
    () => ({
      loadingSeasons,
      loadingData: seasonId !== null && loadedParts < 5,
      error,
      seasons,
      seasonId,
      season: seasons.find((s) => s.id === seasonId) ?? null,
      selectSeason,
      teams,
      players,
      games,
      pitches,
      battedBalls,
      pool,
      teamById: (id) => (id ? (teamMap.get(id) ?? null) : null),
      playerById: (id) => (id ? (playerMap.get(id) ?? null) : null),
      gameById: (id) => (id ? (gameMap.get(id) ?? null) : null),
    }),
    [
      loadingSeasons,
      loadedParts,
      error,
      seasons,
      seasonId,
      selectSeason,
      teams,
      players,
      games,
      pitches,
      battedBalls,
      pool,
      teamMap,
      playerMap,
      gameMap,
    ],
  )

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>
}

export function useSeason(): SeasonContextValue {
  const ctx = useContext(SeasonContext)
  if (!ctx) throw new Error('useSeason 必須在 <SeasonProvider> 內使用')
  return ctx
}
