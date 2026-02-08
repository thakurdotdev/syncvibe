import { memo } from "react"
import { Button } from "@/components/ui/button"
import { Music, Users, Radio, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Users,
    title: "Listen Together",
    description: "Sync music playback with friends in real-time",
  },
  {
    icon: Radio,
    title: "Perfect Sync",
    description: "Everyone hears the same beat at the same moment",
  },
  {
    icon: Sparkles,
    title: "Group Chat",
    description: "Chat and share reactions while listening",
  },
]

const WelcomeView = ({ onOpenModal }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      {/* Animated Music Icon */}
      <div className="relative mb-8">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="p-6 rounded-full bg-linear-to-br from-primary/20 to-primary/5"
        >
          <Music className="h-16 w-16 text-primary" />
        </motion.div>

        {/* Decorative rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="h-28 w-28 rounded-full border-2 border-primary/20"
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="h-28 w-28 rounded-full border-2 border-primary/10"
          />
        </div>
      </div>

      {/* Title & Description */}
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold text-center mb-3"
      >
        Group Music Session
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground text-center max-w-md mb-8"
      >
        Create or join a group to listen to music together with friends, perfectly synchronized in
        real-time.
      </motion.p>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 max-w-2xl"
      >
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            className={cn(
              "flex flex-col items-center p-4 rounded-xl",
              "bg-accent/30 border border-border/50",
              "hover:bg-accent/50 transition-colors",
            )}
          >
            <feature.icon className="h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold text-sm">{feature.title}</h3>
            <p className="text-xs text-muted-foreground text-center mt-1">{feature.description}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
      >
        <Button
          onClick={onOpenModal}
          size="lg"
          className={cn(
            "rounded-full px-10 py-6 text-lg font-medium",
            "bg-primary hover:bg-primary/90",
            "shadow-xl shadow-primary/25",
            "hover:scale-105 transition-transform",
          )}
        >
          <Users className="mr-2 h-5 w-5" />
          Get Started
        </Button>
      </motion.div>
    </motion.div>
  )
}

export default memo(WelcomeView)
