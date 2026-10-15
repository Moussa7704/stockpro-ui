import { LockOutlined } from '@ant-design/icons'
import { Alert, App, Button, Form, Input, Result, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FullPageLoader } from '../../components/FullPageLoader'
import { getErrorMessage } from '../../services/api'
import * as authService from '../../services/auth.service'
import type { PasswordTokenInfo } from '../../types/auth'
import { newPasswordRules, confirmPasswordRules } from './passwordRules'

interface ResetValues {
  password: string
  confirmPassword: string
}

/**
 * Page ouverte depuis un lien reçu par email : /reset-password?token=…
 * Sert à la fois à l'invitation (premier mot de passe) et au mot de passe oublié.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  if (!token) {
    return <InvalidLink message="Ce lien est incomplet." />
  }
  // key : un autre lien ouvert dans le même onglet recharge bien les informations
  return <ResetPasswordForm key={token} token={token} />
}

function ResetPasswordForm({ token }: { token: string }) {
  const navigate = useNavigate()
  const { message } = App.useApp()

  const [info, setInfo] = useState<PasswordTokenInfo | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // On vérifie le lien avant d'afficher le formulaire : inutile de taper un mot de passe pour rien
  useEffect(() => {
    let cancelled = false
    authService
      .checkPasswordToken(token)
      .then((result) => !cancelled && setInfo(result))
      .catch((err: unknown) => !cancelled && setLinkError(getErrorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit({ password }: ResetValues) {
    setError(null)
    setSubmitting(true)
    try {
      await authService.resetPassword({ token, password })
      message.success('Mot de passe enregistré, vous pouvez vous connecter')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  if (linkError) return <InvalidLink message={linkError} />
  if (!info) return <FullPageLoader />

  const isInvite = info.purpose === 'invite'

  return (
    <>
      <Typography.Title level={3} className="mb-1">
        {isInvite ? `Bienvenue ${info.name}` : 'Nouveau mot de passe'}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {isInvite
          ? 'Choisissez le mot de passe de votre compte StockPro pour l’activer.'
          : 'Choisissez un nouveau mot de passe. Vous serez déconnecté de tous vos appareils.'}
      </Typography.Paragraph>

      <Form<ResetValues> layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        {/* Aide les gestionnaires de mots de passe à associer le mot de passe au bon compte */}
        <input type="email" value={info.email} autoComplete="username" readOnly hidden />

        <Form.Item name="password" label="Mot de passe" extra="8 caractères minimum" rules={newPasswordRules}>
          <Input.Password prefix={<LockOutlined />} size="large" autoComplete="new-password" autoFocus />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirmer le mot de passe"
          dependencies={['password']}
          rules={confirmPasswordRules('password')}
        >
          <Input.Password prefix={<LockOutlined />} size="large" autoComplete="new-password" />
        </Form.Item>

        {error && <Alert type="error" title={error} showIcon className="mb-4" />}

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          {isInvite ? 'Activer mon compte' : 'Enregistrer'}
        </Button>
      </Form>
    </>
  )
}

function InvalidLink({ message }: { message: string }) {
  return (
    <Result
      status="warning"
      title="Lien invalide ou expiré"
      subTitle={`${message} Les liens ne servent qu'une fois et expirent (30 min pour une réinitialisation, 48 h pour une invitation).`}
      extra={[
        <Link key="forgot" to="/forgot-password">
          Demander un nouveau lien
        </Link>,
        <Link key="login" to="/login" className="ml-4">
          Connexion
        </Link>,
      ]}
    />
  )
}
