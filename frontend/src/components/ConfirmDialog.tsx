export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel?: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onCancel || onConfirm}
    >
      <div
        className="bg-card border border-border rounded-sm p-6 max-w-sm w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-semibold text-lg text-foreground mb-2">
          {title}
        </h3>
        <p className="text-base text-muted-foreground mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-sm text-base text-muted-foreground hover:text-foreground hover:bg-card/50 transition-colors"
              onClick={onCancel}
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            className="px-3 py-1.5 rounded-sm text-base bg-destructive/80 text-white hover:bg-destructive transition-colors"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
