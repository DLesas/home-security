'use client'

import { Button } from '@nextui-org/button'
import { FaPlus } from 'react-icons/fa6'
import { motion } from 'framer-motion'

interface FloatingActionButtonProps {
  onPress: () => void
  label?: string
}

export function FloatingActionButton({ onPress, label = 'Add' }: FloatingActionButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="fixed bottom-8 right-8 z-50"
    >
      <Button
        isIconOnly
        color="primary"
        size="lg"
        className="w-14 h-14 shadow-lg hover:shadow-xl transition-shadow"
        onPress={onPress}
        aria-label={label}
      >
        <FaPlus size={20} />
      </Button>
    </motion.div>
  )
}
