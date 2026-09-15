/**
 * 測試用的假資料建構器。只有 *.test.ts 會 import 這個檔案。
 *
 * createdAt 預設為 0，需要測「createdAt 早者優先」的案例再自己指定，
 * 這樣測試不依賴任何隱含的全域計數器，讀起來也比較清楚。
 */

import type { BattedBall, Game, Id, Pitch, Player } from '../types/models'

export const SEASON = 'season-2026'
export const TEAM_A = 'team-lightning' // 閃電女孩
export const TEAM_B = 'team-nona' // 諾娜

/** g1 與 g2 同一天（order 1、2），g3 是下一週。 */
export const GAMES: Game[] = [
  {
    id: 'g1',
    seasonId: SEASON,
    date: '2026-09-13',
    order: 1,
    teamAId: TEAM_A,
    teamBId: TEAM_B,
    youtubeUrl: null,
  },
  {
    id: 'g2',
    seasonId: SEASON,
    date: '2026-09-13',
    order: 2,
    teamAId: TEAM_A,
    teamBId: TEAM_B,
    youtubeUrl: null,
  },
  {
    id: 'g3',
    seasonId: SEASON,
    date: '2026-09-20',
    order: 1,
    teamAId: TEAM_A,
    teamBId: TEAM_B,
    youtubeUrl: null,
  },
]

type PitchOverrides = Partial<Omit<Pitch, 'id'>>
type BattedOverrides = Partial<Omit<BattedBall, 'id'>>

export function pitch(id: Id, overrides: PitchOverrides = {}): Pitch {
  return {
    id,
    seasonId: SEASON,
    gameId: 'g1',
    teamId: TEAM_A,
    playerId: 'p1',
    speed: null,
    spin: null,
    axis: null,
    hBreak: null,
    vBreak: null,
    videoTime: null,
    createdAt: 0,
    ...overrides,
  }
}

export function batted(id: Id, overrides: BattedOverrides = {}): BattedBall {
  return {
    id,
    seasonId: SEASON,
    gameId: 'g1',
    teamId: TEAM_A,
    playerId: 'p1',
    exitVelo: null,
    launchAngle: null,
    distance: null,
    videoTime: null,
    createdAt: 0,
    ...overrides,
  }
}

export function player(id: Id, overrides: Partial<Omit<Player, 'id'>> = {}): Player {
  return {
    id,
    seasonId: SEASON,
    teamId: TEAM_A,
    number: '1',
    name: `選手${id}`,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

/** 斷言時只看 id，比對整個物件難讀。 */
export function ids(entries: readonly { event: { id: Id } }[]): Id[] {
  return entries.map((e) => e.event.id)
}
