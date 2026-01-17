import React, { useState, useCallback, memo } from "react"
import { Plus, Minus } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const AccordionBorderItem = memo(({ title, content, isActive, onClick }) => {
  return (
    <div className="border-b dark:border-b-slate-700 last:border-b-0">
      <motion.button
        className="w-full p-4 text-left bg-white dark:bg-gray-800 focus:outline-none transition-colors duration-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        onClick={onClick}
        aria-expanded={isActive}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</div>
          <motion.div
            initial={false}
            animate={{ rotate: isActive ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isActive ? (
              <Minus size={14} className="text-gray-800 dark:text-gray-200" />
            ) : (
              <Plus size={14} className="text-gray-800 dark:text-gray-200" />
            )}
          </motion.div>
        </div>
      </motion.button>
      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="p-4 bg-gray-50 dark:bg-gray-700">
              <div className="text-sm text-gray-700 dark:text-gray-300">{content}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

AccordionBorderItem.displayName = "AccordionBorderItem"

const AccordionBorder = ({ items }) => {
  const [activeIndex, setActiveIndex] = useState(null)

  const toggleAccordion = useCallback((index) => {
    setActiveIndex((prevIndex) => (prevIndex === index ? null : index))
  }, [])

  return (
    <motion.div
      className="w-full border rounded-lg overflow-hidden shadow-sm dark:border-gray-700"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {items.map((item, index) => (
        <AccordionBorderItem
          key={item.id || index}
          title={item.title}
          content={item.content}
          isActive={activeIndex === index}
          onClick={() => toggleAccordion(index)}
        />
      ))}
    </motion.div>
  )
}

export default memo(AccordionBorder)
