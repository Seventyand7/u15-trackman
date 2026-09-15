import { describe, expect, it } from 'vitest'
import {
  EMPTY_BATTED_INPUT,
  EMPTY_PITCH_INPUT,
  battedHasData,
  buildBattedBall,
  buildPitch,
  findDuplicateBattedBall,
  findDuplicatePitch,
  pitchHasData,
  toNumber,
  toText,
  warnBatted,
  warnPitch,
  type BattedInput,
  type PitchInput,
} from './validation'
import { SEASON, TEAM_A, batted, pitch } from './testFixtures'

const refs = {
  seasonId: SEASON,
  gameId: 'g1',
  teamId: TEAM_A,
  playerId: 'p1',
  createdAt: 1000,
}

function p(over: Partial<PitchInput> = {}): PitchInput {
  return { ...EMPTY_PITCH_INPUT, ...over }
}
function b(over: Partial<BattedInput> = {}): BattedInput {
  return { ...EMPTY_BATTED_INPUT, ...over }
}
function fields(warnings: { field: string }[]): string[] {
  return warnings.map((w) => w.field)
}

describe('toNumber / toText', () => {
  it('空字串是 null', () => {
    expect(toNumber('')).toBeNull()
    expect(toNumber('   ')).toBeNull()
    expect(toText('  ')).toBeNull()
  })

  it('0 不是 null', () => {
    expect(toNumber('0')).toBe(0)
  })

  it('負數可以', () => {
    expect(toNumber('-12.5')).toBe(-12.5)
  })

  it('不是數字回傳 NaN', () => {
    expect(Number.isNaN(toNumber('abc'))).toBe(true)
  })
})

describe('warnPitch — 只警告不擋', () => {
  it('正常數值沒有警告', () => {
    expect(warnPitch(p({ speed: '135.2', spin: '2100', axis: '1:30' }))).toEqual([])
  })

  it('球速超出 40–160 會警告', () => {
    expect(fields(warnPitch(p({ speed: '200' })))).toEqual(['speed'])
    expect(fields(warnPitch(p({ speed: '20' })))).toEqual(['speed'])
  })

  it('球速剛好在邊界不警告', () => {
    expect(warnPitch(p({ speed: '40' }))).toEqual([])
    expect(warnPitch(p({ speed: '160' }))).toEqual([])
  })

  it('轉速超出 0–4000 會警告', () => {
    expect(fields(warnPitch(p({ spin: '5000' })))).toEqual(['spin'])
    expect(warnPitch(p({ spin: '0' }))).toEqual([])
    expect(warnPitch(p({ spin: '4000' }))).toEqual([])
  })

  it('不是數字會警告，並說明那欄會留白', () => {
    const w = warnPitch(p({ speed: 'abc' }))
    expect(w[0]?.field).toBe('speed')
    expect(w[0]?.message).toContain('留白')
  })

  it('轉軸格式錯誤會警告', () => {
    expect(fields(warnPitch(p({ axis: '13:00' })))).toEqual(['axis'])
    expect(fields(warnPitch(p({ axis: '1:70' })))).toEqual(['axis'])
    expect(fields(warnPitch(p({ axis: '130' })))).toEqual(['axis'])
    expect(fields(warnPitch(p({ axis: '0:30' })))).toEqual(['axis'])
  })

  it('合法的轉軸不警告', () => {
    for (const axis of ['1:30', '12:00', '6:45', '9:59']) {
      expect(warnPitch(p({ axis }))).toEqual([])
    }
  })

  it('位移是純文字，寫什麼都不警告', () => {
    expect(warnPitch(p({ hBreak: '往右 30 cm', vBreak: '-12' }))).toEqual([])
  })

  it('空欄位不警告', () => {
    expect(warnPitch(EMPTY_PITCH_INPUT)).toEqual([])
  })

  it('可以同時有多個警告', () => {
    expect(fields(warnPitch(p({ speed: '999', spin: '9999', axis: 'x' })))).toEqual([
      'speed',
      'spin',
      'axis',
    ])
  })
})

describe('warnBatted', () => {
  it('正常數值沒有警告', () => {
    expect(warnBatted(b({ exitVelo: '118.3', launchAngle: '24.6', distance: '49.95' }))).toEqual([])
  })

  it('仰角可以是負的，−90 到 90 都不警告', () => {
    expect(warnBatted(b({ launchAngle: '-35.5' }))).toEqual([])
    expect(warnBatted(b({ launchAngle: '-90' }))).toEqual([])
    expect(warnBatted(b({ launchAngle: '90' }))).toEqual([])
  })

  it('仰角超出範圍會警告', () => {
    expect(fields(warnBatted(b({ launchAngle: '-91' })))).toEqual(['launchAngle'])
    expect(fields(warnBatted(b({ launchAngle: '120' })))).toEqual(['launchAngle'])
  })

  it('距離超出 0–150 會警告', () => {
    expect(fields(warnBatted(b({ distance: '200' })))).toEqual(['distance'])
    expect(fields(warnBatted(b({ distance: '-1' })))).toEqual(['distance'])
  })
})

