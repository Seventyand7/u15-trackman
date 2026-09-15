/**
 * 投球／擊球輸入面板。兩種事件的欄位不同，但流程完全一樣，所以共用一個元件。
 *
 * 鍵盤流程（追求打字速度）：
 *   Tab            移到下一欄
 *   Enter          送出
 *   Esc            清空整筆
 *   送出後         清空數值欄，保留隊伍與背號，游標回到第一個數值欄
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSeason } from '../../state/SeasonProvider'
import { createBattedBall, createPitch, createPlayer, updatePlayer } from '../../firebase/repo'
import { planAddPlayer } from '../../lib/players'
import { evaluateDraft, type DraftImpact } from '../../lib/ranking'
import {
  EMPTY_BATTED_INPUT,
  EMPTY_PITCH_INPUT,
  battedHasData,
  buildBattedBall,
  buildPitch,
  findDuplicateBattedBall,
  findDuplicatePitch,
  formatVideoTimeInput,
  pitchHasData,
  warnBatted,
  warnPitch,
  type BattedInput,
  type FieldWarning,
  type PitchInput,
} from '../../lib/validation'
import type { EventKind } from '../../lib/ranking'
import type { Game, Id, Player, Team } from '../../types/models'
import { Kbd } from '../../components/ui'
import { PlayerPicker, SameNameDecision, resolvePlayer } from './PlayerPicker'

interface FieldSpec {
  key: string
  label: string
  /** 標籤旁的小灰字：單位或格式。不放在 placeholder，免得看起來像已經填過了。 */
  hint?: string
  width: string
}

/**
 * 所有數值欄共用的 placeholder。
 * 刻意用一個破折號而不是範例數字——範例數字（135.2 之類的）
 * 掃過去會誤以為那欄已經填了。破折號跟缺值的顯示方式一致，一看就知道是空的。
 */
const EMPTY_HINT = '—'

const PITCH_FIELDS: FieldSpec[] = [
  { key: 'speed', label: '球速', hint: 'km/h', width: 'w-28' },
  { key: 'spin', label: '轉速', hint: '轉', width: 'w-28' },
  { key: 'axis', label: '轉軸', hint: 'H:MM', width: 'w-24' },
  { key: 'hBreak', label: '水平位移', width: 'w-28' },
  { key: 'vBreak', label: '垂直位移', width: 'w-28' },
  { key: 'videoTime', label: '時間碼', hint: '只打數字', width: 'w-28' },
]

const BATTED_FIELDS: FieldSpec[] = [
  { key: 'exitVelo', label: '擊球初速', hint: 'km/h', width: 'w-28' },
  { key: 'launchAngle', label: '仰角', hint: '°', width: 'w-24' },
  { key: 'distance', label: '擊球距離', hint: 'm', width: 'w-28' },
  { key: 'videoTime', label: '時間碼', hint: '只打數字', width: 'w-28' },
]

type Values = Record<string, string>

function emptyValues(kind: EventKind): Values {
  return kind === 'pitch' ? { ...EMPTY_PITCH_INPUT } : { ...EMPTY_BATTED_INPUT }
}

function asPitchInput(v: Values): PitchInput {
  return {
    speed: v.speed ?? '',
    spin: v.spin ?? '',
    axis: v.axis ?? '',
    hBreak: v.hBreak ?? '',
    vBreak: v.vBreak ?? '',
    videoTime: v.videoTime ?? '',
  }
}

function asBattedInput(v: Values): BattedInput {
  return {
    exitVelo: v.exitVelo ?? '',
    launchAngle: v.launchAngle ?? '',
    distance: v.distance ?? '',
    videoTime: v.videoTime ?? '',
  }
}

/** 草稿用的假 playerId：全新球員還沒有 id，但他也還沒有任何紀錄，所以怎麼算都對。 */
const DRAFT_PLAYER_ID = '__draft_player__'

interface Pending {
  candidates: Player[]
  number: string
  name: string
}

export interface EventFormProps {
  kind: EventKind
  game: Game
  teamA: Team
  teamB: Team
  active: boolean
  onActivate: () => void
  shortcutLabel: string
}

