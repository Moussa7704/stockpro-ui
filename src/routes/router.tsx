import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AccountPage } from '../features/account/AccountPage'
import { AuditLogPage } from '../features/audit/AuditLogPage'
import { CategoriesPage } from '../features/catalog/CategoriesPage'
import { ProductsPage } from '../features/catalog/ProductsPage'
import { SuppliersPage } from '../features/catalog/SuppliersPage'
import { UnitsPage } from '../features/catalog/UnitsPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { LoginPage } from '../features/auth/LoginPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { SelectCompanyPage } from '../features/auth/SelectCompanyPage'
import { VerifyOtpPage } from '../features/auth/VerifyOtpPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { MembersPage } from '../features/members/MembersPage'
import { RolesPage } from '../features/roles/RolesPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AdjustmentsPage } from '../features/stock/AdjustmentsPage'
import { InventoriesPage } from '../features/stock/InventoriesPage'
import { InventoryPage } from '../features/stock/InventoryPage'
import { MovementsPage } from '../features/stock/MovementsPage'
import { StockLevelsPage } from '../features/stock/StockLevelsPage'
import { TransfersPage } from '../features/stock/TransfersPage'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { CompanyRoute, PermissionRoute, ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute'

// Exportées seules : les tests les montent dans un routeur en mémoire (createMemoryRouter)
export const routes: RouteObject[] = [
  {
    // Pas d'inscription publique : le propriétaire invite son équipe (page Équipe)
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/verify-otp', element: <VerifyOtpPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
    ],
  },
  {
    // Lien reçu par email : accessible même connecté (ex. un admin qui teste une invitation)
    element: <AuthLayout />,
    children: [{ path: '/reset-password', element: <ResetPasswordPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        // Membre de plusieurs entreprises : choix de l'entreprise active
        element: <AuthLayout />,
        children: [{ path: '/select-company', element: <SelectCompanyPage /> }],
      },
      {
        element: <CompanyRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <DashboardPage /> },
              { path: '/account', element: <AccountPage /> },
              // Catalogue : unités et catégories lisibles par tout membre, produits et fournisseurs avec products.view
              { path: '/units', element: <UnitsPage /> },
              { path: '/categories', element: <CategoriesPage /> },
              {
                element: <PermissionRoute permission="products.view" />,
                children: [
                  { path: '/products', element: <ProductsPage /> },
                  { path: '/suppliers', element: <SuppliersPage /> },
                ],
              },
              // Stock : consultation avec stock.view (les actions sont réservées dans chaque écran)
              {
                element: <PermissionRoute permission="stock.view" />,
                children: [
                  { path: '/stock', element: <StockLevelsPage /> },
                  { path: '/stock/movements', element: <MovementsPage /> },
                  { path: '/stock/adjustments', element: <AdjustmentsPage /> },
                  { path: '/stock/transfers', element: <TransfersPage /> },
                  { path: '/stock/inventories', element: <InventoriesPage /> },
                  { path: '/stock/inventories/:id', element: <InventoryPage /> },
                ],
              },
              {
                element: <PermissionRoute permission="users.manage" />,
                children: [{ path: '/members', element: <MembersPage /> }],
              },
              {
                element: <PermissionRoute permission="roles.manage" />,
                children: [{ path: '/roles', element: <RolesPage /> }],
              },
              {
                element: <PermissionRoute permission="company.manage" />,
                children: [{ path: '/settings', element: <SettingsPage /> }],
              },
              {
                element: <PermissionRoute permission="audit.view" />,
                children: [{ path: '/audit', element: <AuditLogPage /> }],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
