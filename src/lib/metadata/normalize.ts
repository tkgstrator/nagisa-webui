/**
 * AniList の native/romaji/english title と provider タイトルを matching するための
 * 正規化関数。NFKC で互換文字 (ローマ数字 Ⅱ→II、半角カナ、康熙部首、全角英数) を畳んでから、
 * 大文字小文字・空白・句読点/記号 (波ダッシュ U+301C を含む) を取り除いて比較キーにする。
 *
 * 注意: この関数を変えると `anilist_media.{native,romaji,english}_norm` の保存値と食い違う。
 * 変更時は `scripts/sync/recompute-anilist-norm.ts` で再計算すること (anilist_sync の upsert でも
 * 同期された行は自動で再計算される)。
 */
export function normalizeTitle(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{Z}\s]/gu, '')
}
