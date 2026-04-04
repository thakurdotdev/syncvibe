import { memo } from "react"
import { Button } from "@/components/ui/button"
import { Music, Users, Radio, MessageCircle } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Users,
    title: "Listen Together",
    description: "Sync playback with friends in real-time",
  },
  {
    icon: Radio,
    title: "Perfect Sync",
    description: "Same beat, same moment, every device",
  },
  {
    icon: MessageCircle,
    title: "Group Chat",
    description: "Chat and react while listening together",
  },
]

const WelcomeView = ({ onOpenModal }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="flex flex-col items-center justify-center py-12 md:py-16 px-4"
    >
      <div className="relative mb-8">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="p-6 rounded-full bg-accent/50"
        >
          <Music className="h-12 w-12 md:h-14 md:w-14 text-primary/60" />
        </motion.div>

        <motion.div
          animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="h-24 w-24 rounded-full border border-primary/10" />
        </motion.div>
      </div>

      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-2xl md:text-3xl font-bold text-center mb-2"
      >
        Group Music Session
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-muted-foreground/60 text-center max-w-sm mb-10 text-sm"
      >
        Create or join a group to listen together, perfectly synchronized across all devices.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 max-w-xl w-full"
      >
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.08 }}
            className={cn(
              "flex flex-col items-center p-4 rounded-xl",
              "bg-accent/20 border border-border/30",
              "hover:bg-accent/30 transition-colors duration-200",
            )}
          >
            <feature.icon className="h-6 w-6 text-muted-foreground/50 mb-2" />
            <h3 className="font-medium text-sm">{feature.title}</h3>
            <p className="text-[11px] text-muted-foreground/40 text-center mt-0.5 leading-relaxed">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.65 }}
      >
        <Button
          onClick={onOpenModal}
          size="lg"
          className={cn(
            "rounded-full px-8 py-5 text-sm font-medium gap-2",
            "hover:scale-[1.02] transition-transform duration-200",
          )}
        >
          <Users className="h-4 w-4" />
          Get Started
        </Button>
      </motion.div>
    </motion.div>
  )
}

export default memo(WelcomeView)
