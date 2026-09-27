import { Link } from '@tanstack/react-router'
import { useIntlayer } from 'react-intlayer'

/**
 * 決定稿の `.ftr`。画面下端に固定表示するので、各ページではなく
 * ルート (`__root.tsx`) が一度だけ描画する。左端は常設サイドバー (236px) の右から。
 * 高さ 44px は `<PageContainer />` の下余白 90px (= 46 + 44) と対になっている。
 */
export const AppFooter = () => {
  const content = useIntlayer('app-footer')
  return (
    <footer className='fixed right-0 bottom-0 left-[236px] z-30 flex h-11 items-center justify-between gap-3 border-border border-t bg-background px-9 text-[11px] text-muted-foreground max-sm:left-0 max-sm:gap-2.5 max-sm:px-4'>
      <span className='inline-flex items-center gap-2 tabular-nums'>
        <span>Nagisa WebUI</span>
        <span>v{__APP_VERSION__}</span>
        <span className='rounded bg-muted px-[5px] py-px font-mono text-[10.5px]'>{__GIT_HASH__}</span>
      </span>
      <span className='inline-flex items-center gap-3.5 max-sm:gap-3'>
        <Link to='/changelog' className='transition-colors hover:text-foreground'>
          {content.changelog}
        </Link>
        <Link to='/admin' className='transition-colors hover:text-foreground'>
          {content.admin}
        </Link>
        <a
          href='https://github.com/tkgstrator/nagisa-webui'
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1 transition-colors hover:text-foreground'
        >
          GitHub
          <svg
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={2}
            strokeLinecap='round'
            strokeLinejoin='round'
            className='size-[11px]'
            aria-hidden='true'
          >
            <path d='M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' />
          </svg>
        </a>
      </span>
    </footer>
  )
}
