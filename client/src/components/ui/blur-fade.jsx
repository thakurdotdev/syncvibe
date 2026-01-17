"use client"
import { useRef } from "react"
import { motion, useInView } from "framer-motion"

export default function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0.04,
  yOffset = 0,
  inView = true,
  inViewMargin = "0px",
  blur = "20px",
}) {
  const ref = useRef(null)
  const isInView = inView && useInView(ref, { once: true, margin: inViewMargin })
  const defaultVariants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: "blur(0px)" },
  }

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variant || defaultVariants}
      transition={{
        delay,
        duration,
        ease: "easeOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
