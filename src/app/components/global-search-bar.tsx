import { useNavigate } from '@tanstack/react-router'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { searchFocusAtom } from '@/app/lib/atoms'

/**
 * 決定稿のサイドバーには検索ボックスが無く、検索はページ内 (`/browse` のツールバー) に置かれる。
 * ⌘K / Ctrl+K を殺さないため、表示を持たないホットキーだけを常駐させ、
 * 押下時に `/browse` へ移動してページ内検索へ焦点を渡す。
 */
export function GlobalSearchHotkey() {
  const navigate = useNavigate()
  const requestFocus = useSetAtom(searchFocusAtom)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isModK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (!isModK) return
      event.preventDefault()
      navigate({ to: '/browse' })
      requestFocus((n) => n + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, requestFocus])

  return null
}
