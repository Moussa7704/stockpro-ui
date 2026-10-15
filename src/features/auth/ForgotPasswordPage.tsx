import { MailOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Result, Typography } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../../services/api'
import * as authService from '../../services/auth.service'

interface ForgotValues {
  email: string
}

export function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit({ email }: ForgotValues) {
    setError(null)
    setSubmitting(true)
    try {
      await authService.forgotPassword(email)
      setSentTo(email)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  // Le serveur répond pareil que le compte existe ou non : on ne dit jamais "email inconnu"
  if (sentTo) {
    return (
      <Result
        status="success"
        title="Vérifiez vos emails"
        subTitle={`Si un compte existe pour ${sentTo}, un lien de réinitialisation vient d'être envoyé. Il est valable 30 minutes.`}
        extra={<Link to="/login">Retour à la connexion</Link>}
      />
    )
  }

  return (
    <>
      <Typography.Title level={3} className="mb-1">
        Mot de passe oublié
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Saisissez votre email : nous vous enverrons un lien pour choisir un nouveau mot de passe.
      </Typography.Paragraph>

      <Form<ForgotValues> layout="vertical" onFinish={handleSubmit} requiredMark={false}>
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

        {error && <Alert type="error" title={error} showIcon className="mb-4" />}

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          Envoyer le lien
        </Button>
      </Form>

      <p className="mt-6 text-center text-sm">
        <Link to="/login">Retour à la connexion</Link>
      </p>
    </>
  )
}
