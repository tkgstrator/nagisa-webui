import { Search as SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { Input } from '@/app/components/ui/input'

/** summary の部分一致。入力ごとに URL を書き換えると履歴が荒れるので 300ms 待つ。 */
export function SummarySearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const content = useIntlayer('admin-logs')
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = (v: string) => {
    setLocalValue(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(v), 300)
  }

  return (
    <div className='relative w-full sm:w-60'>
      <SearchIcon className='pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-muted-foreground' />
      <Input
        type='search'
        placeholder={content.search.placeholder.value}
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className='h-[30px] rounded-full bg-background pr-3 pl-8 text-xs focus-visible:border-primary md:text-xs'
        aria-label={content.search.ariaLabel.value}
      />
    </div>
  )
}
