/** Image proxy component. Serves imageUrl via the proxy endpoint. */
import { useState } from 'react'

/**
 * R2 に永続化する幅。src/routes/img.ts の PERSISTED_WIDTHS と同じ値でなければならない。
 * ここに無い幅を要求すると変換結果が保存されず、毎リクエストでオリジン取得と変換が走る。
 *
 * 3 段なのは DPR の境界に合わせたため。以前の 5 段 (176/200/400/480/800) は刻みすぎで、
 * 176 と 200 は 1 枚あたり 0.7 KiB、400 と 480 も 2.8 KiB しか違わなかった。
 */
const LADDER = [200, 400, 800] as const

/** 必要な実ピクセル数を満たす最小の段。最大段を超える分は頭打ちにする (1280 は用意していない) */
const stepFor = (px: number): number => LADDER.find((w) => w >= px) ?? LADDER[LADDER.length - 1]

type ProxyImageProps = {
  src: string
  alt: string
  className?: string
  /**
   * 表示枠の CSS ピクセル幅。取得する画像の幅ではない。
   * DPR 1/2/3 に必要な実ピクセル数をここから計算し、ラダーの段に丸めて srcSet に並べる。
   */
  slotWidth?: number
}

export function ProxyImage({ src, alt, className, slotWidth }: ProxyImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    const firstChar = Array.from(alt.trim())[0]
    const initial = firstChar !== undefined ? firstChar : '?'
    return (
      <div
        role='img'
        aria-label={alt}
        className={`flex select-none items-center justify-center overflow-hidden bg-muted text-muted-foreground ${className ?? ''}`}
      >
        <span aria-hidden='true' className='text-2xl font-semibold leading-none'>
          {initial}
        </span>
      </div>
    )
  }

  const base = `/api/img/${btoa(src).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
  const withWidth = (w: number) => `${base}?w=${w}`
  const proxySrc = slotWidth === undefined ? base : withWidth(stepFor(slotWidth))
  const srcSet =
    slotWidth === undefined
      ? undefined
      : [1, 2, 3].map((dpr) => `${withWidth(stepFor(slotWidth * dpr))} ${dpr}x`).join(', ')
  return (
    <img
      src={proxySrc}
      srcSet={srcSet}
      alt={alt}
      loading='lazy'
      decoding='async'
      draggable={false}
      onError={() => setFailed(true)}
      className={`select-none ${className ?? ''}`}
    />
  )
}
