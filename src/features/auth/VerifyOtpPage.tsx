import { MailOutlined } from '@ant-design/icons'
import { Alert, App, Button, Input, Typography } from 'antd'
import type { OTPRef } from 'antd/es/input/OTP'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { OtpChallenge } from '../../context/AuthContext'
import { useAuth } from '../../hook/useAuth'
import { getErrorMessage } from '../../services/api'

/** Données transmises par la page de connexion (ou d'inscription) via navigate(..., { state }). */
export interface VerifyOtpState {
  challenge: OtpChallenge
  from?: string
}

// Même délai que le serveur entre deux envois
const RESEND_COOLDOWN_SECONDS = 60

export function VerifyOtpPage() {
  const state = useLocation().state as VerifyOtpState | null

  // Arrivée directe sur l'URL ou page rechargée : pas de challenge, on recommence la connexion
  if (!state?.challenge) {
    return <Navigate to="/login" replace />
  }
  return <VerifyOtpForm challenge={state.challenge} from={state.from ?? '/'} />
}

function VerifyOtpForm({ challenge, from }: { challenge: OtpChallenge; from: string }) {
  const { verifyOtp, resendOtp } = useAuth()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const otpRef = useRef<OTPRef>(null)

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  // Changer la clé recrée le champ : les 6 cases sont vidées
  const [otpKey, setOtpKey] = useState(0)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  // Curseur dans la première case à l'arrivée et après chaque remise à zéro
  useEffect(() => {
    otpRef.current?.focus()
  }, [otpKey])

  // Compte à rebours avant de pouvoir redemander un code
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // Appelé par Input.OTP quand les 6 chiffres sont saisis : validation automatique
  async function handleComplete(code: string) {
    setError(null)
    setSubmitting(true)
    try {
      await verifyOtp(challenge.challengeToken, code)
      navigate(from, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
      setOtpKey((key) => key + 1)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setError(null)
    setResending(true)
    try {
      await resendOtp(challenge.challengeToken)
      message.success(`Nouveau code envoyé à ${challenge.sentTo}`)
      setCooldown(RESEND_COOLDOWN_SECONDS)
      setOtpKey((key) => key + 1)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  const minutes = Math.round(challenge.expiresInSeconds / 60)

  return (
    <>
      <Typography.Title level={3} className="mb-1">
        Vérifiez vos emails
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        <MailOutlined /> Un code à 6 chiffres a été envoyé à <strong>{challenge.sentTo}</strong>.
        Il expire dans {minutes} minutes.
      </Typography.Paragraph>

      <div className="my-6 flex justify-center">
        <Input.OTP
          key={otpKey}
          ref={otpRef}
          length={6}
          size="large"
          disabled={submitting}
          autoComplete="one-time-code"
          // Uniquement des chiffres (un collage "123 456" donne bien 123456)
          formatter={(value) => value.replace(/\D/g, '')}
          onChange={handleComplete}
          aria-label="Code de vérification"
        />
      </div>

      {submitting && (
        <Typography.Paragraph type="secondary" className="text-center">
          Vérification…
        </Typography.Paragraph>
      )}

      {error && <Alert type="error" title={error} showIcon className="mb-4" />}

      <Button
        type="link"
        block
        disabled={cooldown > 0 || submitting}
        loading={resending}
        onClick={handleResend}
      >
        {cooldown > 0 ? `Renvoyer le code dans ${cooldown} s` : 'Renvoyer le code'}
      </Button>

      <p className="mt-4 text-center text-sm text-slate-500">
        Mauvaise adresse ? <Link to="/login">Changer de compte</Link>
      </p>
    </>
  )
}
