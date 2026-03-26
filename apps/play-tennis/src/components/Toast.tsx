import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'
export type ConfirmationTone = 'green' | 'blue' | 'orange' | 'red'

interface ToastData {
  id: number
  message: string
  type: ToastType
  variant?: 'default' | 'confirmation'
  tone?: ConfirmationTone
}

const TONE_ICONS: Record<ConfirmationTone, string> = {
  green: '\u2713',
  blue: '\u2191',
  orange: '\u26A0',
  red: '\u26A0',
}

interface ToastContextType {
  showSuccess: (message: string) => void
  showError: (message: string) => void
  showInfo: (message: string) => void
  showWarning: (message: string) => void
  showConfirmation: (message: string, tone: ConfirmationTone) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      showSuccess: () => {},
      showError: () => {},
      showInfo: () => {},
      showWarning: () => {},
      showConfirmation: () => {},
    }
  }
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const idRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = useCallback((message: string, type: ToastType, variant?: 'default' | 'confirmation', tone?: ConfirmationTone) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const id = ++idRef.current
    setToast({ id, message, type, variant, tone })
    if (type !== 'error') {
      const duration = variant === 'confirmation' ? 6000 : 3000
      timerRef.current = setTimeout(() => {
        setToast(prev => prev?.id === id ? null : prev)
      }, duration)
    }
  }, [])

  const showSuccess = useCallback((msg: string) => show(msg, 'success'), [show])
  const showError = useCallback((msg: string) => show(msg, 'error'), [show])
  const showInfo = useCallback((msg: string) => show(msg, 'info'), [show])
  const showWarning = useCallback((msg: string) => show(msg, 'warning'), [show])
  const showConfirmation = useCallback((msg: string, tone: ConfirmationTone) => show(msg, 'info', 'confirmation', tone), [show])

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo, showWarning, showConfirmation }}>
      {children}
      {toast && toast.variant === 'confirmation' && toast.tone ? (
        <div className={`rally-toast-confirm rally-toast-confirm--${toast.tone}`} key={toast.id}>
          <span className="rally-toast-confirm-icon">{TONE_ICONS[toast.tone]}</span>
          <span className="rally-toast-confirm-msg">{toast.message}</span>
        </div>
      ) : toast ? (
        <div className={`rally-toast rally-toast-${toast.type}`} key={toast.id}>
          <span className="rally-toast-msg">{toast.message}</span>
          <button className="rally-toast-dismiss" onClick={() => setToast(null)} aria-label="Dismiss">&times;</button>
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}
