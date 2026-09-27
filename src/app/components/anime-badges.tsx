import type { MouseEventHandler } from 'react'
import { Badge } from '@/app/components/ui/badge'
import { providerColor, providerLabel, statusColor, statusLabel } from '@/app/lib/constants'
import { cn } from '@/app/lib/utils'

export function ProviderBadge({
  provider,
  className = '',
  onClick
}: {
  provider: string
  className?: string
  onClick?: MouseEventHandler
}) {
  return (
    <Badge variant='secondary' className={cn(providerColor[provider], className)} onClick={onClick}>
      {providerLabel[provider] ?? provider}
    </Badge>
  )
}

export function StatusBadge({
  status,
  className = '',
  onClick
}: {
  status: string
  className?: string
  onClick?: MouseEventHandler
}) {
  return (
    <Badge variant='secondary' className={cn(statusColor[status], className)} onClick={onClick}>
      {statusLabel[status] ?? status}
    </Badge>
  )
}
