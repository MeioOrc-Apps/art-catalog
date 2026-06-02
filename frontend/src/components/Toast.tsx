import { useEffect, useRef, useState } from 'react'
import { CheckCircle } from 'lucide-react'

interface ToastProps {
  message: string | null
  onDone: () => void
}

export default function Toast({ message, onDone }: ToastProps) {
  const [visible, setVisible] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!message) return
    setVisible(true)
    const hide = setTimeout(() => setVisible(false), 3500)
    const clear = setTimeout(() => onDoneRef.current(), 3800)
    return () => { clearTimeout(hide); clearTimeout(clear) }
  }, [message])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] transition-all duration-300 pointer-events-none ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="flex items-center gap-2 bg-card border border-border/60 shadow-lg rounded-sm px-4 py-2.5 text-sm text-foreground whitespace-nowrap">
        <CheckCircle size={15} className="text-accent shrink-0" />
        {message}
      </div>
    </div>
  )
}
