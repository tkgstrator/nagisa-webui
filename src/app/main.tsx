import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { IntlayerProvider } from 'react-intlayer'

import '../index.css'

import { registerImageCacheWorker } from './lib/image-cache'
import { appLocale } from './lib/locale'
import { queryClient } from './lib/query-client'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  context: { queryClient }
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// index.html は lang="ja" 固定なので、保存済みの言語で上書きする (読み上げとフォント選択に効く)
document.documentElement.lang = String(appLocale)

registerImageCacheWorker()

// biome-ignore lint/style/noNonNullAssertion: reason
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <IntlayerProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </IntlayerProvider>
    </StrictMode>
  )
}
