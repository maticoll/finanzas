type Props = { data: { name: string; emoji?: string | null; total: number; currency: string }[] }

export default function TopCategories({ data }: Props) {
  const max = data[0]?.total ?? 1
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-200">{item.emoji} {item.name}</span>
            <span className="text-red-400">${item.total.toLocaleString('es-UY')} {item.currency}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(item.total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
