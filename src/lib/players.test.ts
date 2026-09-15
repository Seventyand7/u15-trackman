import { describe, expect, it } from 'vitest'
import {
  applyEditPlayer,
  applyMergePlan,
  countPlayerEvents,
  findNumberConflict,
  findPlayerByNumber,
  findSameNamePlayers,
  normalizeName,
  normalizeNumber,
  planAddPlayer,
  planDeletePlayer,
  planEditPlayer,
  planMergePlayers,
} from './players'
import { SEASON, TEAM_A, TEAM_B, batted, pitch, player } from './testFixtures'

const scope = { seasonId: SEASON, teamId: TEAM_A }

// ---------------------------------------------------------------------------

describe('normalizeName', () => {
  it('去掉半形空白', () => {
    expect(normalizeName('王 小明')).toBe('王小明')
  })

  it('去掉全形空白', () => {
    expect(normalizeName('王　小明')).toBe('王小明')
  })

  it('去掉前後空白', () => {
    expect(normalizeName('  王小明  ')).toBe('王小明')
  })
})

describe('normalizeNumber', () => {
  it('只去前後空白', () => {
    expect(normalizeNumber('  15 ')).toBe('15')
  })

  it('保留前置零——"00" 和 "0" 是不同背號', () => {
    expect(normalizeNumber('00')).toBe('00')
    expect(normalizeNumber('00')).not.toBe(normalizeNumber('0'))
  })
})

// ---------------------------------------------------------------------------

describe('findPlayerByNumber', () => {
  const players = [
    player('a', { number: '5', name: '王小明' }),
    player('b', { number: '00', name: '李大同' }),
    player('c', { number: '5', name: '別隊的人', teamId: TEAM_B }),
  ]

  it('依背號找到同隊球員', () => {
    expect(findPlayerByNumber(players, scope, '5')?.id).toBe('a')
  })

  it('容忍輸入的前後空白', () => {
    expect(findPlayerByNumber(players, scope, ' 5 ')?.id).toBe('a')
  })

  it('"00" 找得到，而且不會誤中 "0"', () => {
    expect(findPlayerByNumber(players, scope, '00')?.id).toBe('b')
    expect(findPlayerByNumber(players, scope, '0')).toBeNull()
  })

  it('不會跨隊找到別隊的同背號', () => {
    expect(findPlayerByNumber(players, { seasonId: SEASON, teamId: TEAM_B }, '5')?.id).toBe('c')
  })

  it('不會跨季找', () => {
    expect(findPlayerByNumber(players, { seasonId: 'other-season', teamId: TEAM_A }, '5')).toBeNull()
  })

  it('找不到時回傳 null', () => {
    expect(findPlayerByNumber(players, scope, '99')).toBeNull()
  })
})

describe('findNumberConflict', () => {
  const players = [
    player('a', { number: '5', name: '王小明' }),
    player('b', { number: '15', name: '李大同' }),
  ]

  it('背號被別人佔用時回傳那個人', () => {
    expect(findNumberConflict(players, scope, '15')?.name).toBe('李大同')
  })

  it('編輯自己時不算衝突', () => {
    expect(findNumberConflict(players, scope, '5', 'a')).toBeNull()
  })

  it('編輯成別人的背號還是算衝突', () => {
    expect(findNumberConflict(players, scope, '15', 'a')?.id).toBe('b')
  })

  it('沒人用的背號不衝突', () => {
    expect(findNumberConflict(players, scope, '7')).toBeNull()
  })
})

