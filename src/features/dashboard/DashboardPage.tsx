import { useAuth } from '../../hook/useAuth'

const ROLE_LABELS = {
  admin: 'Administrateur',
  manager: 'Gestionnaire',
  employee: 'Employé',
} as const

export function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <section className="dashboard">
      <h1>Bonjour {user.name}</h1>
      <dl className="profile">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Rôle</dt>
        <dd>{ROLE_LABELS[user.role]}</dd>
      </dl>
    </section>
  )
}
