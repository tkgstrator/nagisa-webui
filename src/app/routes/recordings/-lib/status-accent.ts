import type { Tone } from '@/app/components/ui/tone'

/** 行頭アクセントの色。導出した tone に揃える (muted は罫線色)。 */
export const accentClassName: Record<Tone, string> = {
  success: 'border-l-success',
  warning: 'border-l-warning',
  info: 'border-l-info',
  primary: 'border-l-primary',
  destructive: 'border-l-destructive',
  muted: 'border-l-border'
}
