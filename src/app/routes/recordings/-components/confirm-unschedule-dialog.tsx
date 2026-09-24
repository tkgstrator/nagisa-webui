import { useIntlayer } from 'react-intlayer'
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
}: ConfirmUnscheduleDialogProps) => {
  const content = useIntlayer('recordings-confirm-unschedule-dialog')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription>
            <span className='tabular-nums'>{selectedCount}</span> {content.descriptionSuffix}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={
              <button
                type='button'
                className='inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs transition-colors hover:bg-muted'
              >
                {content.cancel}
              </button>
            }
          />
          <button
            type='button'
            onClick={onConfirm}
            className='inline-flex h-8 items-center rounded-md bg-destructive px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90'
          >
            {content.confirm}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
