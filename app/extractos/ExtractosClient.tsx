'use client'
import { useState, useEffect } from 'react'

type Card = { id: string; name: string; bank: string | null; type: string }
type Result = { saved: number; skipped: number }

export default function ExtractosClient() {
  const [cards, setCards] = useState<Card[]>([])
  const [cardId, setCardId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/cards')
      .then(r => r.json())
      .then((data: Card[]) => {
        setCards(data)
        if (data.length > 0) setCardId(data[0].id)
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !cardId) return

    setLoading(true)
    setResult(null)
    setError(null)

    const formData = new FormData()
    formData.append('cardId', cardId)
    formData.append('file', file)

    try {
      const res = await fetch('/api/extractos', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error desconocido')
      } else {
        setResult(data)
      }
    } catch {
      setError('Error de red. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="pt-2 mb-6">
        <h1 className="text-xl font-bold">Importar extracto</h1>
        <p className="text-sm text-gray-500 mt-1">Subí el PDF del extracto Itaú para importar tus gastos automáticamente.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Selector de tarjeta */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tarjeta</label>
          <select
            value={cardId}
            onChange={e => setCardId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            required
          >
            {cards.map(card => (
              <option key={card.id} value={card.id}>
                {card.name} {card.bank ? `· ${card.bank}` : ''} ({card.type})
              </option>
            ))}
          </select>
        </div>

        {/* Upload PDF */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Archivo PDF</label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm file:mr-3 file:bg-indigo-600 file:text-white file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-xs focus:outline-none focus:border-indigo-500"
            required
          />
          {file && <p className="text-xs text-gray-500 mt-1">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
        </div>

        <button
          type="submit"
          disabled={loading || !file || !cardId}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl py-3 text-sm font-semibold transition-colors"
        >
          {loading ? 'Procesando...' : 'Procesar extracto'}
        </button>
      </form>

      {/* Resultado */}
      {result && (
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <h2 className="font-semibold mb-3 text-green-400">✅ Extracto procesado</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Transacciones guardadas</span>
              <span className="font-semibold text-green-400">{result.saved}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duplicadas ignoradas</span>
              <span className="font-semibold text-gray-500">{result.skipped}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 bg-red-950 border border-red-800 rounded-2xl p-4">
          <p className="text-sm text-red-400">⚠️ {error}</p>
        </div>
      )}
    </div>
  )
}