export function EventForm({
  kind,
  game,
  teamA,
  teamB,
  active,
  onActivate,
  shortcutLabel,
}: EventFormProps) {
  const { seasonId, players, pool, pitches, battedBalls } = useSeason()
  const fields = kind === 'pitch' ? PITCH_FIELDS : BATTED_FIELDS

  const [teamId, setTeamId] = useState<Id | null>(null)
  const [number, setNumber] = useState('')
  const [newName, setNewName] = useState('')
  const [values, setValues] = useState<Values>(() => emptyValues(kind))
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const formRef = useRef<HTMLFormElement>(null)
  const numberRef = useRef<HTMLInputElement>(null)
  const firstValueRef = useRef<HTMLInputElement>(null)

  const resolved = resolvePlayer(players, seasonId ?? '', teamId, number)

  // 換隊時背號對應的人就變了，清掉新球員姓名避免帶錯
  useEffect(() => {
    setNewName('')
    setPending(null)
  }, [teamId])

  useEffect(() => {
    setPending(null)
  }, [number])

  const warnings: FieldWarning[] = useMemo(
    () => (kind === 'pitch' ? warnPitch(asPitchInput(values)) : warnBatted(asBattedInput(values))),
    [kind, values],
  )

  const hasData = kind === 'pitch' ? pitchHasData(asPitchInput(values)) : battedHasData(asBattedInput(values))

  // 送出前的即時提示：把這筆加進事件池重算排名
  const impacts: DraftImpact[] = useMemo(() => {
    if (!seasonId || !teamId || !hasData) return []
    const refs = {
      seasonId,
      gameId: game.id,
      teamId,
      playerId: resolved?.id ?? DRAFT_PLAYER_ID,
      createdAt: Date.now(),
    }
    return kind === 'pitch'
      ? evaluateDraft(pool, { kind: 'pitch', event: { id: '', ...buildPitch(asPitchInput(values), refs) } })
      : evaluateDraft(pool, {
          kind: 'battedBall',
          event: { id: '', ...buildBattedBall(asBattedInput(values), refs) },
        })
  }, [seasonId, teamId, hasData, game.id, resolved?.id, kind, values, pool])

  // 重複偵測：同場同球員數值完全相同
  const duplicate = useMemo(() => {
    if (!seasonId || !teamId || !resolved || !hasData) return null
    const refs = {
      seasonId,
      gameId: game.id,
      teamId,
      playerId: resolved.id,
      createdAt: 0,
    }
    return kind === 'pitch'
      ? findDuplicatePitch(pitches, buildPitch(asPitchInput(values), refs))
      : findDuplicateBattedBall(battedBalls, buildBattedBall(asBattedInput(values), refs))
  }, [seasonId, teamId, resolved, hasData, game.id, kind, values, pitches, battedBalls])

  const clearValues = useCallback(() => {
    setValues(emptyValues(kind))
    setError(null)
  }, [kind])

  const clearAll = useCallback(() => {
    clearValues()
    setNumber('')
    setNewName('')
    setPending(null)
    setFlash(null)
    numberRef.current?.focus()
  }, [clearValues])

  /** 真正寫入事件。playerId 到這一步一定已經確定了。 */
  const writeEvent = useCallback(
    async (playerId: Id) => {
      if (!seasonId || !teamId) return
      const refs = { seasonId, gameId: game.id, teamId, playerId, createdAt: Date.now() }
      setSaving(true)
      try {
        if (kind === 'pitch') {
          await createPitch(buildPitch(asPitchInput(values), refs))
        } else {
          await createBattedBall(buildBattedBall(asBattedInput(values), refs))
        }
        const won = impacts.filter((i) => i.isGameBest || i.seasonRank !== null)
        setFlash(
          won.length > 0
            ? `已記錄 ⭐ ${won.map((i) => i.label).join('、')}`
            : '已記錄',
        )
        clearValues()
        setPending(null)
        // 保留隊伍與背號，游標回到第一個數值欄（同一位投手連續記錄）
        firstValueRef.current?.focus()
      } catch (e) {
        setError(`寫入失敗：${(e as Error).message}`)
      } finally {
        setSaving(false)
      }
    },
    [seasonId, teamId, game.id, kind, values, impacts, clearValues],
  )

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setError(null)

    if (!seasonId) return
    if (!teamId) {
      setError('請先選隊伍')
      return
    }
    if (number.trim() === '') {
      setError('請輸入背號')
      numberRef.current?.focus()
      return
    }
    if (!hasData) {
      setError('至少要有一個數據欄才能送出')
      firstValueRef.current?.focus()
      return
    }

    if (resolved) {
      await writeEvent(resolved.id)
      return
    }

    // 背號不存在 → 要新增球員
    const name = newName.trim()
    if (name === '') {
      setError('這個背號還沒有球員，請輸入姓名')
      return
    }

    const plan = planAddPlayer(players, { seasonId, teamId }, { number, name })
    if (plan.kind === 'same-name') {
      setPending({ candidates: plan.candidates, number: number.trim(), name })
      return
    }
    if (plan.kind === 'number-taken') {
      await writeEvent(plan.occupiedBy.id)
      return
    }

    try {
      const id = await createPlayer({ seasonId, teamId, number, name })
      setNewName('')
      await writeEvent(id)
    } catch (err) {
      setError(`新增球員失敗：${(err as Error).message}`)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      clearAll()
    }
  }

  const teams: Team[] = [teamA, teamB]

  return (
    <form
      ref={formRef}
      onSubmit={(e) => void submit(e)}
      onKeyDown={onKeyDown}
      onFocus={onActivate}
      className={`panel transition-colors ${
        active ? 'border-amber1/40 shadow-amber1/5' : 'border-white/10'
      }`}
    >
      <header className="panel-head">
        <span className={active ? 'text-amber1' : ''}>
          {kind === 'pitch' ? '投球' : '擊球'}
        </span>
        <span className="ml-auto text-xs font-normal text-slate-500">
          <Kbd>{shortcutLabel}</Kbd>
        </span>
      </header>

      <div className="space-y-4 p-4">
        {/* 隊伍 */}
        <div>
          <span className="label">隊伍</span>
          <div className="flex gap-2">
            {teams.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTeamId(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault()
                    setTeamId(teams[1 - i]!.id)
                  }
                }}
                className={`flex-1 rounded-lg border px-4 py-3 text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber1/70 ${
                  teamId === t.id
                    ? 'border-amber1 bg-amber1/15 text-amber1'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* 背號 → 姓名 */}
        <PlayerPicker
          ref={numberRef}
          seasonId={`${kind}-${seasonId ?? ''}`}
          teamId={teamId}
          number={number}
          onNumberChange={setNumber}
          newName={newName}
          onNewNameChange={setNewName}
          resolved={resolved}
          onAdvance={() => firstValueRef.current?.focus()}
        />

        {/* 數值欄 */}
        <div className="flex flex-wrap gap-3">
          {fields.map((f, i) => {
            const warning = warnings.find((w) => w.field === f.key)
            return (
              <div key={f.key}>
                <label className="label" htmlFor={`${kind}-${f.key}`}>
                  {f.label}
                  {f.hint && <span className="ml-1 normal-case text-slate-600">{f.hint}</span>}
                </label>
                <input
                  ref={i === 0 ? firstValueRef : undefined}
                  id={`${kind}-${f.key}`}
                  className={`field ${f.width} font-mono placeholder:text-slate-700 ${
                    warning ? 'border-amber-500/60 bg-amber-500/5' : ''
                  }`}
                  value={values[f.key] ?? ''}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      // 時間碼只打數字，冒號自己長出來
                      [f.key]:
                        f.key === 'videoTime'
                          ? formatVideoTimeInput(e.target.value)
                          : e.target.value,
                    }))
                  }
                  placeholder={EMPTY_HINT}
                  autoComplete="off"
                />
              </div>
            )
          })}
        </div>

        {/* 即時提示 */}
        {impacts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {impacts.map((i) => (
              <ImpactBadge key={i.category} impact={i} teamName={teams.find((t) => t.id === teamId)?.name ?? ''} />
            ))}
          </div>
        )}

        {/* 警告（不擋送出） */}
        {warnings.length > 0 && (
          <ul className="space-y-1">
            {warnings.map((w) => (
              <li key={w.field} className="text-xs text-amber-300">
                ⚠️ {w.message}
              </li>
            ))}
          </ul>
        )}

        {duplicate && (
          <p className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-300">
            ⚠️ 可能重複：這場已經有一筆同球員、數值完全相同的紀錄了
          </p>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}

        {pending && (
          <SameNameDecision
            candidates={pending.candidates}
            number={pending.number}
            name={pending.name}
            onSamePerson={(p) => {
              void (async () => {
                try {
                  await updatePlayer(p.id, { number: pending.number })
                  setNewName('')
                  setPending(null)
                  await writeEvent(p.id)
                } catch (e) {
                  setError(`更新球員失敗：${(e as Error).message}`)
                }
              })()
            }}
            onDifferentPerson={() => {
              void (async () => {
                if (!seasonId || !teamId) return
                try {
                  const id = await createPlayer({
                    seasonId,
                    teamId,
                    number: pending.number,
                    name: pending.name,
                  })
                  setNewName('')
                  setPending(null)
                  await writeEvent(id)
                } catch (e) {
                  setError(`新增球員失敗：${(e as Error).message}`)
                }
              })()
            }}
            onCancel={() => setPending(null)}
          />
        )}

        <div className="flex items-center gap-3 border-t border-white/5 pt-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? '寫入中…' : '送出'}
          </button>
          <button type="button" className="btn-ghost" onClick={clearAll}>
            清空
          </button>
          <span className="text-xs text-slate-500">
            <Kbd>Enter</Kbd> 送出 <Kbd>Esc</Kbd> 清空 <Kbd>Tab</Kbd> 下一欄
          </span>
          {flash && (
            <span key={flash} className="ml-auto animate-pop-in text-xs font-medium text-emerald-300">
              {flash}
            </span>
          )}
        </div>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------

function ImpactBadge({ impact, teamName }: { impact: DraftImpact; teamName: string }) {
  const parts: string[] = []
  if (impact.isGameBest) parts.push(`⭐ 本場${impact.label}`)
  if (impact.seasonRank !== null) {
    // 這位球員本來就在前三 → 這筆是取代他自己那一筆，不是擠掉別人
    const prefix = impact.replacesOwnEntry ? '刷新個人最佳，' : ''
    parts.push(`${prefix}${teamName} 季第 ${impact.seasonRank} 名`)
  }
  return (
    <span className="animate-record-glow rounded-lg border border-amber1/40 bg-amber1/15 px-3 py-1.5 text-xs font-semibold text-amber1">
      {parts.join(' · ')}
    </span>
  )
}
