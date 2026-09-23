import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/app/components/ui/dialog'

type ConfirmUnscheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  onConfirm: () => void
}

export const ConfirmUnscheduleDialog = ({
  open,
  onOpenChange,
  selectedCount,
  onConfirm
}: ConfirmUnscheduleDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className='sm:max-w-md'>
      <DialogHeader>
        <DialogTitle>選択した予約を解除しますか</DialogTitle>
        <DialogDescription>
          <span className='tabular-nums'>{selectedCount}</span>{' '}
          件の予約を解除します。録画済みのファイルは削除されません。
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose
          render={
            <button
              type='button'
              className='inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs transition-colors hover:bg-muted'
            >
              やめる
            </button>
          }
        />
        <button
          type='button'
          onClick={onConfirm}
          className='inline-flex h-8 items-center rounded-md bg-destructive px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90'
        >
          解除する
        </button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
