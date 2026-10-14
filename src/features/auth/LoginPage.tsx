import { LockOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hook/useAuth'
import { getErrorMessage } from '../../services/api'

interface CredentialsValues {
  email: string
  password: string
}

interface TwoFactorValues {
  code: string
}

export function LoginPage() {
  const { login, verifyTwoFactor } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  // Présent quand le mot de passe est validé mais qu'il faut encore le code 2FA
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleCredentials({ email, password }: CredentialsValues) {
    setError(null)
    setSubmitting(true)
    try {
      const result = await login(email, password)
      if (result.twoFactorRequired) {
        setChallengeToken(result.challengeToken)
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTwoFactor({ code }: TwoFactorValues) {
    if (!challengeToken) return
    setError(null)
    setSubmitting(true)
    try {
      await verifyTwoFactor(challengeToken, code)
      navigate(from, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function backToCredentials() {
    // Le challenge expire au bout de 5 min : on recommence depuis le mot de passe
    setChallengeToken(null)
    setError(null)
  }

  if (challengeToken) {
    return (
      <>
        <Typography.Title level={3} className="mb-1">
          Vérification
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Saisissez le code à 6 chiffres de votre application d’authentification, ou un code de secours.
        </Typography.Paragraph>

        <Form<TwoFactorValues> layout="vertical" onFinish={handleTwoFactor} requiredMark={false}>
          <Form.Item
            name="code"
            label="Code"
            rules={[{ required: true, message: 'Saisissez votre code' }]}
          >
            <Input
              prefix={<SafetyOutlined />}
              size="large"
              autoComplete="one-time-code"
              placeholder="123 456 ou XXXX-XXXX"
              autoFocus
            />
          </Form.Item>

          {error && <Alert type="error" title={error} showIcon className="mb-4" />}

          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            Valider
          </Button>
          <Button type="link" block className="mt-2" onClick={backToCredentials}>
            Retour
          </Button>
        </Form>
      </>
    )
  }

  return (
    <>
      <Typography.Title level={3} className="mb-6">
        Connexion
      </Typography.Title>

      <Form<CredentialsValues> layout="vertical" onFinish={handleCredentials} requiredMark={false}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Saisissez votre email' },
            { type: 'email', message: 'Email invalide' },
          ]}
        >
          <Input prefix={<MailOutlined />} size="large" autoComplete="email" autoFocus />
        </Form.Item>

        <Form.Item
          name="password"
          label="Mot de passe"
          rules={[{ required: true, message: 'Saisissez votre mot de passe' }]}
        >
          <Input.Password prefix={<LockOutlined />} size="large" autoComplete="current-password" />
        </Form.Item>

        {error && <Alert type="error" title={error} showIcon className="mb-4" />}

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          Se connecter
        </Button>
      </Form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Pas encore de compte ? <Link to="/register">Créer un compte</Link>
      </p>
    </>
  )
}
