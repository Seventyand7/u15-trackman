import { useEffect, useMemo, useRef, useState } from 'react'
import { useSeason } from '../state/SeasonProvider'
import { useCardConfig } from '../state/CardConfigProvider'
import { gameBests, type RankCategory, type RankEntry } from '../lib/ranking'
import { formatGameDate, formatGameTitle, gameDates, todayISO } from '../lib/format'
import {
  copyBlobToClipboard,
  downloadBlob,
  mergedCardFilename,
  nodeToPngBlob,
  singleCardFilename,
  zipBlobs,
  zipFilename,
} from '../lib/exportImage'
import { GameCard } from '../components/card/GameCard'
import { FieldPicker } from '../components/card/FieldPicker'
import { Empty, ErrorBanner, Panel, Spinner } from '../components/ui'
import type { Game } from '../types/models'

export default function CardsPage() {
  const { loadingSeasons, loadingData, error, seasonId, games, teams, players, pool } = useSeason()
  const { config } = useCardConfig()

  const dates = useMemo(() => gameDates(games), [games])
  const [date, setDate] = useState(() => dates[0] ?? todayISO())
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeIds, setMergeIds] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  // 第一次載到資料時跳到最近有比賽的日子
  const initialised = useRef(false)
  useEffect(() => {
    if (initialised.current || dates.length === 0) return
    initialised.current = true
    setDate(dates[0]!)
  }, [dates])

  const dayGames = useMemo(
    () => games.filter((g) => g.date === date).sort((a, b) => a.order - b.order),
    [games, date],
  )

  // 每場的四項最佳，圖卡與合併圖共用
  const bestsByGame = useMemo(() => {
    const map = new Map<string, Record<RankCategory, RankEntry | null>>()
    for (const g of dayGames) map.set(g.id, gameBests(pool, g.id))
    return map
  }, [dayGames, pool])

  const lookups = useMemo(() => ({ teams, players }), [teams, players])

  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const mergedRef = useRef<HTMLDivElement>(null)

  // 換日期時把合併勾選清掉，免得選到別天的場次
  useEffect(() => {
    setMergeIds([])
  }, [date])

  const index = dates.indexOf(date)
  const olderDate = index === -1 ? dates[0] : dates[index + 1]
  const newerDate = index <= 0 ? undefined : dates[index - 1]

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label)
    setActionError(null)
    setFlash(null)
    try {
      await fn()
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function nodeFor(gameId: string): HTMLElement {
    const node = cardRefs.current.get(gameId)
    if (!node) throw new Error('圖卡還沒準備好，請稍後再試')
    return node
  }

  async function downloadOne(game: Game) {
    await run(`download-${game.id}`, async () => {
      const blob = await nodeToPngBlob(nodeFor(game.id))
      downloadBlob(blob, singleCardFilename(game, teams))
      setFlash(`已下載 ${singleCardFilename(game, teams)}`)
    })
  }

  async function copyOne(game: Game) {
    await run(`copy-${game.id}`, async () => {
      const blob = await nodeToPngBlob(nodeFor(game.id))
      await copyBlobToClipboard(blob)
      setFlash('已複製到剪貼簿，可以直接貼到 FB 或訊息裡')
    })
  }

  async function downloadAll() {
    await run('zip', async () => {
      const files: { name: string; blob: Blob }[] = []
      for (const g of dayGames) {
        files.push({ name: singleCardFilename(g, teams), blob: await nodeToPngBlob(nodeFor(g.id)) })
      }
      await zipBlobs(files, zipFilename(date))
      setFlash(`已下載 ${zipFilename(date)}（${files.length} 張）`)
    })
  }

  async function downloadMerged() {
    await run('merged', async () => {
      const node = mergedRef.current
      if (!node) throw new Error('合併圖還沒準備好')
      const blob = await nodeToPngBlob(node)
      const orders = dayGames.filter((g) => mergeIds.includes(g.id)).map((g) => g.order)
      const name = mergedCardFilename(date, orders)
      downloadBlob(blob, name)
      setFlash(`已下載 ${name}`)
    })
  }

  if (loadingSeasons) return <Spinner label="載入球季…" />
  if (!seasonId) return <Empty>還沒有球季。請先到「設定」建立球季與比賽。</Empty>
  if (loadingData) return <Spinner label="載入本季資料…" />
  if (games.length === 0) return <Empty>這一季還沒有比賽。</Empty>

  const mergeGames = dayGames.filter((g) => mergeIds.includes(g.id))

  return (
    <div className="space-y-4">
      <ErrorBanner message={error ?? actionError} />

      {/* 選日期 */}
      <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-2"
            onClick={() => olderDate && setDate(olderDate)}
            disabled={!olderDate}
            title="前一個比賽日"
          >
            ◀
          </button>
          <input
            type="date"
            className="field w-[150px] font-mono"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="比賽日期"
          />
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-2"
            onClick={() => newerDate && setDate(newerDate)}
            disabled={!newerDate}
            title="後一個比賽日"
          >
            ▶
          </button>
        </div>

        <span className="font-mono text-sm text-slate-400">{formatGameDate(date)}</span>
        <span className="text-sm text-slate-500">{dayGames.length} 場</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void downloadAll()}
            disabled={dayGames.length === 0 || busy !== null}
          >
            {busy === 'zip' ? '打包中…' : '全部下載（ZIP）'}
          </button>
          <button
            type="button"
            className={mergeMode ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setMergeMode((v) => !v)}
            disabled={dayGames.length < 2}
            title={dayGames.length < 2 ? '這天只有一場，不需要合併' : undefined}
          >
            合併輸出
          </button>
        </div>
      </div>

      {flash && (
        <p className="animate-pop-in rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {flash}
        </p>
      )}

      <FieldPicker />

      {dayGames.length === 0 ? (
        <Empty>這天沒有比賽。用上面的 ◀ ▶ 跳到有比賽的日子。</Empty>
      ) : (
        <>
          {mergeMode && (
            <Panel
              title="合併輸出"
              right={
                <button
                  type="button"
                  className="btn-primary !py-1 text-xs"
                  onClick={() => void downloadMerged()}
                  disabled={mergeGames.length === 0 || busy !== null}
                >
                  {busy === 'merged' ? '產生中…' : `下載長圖（${mergeGames.length} 場）`}
                </button>
              }
            >
              <div className="flex flex-wrap gap-2">
                {dayGames.map((g) => {
                  const checked = mergeIds.includes(g.id)
                  return (
                    <label
                      key={g.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        checked
                          ? 'border-amber1/50 bg-amber1/10 text-amber1'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-amber1"
                        checked={checked}
                        onChange={() =>
                          setMergeIds((ids) =>
                            ids.includes(g.id) ? ids.filter((i) => i !== g.id) : [...ids, g.id],
                          )
                        }
                      />
                      {formatGameTitle(g, teams)}
                    </label>
                  )
                })}
              </div>
              <p className="mt-3 text-xs text-slate-500">日期只會在長圖最上方出現一次。</p>
            </Panel>
          )}

          {/* 單場圖卡 */}
          <div className="flex flex-wrap gap-6">
            {dayGames.map((g) => (
              <div key={g.id} className="space-y-3">
                <div className="w-[490px] overflow-hidden rounded-lg bg-white shadow-xl shadow-black/40">
                  <GameCard
                    ref={(el) => {
                      if (el) cardRefs.current.set(g.id, el)
                      else cardRefs.current.delete(g.id)
                    }}
                    date={g.date}
                    games={[{ game: g, bests: bestsByGame.get(g.id)! }]}
                    config={config}
                    lookups={lookups}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    onClick={() => void downloadOne(g)}
                    disabled={busy !== null}
                  >
                    {busy === `download-${g.id}` ? '產生中…' : '下載 PNG'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost flex-1"
                    onClick={() => void copyOne(g)}
                    disabled={busy !== null}
                  >
                    {busy === `copy-${g.id}` ? '產生中…' : '複製到剪貼簿'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 合併長圖：畫在畫面外，只是為了截圖 */}
          {mergeMode && mergeGames.length > 0 && (
            <div
              aria-hidden
              style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}
            >
              <GameCard
                ref={mergedRef}
                date={date}
                games={mergeGames.map((g) => ({ game: g, bests: bestsByGame.get(g.id)! }))}
                config={config}
                lookups={lookups}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
