import { z } from 'zod'

/** 画像プロキシのパスパラメータ。元画像URLの base64url (padding なし) が入る */
export const ImageProxyParamsSchema = z.object({
  key: z.string().nonempty()
})
export type ImageProxyParamsSchema = z.infer<typeof ImageProxyParamsSchema>

/**
 * 画像プロキシのクエリ。
 *
 * `w` は省略可だが、与えるなら 1〜4096 の整数でなければならない。壊れた値
 * (`?w=abc`, `?w=-5`) を無視して原寸を返してはいけない。原寸は変換後でも
 * 130 KiB 前後あり、ラダーの 400px (18 KiB) の 7 倍を黙って配ることになる。
 *
 * `?w=` を組み立てるのは ProxyImage だけで、常にラダーの値 (200/400/800) を
 * 出す。したがって範囲外の値が来たら呼び出し側のバグであり、400 で落として
 * 気付けるようにするのが正しい。ラダー外でも範囲内の幅 (例: 500) は従来どおり
 * 変換して返す (保存だけしない。src/routes/img.ts のホワイトリスト参照)。
 */
export const ImageProxyQuerySchema = z.object({
  w: z.coerce.number().int().min(1).max(4096).optional()
})
export type ImageProxyQuerySchema = z.infer<typeof ImageProxyQuerySchema>
