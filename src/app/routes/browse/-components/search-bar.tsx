import { useAtomValue } from 'jotai'
import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/app/components/ui/input'
import { searchFocusAtom } from '@/app/lib/atoms'

export function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const focusSignal = useAtomValue(searchFocusAtom)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = (v: string) => {
    setLocalValue(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(v), 300)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (focusSignal === 0) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusSignal])

  return (
    <div className='relative w-full sm:w-60'>
      <Search className='pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-muted-foreground' />
      <Input
        ref={inputRef}
        type='search'
        placeholder='タイトルで検索'
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className='h-[34px] rounded-full bg-background pr-3 pl-8 text-[12.5px] focus-visible:border-primary md:text-[12.5px]'
        aria-label='タイトルで検索'
      />
    </div>
  )
}
