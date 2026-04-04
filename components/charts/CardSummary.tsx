type Props = { data: { name: string; total: number; currency: string }[] }

export default function CardSummary({ data }: Props) {
  if (data.length === 0) return <p className="text-gray-500 text-sm">Sin gastos</p>
  return (
    <div className="space-y-2">
      {data.sort((a, b) => b.total - a.total).map((item, i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-gray-800">
          <span className="text-sm text-gray-200">{item.name}</span>
          <span className="font-semibold text-red-400">${item.total.toLocaleString('es-UY')} {item.currency}</span>
        </div>
      ))}
    </div>
  )
}
