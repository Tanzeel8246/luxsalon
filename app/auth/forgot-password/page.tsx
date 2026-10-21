'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { resetPassword } from '@/lib/auth'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
      toast.success('Password reset email sent!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gold-500/3 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold-gradient flex items-center justify-center mx-auto mb-4 shadow-gold">
            <Scissors size={24} className="text-obsidian-950" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Reset Password</h1>
          <p className="text-sm text-gold-500 mt-1">We will send you a reset link</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-sm p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-green-400">Email sent! Check your inbox to reset your password.</p>
              <Link href="/auth/login" className="block text-gold-400 hover:text-gold-300 transition-colors">
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                prefix={<Mail size={14} />}
                required
                autoComplete="email"
              />

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Send Reset Link
              </Button>
            </form>
          )}

          {!sent && (
            <p className="mt-6 text-center text-sm text-gray-500">
              Remember your password?{' '}
              <Link href="/auth/login" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
                Sign In
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
