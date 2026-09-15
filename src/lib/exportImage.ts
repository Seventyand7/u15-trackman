/**
 * 把圖卡節點變成 PNG，以及下載／複製／打包。
 */

import { toSvg } from 'html-to-image'
import JSZip from 'jszip'
import { ensureFontsReady, loadFontEmbedCSS } from './fontEmbed'
import { compactDate, formatOrder } from './format'
import { seasonSlug } from './csv'
import type { Game, Team } from '../types/models'

/** 規格要求 2 以上。490px 寬 × 2 = 980px，貼 FB 綽綽有餘。 */
export const PIXEL_RATIO = 2

/**
 * 載入圖片。
 *
 * 這裡刻意不用 html-to-image 的 toPng／toCanvas：
 * 它內部是在 requestAnimationFrame 裡才 resolve，而分頁切到背景時 rAF 會被停掉——
 * 按下「全部下載」之後跑去看 FB，匯出就會卡在那裡直到切回來。
 * 自己做這一步只需要 decode()，跟分頁在不在前景無關。
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      img
        .decode()
        .then(() => resolve(img))
        // Safari 對 SVG 的 decode() 偶爾會拒絕，但圖其實已經可以畫了
        .catch(() => resolve(img))
    }
    img.onerror = () => reject(new Error('圖卡轉檔失敗：SVG 無法載入'))
    img.src = url
  })
}

export async function nodeToPngBlob(node: HTMLElement): Promise<Blob> {
  await ensureFontsReady()
  const fontEmbedCSS = await loadFontEmbedCSS()

  const svgUrl = await toSvg(node, {
    // 圖卡本來就是白底，明講一次，避免透明背景在某些地方變成黑的
    backgroundColor: '#FFFFFF',
    fontEmbedCSS,
  })

  const img = await loadImage(svgUrl)

  const width = node.offsetWidth
  const height = node.offsetHeight
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * PIXEL_RATIO)
  canvas.height = Math.round(height * PIXEL_RATIO)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('圖卡轉檔失敗：取不到 canvas context')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('圖卡轉檔失敗：產生不出 PNG'))),
      'image/png',
    )
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 立刻 revoke 在某些瀏覽器會讓下載失敗，延後一點
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('這個瀏覽器不支援複製圖片到剪貼簿，請改用下載')
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export async function zipBlobs(
  files: readonly { name: string; blob: Blob }[],
  zipName: string,
): Promise<void> {
  const zip = new JSZip()
  for (const f of files) zip.file(f.name, f.blob)
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, zipName)
}

// ---------------------------------------------------------------------------
// 檔名

/** 檔名裡不能有這些字元（Windows 尤其嚴格） */
function safe(part: string): string {
  return part.replace(/[\\/:*?"<>|]/g, '').trim()
}

/** '20260913_01_閃電女孩vs諾娜.png' */
export function singleCardFilename(game: Game, teams: readonly Team[]): string {
  const a = teams.find((t) => t.id === game.teamAId)?.name ?? '未知'
  const b = teams.find((t) => t.id === game.teamBId)?.name ?? '未知'
  return `${compactDate(game.date)}_${formatOrder(game.order)}_${safe(a)}vs${safe(b)}.png`
}

/** '20260913_01-02.png'（合併圖，取所選場次的最小與最大序號） */
export function mergedCardFilename(date: string, orders: readonly number[]): string {
  if (orders.length === 0) return `${compactDate(date)}.png`
  const sorted = [...orders].sort((a, b) => a - b)
  const first = formatOrder(sorted[0]!)
  const last = formatOrder(sorted[sorted.length - 1]!)
  return first === last
    ? `${compactDate(date)}_${first}.png`
    : `${compactDate(date)}_${first}-${last}.png`
}

/** '20260913_單場數據.zip' */
export function zipFilename(date: string): string {
  return `${compactDate(date)}_單場數據.zip`
}

/** '2026秋季_閃電女孩_季排名.png' */
export function rankingCardFilename(seasonName: string, teamName: string): string {
  return `${seasonSlug(seasonName)}_${safe(teamName)}_季排名.png`
}

/** '2026秋季_季排名.zip' */
export function rankingZipFilename(seasonName: string): string {
  return `${seasonSlug(seasonName)}_季排名.zip`
}
