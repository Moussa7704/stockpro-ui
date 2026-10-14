import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hook/useAuth'
import { getErrorMessage } from '../../services/api'

interface RegisterValues {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit({ name, email, password }: RegisterValues) {
    setError(null)
    setSubmitting(true)
    try {
      await register(name, email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Typography.Title level={3} className="mb-6">
        Créer un compte
      </Typography.Title>

      {/* Les règles reprennent celles du serveur (registerSchema) pour éviter un aller-retour */}
      <Form<RegisterValues> layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <Form.Item
          name="name"
          label="Nom"
          rules={[
            { required: true, whitespace: true, message: 'Saisissez votre nom' },
            { min: 2, max: 100, message: 'Entre 2 et 100 caractères' },
          ]}
        >
          <Input prefix={<UserOutlined />} size="large" autoComplete="name" autoFocus />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Saisissez votre email' },
            { type: 'email', message: 'Email invalide' },
          ]}
        >
          <Input prefix={<MailOutlined />} size="large" autoComplete="email" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Mot de passe"
          extra="8 caractères minimum"
          rules={[
            { required: true, message: 'Saisissez un mot de passe' },
            { min: 8, message: '8 caractères minimum' },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} size="large" autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirmer le mot de passe"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Confirmez le mot de passe' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue('password') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error('Les mots de passe ne correspondent pas'))
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} size="large" autoComplete="new-password" />
        </Form.Item>

        {error && <Alert type="error" title={error} showIcon className="mb-4" />}

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          Créer mon compte
        </Button>
      </Form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Déjà un compte ? <Link to="/login">Se connecter</Link>
      </p>
    </>
  )
}
