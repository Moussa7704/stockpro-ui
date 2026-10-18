import { Card } from 'antd'
import { Outlet } from 'react-router-dom'
import { PageSuspense } from '../components/PageSuspense'

export function AuthLayout() {
  return (
    <main className="flex min-h-full items-center justify-center bg-linear-to-br from-indigo-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-2xl font-bold tracking-tight text-brand">StockPro</p>
        <Card className="shadow-lg">
          <PageSuspense>
            <Outlet />
          </PageSuspense>
        </Card>
      </div>
    </main>
  )
}
