'use client'
import { useState } from 'react'

type ApiKey = { id: string; name: string; createdAt: string }

export default function ApiKeysClient({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reload = async () => {
    const res = await fetch('/api/apikeys')
    setKeys(await res.json())
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const res = await fetch('/api/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      setNewKey(data.key)
      setName('')
      reload()
    }
  }

  const copy = async () => {
    if (!newKey) return
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const remove = async (id: string) => {
    await fetch('/api/apikeys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    reload()
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="mb-6 pt-2">
        <h1 className="text-xl font-bold mb-1">API Keys</h1>
        <p className="text-sm text-gray-500">Usá estas claves para acceder a tu data desde apps externas.</p>
      </div>

      {newKey && (
        <div className="bg-green-900/40 border border-green-700 rounded-2xl p-4 mb-6">
          <p className="text-sm text-green-400 font-semibold mb-2">API key creada — copiala ahora, no se vuelve a mostrar</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-900 rounded-xl px-3 py-2 text-xs text-green-300 break-all">{newKey}</code>
            <button
              onClick={copy}
              className="shrink-0 bg-green-700 hover:bg-green-600 px-3 py-2 rounded-xl text-sm font-semibold"
            >
              {copied ? '✓ Copiada' : 'Copiar'}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-3 text-xs text-gray-500 hover:text-gray-300">
            Cerrar
          </button>
        </div>
      )}

      <form onSubmit={create} className="bg-gray-800 rounded-2xl p-4 mb-6 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nombre de la key (ej: Notion)"
          className="flex-1 bg-gray-700 rounded-xl px-3 py-2 text-white text-sm"
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl px-4 py-2 text-sm font-semibold shrink-0"
        >
          {loading ? '...' : 'Crear'}
        </button>
      </form>

      <div className="space-y-2">
        {keys.length === 0 && (
          <p className="text-sm text-gray-600 py-2">Sin API keys creadas.</p>
        )}
        {keys.map(k => (
          <div key={k.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-white">{k.name}</p>
              <p className="text-xs text-gray-400">{new Date(k.createdAt).toLocaleDateString('es')}</p>
            </div>
            <button
              onClick={() => remove(k.id)}
              className="text-xs text-red-500 hover:text-red-400"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
