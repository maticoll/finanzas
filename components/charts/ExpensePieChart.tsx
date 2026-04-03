'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Props = { data: { name: string; total: number; color?: string | null }[] }

export default function ExpensePieChart({ data }: Props) {
  if (data.length === 0) return <p className="text-center text-gray-500 py-8">Sin gastos</p>
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? `hsl(${i * 37}, 70%, 55%)`} />
          ))}
        </Pie>
        <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString('es-UY')}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
