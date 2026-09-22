/**
 * webp-matrix.ts (計測) と webp-matrix-report.ts (集計) が共有する軸の定義。
 *
 * 計測スクリプト側に置くと、レポートが値を import しただけでスイープ本体が
 * 走ってしまう (トップレベル await のスクリプトなので) ため、別モジュールにする。
 */

/** 原寸 (undefined) と、保存方針の候補になる幅。176〜800 はフロントが実際に要求する幅 */
export const WIDTHS = [undefined, 1280, 960, 800, 640, 480, 400, 200, 176] as const
/** q80 が現行実装の値。前後に振って画質とサイズの交換比を見る */
export const QUALITIES = [50, 60, 70, 80, 90] as const

/** フロントが実際に要求する幅 (src/routes/img.ts の PERSISTED_WIDTHS) */
export const SERVED = [176, 200, 400, 480, 800] as const

export type MatrixRow = {
  url: string
  host: string
  original: number
  originalWidth: number
  originalHeight: number
  originalFormat: string
  /** `q80|full` / `q80|w400` -> バイト数 (変換失敗は null) */
  webp: Record<string, number | null>
  /** 実際に出力された幅。原寸より大きい幅を要求しても拡大されないことの確認用 */
  outWidth: Record<string, number | null>
}

export const slotKey = (q: number, w: number | undefined) => `q${q}|${w === undefined ? 'full' : `w${w}`}`
