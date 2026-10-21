import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-obsidian-950 flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-sm">
        <div className="text-7xl">✂️</div>
        <div>
          <h1 className="text-4xl font-bold text-gold-400 mb-2">404</h1>
          <h2 className="text-xl font-semibold text-white mb-3">Page Not Found</h2>
          <p className="text-sm text-gray-400">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg bg-gold-gradient text-obsidian-950 text-sm font-semibold"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/booking"
            className="px-5 py-2.5 rounded-lg border border-white/15 text-gray-300 text-sm"
          >
            Book Appointment
          </Link>
        </div>
      </div>
    </div>
  )
}
