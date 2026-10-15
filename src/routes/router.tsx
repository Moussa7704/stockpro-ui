import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AccountPage } from '../features/account/AccountPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { LoginPage } from '../features/auth/LoginPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { VerifyOtpPage } from '../features/auth/VerifyOtpPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { UsersPage } from '../features/users/UsersPage'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from './ProtectedRoute'

export const router = createBrowserRouter([
  {
    // Pas d'inscription publique : les comptes sont créés par un admin (page Utilisateurs)
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
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/account', element: <AccountPage /> },
          {
            element: <RoleRoute roles={['admin']} />,
            children: [{ path: '/users', element: <UsersPage /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
