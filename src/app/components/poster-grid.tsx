import { ImageIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ProxyImage } from '@/app/components/proxy-image'
import { providerColor, providerLabel } from '@/app/lib/constants'
import { cn } from '@/app/lib/utils'

/** 決定稿の `.pg-poster-grid`。幅に応じて列数が変わり、スマホでは 2 列固定。 */
export const PosterGrid = ({ children }: { children: ReactNode }) => (
  <div className='grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 max-sm:grid-cols-2'>{children}</div>
)

/** `.rev-prov`。配信元をブランド色の小さな札で示す。 */
export const ProviderTag = ({ provider }: { provider: string }) => (
  <span
    className={cn(
      'flex-none rounded-[4px] px-1.5 py-px text-[9.5px] font-bold whitespace-nowrap',
      providerColor[provider] ?? 'bg-muted text-muted-foreground'
    )}
  >
    {providerLabel[provider] ?? provider}
  </span>
)

/** `.pg-poster-meta`。サムネ下の補足行。 */
export const PosterMeta = ({ children }: { children: ReactNode }) => (
  <div className='flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground'>{children}</div>
)

/**
 * `.pg-poster`。16:9 のサムネと 2 行までのタイトル、その下に補足行を並べる。
 * `href` があれば外部リンクとして開く。
 */
export const PosterCard = ({
  title,
  imageUrl,
  href,
  children
}: {
  title: string
  imageUrl?: string | null
  href?: string | null
  children?: ReactNode
}) => {
  const body = (
    <>
      <div className='relative grid aspect-video place-items-center overflow-hidden rounded-[10px] bg-muted text-muted-foreground'>
        {imageUrl ? (
          <ProxyImage
            src={imageUrl}
            alt={title}
            slotWidth={400}
            className='absolute inset-0 size-full object-cover transition-transform duration-200 group-hover:scale-105'
          />
        ) : (
          <ImageIcon className='size-[22px]' aria-hidden='true' />
        )}
      </div>
      <p className='line-clamp-2 text-[12.5px]/[1.35] font-semibold'>{title}</p>
      {children}
    </>
  )
  const className = 'group flex min-w-0 flex-col gap-1.5'
  return href ? (
    <a href={href} target='_blank' rel='noopener noreferrer' className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  )
}
