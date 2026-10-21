'use client'
import { Moon, Sun, Sparkles, Gem } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const THEMES = ['dark', 'light', 'emerald', 'ruby']

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-[34px] h-[34px] rounded-lg bg-white/5" />
  }

  const toggleTheme = () => {
    const currentIndex = THEMES.indexOf(theme || 'dark')
    const nextIndex = (currentIndex + 1) % THEMES.length
    setTheme(THEMES[nextIndex])
  }

  const renderIcon = () => {
    if (theme === 'light') return <Sun size={18} />
    if (theme === 'emerald') return <Sparkles size={18} className="text-emerald-400" />
    if (theme === 'ruby') return <Gem size={18} className="text-rose-400" />
    return <Moon size={18} />
  }

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggleTheme}
      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
      title={`Current Theme: ${theme?.charAt(0).toUpperCase()}${theme?.slice(1)}`}
    >
      {renderIcon()}
    </motion.button>
  )
}
