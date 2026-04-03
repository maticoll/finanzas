import ReportesClient from './ReportesClient'

export default function ReportesPage() {
  const now = new Date()
  return <ReportesClient initialMonth={now.getMonth() + 1} initialYear={now.getFullYear()} />
}
