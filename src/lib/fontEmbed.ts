/**
 * 給 html-to-image 用的字型內嵌 CSS。
 *
 * 為什麼要自己做這件事：
 * html-to-image 是把節點包成 SVG 的 foreignObject 再讓瀏覽器畫成圖。
 * 那個 SVG 是獨立文件，拿不到頁面已經載入的 webfont，
 * 字型必須以 data URI 內嵌在 SVG 的 CSS 裡，否則中文會變成系統預設字型
 * （每台電腦不一樣，交出去的圖卡就不一致了）。
 *
 * html-to-image 內建的 embedFonts 會去掃頁面所有樣式表裡的 @font-face 並全部抓下來。
 * @fontsource/noto-sans-tc 拆成 954 個子集檔（各語系 × 各字重），全抓會非常久。
 * 所以這裡只挑我們真正用到的四個檔案（繁中與拉丁 × 400/700），自己組 CSS。
 *
 * 結果會快取起來：第一張圖卡要等一下，之後都是現成的。
 */

import tcRegular from '@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-400-normal.woff2?url'
import tcBold from '@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-700-normal.woff2?url'
import latinRegular from '@fontsource/noto-sans-tc/files/noto-sans-tc-latin-400-normal.woff2?url'
import latinBold from '@fontsource/noto-sans-tc/files/noto-sans-tc-latin-700-normal.woff2?url'

const FACES = [
  { url: latinRegular, weight: 400 },
  { url: latinBold, weight: 700 },
  { url: tcRegular, weight: 400 },
  { url: tcBold, weight: 700 },
] as const

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`字型載入失敗（${res.status}）：${url}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  // 分段轉換，避免一次 apply 幾十萬個 byte 造成堆疊溢位
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

let cached: Promise<string> | null = null

/** 組出可以直接餵給 html-to-image 的 @font-face CSS（已快取）。 */
export function loadFontEmbedCSS(): Promise<string> {
  if (!cached) {
    cached = Promise.all(
      FACES.map(async (face) => {
        const b64 = await toBase64(face.url)
        return [
          '@font-face{',
          `font-family:'Noto Sans TC';`,
          'font-style:normal;',
          `font-weight:${face.weight};`,
          'font-display:block;',
          `src:url(data:font/woff2;base64,${b64}) format('woff2');`,
          '}',
        ].join('')
      }),
    ).then((css) => css.join('\n'))

    // 失敗就把快取清掉，讓下一次可以重試
    cached.catch(() => {
      cached = null
    })
  }
  return cached
}

/**
 * 確認畫面上的字型也已經真的載入完成。
 * document.fonts.ready 只保證「目前需要的」字型下載完，
 * 所以另外明確要求這兩個字重，避免第一次截圖時字還沒到。
 */
export async function ensureFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all([
    document.fonts.load('400 16px "Noto Sans TC"', '中文abc123'),
    document.fonts.load('700 16px "Noto Sans TC"', '中文abc123'),
  ])
  await document.fonts.ready
}
