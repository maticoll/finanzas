'use client'

export default function Error({ error }: { error: Error }) {
  return (
    <div className="p-8 text-red-400">
      <h1 className="text-xl font-bold mb-2">Error</h1>
      <pre className="text-sm bg-gray-900 p-4 rounded overflow-auto">{error.message}</pre>
    </div>
  )
}
