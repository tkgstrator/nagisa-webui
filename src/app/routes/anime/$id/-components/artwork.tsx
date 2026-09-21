import type { CSSProperties, ReactNode } from 'react'
import { ProxyImage } from '@/app/components/proxy-image'
import { hueOf } from '../-lib/format'

type ArtworkProps = {
  /** 画像 URL。空文字のときはプレースホルダだけを描画する。 */
  src: string
  alt: string
  /** 色相を決めるキー。同じタイトル/話数なら常に同じ色になる。 */
  seed: string
  width: number
  variant: 'hero' | 'thumb'
  /** プレースホルダに重ねる文字。ヒーローでのみ使う。 */
  initial?: string
  className?: string
  /** 画像の上に重ねるオーバーレイ (無料バッジ・再生時間など)。 */
  children?: ReactNode
}

/**
 * 16:9 のアートワーク枠。実画像が載るまでの下地としてモックのグラデーションを敷き、
 * 画像はその上に重ねる。縦長・正方形は使わない (SPEC の絶対条件)。
 */
export const Artwork = ({ src, alt, seed, width, variant, initial, className, children }: ArtworkProps) => {
  const h = hueOf(seed)
  const art: CSSProperties =
    variant === 'hero'
      ? {
          background: `radial-gradient(120% 100% at 25% 0%, oklch(0.82 0.11 ${h} / 85%), transparent 55%), linear-gradient(165deg, oklch(0.6 0.15 ${h}) 0%, oklch(0.32 0.13 ${h + 40}) 100%)`
        }
      : { background: `linear-gradient(135deg, oklch(0.62 0.12 ${h}), oklch(0.38 0.12 ${h + 40}))` }

  return (
    <div className={`relative aspect-video overflow-hidden ${className ?? ''}`}>
      <div aria-hidden='true' className='absolute inset-0' style={art} />
      {initial !== undefined && (
        <span
          aria-hidden='true'
          className='absolute top-[10px] right-[18px] text-[52px] leading-none font-extrabold opacity-[0.18]'
          style={{ color: 'oklch(0.99 0.01 265)' }}
        >
          {initial}
        </span>
      )}
      {src.length > 0 && (
        <ProxyImage
          src={src}
          alt={alt}
          width={width}
          className='absolute inset-0 size-full object-cover [&[role=img]]:hidden'
        />
      )}
      {children}
    </div>
  )
}
