import { v5 as uuidv5 } from 'uuid'

/** プロジェクト共通の UUIDv5 namespace */
const NAMESPACE = uuidv5('animetracker', uuidv5.DNS)

/**
 * R2 に永続化する幅のラダー。
 *
 * フロント (`ProxyImage` の LADDER) が実際に要求する幅と同じ値にすること。片方だけずれると、
 * その幅は「変換はするが保存しない」状態になり、毎リクエストでオリジン取得と変換が走る。
 * `src/routes/img.ts` のホワイトリストと `src/lib/image-warm.ts` の事前 warm がここを見る。
 */
export const PERSISTED_WIDTHS = [200, 400, 800] as const

/**
 * 画像の元URLから R2 キーの基底となる UUID を生成する。
 * 同じ URL からは常に同じ UUID が生成される。
 */
export function imageBaseKey(imageUrl: string): string {
  return uuidv5(imageUrl, NAMESPACE)
}

/**
 * 画像の元URLから R2 のオブジェクトキーを生成する。
 * 同じ URL からは常に同じキーが生成される。拡張子は webp 固定。
 */
export function imageKey(imageUrl: string): string {
  return `${imageBaseKey(imageUrl)}.webp`
}

/**
 * WebP 変換結果の R2 キー。
 * 幅指定なしは原寸で、バッチ (scripts/fetch/common/upload_images.sh) が投入するキーと同じになる。
 */
export function webpKey(imageUrl: string, width?: number): string {
  return width === undefined ? imageKey(imageUrl) : `${imageBaseKey(imageUrl)}/w${width}.webp`
}

/**
 * 変換前の元バイナリの R2 キー。
 * 配信終了で元URLが 404 になった後も、ここから別の幅を再生成できる。
 */
export function originalKey(imageUrl: string): string {
  return `${imageBaseKey(imageUrl)}/original`
}
