import { memo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const FAQ = memo(() => {
  const [openIndex, setOpenIndex] = useState(0)

  const faqs = [
    {
      question: "How does real-time synchronized playback work?",
      answer:
        "SyncVibe utilizes WebSocket streaming channels with periodic client-server timestamp alignment. When the room host or a member plays, pauses, or seeks, the event is distributed with millisecond offsets so everyone hears the same audio simultaneously.",
    },
    {
      question: "Can my friends join from mobile browsers or the Android app?",
      answer:
        "Yes! SyncVibe is cross-platform. Friends can join your room from Google Chrome, Safari, Firefox on any desktop/laptop, mobile browsers, or via our dedicated native Android app.",
    },
    {
      question: "Do all my friends need a PRO plan to join my room?",
      answer:
        "No. Free users can join any room as participants. The PRO plan allows room creators to host up to 10 members and queue up to 50 songs with live video/voice capabilities.",
    },
    {
      question: "How does the collaborative queue work?",
      answer:
        "Inside any active sync room, participants can search for tracks and add them to the shared queue. The room also supports democratic voting where popular songs move up automatically.",
    },
    {
      question: "Can I create and share private playlists?",
      answer:
        "Yes. You can organize your favorite tracks into personal playlists or make them public so other SyncVibe members can discover your curated taste.",
    },
  ]

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? -1 : index)
  }

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 relative border-t border-zinc-800/60">
      <div className="max-w-3xl mx-auto">
        <div className="text-center max-w-md mx-auto mb-14 space-y-2.5">
          <span className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-widest">
            FAQ
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Common questions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
            Everything you need to know about rooms, sync, and subscriptions.
          </p>
        </div>

        <div className="space-y-2.5">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index
            return (
              <div
                key={index}
                className={cn(
                  "rounded-xl border transition-all duration-200 overflow-hidden",
                  isOpen
                    ? "border-zinc-700 bg-zinc-900/60"
                    : "border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="text-sm font-medium text-zinc-200">{faq.question}</span>
                  <ChevronDown
                    size={15}
                    className={cn(
                      "text-zinc-500 transition-transform duration-200 shrink-0",
                      isOpen && "transform rotate-180 text-white",
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 pt-1 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/60">
                    {faq.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
})

FAQ.displayName = "FAQ"
export default FAQ
