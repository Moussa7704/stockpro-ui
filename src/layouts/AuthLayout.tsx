import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <main className="auth-layout">
      <div className="auth-card">
        <p className="auth-brand">StockPro</p>
        <Outlet />
      </div>
    </main>
  )
}
