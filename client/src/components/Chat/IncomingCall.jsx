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
    <div
      className="fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:w-[360px]"
      style={{ zIndex: 9999 }}
    >
      <div
        className={`transition-all duration-500 ease-out ${isVisible ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95"
          }`}
      >
        <div className="incoming-call-card rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 flex items-center gap-3.5 relative">
            {isRinging && (
              <div className="absolute inset-0 rounded-2xl animate-pulse bg-emerald-500/5 pointer-events-none" />
            )}

            <div className="relative shrink-0">
              {incomingCall.profilepic ? (
                <img
                  src={incomingCall.profilepic}
                  alt={incomingCall.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/30"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center ring-2 ring-emerald-500/30">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background ${isRinging ? "animate-pulse" : ""
                  }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {incomingCall.name}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  {isRinging && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Incoming video call
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={answerCall}
                className="h-11 w-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/25"
              >
                <Phone className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={endCall}
                className="h-11 w-11 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-lg shadow-red-500/25"
              >
                <PhoneOff className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>

          <div className="h-[3px] bg-muted/30">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{
                width: "100%",
                animation: isRinging ? "call-progress 30s linear forwards" : "none",
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        .incoming-call-card {
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        @keyframes call-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}

export default IncomingCallNotification
