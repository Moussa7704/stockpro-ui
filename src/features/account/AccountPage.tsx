import { LockOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Descriptions, Form, Input, Tag, Typography } from 'antd'
import { useState } from 'react'
import { ROLES } from '../../constants/roles'
import { useAuth } from '../../hook/useAuth'
import { getErrorMessage } from '../../services/api'
import * as authService from '../../services/auth.service'
import { confirmPasswordRules, newPasswordRules } from '../auth/passwordRules'

interface ChangePasswordValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function AccountPage() {
  const { user } = useAuth()
  if (!user) return null

  const role = ROLES[user.role]

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Typography.Title level={2} className="mb-0">
        Mon compte
      </Typography.Title>

      <Card title="Profil">
        <Descriptions column={1}>
          <Descriptions.Item label="Nom">{user.name}</Descriptions.Item>
          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          <Descriptions.Item label="Rôle">
            <Tag color={role.color}>{role.label}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <ChangePasswordCard />
    </div>
  )
}

function ChangePasswordCard() {
  const [form] = Form.useForm<ChangePasswordValues>()
  const { message } = App.useApp()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit({ currentPassword, newPassword }: ChangePasswordValues) {
    setError(null)
    setSubmitting(true)
    try {
      const result = await authService.changePassword({ currentPassword, newPassword })
      message.success(result.message)
      form.resetFields()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Changer de mot de passe">
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
