/** 전역 토스트 — 화면을 이동해도 메시지가 유지됨 (예: 등록 후 상세로 이동하며 "발행했어요") */
import { createContext, useCallback, useContext, useState } from 'react'
import { Toast } from '../components/feedback'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const show = useCallback((text) => setToast({ text, id: Date.now() }), [])
  const clear = useCallback(() => setToast(null), [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <Toast key={toast?.id} message={toast?.text} onDone={clear} />
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
