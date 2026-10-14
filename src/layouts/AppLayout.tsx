import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../hook/useAuth'

export function AppLayout() {
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="app-brand">StockPro</span>
        <div className="app-user">
          <span>{user?.name}</span>
          <button type="button" className="btn btn-secondary" onClick={handleLogout} disabled={loggingOut}>
            Se déconnecter
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
