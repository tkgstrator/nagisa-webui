import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

/** 入力欄と同じ高さ・角丸。Input / SelectTrigger の className に足して使う。 */
export const formControlClass = 'h-9 w-full rounded-lg px-2.5 text-sm data-[size=default]:h-9 md:text-sm'

/** 等幅で出す補足 (パスやフラグ)。 */
export const MonoText = ({ children }: { children: ReactNode }) => (
  <code className='font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-[11.5px]'>{children}</code>
)

export const FormHint = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('text-[11.5px] text-muted-foreground', className)}>{children}</p>
)

interface FormFieldProps {
  label: ReactNode
  htmlFor: string
  hint?: ReactNode
  children: ReactNode
}

/** ラベル + 入力欄 + 補足の 1 組。モックの `.a-field-wrap` に相当する (幅 280px)。 */
export const FormField = ({ label, htmlFor, hint, children }: FormFieldProps) => (
  <div className='flex w-[280px] max-w-full flex-col gap-1.5'>
    <label htmlFor={htmlFor} className='text-xs/[18px] font-semibold'>
      {label}
    </label>
    {children}
    {hint && <FormHint>{hint}</FormHint>}
  </div>
)

/** 2 項目を横に並べる行。スマホでは縦積み。 */
export const FormRow = ({ children }: { children: ReactNode }) => (
  <div className='grid grid-cols-2 gap-3.5 max-sm:grid-cols-1'>{children}</div>
)

/** JSON などの整形済みテキスト。モックの `.pg-pre` に相当する。 */
export const PreBlock = ({ children, error }: { children: ReactNode; error?: boolean }) => (
  <pre
    className={cn(
      'overflow-x-auto rounded-[10px] px-3.5 py-3 font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-[11.5px] leading-[1.6] break-all whitespace-pre-wrap',
      error ? 'bg-destructive/8 text-destructive' : 'bg-muted text-foreground'
    )}
  >
    {children}
  </pre>
)
