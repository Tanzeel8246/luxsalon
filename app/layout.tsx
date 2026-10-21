import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { Toaster }                 from 'react-hot-toast'
import { Providers }               from './providers'
import { ServiceWorkerProvider }   from '@/components/providers/ServiceWorkerProvider'
import { ThemeProvider }           from '@/components/providers/ThemeProvider'
import { ErrorBoundary }           from '@/components/ui/ErrorBoundary'
import { validateEnvOrThrow }      from '@/lib/env'
import './globals.css'

// Validate environment variables on server startup
if (typeof window === 'undefined') {
  validateEnvOrThrow()
}

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
})

const playfair = Playfair_Display({
  subsets:  ['latin'],
  variable: '--font-playfair',
  display:  'swap',
})

export const metadata: Metadata = {
  metadataBase:  new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    template: '%s — LuxSalon',
    default:  'LuxSalon — Smart Salon & Groom Center',
  },
  description:   'Premium AI-powered salon management system with smart booking, live queue, and real-time analytics.',
  applicationName: 'LuxSalon',
  keywords:      ['salon', 'booking', 'appointment', 'groom', 'management'],
  authors:       [{ name: 'LuxSalon' }],
  manifest:      '/manifest.json',
  icons: {
    icon:   [
      { url: '/icons/icon-72.png',  sizes: '72x72',   type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple:  [{ url: '/icons/icon-192.png' }],
  },
  openGraph: {
    type:        'website',
    title:       'LuxSalon — Smart Salon & Groom Center',
    description: 'Premium AI-powered salon management',
    siteName:    'LuxSalon',
  },
  twitter: {
    card:  'summary',
    title: 'LuxSalon',
  },
}

export const viewport: Viewport = {
  themeColor:         '#D4AF37',
  colorScheme:        'dark light',
  width:              'device-width',
  initialScale:       1,
  maximumScale:       5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} dark`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} themes={['light', 'dark', 'emerald', 'ruby']}>
            <ServiceWorkerProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
              <Toaster
              position="top-right"
              gutter={8}
              toastOptions={{
                duration: 4000,
                style: {
                  background:   '#1a1a1a',
                  color:        '#ffffff',
                  border:       '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize:     '13px',
                },
                success: { iconTheme: { primary: '#D4AF37', secondary: '#0A0A0A' } },
                error:   { iconTheme: { primary: '#ef4444', secondary: '#0A0A0A' }, duration: 6000 },
              }}
            />
            </ServiceWorkerProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
