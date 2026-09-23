import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { ChevronDown, Home, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { PageContainer } from '@/app/components/page-container'
import { StatusHero, StatusMeta, type StatusMetaRow, type StatusTone } from '@/app/components/status-page'
import { Button } from '@/app/components/ui/button'

/**
 * TanStack Router の `errorComponent` は unknown を渡してくる。
 * Zodios (axios 形式) の失敗は `error.response.status` に本当のステータスを持つので、
 * そこを最初に見ないと 404 を素の文字列のまま画面に出してしまう。
 */
function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const record = error as Record<string, unknown>
  const response = record.response
  if (typeof response === 'object' && response !== null) {
    const status = (response as { status?: unknown }).status
    if (typeof status === 'number') return status
  }
  // `_errors/$statusCode` のテスト用エラーはプレーンな status を持つ
  if (typeof record.status === 'number') return record.status
  if (typeof record.statusCode === 'number') return record.statusCode
  return undefined
}

/** Zodios は `error.config` に投げたリクエストを残す。無ければ今いる URL で代用する。 */
function getRequestLine(error: unknown, pathname: string): string {
  if (typeof error === 'object' && error !== null) {
    const config = (error as { config?: { method?: unknown; url?: unknown } }).config
    const url = config?.url
    if (typeof url === 'string' && url.length > 0) {
      const method = typeof config?.method === 'string' ? config.method.toUpperCase() : 'GET'
      return `${method} ${url}`
    }
  }
  return `GET ${pathname}`
}

function getRawMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.stack && error.stack.trim().length > 0 ? error.stack : error.message
  }
  if (typeof error === 'string') return error
  return ''
}

const statusLabels: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout'
}

/** ステータスから見出しの深刻度と文面を決める。ステータス不明はネットワーク到達不能として扱う。 */
function describe(statusCode: number | undefined): {
  tone: StatusTone
  eyebrow: string
  title: string
  description: string
  statusValue: string
} {
  if (statusCode === undefined) {
    return {
      tone: 'warn',
      eyebrow: 'NETWORK ERROR',
      title: 'サーバーに接続できません',
      description:
        'ネットワークに接続されていないか、サーバーに到達できませんでした。接続を確認してから再度お試しください。',
      statusValue: '応答なし'
    }
  }

  const label = statusLabels[statusCode] ?? 'Error'
  const statusValue = `${statusCode} ${label}`

  if (statusCode === 404) {
    return {
      tone: 'mute',
      eyebrow: `404 ${label.toUpperCase()}`,
      title: 'ページが見つかりません',
      description: 'お探しのページは存在しないか、移動した可能性があります。',
      statusValue
    }
  }

  if (statusCode === 429 || statusCode === 503) {
    return {
      tone: 'warn',
      eyebrow: `${statusCode} ${label.toUpperCase()}`,
      title: '一時的に利用できません',
      description: 'メンテナンス中か、アクセスが集中しています。時間をおいてから再度お試しください。',
      statusValue
    }
  }

  if (statusCode === 502 || statusCode === 504 || statusCode === 408) {
    return {
      tone: 'warn',
      eyebrow: `${statusCode} ${label.toUpperCase()}`,
      title: 'サーバーの応答がありません',
      description: '上流のサーバーが応答しませんでした。時間をおいてから再度お試しください。',
      statusValue
    }
  }

  return {
    tone: 'danger',
    eyebrow: `${statusCode} ${label.toUpperCase()}`,
    title: 'データの取得に失敗しました',
    description:
      'サーバー側で予期しないエラーが発生しました。データは失われていません。しばらく待ってから再読み込みしてください。',
    statusValue
  }
}

export function ErrorPage({ error }: { error: unknown }) {
  const router = useRouter()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  // 描画のたびに動くと落ち着かないので、マウント時刻で固定する
  const [occurredAt] = useState(() => dayjs().format('YYYY-MM-DD HH:mm:ss'))

  const statusCode = getStatusCode(error)
  const { tone, eyebrow, title, description, statusValue } = describe(statusCode)
  const raw = getRawMessage(error)

  const rows: StatusMetaRow[] = [
    { label: 'リクエスト', value: getRequestLine(error, pathname) },
    { label: 'ステータス', value: statusValue, tone: tone === 'mute' ? undefined : tone },
    { label: '発生時刻', value: occurredAt }
  ]

  return (
    <PageContainer>
      <div className='w-full max-w-[640px] pt-[22px]'>
        <StatusHero size='compact' tone={tone} eyebrow={eyebrow} title={title} description={description} />

        <StatusMeta size='compact' rows={rows} />

        <div className='mt-[18px] flex flex-wrap items-center gap-2'>
          <Button className='h-[34px] gap-[7px] rounded-md px-3.5 text-[12.5px]' onClick={() => router.invalidate()}>
            <RotateCcw className='size-[15px]' />
            再読み込み
          </Button>
          <Button
            variant='outline'
            className='h-[34px] gap-[7px] rounded-md px-3.5 text-[12.5px]'
            render={<Link to='/' />}
          >
            <Home className='size-[15px]' />
            ホームに戻る
          </Button>
        </div>

        {raw.length > 0 && (
          <details className='group mt-[18px]'>
            <summary className='inline-flex cursor-pointer list-none items-center gap-1.5 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden'>
              <ChevronDown className='size-[13px] transition-transform group-open:rotate-180' />
              技術的な詳細
            </summary>
            <pre className='mt-2.5 overflow-x-auto whitespace-pre-wrap break-all rounded-r-md border-border border-l-[3px] bg-muted px-3.5 py-3 font-mono text-[11px] text-muted-foreground leading-[1.7]'>
              {raw}
            </pre>
          </details>
        )}
      </div>
    </PageContainer>
  )
}
