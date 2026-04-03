'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type Props = { data: Record<string, number> }

export default function BalanceLine({ data }: Props) {
  const chartData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, delta]) => ({ date: date.slice(5), delta }))

  // Acumular
  let running = 0
  const accumulated = chartData.map(d => { running += d.delta; return { date: d.date, balance: running } })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={accumulated}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString('es-UY')}`} />
        <Line type="monotone" dataKey="balance" stroke="#818cf8" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
