'use client'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Bot, User, Minimize2 } from 'lucide-react'
import { aiService } from '@/services/aiService'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types/modules'

export function ChatBot() {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role:      'assistant',
      content:   "Hi! I'm your LuxSalon AI assistant. I can help with bookings, prices, queue status, or any questions. How can I help you today?",
      timestamp: new Date().toISOString(),
    },
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = {
      role:      'user',
      content:   input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const { data: reply } = await aiService.processChat(userMsg.content, messages)

    const botMsg: ChatMessage = {
      role:      'assistant',
      content:   reply ?? "I'm not sure about that. Would you like me to connect you with a staff member?",
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, botMsg])
    setLoading(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <>
      {/* Floating button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gold-gradient shadow-gold-lg flex items-center justify-center"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X size={22} className="text-obsidian-950" /></motion.div>
            : <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><MessageCircle size={22} className="text-obsidian-950" /></motion.div>
          }
        </AnimatePresence>
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 rounded-2xl border border-white/10 bg-obsidian-900 shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
            style={{ maxHeight: '480px' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-obsidian-900 to-obsidian-950 border-b border-white/10">
              <div className="w-8 h-8 rounded-full bg-gold-gradient flex items-center justify-center">
                <Bot size={16} className="text-obsidian-950" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">LuxSalon AI</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-gray-400">Online</span>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="ml-auto text-gray-500 hover:text-gray-300 transition-colors">
                <Minimize2 size={15} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={12} className="text-gold-400" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-gold-500/20 text-white rounded-br-sm'
                      : 'bg-white/5 text-gray-200 rounded-bl-sm'
                  )}>
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={12} className="text-gray-400" />
                    </div>
                  )}
                </motion.div>
              ))}

              {loading && (
                <div className="flex gap-2 items-start">
                  <div className="w-6 h-6 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center shrink-0">
                    <Bot size={12} className="text-gold-400" />
                  </div>
                  <div className="bg-white/5 rounded-xl px-4 py-2.5 flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 p-3 border-t border-white/10 bg-white/2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything…"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl bg-gold-gradient flex items-center justify-center disabled:opacity-40 transition-opacity"
              >
                <Send size={14} className="text-obsidian-950" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
