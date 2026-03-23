import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastData {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  showSuccess: (message: string) => void
  showError: (message: string) => void
  showInfo: (message: string) => void
  showWarning: (message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Return no-op functions if outside provider (for safety)
    return {
      showSuccess: () => {},
      showError: () => {},
      showInfo: () => {},
      showWarning: () => {},
    }
  }
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const idRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = useCallback((message: string, type: ToastType) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const id = ++idRef.current
    setToast({ id, message, type })
    if (type !== 'error') {
      timerRef.current = setTimeout(() => {
        setToast(prev => prev?.id === id ? null : prev)
      }, 3000)
    }
  }, [])

  const showSuccess = useCallback((msg: string) => show(msg, 'success'), [show])
  const showError = useCallback((msg: string) => show(msg, 'error'), [show])
  const showInfo = useCallback((msg: string) => show(msg, 'info'), [show])
  const showWarning = useCallback((msg: string) => show(msg, 'warning'), [show])

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo, showWarning }}>
      {children}
      {toast && (
        <div className={`rally-toast rally-toast-${toast.type}`} key={toast.id}>
          <span className="rally-toast-msg">{toast.message}</span>
          <button className="rally-toast-dismiss" onClick={() => setToast(null)} aria-label="Dismiss">&times;</button>
        </div>
      )}
    </ToastContext.Provider>
  )
}
