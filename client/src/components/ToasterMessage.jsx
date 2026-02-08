import React, { useState, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle, XCircle, Info, X } from "lucide-react"

// Toast queue manager
const toastQueue = []
let notifyChange

// Toast variants configuration
const VARIANTS = {
  success: {
    icon: CheckCircle,
    class: "bg-gray-900 border-green-500",
  },
  error: {
    icon: XCircle,
    class: "bg-gray-900 border-red-500",
  },
  info: {
    icon: Info,
    class: "bg-gray-900 border-blue-500",
  },
}

// Position styles mapping
const POSITIONS = {
  "top-left": "top-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-4 right-4",
}

// Toast API
export const toast = {
  success: (message, options = {}) => {
    addToast({ message, variant: "success", ...options })
  },
  error: (message, options = {}) => {
    addToast({ message, variant: "error", ...options })
  },
  info: (message, options = {}) => {
    addToast({ message, variant: "info", ...options })
  },
}

const addToast = (toast) => {
  toastQueue.push({ ...toast, id: Date.now() })
  if (notifyChange) notifyChange()
}

const ToastMessage = ({ toast, onClose }) => {
  const variant = VARIANTS[toast.variant] || VARIANTS.info
  const Icon = variant.icon

  const getIconColor = () => {
    switch (toast.variant) {
      case "success":
        return "text-green-500"
      case "error":
        return "text-red-500"
      case "info":
        return "text-blue-500"
      default:
        return "text-blue-500"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className={`
        ${variant.class}
        border-l-4
        rounded-lg
        shadow-lg
        shadow-black/10
        backdrop-blur-md
        bg-opacity-95
        overflow-hidden
      `}
    >
      <div className="px-4 py-3 flex items-center gap-3 relative">
        <Icon className={`w-5 h-5 ${getIconColor()} shrink-0`} />
        <p className="text-gray-100 font-medium text-sm pr-8">{toast.message}</p>
        <button
          onClick={onClose}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full 
                   hover:bg-gray-800 transition-colors duration-200"
        >
          <X className="w-4 h-4 text-gray-400 hover:text-gray-200 transition-colors duration-200" />
        </button>
      </div>
      <div className="h-1 bg-gray-800 relative overflow-hidden">
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: 0 }}
          transition={{
            duration: (toast.time || 5000) / 1000,
            ease: "linear",
          }}
          className={`absolute inset-0 ${getProgressBarColor(toast.variant)}`}
          onAnimationComplete={onClose}
        />
      </div>
    </motion.div>
  )
}

const getProgressBarColor = (variant) => {
  switch (variant) {
    case "success":
      return "bg-green-500/30"
    case "error":
      return "bg-red-500/30"
    case "info":
      return "bg-blue-500/30"
    default:
      return "bg-blue-500/30"
  }
}

const Toaster = () => {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  useEffect(() => {
    notifyChange = () => {
      if (toastQueue.length > 0) {
        const newToast = toastQueue.shift()
        setToasts((prev) => [...prev, newToast])
      }
    }
  }, [])

  const getPositionClasses = () => {
    return POSITIONS[toasts[0]?.position || "top-right"]
  }

  return (
    <div
      className={`fixed ${getPositionClasses()} z-50 flex flex-col gap-2 min-w-[300px] max-w-[400px]`}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

export default Toaster