describe('findSameNamePlayers', () => {
  const players = [
    player('a', { number: '5', name: '王小明' }),
    player('b', { number: '15', name: '王 小明' }),
    player('c', { number: '7', name: '李大同' }),
    player('d', { number: '5', name: '王小明', teamId: TEAM_B }),
  ]

  it('完全相同的姓名算同名', () => {
    expect(findSameNamePlayers(players, scope, '王小明').map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('去除空白後相同也算同名', () => {
    expect(findSameNamePlayers(players, scope, '王　小明').map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('可以排除自己', () => {
    expect(findSameNamePlayers(players, scope, '王小明', 'a').map((p) => p.id)).toEqual(['b'])
  })

  it('不會跨隊比對', () => {
    expect(findSameNamePlayers(players, scope, '王小明').some((p) => p.id === 'd')).toBe(false)
  })

  it('空字串不算同名，不然每個空白名字都會互相配對', () => {
    expect(findSameNamePlayers(players, scope, '   ')).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('countPlayerEvents', () => {
  const pitches = [
    pitch('p1', { playerId: 'x' }),
    pitch('p2', { playerId: 'x' }),
    pitch('p3', { playerId: 'y' }),
  ]
  const battedBalls = [batted('b1', { playerId: 'x' })]

  it('分別數投球與擊球', () => {
    expect(countPlayerEvents('x', pitches, battedBalls)).toEqual({
      pitches: 2,
      battedBalls: 1,
      total: 3,
    })
  })

  it('沒有紀錄的球員是 0', () => {
    expect(countPlayerEvents('z', pitches, battedBalls)).toEqual({
      pitches: 0,
      battedBalls: 0,
      total: 0,
    })
  })
})

// ---------------------------------------------------------------------------

describe('planAddPlayer — 新增球員時的同名偵測', () => {
  const players = [
    player('a', { number: '5', name: '王小明' }),
    player('b', { number: '7', name: '李大同' }),
  ]

  it('背號沒人用、也沒同名，就直接新增', () => {
    expect(planAddPlayer(players, scope, { number: '9', name: '陳小華' })).toEqual({
      kind: 'create',
    })
  })

  it('同隊已有同名時，回報候選人讓使用者選是不是同一人', () => {
    const plan = planAddPlayer(players, scope, { number: '15', name: '王小明' })
    expect(plan.kind).toBe('same-name')
    if (plan.kind === 'same-name') {
      expect(plan.candidates.map((p) => p.number)).toEqual(['5'])
    }
  })

  it('去除空白後同名也要偵測到（換背號最常見的打字差異）', () => {
    const plan = planAddPlayer(players, scope, { number: '15', name: '王 小明' })
    expect(plan.kind).toBe('same-name')
  })

  it('背號已被佔用時優先擋下，並指出是誰', () => {
    const plan = planAddPlayer(players, scope, { number: '7', name: '新來的' })
    expect(plan.kind).toBe('number-taken')
    if (plan.kind === 'number-taken') {
      expect(plan.occupiedBy.name).toBe('李大同')
    }
  })

  it('別隊有同名球員不會擋（不同隊本來就可能同名）', () => {
    const withOtherTeam = [...players, player('x', { number: '3', name: '陳小華', teamId: TEAM_B })]
    expect(planAddPlayer(withOtherTeam, scope, { number: '9', name: '陳小華' })).toEqual({
      kind: 'create',
    })
  })
})

// ---------------------------------------------------------------------------

describe('planEditPlayer — 就地編輯', () => {
  const target = player('a', { number: '5', name: '王小明' })
  const players = [target, player('b', { number: '15', name: '李大同' })]
  const pitches = [pitch('p1', { playerId: 'a' }), pitch('p2', { playerId: 'a' })]
  const battedBalls = [batted('b1', { playerId: 'a' })]

  it('可以改成沒人用的背號，並回報會同步更新幾筆紀錄', () => {
    const plan = planEditPlayer({
      player: target,
      nextNumber: '23',
      nextName: '王小明',
      players,
      pitches,
      battedBalls,
    })
    expect(plan).toEqual({ kind: 'ok', affected: { pitches: 2, battedBalls: 1, total: 3 } })
  })

  it('背號沒改（還是自己的）不算衝突', () => {
    const plan = planEditPlayer({
      player: target,
      nextNumber: '5',
      nextName: '王小明改名',
      players,
      pitches,
      battedBalls,
    })
    expect(plan.kind).toBe('ok')
  })

  it('改成別人佔用的背號會被擋下並指出是誰', () => {
    const plan = planEditPlayer({
      player: target,
      nextNumber: '15',
      nextName: '王小明',
      players,
      pitches,
      battedBalls,
    })
    expect(plan.kind).toBe('number-taken')
    if (plan.kind === 'number-taken') expect(plan.occupiedBy.name).toBe('李大同')
  })

  it('姓名不能清空', () => {
    const plan = planEditPlayer({
      player: target,
      nextNumber: '5',
      nextName: '   ',
      players,
      pitches,
      battedBalls,
    })
    expect(plan).toEqual({ kind: 'empty-name' })
  })
})

describe('applyEditPlayer', () => {
  const players = [player('a', { number: '5', name: '王小明', updatedAt: 0 })]

  it('更新背號、姓名與 updatedAt，並順手去掉前後空白', () => {
    const next = applyEditPlayer(players, 'a', { number: ' 15 ', name: ' 王小明 ' }, 999)
    expect(next[0]).toMatchObject({ number: '15', name: '王小明', updatedAt: 999 })
  })

  it('不改動輸入陣列', () => {
    applyEditPlayer(players, 'a', { number: '15', name: '改了' }, 999)
    expect(players[0]?.number).toBe('5')
  })

  it('不動到其他球員', () => {
    const many = [...players, player('b', { number: '7', name: '李大同' })]
    const next = applyEditPlayer(many, 'a', { number: '15', name: '王小明' }, 999)
    expect(next[1]).toEqual(many[1])
  })
})

// ---------------------------------------------------------------------------

describe('planDeletePlayer', () => {
  const pitches = [pitch('p1', { playerId: 'busy' })]

  it('有事件關聯的球員禁止刪除，並回報筆數（提示改用合併）', () => {
    const plan = planDeletePlayer('busy', pitches, [])
    expect(plan.kind).toBe('blocked')
    if (plan.kind === 'blocked') expect(plan.affected.total).toBe(1)
  })

  it('沒有任何紀錄的球員可以直接刪', () => {
    expect(planDeletePlayer('idle', pitches, [])).toEqual({ kind: 'ok' })
  })
})

// ---------------------------------------------------------------------------

describe('planMergePlayers', () => {
  const keep = player('keep', { number: '5', name: '王小明' })
  const remove = player('remove', { number: '15', name: '王 小明' })
  const players = [keep, remove, player('other', { number: '7', name: '李大同' })]
  const pitches = [
    pitch('p1', { playerId: 'remove' }),
    pitch('p2', { playerId: 'remove' }),
    pitch('p3', { playerId: 'keep' }),
  ]
  const battedBalls = [batted('b1', { playerId: 'remove' })]

  function plan(numberFrom: 'keep' | 'remove', nameFrom: 'keep' | 'remove') {
    return planMergePlayers({
      selection: { keepId: 'keep', removeId: 'remove', numberFrom, nameFrom },
      players,
      pitches,
      battedBalls,
    })
  }

  it('只算要搬家的事件（保留者自己的事件不用動）', () => {
    expect(plan('keep', 'keep').affected).toEqual({ pitches: 2, battedBalls: 1, total: 3 })
    expect(plan('keep', 'keep').pitchIds).toEqual(['p1', 'p2'])
    expect(plan('keep', 'keep').battedBallIds).toEqual(['b1'])
  })

  it('可以選用被刪那筆的背號（換背號的情境）', () => {
    expect(plan('remove', 'keep').result).toEqual({ number: '15', name: '王小明' })
  })

  it('可以選用被刪那筆的姓名', () => {
    expect(plan('keep', 'remove').result).toEqual({ number: '5', name: '王 小明' })
  })

  it('不能合併到自己身上', () => {
    expect(() =>
      planMergePlayers({
        selection: { keepId: 'keep', removeId: 'keep', numberFrom: 'keep', nameFrom: 'keep' },
        players,
        pitches,
        battedBalls,
      }),
    ).toThrow('不能把球員合併到自己身上')
  })

  it('找不到球員時明確報錯', () => {
    expect(() =>
      planMergePlayers({
        selection: { keepId: 'keep', removeId: 'ghost', numberFrom: 'keep', nameFrom: 'keep' },
        players,
        pitches,
        battedBalls,
      }),
    ).toThrow('找不到球員：ghost')
  })

  it('不同隊的球員不能合併', () => {
    const crossTeam = [keep, player('enemy', { number: '9', teamId: TEAM_B })]
    expect(() =>
      planMergePlayers({
        selection: { keepId: 'keep', removeId: 'enemy', numberFrom: 'keep', nameFrom: 'keep' },
        players: crossTeam,
        pitches: [],
        battedBalls: [],
      }),
    ).toThrow('不同隊伍')
  })

  it('不同球季的球員不能合併', () => {
    const crossSeason = [keep, player('lastYear', { number: '9', seasonId: 'season-2025' })]
    expect(() =>
      planMergePlayers({
        selection: { keepId: 'keep', removeId: 'lastYear', numberFrom: 'keep', nameFrom: 'keep' },
        players: crossSeason,
        pitches: [],
        battedBalls: [],
      }),
    ).toThrow('不同球季')
  })

  it('合併後的背號若被第三人佔用，擋下並指出是誰', () => {
    const dirty = [
      keep,
      remove,
      player('squatter', { number: '15', name: '佔號的人' }),
    ]
    expect(() =>
      planMergePlayers({
        selection: { keepId: 'keep', removeId: 'remove', numberFrom: 'remove', nameFrom: 'keep' },
        players: dirty,
        pitches: [],
        battedBalls: [],
      }),
    ).toThrow('背號 15 已經被 佔號的人 使用')
  })

  it('兩人都沒有事件時影響筆數是 0', () => {
    const p = planMergePlayers({
      selection: { keepId: 'keep', removeId: 'remove', numberFrom: 'keep', nameFrom: 'keep' },
      players,
      pitches: [],
      battedBalls: [],
    })
    expect(p.affected.total).toBe(0)
  })
})

describe('applyMergePlan', () => {
  const keep = player('keep', { number: '5', name: '王小明', updatedAt: 0 })
  const remove = player('remove', { number: '15', name: '王小明' })
  const other = player('other', { number: '7', name: '李大同' })
  const players = [keep, remove, other]
  const pitches = [pitch('p1', { playerId: 'remove' }), pitch('p2', { playerId: 'other' })]
  const battedBalls = [batted('b1', { playerId: 'remove' })]

  const plan = planMergePlayers({
    selection: { keepId: 'keep', removeId: 'remove', numberFrom: 'remove', nameFrom: 'keep' },
    players,
    pitches,
    battedBalls,
  })

  it('刪掉被合併的球員，保留者套用選定的背號與姓名', () => {
    const next = applyMergePlan(plan, { players, pitches, battedBalls }, 555)
    expect(next.players.map((p) => p.id)).toEqual(['keep', 'other'])
    expect(next.players[0]).toMatchObject({ number: '15', name: '王小明', updatedAt: 555 })
  })

  it('事件的 playerId 搬到保留者身上', () => {
    const next = applyMergePlan(plan, { players, pitches, battedBalls }, 555)
    expect(next.pitches.map((e) => e.playerId)).toEqual(['keep', 'other'])
    expect(next.battedBalls[0]?.playerId).toBe('keep')
  })

  it('不動到其他球員的事件', () => {
    const next = applyMergePlan(plan, { players, pitches, battedBalls }, 555)
    expect(next.pitches[1]).toEqual(pitches[1])
  })

  it('不改動輸入資料', () => {
    applyMergePlan(plan, { players, pitches, battedBalls }, 555)
    expect(players).toHaveLength(3)
    expect(pitches[0]?.playerId).toBe('remove')
    expect(keep.number).toBe('5')
  })

  it('合併後保留者的背號不會再跟任何人衝突', () => {
    const next = applyMergePlan(plan, { players, pitches, battedBalls }, 555)
    expect(findNumberConflict(next.players, scope, '15', 'keep')).toBeNull()
  })
})
