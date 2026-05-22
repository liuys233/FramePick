import { message } from 'antd'
import type { ReactNode } from 'react'

interface ToastContextType {
  success: (content: ReactNode) => void
  error: (content: ReactNode) => void
  warning: (content: ReactNode) => void
  info: (content: ReactNode) => void
}

export function useAntdToast(): ToastContextType {
  return {
    success: (content) => message.success(content),
    error: (content) => message.error(content),
    warning: (content) => message.warning(content),
    info: (content) => message.info(content),
  }
}