describe('至少要有一個數據欄', () => {
  it('完全空白不算有資料', () => {
    expect(pitchHasData(EMPTY_PITCH_INPUT)).toBe(false)
    expect(battedHasData(EMPTY_BATTED_INPUT)).toBe(false)
  })

  it('只填時間碼不算有資料', () => {
    expect(pitchHasData(p({ videoTime: '1:23:45' }))).toBe(false)
    expect(battedHasData(b({ videoTime: '1:23:45' }))).toBe(false)
  })

  it('任何一個數據欄有值就可以送出', () => {
    expect(pitchHasData(p({ speed: '130' }))).toBe(true)
    expect(pitchHasData(p({ axis: '1:30' }))).toBe(true)
    expect(pitchHasData(p({ vBreak: '往下' }))).toBe(true)
    expect(battedHasData(b({ launchAngle: '10' }))).toBe(true)
  })
})

describe('buildPitch', () => {
  it('把字串轉成正確型別', () => {
    const built = buildPitch(
      p({ speed: '135.2', spin: '2100', axis: '1:30', hBreak: '右 20', videoTime: '1:23:45' }),
      refs,
    )
    expect(built).toMatchObject({
      speed: 135.2,
      spin: 2100,
      axis: '1:30',
      hBreak: '右 20',
      vBreak: null,
      videoTime: '1:23:45',
      gameId: 'g1',
      playerId: 'p1',
    })
  })

  it('沒填的欄位是 null，不是 undefined（Firestore 不接受 undefined）', () => {
    const built = buildPitch(EMPTY_PITCH_INPUT, refs)
    expect(built.speed).toBeNull()
    expect(built.axis).toBeNull()
    expect(Object.values(built).every((v) => v !== undefined)).toBe(true)
  })

  it('打錯字的數值存成 null，不會把 NaN 寫進資料庫', () => {
    const built = buildPitch(p({ speed: '一三五' }), refs)
    expect(built.speed).toBeNull()
  })

  it('0 會如實存下來', () => {
    expect(buildPitch(p({ spin: '0' }), refs).spin).toBe(0)
  })
})

describe('buildBattedBall', () => {
  it('負的仰角存得下來', () => {
    expect(buildBattedBall(b({ launchAngle: '-12.5' }), refs).launchAngle).toBe(-12.5)
  })

  it('沒填的欄位是 null', () => {
    const built = buildBattedBall(EMPTY_BATTED_INPUT, refs)
    expect(built.exitVelo).toBeNull()
    expect(built.distance).toBeNull()
  })
})

describe('重複偵測', () => {
  const existing = [
    pitch('old', { gameId: 'g1', playerId: 'p1', speed: 130, spin: 2000, axis: '1:30' }),
  ]

  it('同場同球員數值完全相同會被抓到', () => {
    const candidate = buildPitch(p({ speed: '130', spin: '2000', axis: '1:30' }), refs)
    expect(findDuplicatePitch(existing, candidate)?.id).toBe('old')
  })

  it('任何一個數值不同就不算重複', () => {
    const candidate = buildPitch(p({ speed: '130.1', spin: '2000', axis: '1:30' }), refs)
    expect(findDuplicatePitch(existing, candidate)).toBeNull()
  })

  it('不同球員不算重複', () => {
    const candidate = buildPitch(p({ speed: '130', spin: '2000', axis: '1:30' }), {
      ...refs,
      playerId: 'p2',
    })
    expect(findDuplicatePitch(existing, candidate)).toBeNull()
  })

  it('不同場次不算重複', () => {
    const candidate = buildPitch(p({ speed: '130', spin: '2000', axis: '1:30' }), {
      ...refs,
      gameId: 'g2',
    })
    expect(findDuplicatePitch(existing, candidate)).toBeNull()
  })

  it('時間碼不同仍然算重複（時間碼常常沒填）', () => {
    const candidate = buildPitch(
      p({ speed: '130', spin: '2000', axis: '1:30', videoTime: '0:10:00' }),
      refs,
    )
    expect(findDuplicatePitch(existing, candidate)?.id).toBe('old')
  })

  it('擊球也有同樣的偵測', () => {
    const balls = [batted('old', { gameId: 'g1', playerId: 'p1', exitVelo: 120, distance: 80 })]
    const same = buildBattedBall(b({ exitVelo: '120', distance: '80' }), refs)
    const different = buildBattedBall(b({ exitVelo: '120', distance: '81' }), refs)
    expect(findDuplicateBattedBall(balls, same)?.id).toBe('old')
    expect(findDuplicateBattedBall(balls, different)).toBeNull()
  })
})
