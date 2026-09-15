import { useMemo, useRef, useState } from 'react'
import { useSeason } from '../state/SeasonProvider'
import { useCardConfig } from '../state/CardConfigProvider'
import { teamTopEntries, type RankCategory, type RankEntry } from '../lib/ranking'
import {
  buildRankingCsv,
  csvToBlob,
  rankingCsvFilename,
  type CsvInput,
} from '../lib/csv'
import {
  downloadBlob,
  nodeToPngBlob,
  rankingCardFilename,
  rankingZipFilename,
  zipBlobs,
} from '../lib/exportImage'
import { RankingCard } from '../components/card/RankingCard'
import { FieldPicker } from '../components/card/FieldPicker'
import { Empty, ErrorBanner, Spinner } from '../components/ui'
import type { Id } from '../types/models'

export default function RankingPage() {
  const { loadingSeasons, loadingData, error, seasons, seasonId, season, selectSeason, teams, players, games, pool } =
    useSeason()
  const { config } = useCardConfig()

  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  /** 打包時的進度，例如 2/4——一張圖卡要壓一秒多，沒有進度會以為當掉了 */
  const [progress, setProgress] = useState<string | null>(null)

  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  /** 每隊四個項目的前三名。CSV 與圖卡共用同一份計算結果。 */
  const topByTeam = useMemo(() => {
    const map = new Map<Id, Record<RankCategory, RankEntry[]>>()
    for (const t of teams) map.set(t.id, teamTopEntries(pool, t.id))
    return map
  }, [teams, pool])

  const lookups = useMemo(() => ({ teams, players }), [teams, players])
  const seasonName = season?.name ?? ''

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
      setProgress(null)
    }
  }

  function nodeFor(teamId: string): HTMLElement {
    const node = cardRefs.current.get(teamId)
    if (!node) throw new Error('圖卡還沒準備好，請稍後再試')
    return node
  }

  async function downloadOne(teamId: string, teamName: string) {
    await run(`download-${teamId}`, async () => {
      const blob = await nodeToPngBlob(nodeFor(teamId))
      const name = rankingCardFilename(seasonName, teamName)
      downloadBlob(blob, name)
      setFlash(`已下載 ${name}`)
    })
  }

  async function downloadAll() {
    await run('zip', async () => {
      const files: { name: string; blob: Blob }[] = []
      for (const [i, t] of teams.entries()) {
        setProgress(`${i + 1}/${teams.length}`)
        files.push({
          name: rankingCardFilename(seasonName, t.name),
          blob: await nodeToPngBlob(nodeFor(t.id)),
        })
      }
      await zipBlobs(files, rankingZipFilename(seasonName))
      setFlash(`已下載 ${rankingZipFilename(seasonName)}（${files.length} 張）`)
    })
  }

  async function exportCsv() {
    await run('csv', async () => {
      const input: CsvInput = { teams, players, games, topByTeam }
      const name = rankingCsvFilename(seasonName)
      downloadBlob(csvToBlob(buildRankingCsv(input)), name)
      setFlash(`已下載 ${name}`)
    })
  }

  if (loadingSeasons) return <Spinner label="載入球季…" />
  if (!seasonId) return <Empty>還沒有球季。請先到「設定」建立球季。</Empty>
  if (loadingData) return <Spinner label="載入本季資料…" />

  return (
    <div className="space-y-4">
      <ErrorBanner message={error ?? actionError} />

      <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
        <label className="label !mb-0" htmlFor="ranking-season">
          球季
        </label>
        <select
          id="ranking-season"
          className="field max-w-[220px]"
          value={seasonId}
          onChange={(e) => selectSeason(e.target.value)}
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <span className="text-sm text-slate-500">
          {teams.length} 隊 · {games.length} 場
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void downloadAll()}
            disabled={teams.length === 0 || busy !== null}
          >
            {busy === 'zip' ? `打包中 ${progress ?? ''}` : '全部下載（ZIP）'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void exportCsv()}
            disabled={teams.length === 0 || busy !== null}
          >
            {busy === 'csv' ? '產生中…' : '匯出 CSV'}
          </button>
        </div>
      </div>

      {flash && (
        <p className="animate-pop-in rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {flash}
        </p>
      )}

      <FieldPicker />

      {teams.length === 0 ? (
        <Empty>這一季還沒有隊伍。請先到「設定」新增隊伍。</Empty>
      ) : (
        <div className="flex flex-wrap gap-6">
          {teams.map((t) => (
            <div key={t.id} className="space-y-3">
              <div className="w-[490px] overflow-hidden rounded-lg bg-white shadow-xl shadow-black/40">
                <RankingCard
                  ref={(el) => {
                    if (el) cardRefs.current.set(t.id, el)
                    else cardRefs.current.delete(t.id)
                  }}
                  seasonName={seasonName}
                  team={t}
                  top={topByTeam.get(t.id)!}
                  config={config}
                  lookups={lookups}
                />
              </div>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => void downloadOne(t.id, t.name)}
                disabled={busy !== null}
              >
                {busy === `download-${t.id}` ? '產生中…' : '下載 PNG'}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">
        CSV 一律帶全部數據欄位，不受上面的圖卡勾選影響。
      </p>
    </div>
  )
}
