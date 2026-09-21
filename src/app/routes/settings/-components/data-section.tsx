import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/app/components/ui/dialog'
import { DEFAULT_SETTINGS, type Settings, useSettings } from '../-lib/settings'
import { StButton, StNote, StPanel, StRow, stButtonClass } from './controls'
import { ImageIcon, ResetIcon, TransferIcon } from './icons'
import { PgSec } from './section'

const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

/**
 * Cache Storage の使用量。usageDetails を出さないブラウザではオリジン全体の推定値になる。
 * 数値が取れないときは「—」のままにする。
 */
const useCacheUsage = () => {
  const [usage, setUsage] = useState<number | null>(null)

  const measure = useCallback(async () => {
    if (typeof navigator === 'undefined' || navigator.storage?.estimate === undefined) return
    const estimate = await navigator.storage.estimate()
    const details = (estimate as { usageDetails?: Record<string, number> }).usageDetails
    setUsage(details?.caches ?? estimate.usage ?? null)
  }, [])

  useEffect(() => {
    void measure()
  }, [measure])

  return { usage, measure }
}

export const DataSection = () => {
  const { settings, reset, replace } = useSettings()
  const { usage, measure } = useCacheUsage()
  const fileInput = useRef<HTMLInputElement>(null)

  const clearCache = async () => {
    if (typeof caches === 'undefined') {
      toast.error('このブラウザではキャッシュを操作できない')
      return
    }
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
    await measure()
    toast.success('画像キャッシュを削除した')
  }

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'nagisa-settings.json'
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success('設定を書き出した')
  }

  const importSettings = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Settings>
      replace({ ...DEFAULT_SETTINGS, ...parsed })
      toast.success('設定を読み込んだ')
    } catch {
      toast.error('設定ファイルを読み取れなかった')
    }
  }

  return (
    <PgSec id='s-data' title='データ' count='このブラウザに残っているもの'>
      <StPanel>
        <StRow
          index={0}
          icon={<ImageIcon />}
          label='画像キャッシュ'
          description='ポスターの WebP を端末に保持している分。消しても作品データは残る。'
        >
          <StNote>{usage === null ? '—' : formatBytes(usage)}</StNote>
          <StButton onClick={() => void clearCache()}>削除</StButton>
        </StRow>

        <StRow
          index={1}
          icon={<TransferIcon />}
          label='設定の書き出しと読み込み'
          description='この画面の内容を JSON で保存し、別の端末に持ち込める。'
        >
          <StButton onClick={exportSettings}>書き出す</StButton>
          <StButton onClick={() => fileInput.current?.click()}>読み込む</StButton>
          <input
            ref={fileInput}
            type='file'
            accept='application/json'
            className='hidden'
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importSettings(file)
              event.target.value = ''
            }}
          />
        </StRow>

        <StRow
          index={2}
          danger
          icon={<ResetIcon />}
          label='すべての設定を初期化する'
          description='この画面の内容だけが既定に戻る。録画予約と作品データには触れない。'
        >
          <Dialog>
            <DialogTrigger
              render={
                <button type='button' className={stButtonClass(true)}>
                  初期化
                </button>
              }
            />
            <DialogContent className='sm:max-w-md'>
              <DialogHeader>
                <DialogTitle>設定を初期化する</DialogTitle>
                <DialogDescription>
                  この画面の内容だけが既定に戻る。録画予約と作品データには触れない。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant='outline'>やめる</Button>} />
                <DialogClose
                  render={
                    <Button
                      variant='destructive'
                      onClick={() => {
                        reset()
                        toast.success('設定を初期化した')
                      }}
                    >
                      初期化する
                    </Button>
                  }
                />
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </StRow>
      </StPanel>
    </PgSec>
  )
}
