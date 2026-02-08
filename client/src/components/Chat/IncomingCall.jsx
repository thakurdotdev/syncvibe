import { Phone, PhoneOff, User } from "lucide-react"
import { useEffect, useState } from "react"

const IncomingCallNotification = ({ incomingCall, answerCall, endCall }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isRinging, setIsRinging] = useState(true)

  useEffect(() => {
    if (incomingCall) {
      setIsVisible(true)
      setIsRinging(true)

      const timer = setTimeout(() => {
        setIsRinging(false)
        endCall()
      }, 30000)

      if (incomingCall.isAnswered) {
        setIsVisible(false)
        setIsRinging(false)
      }

      return () => {
        clearTimeout(timer)
      }
    } else {
      setIsVisible(false)
      setIsRinging(false)
    }
  }, [incomingCall])

  if (!incomingCall) return null

  return (
    <div className="fixed bottom-6 md:right-6 z-50 w-full md:w-auto max-md:px-4">
      <div
        className={`transform transition-all duration-500 ease-out ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
        }`}
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden w-full md:max-w-md">
          <div className="p-4 flex items-center gap-4 relative">
            <div
              className={`absolute inset-0 ${
                isRinging ? "animate-ping" : ""
              } rounded-2xl bg-green-500/10`}
            />

            <div className="relative bg-gray-100 dark:bg-gray-700 rounded-full p-2">
              {incomingCall.profilepic ? (
                <img
                  src={incomingCall.profilepic}
                  alt={incomingCall.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                </div>
              )}
              <div
                className={`absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 ${
                  isRinging ? "animate-pulse" : ""
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {incomingCall.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full bg-green-500 ${
                    isRinging ? "animate-pulse" : ""
                  }`}
                />
                Incoming video call...
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={answerCall}
                className="p-3 rounded-full bg-green-500 hover:bg-green-600 text-white transform transition-all duration-200 hover:scale-105 focus:outline-hidden focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={endCall}
                className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transform transition-all duration-200 hover:scale-105 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="h-1 bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full bg-green-500 transition-all duration-200"
              style={{
                width: "100%",
                animation: isRinging ? "progress 30s linear" : "none",
              }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}

export default IncomingCallNotification
