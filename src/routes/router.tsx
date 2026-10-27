import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { PlatformLayout } from '../layouts/PlatformLayout'
import { CompanyRoute, PermissionRoute, PlatformRoute, ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute'
import { lazyPage } from './lazyPage'
import { RouteError } from './RouteError'

// Un fichier par écran, téléchargé à sa première ouverture (layouts et gardes restent dans le
// fichier principal : en-tête et menu s'affichent tout de suite)
const AccountPage = lazyPage(() => import('../features/account/AccountPage'), 'AccountPage')
const AuditLogPage = lazyPage(() => import('../features/audit/AuditLogPage'), 'AuditLogPage')
const CategoriesPage = lazyPage(() => import('../features/catalog/CategoriesPage'), 'CategoriesPage')
const ProductImportPage = lazyPage(() => import('../features/catalog/ProductImportPage'), 'ProductImportPage')
const ProductsPage = lazyPage(() => import('../features/catalog/ProductsPage'), 'ProductsPage')
const SuppliersPage = lazyPage(() => import('../features/catalog/SuppliersPage'), 'SuppliersPage')
const UnitsPage = lazyPage(() => import('../features/catalog/UnitsPage'), 'UnitsPage')
const ForgotPasswordPage = lazyPage(() => import('../features/auth/ForgotPasswordPage'), 'ForgotPasswordPage')
const LoginPage = lazyPage(() => import('../features/auth/LoginPage'), 'LoginPage')
const ResetPasswordPage = lazyPage(() => import('../features/auth/ResetPasswordPage'), 'ResetPasswordPage')
const SelectCompanyPage = lazyPage(() => import('../features/auth/SelectCompanyPage'), 'SelectCompanyPage')
const VerifyOtpPage = lazyPage(() => import('../features/auth/VerifyOtpPage'), 'VerifyOtpPage')
const DashboardPage = lazyPage(() => import('../features/dashboard/DashboardPage'), 'DashboardPage')
const MembersPage = lazyPage(() => import('../features/members/MembersPage'), 'MembersPage')
const CustomerPage = lazyPage(() => import('../features/customers/CustomerPage'), 'CustomerPage')
const CustomersPage = lazyPage(() => import('../features/customers/CustomersPage'), 'CustomersPage')
const DebtorsPage = lazyPage(() => import('../features/customers/DebtorsPage'), 'DebtorsPage')
const ExpensesPage = lazyPage(() => import('../features/expenses/ExpensesPage'), 'ExpensesPage')
const PosPage = lazyPage(() => import('../features/pos/PosPage'), 'PosPage')
const SalesPage = lazyPage(() => import('../features/pos/SalesPage'), 'SalesPage')
const InvoicesPage = lazyPage(() => import('../features/purchases/InvoicesPage'), 'InvoicesPage')
const OrdersPage = lazyPage(() => import('../features/purchases/OrdersPage'), 'OrdersPage')
const ReceiptsPage = lazyPage(() => import('../features/purchases/ReceiptsPage'), 'ReceiptsPage')
const ReturnsPage = lazyPage(() => import('../features/purchases/ReturnsPage'), 'ReturnsPage')
const ReportsPage = lazyPage(() => import('../features/reports/ReportsPage'), 'ReportsPage')
const RolesPage = lazyPage(() => import('../features/roles/RolesPage'), 'RolesPage')
const SettingsPage = lazyPage(() => import('../features/settings/SettingsPage'), 'SettingsPage')
const AdjustmentsPage = lazyPage(() => import('../features/stock/AdjustmentsPage'), 'AdjustmentsPage')
const InventoriesPage = lazyPage(() => import('../features/stock/InventoriesPage'), 'InventoriesPage')
const InventoryPage = lazyPage(() => import('../features/stock/InventoryPage'), 'InventoryPage')
const MovementsPage = lazyPage(() => import('../features/stock/MovementsPage'), 'MovementsPage')
const StockLevelsPage = lazyPage(() => import('../features/stock/StockLevelsPage'), 'StockLevelsPage')
const TransfersPage = lazyPage(() => import('../features/stock/TransfersPage'), 'TransfersPage')
const PlatformCompaniesPage = lazyPage(() => import('../features/platform/PlatformCompaniesPage'), 'PlatformCompaniesPage')
const PlatformCompanyPage = lazyPage(() => import('../features/platform/PlatformCompanyPage'), 'PlatformCompanyPage')

// Exportées seules : les tests les montent dans un routeur en mémoire (createMemoryRouter)
export const routes: RouteObject[] = [
  {
    // Erreur dans n'importe quel écran (y compris un fichier d'écran introuvable après une mise à
    // jour) : page claire en français au lieu de la page technique de React Router
    errorElement: <RouteError />,
    children: [
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
            // Back-office de la plateforme : hors entreprise (un super-admin peut n'être membre de rien)
            element: <PlatformRoute />,
            children: [
              {
                element: <PlatformLayout />,
                children: [
                  { path: '/platform', element: <PlatformCompaniesPage /> },
                  { path: '/platform/companies/:id', element: <PlatformCompanyPage /> },
                ],
              },
            ],
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
                  {
                    element: <PermissionRoute permission="products.manage" />,
                    children: [{ path: '/products/import', element: <ProductImportPage /> }],
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
                  // Caisse : vendre (sales.create) dans une session ouverte (cash_sessions.manage)
                  {
                    element: <PermissionRoute permission="sales.create" />,
                    children: [
                      { path: '/pos', element: <PosPage /> },
                      { path: '/pos/sales', element: <SalesPage /> },
                    ],
                  },
                  // Clients et finances
                  {
                    element: <PermissionRoute permission="customers.manage" />,
                    children: [
                      { path: '/customers', element: <CustomersPage /> },
                      { path: '/customers/:id', element: <CustomerPage /> },
                    ],
                  },
                  {
                    element: <PermissionRoute permission="reports.view" />,
                    children: [
                      { path: '/debtors', element: <DebtorsPage /> },
                      { path: '/reports', element: <ReportsPage /> },
                    ],
                  },
                  {
                    element: <PermissionRoute permission="expenses.manage" />,
                    children: [{ path: '/expenses', element: <ExpensesPage /> }],
                  },
                  // Achats : commandes, réceptions et retours avec purchases.manage
                  {
                    element: <PermissionRoute permission="purchases.manage" />,
                    children: [
                      { path: '/purchases/orders', element: <OrdersPage /> },
                      { path: '/purchases/receipts', element: <ReceiptsPage /> },
                      { path: '/purchases/returns', element: <ReturnsPage /> },
                    ],
                  },
                  // Factures et paiements fournisseurs : supplier_payments.manage (comptable, gérant…)
                  {
                    element: <PermissionRoute permission="supplier_payments.manage" />,
                    children: [{ path: '/purchases/invoices', element: <InvoicesPage /> }],
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
    ],
  },
]

export const router = createBrowserRouter(routes)
