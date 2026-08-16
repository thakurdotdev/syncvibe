import { memo } from "react"
import { Play, Radio, UserPlus } from "lucide-react"

const HowItWorks = memo(() => {
  const steps = [
    {
      num: "01",
      icon: Radio,
      title: "Create your room",
      description:
        "Start a session in one click. Choose between public discoverable rooms or private invite-only spaces.",
    },
    {
      num: "02",
      icon: UserPlus,
      title: "Direct & link invites",
      description:
        "Send 1-click real-time invites directly to online friends, or share your room link and 6-digit code anywhere.",
    },
    {
      num: "03",
      icon: Play,
      title: "Stream in sync",
      description:
        "Hit play. Audio playback, scrubbing, collaborative queueing, and reactions sync across all devices in real time.",
    },
  ]

  return (
    <section id="how-it-works" className="py-24 px-4 sm:px-6 relative border-t border-zinc-800/60">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto mb-20 space-y-3">
          <span className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-widest">
            Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
            From invite to listening in seconds.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
            Three effortless steps to synchronize your squad with zero configuration required.
          </p>
        </div>

        {/* 3-Step Connected Journey */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {/* Subtle Connecting Line on Desktop */}
          <div className="hidden md:block absolute top-7 left-14 right-14 h-[1px] bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 pointer-events-none z-0" />

          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={i} className="relative z-10 flex flex-col items-center text-center space-y-4">
                {/* Step Circle with Number Badge */}
                <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-xl ring-4 ring-[#050505] group hover:border-zinc-600 transition-colors">
                  <span className="font-mono text-sm font-bold text-white">{step.num}</span>
                </div>

                {/* Step Content */}
                <div className="space-y-2 max-w-xs">
                  <h3 className="text-lg font-semibold text-white tracking-tight flex items-center justify-center gap-2">
                    <Icon size={16} className="text-zinc-400" />
                    <span>{step.title}</span>
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
})

HowItWorks.displayName = "HowItWorks"
export default HowItWorks
