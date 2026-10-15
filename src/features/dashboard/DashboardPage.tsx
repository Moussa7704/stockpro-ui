import { Card, Descriptions, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { ROLES } from '../../constants/roles'
import { useAuth } from '../../hook/useAuth'

export function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null

  const role = ROLES[user.role]

  return (
    <div className="mx-auto max-w-4xl">
      <Typography.Title level={2}>Bonjour {user.name}</Typography.Title>
      <Card title="Mon profil" extra={<Link to="/account">Gérer mon compte</Link>}>
        <Descriptions column={1}>
          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          <Descriptions.Item label="Rôle">
            <Tag color={role.color}>{role.label}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}
