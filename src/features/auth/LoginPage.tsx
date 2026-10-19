import { LockOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hook/useAuth'
import { getErrorMessage } from '../../services/api'
import type { VerifyOtpState } from './VerifyOtpPage'

interface CredentialsValues {
  email: string
  password: string
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleCredentials({ email, password }: CredentialsValues) {
    setError(null)
    setSubmitting(true)
    try {
      // Mot de passe correct : un code est envoyé par email, on passe à sa vérification
      const challenge = await login(email, password)
      navigate('/verify-otp', { state: { challenge, from } satisfies VerifyOtpState })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Typography.Title level={3} className="mb-1">
        Connexion
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="mb-6">
        Bienvenue ! Connectez-vous pour gérer votre boutique.
      </Typography.Paragraph>

      <Form<CredentialsValues> layout="vertical" onFinish={handleCredentials} requiredMark={false}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Saisissez votre email' },
            { type: 'email', message: 'Email invalide' },
          ]}
        >
          <Input prefix={<MailOutlined />} size="large" autoComplete="email" placeholder="vous@exemple.com" autoFocus />
        </Form.Item>

        <Form.Item
          name="password"
          label="Mot de passe"
          rules={[{ required: true, message: 'Saisissez votre mot de passe' }]}
        >
          <Input.Password prefix={<LockOutlined />} size="large" autoComplete="current-password" />
        </Form.Item>

        <div className="-mt-3 mb-4 text-right text-sm">
          <Link to="/forgot-password">Mot de passe oublié ?</Link>
        </div>

        {error && <Alert type="error" title={error} showIcon className="mb-4" />}

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          Se connecter
        </Button>
      </Form>

      <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        <SafetyCertificateOutlined className="mt-0.5 text-base text-green-700" aria-hidden />
        <span>Connexion protégée : un code vous est envoyé par email à chaque connexion.</span>
      </div>
      <p className="mt-4 mb-0 text-center text-sm text-slate-500">
        Pas encore de compte ? Demandez à un administrateur de vous inviter.
      </p>
    </>
  )
}
