import { MailOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Form, Input, Modal, Select, Typography } from 'antd'
import { useState } from 'react'
import { ROLE_OPTIONS } from '../../constants/roles'
import { getErrorMessage } from '../../services/api'
import * as usersService from '../../services/users.service'
import type { User, UserRole } from '../../types/auth'

interface InviteValues {
  name: string
  email: string
  role: UserRole
}

interface InviteUserModalProps {
  open: boolean
  onCancel: () => void
  onInvited: (user: User) => void
}

/** L'admin ne choisit pas le mot de passe : la personne le définit via le lien reçu par email. */
export function InviteUserModal({ open, onCancel, onInvited }: InviteUserModalProps) {
  const [form] = Form.useForm<InviteValues>()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(values: InviteValues) {
    setError(null)
    setSubmitting(true)
    try {
      const { user } = await usersService.createUser(values)
      form.resetFields()
      onInvited(user)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    setError(null)
    form.resetFields()
    onCancel()
  }

  return (
    <Modal
      title="Inviter un utilisateur"
      open={open}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      okText="Envoyer l’invitation"
      cancelText="Annuler"
      confirmLoading={submitting}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">
        La personne recevra un email pour choisir son mot de passe (lien valable 48 h).
      </Typography.Paragraph>

      <Form<InviteValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        initialValues={{ role: 'employee' }}
      >
        <Form.Item
          name="name"
          label="Nom"
          rules={[
            { required: true, whitespace: true, message: 'Saisissez le nom' },
            { min: 2, max: 100, message: 'Entre 2 et 100 caractères' },
          ]}
        >
          <Input prefix={<UserOutlined />} autoFocus />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Saisissez l’email' },
            { type: 'email', message: 'Email invalide' },
          ]}
        >
          <Input prefix={<MailOutlined />} />
        </Form.Item>

        <Form.Item name="role" label="Rôle" rules={[{ required: true }]}>
          <Select<UserRole> options={ROLE_OPTIONS} />
        </Form.Item>

        {error && <Alert type="error" title={error} showIcon />}
      </Form>
    </Modal>
  )
}
