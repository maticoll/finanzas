'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', icon: '🏠', label: 'Inicio' },
  { href: '/transacciones/nueva', icon: '➕', label: 'Nueva' },
  { href: '/reportes', icon: '📊', label: 'Reportes' },
  { href: '/tarjetas', icon: '💳', label: 'Tarjetas' },
  { href: '/extractos', icon: '📄', label: 'Extractos' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="bg-gray-900 border-t border-gray-800 md:hidden flex-shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex justify-around items-center h-16">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs ${
              pathname === item.href ? 'text-indigo-400' : 'text-gray-500'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
