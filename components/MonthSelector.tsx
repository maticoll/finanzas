'use client'

type Props = {
  month: number
  year: number
  onChange: (month: number, year: number) => void
}

export default function MonthSelector({ month, year, onChange }: Props) {
  const prev = () => {
    if (month === 1) onChange(12, year - 1)
    else onChange(month - 1, year)
  }
  const next = () => {
    const now = new Date()
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return
    if (month === 12) onChange(1, year + 1)
    else onChange(month + 1, year)
  }
  const label = new Date(year, month - 1).toLocaleString('es', { month: 'long', year: 'numeric' })
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button onClick={prev} className="text-2xl text-gray-400 hover:text-white px-2">‹</button>
      <span className="capitalize font-semibold">{label}</span>
      <button onClick={next} className="text-2xl text-gray-400 hover:text-white px-2">›</button>
    </div>
  )
}
