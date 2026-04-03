'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Props = { data: { label: string; expenses: number; income: number }[] }

export default function MonthlyBarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString('es-UY')}`} />
        <Legend />
        <Bar dataKey="income" name="Ingresos" fill="#34d399" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
