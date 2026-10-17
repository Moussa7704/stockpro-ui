import { LockOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Descriptions, Form, Input, Tag, Typography } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../../hook/useAuth'
import { getErrorMessage } from '../../services/api'
import * as authService from '../../services/auth.service'
import { queryKeys } from '../../lib/queryKeys'
import { confirmPasswordRules, newPasswordRules } from '../auth/passwordRules'
import { SessionsCard } from './SessionsCard'

interface ChangePasswordValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function AccountPage() {
  const { user, activeCompany } = useAuth()
  if (!user) return null

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Typography.Title level={2} className="mb-0">
        Mon compte
      </Typography.Title>

      {/* Côte à côte sur grand écran, à la même hauteur ; l'une sous l'autre sur téléphone */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <Card title="Profil" className="h-full">
          <Descriptions column={1}>
            <Descriptions.Item label="Nom">{user.name}</Descriptions.Item>
            <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
            {activeCompany && (
              <Descriptions.Item label={`Rôle chez ${activeCompany.name}`}>
                <Tag color="blue">{activeCompany.role.name}</Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        <ChangePasswordCard />
      </div>

      <SessionsCard />
    </div>
  )
}

function ChangePasswordCard() {
  const [form] = Form.useForm<ChangePasswordValues>()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit({ currentPassword, newPassword }: ChangePasswordValues) {
    setError(null)
    setSubmitting(true)
    try {
      const result = await authService.changePassword({ currentPassword, newPassword })
      message.success(result.message)
      form.resetFields()
      // Les autres appareils viennent d'être déconnectés : la liste se met à jour
      void queryClient.invalidateQueries({ queryKey: queryKeys.account.sessions })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Changer de mot de passe" className="h-full">
      <Typography.Paragraph type="secondary">
        Vos autres appareils seront déconnectés. Vous restez connecté sur celui-ci.
      </Typography.Paragraph>

      <Form<ChangePasswordValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        className="max-w-md"
      >
        <Form.Item
          name="currentPassword"
          label="Mot de passe actuel"
          rules={[{ required: true, message: 'Saisissez votre mot de passe actuel' }]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label="Nouveau mot de passe"
          extra="8 caractères minimum"
          dependencies={['currentPassword']}
          rules={[
            ...newPasswordRules,
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || value !== getFieldValue('currentPassword')
                  ? Promise.resolve()
                  : Promise.reject(new Error('Choisissez un mot de passe différent de l’actuel'))
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirmer le nouveau mot de passe"
          dependencies={['newPassword']}
          rules={confirmPasswordRules('newPassword')}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>

        {error && <Alert type="error" title={error} showIcon className="mb-4" />}

        <Button type="primary" htmlType="submit" loading={submitting}>
          Changer le mot de passe
        </Button>
      </Form>
    </Card>
  )
}
