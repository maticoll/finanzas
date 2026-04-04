import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Finanzas',
  description: 'App de finanzas personales',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

const NAV_ITEMS = [
  { href: '/', icon: '🏠', label: 'Dashboard' },
  { href: '/transacciones/nueva', icon: '➕', label: 'Nueva transacción' },
  { href: '/reportes', icon: '📊', label: 'Reportes' },
  { href: '/tarjetas', icon: '💳', label: 'Tarjetas' },
  { href: '/extractos', icon: '📄', label: 'Extractos' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-950 text-gray-100 h-screen overflow-hidden flex flex-col`}>
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar desktop */}
          <aside className="hidden md:flex flex-col w-56 bg-gray-900 border-r border-gray-800 p-4 gap-1 flex-shrink-0">
            <div className="text-xl font-bold text-indigo-400 mb-6 px-2">💰 Finanzas</div>
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </aside>
          {/* Main content scrolls here */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
