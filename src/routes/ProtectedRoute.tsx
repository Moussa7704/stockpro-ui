import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageLoader } from '../components/FullPageLoader'
import { useAuth } from '../hook/useAuth'

/** Pages réservées aux utilisateurs connectés. */
export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'anonymous') {
    // On mémorise la page demandée pour y revenir après la connexion
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Pages de connexion / inscription : inutiles si on est déjà connecté. */
export function PublicOnlyRoute() {
  const { status } = useAuth()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
