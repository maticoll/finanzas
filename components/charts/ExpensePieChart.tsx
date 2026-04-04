'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Props = { data: { name: string; total: number; color?: string | null }[] }

export default function ExpensePieChart({ data }: Props) {
  if (data.length === 0) return <p className="text-center text-gray-500 py-8">Sin gastos</p>
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie data={data} dataKey="total" nameKey="name" cx="50%" cy="42%" outerRadius="38%">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? `hsl(${i * 37}, 70%, 55%)`} />
          ))}
        </Pie>
        <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString('es-UY')}`} />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
