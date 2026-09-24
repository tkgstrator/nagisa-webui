import { useCallback, useEffect, useRef, useState } from 'react'
import { useIntlayer } from 'react-intlayer'
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
  const content = useIntlayer('settings-data-section')

  const clearCache = async () => {
    if (typeof caches === 'undefined') {
      toast.error(content.cache.unavailableError.value)
      return
    }
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
    await measure()
    toast.success(content.cache.deletedToast.value)
  }

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'nagisa-settings.json'
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(content.transfer.exportedToast.value)
  }

  const importSettings = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Settings>
      replace({ ...DEFAULT_SETTINGS, ...parsed })
      toast.success(content.transfer.importedToast.value)
    } catch {
      toast.error(content.transfer.importFailedToast.value)
    }
  }

  return (
    <PgSec id='s-data' title={content.title.value} count={content.count}>
      <StPanel>
        <StRow index={0} icon={<ImageIcon />} label={content.cache.label.value} description={content.cache.description}>
          <StNote>{usage === null ? '—' : formatBytes(usage)}</StNote>
          <StButton onClick={() => void clearCache()}>{content.cache.deleteButton}</StButton>
        </StRow>

        <StRow
          index={1}
          icon={<TransferIcon />}
          label={content.transfer.label.value}
          description={content.transfer.description}
        >
          <StButton onClick={exportSettings}>{content.transfer.exportButton}</StButton>
          <StButton onClick={() => fileInput.current?.click()}>{content.transfer.importButton}</StButton>
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
          label={content.reset.label.value}
          description={content.reset.description}
        >
          <Dialog>
            <DialogTrigger
              render={
                <button type='button' className={stButtonClass(true)}>
                  {content.reset.triggerButton}
                </button>
              }
            />
            <DialogContent className='sm:max-w-md'>
              <DialogHeader>
                <DialogTitle>{content.reset.dialogTitle}</DialogTitle>
                <DialogDescription>{content.reset.description}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant='outline'>{content.reset.cancelButton}</Button>} />
                <DialogClose
                  render={
                    <Button
                      variant='destructive'
                      onClick={() => {
                        reset()
                        toast.success(content.reset.resetToast.value)
                      }}
                    >
                      {content.reset.confirmButton}
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
