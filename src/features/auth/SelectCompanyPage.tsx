import { LogoutOutlined, ShopOutlined } from '@ant-design/icons'
import { Alert, App, Button, List, Typography } from 'antd'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hook/useAuth'
import { getErrorMessage } from '../../services/api'

/** Membre de plusieurs entreprises : on choisit celle dans laquelle on travaille. */
export function SelectCompanyPage() {
  const { companies, activeCompany, switchCompany, logout } = useAuth()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [busyId, setBusyId] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function handleSelect(companyId: string) {
    setBusyId(companyId)
    try {
      await switchCompany(companyId)
      navigate(from === '/select-company' ? '/' : from, { replace: true })
    } catch (err) {
      message.error(getErrorMessage(err))
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Typography.Title level={3} className="mb-1">
          Choisissez une entreprise
        </Typography.Title>
        <Typography.Text type="secondary">Vous pourrez en changer à tout moment.</Typography.Text>
      </div>

      {companies.length === 0 ? (
        <Alert
          type="warning"
          showIcon
          title="Vous n’êtes membre d’aucune entreprise"
          description="Demandez à un responsable de vous inviter, ou contactez le support."
        />
      ) : (
        <List
          bordered
          dataSource={companies}
          renderItem={(company) => (
            <List.Item
              actions={[
                <Button
                  key="select"
                  type={company.id === activeCompany?.id ? 'default' : 'primary'}
                  loading={busyId === company.id}
                  disabled={busyId !== null && busyId !== company.id}
                  onClick={() => handleSelect(company.id)}
                >
                  {company.id === activeCompany?.id ? 'Actuelle' : 'Choisir'}
                </Button>,
              ]}
            >
              <List.Item.Meta avatar={<ShopOutlined className="text-lg" />} title={company.name} description={company.role.name} />
            </List.Item>
          )}
        />
      )}

      <Button type="link" icon={<LogoutOutlined />} onClick={() => void logout()}>
        Se déconnecter
      </Button>
    </div>
  )
}
