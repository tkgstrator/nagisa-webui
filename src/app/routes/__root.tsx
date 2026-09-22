import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from 'sonner'
import { AppFooter } from '@/app/components/app-footer'
import { AppSidebar } from '@/app/components/app-sidebar'
import { ErrorPage } from '@/app/components/error-page'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { NotFoundPage } from '@/app/components/not-found-page'

const RootComponent = () => {
  return (
    <div className='flex min-h-screen select-none bg-background max-sm:flex-col'>
      <AppSidebar />
      <div className='flex min-w-0 flex-1 flex-col'>
        <main className='flex flex-1 select-text flex-col overflow-x-hidden'>
          <Outlet />
        </main>
        {/* 画面下端に固定するので、ページではなくここで一度だけ描画する */}
        <AppFooter />
      </div>
      <Toaster richColors position='top-right' />
      <TanStackRouterDevtools position='bottom-right' />
      <ReactQueryDevtools buttonPosition='bottom-left' />
    </div>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  pendingComponent: LoadingSpinner,
  errorComponent: ({ error }) => <ErrorPage error={error} />,
  notFoundComponent: NotFoundPage
})
