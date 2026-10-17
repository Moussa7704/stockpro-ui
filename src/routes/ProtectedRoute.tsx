import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageLoader } from '../components/FullPageLoader'
import { ServerUnavailable } from '../components/ServerUnavailable'
import { useAuth } from '../hook/useAuth'
import type { Permission } from '../types/access'

/** Pages réservées aux utilisateurs connectés. */
export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />
  // Session non vérifiée (serveur injoignable) : surtout pas la page de connexion
  if (status === 'unavailable') return <ServerUnavailable />
  if (status === 'anonymous') {
    // On mémorise la page demandée pour y revenir après la connexion
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/**
 * Pages qui travaillent dans une entreprise (à placer sous ProtectedRoute) :
 * membre de plusieurs entreprises → il faut d'abord en choisir une.
 */
export function CompanyRoute() {
  const { user, companies, activeCompany } = useAuth()
  const location = useLocation()

  // Super-admin membre d'aucune entreprise : son espace, c'est le back-office
  if (!activeCompany && user?.isPlatformAdmin && companies.length === 0) return <Navigate to="/platform" replace />
  if (!activeCompany) return <Navigate to="/select-company" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/**
 * Pages réservées à une permission (à placer sous CompanyRoute).
 * Confort d'affichage uniquement : la vraie protection est côté API (requirePermission).
 */
export function PermissionRoute({ permission }: { permission: Permission }) {
  const { can } = useAuth()

  if (!can(permission)) return <Navigate to="/" replace />
  return <Outlet />
}

/**
 * Back-office de la plateforme (à placer sous ProtectedRoute, hors CompanyRoute) : réservé à
 * l'administrateur SaaS. Confort d'affichage : l'API refuse de toute façon (requirePlatformAdmin).
 */
export function PlatformRoute() {
  const { user } = useAuth()

  if (!user?.isPlatformAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

/** Pages de connexion : inutiles si on est déjà connecté. */
export function PublicOnlyRoute() {
  const { status } = useAuth()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'unavailable') return <ServerUnavailable />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
