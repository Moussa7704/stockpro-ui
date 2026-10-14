import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hook/useAuth'
import { getErrorMessage } from '../../services/api'

export function LoginPage() {
  const { login, verifyTwoFactor } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  // Présent quand le mot de passe est validé mais qu'il faut encore le code 2FA
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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

  async function handleTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
    setCode('')
    setError(null)
  }

  if (challengeToken) {
    return (
      <form className="auth-form" onSubmit={handleTwoFactor}>
        <h1>Vérification</h1>
        <p className="auth-hint">
          Saisissez le code à 6 chiffres de votre application d’authentification, ou un code de secours.
        </p>

        <label className="field">
          <span>Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            inputMode="text"
            autoFocus
            required
          />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Vérification…' : 'Valider'}
        </button>
        <button type="button" className="btn btn-link" onClick={backToCredentials}>
          Retour
        </button>
      </form>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleCredentials}>
      <h1>Connexion</h1>

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          required
        />
      </label>

      <label className="field">
        <span>Mot de passe</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Connexion…' : 'Se connecter'}
      </button>

      <p className="auth-switch">
        Pas encore de compte ? <Link to="/register">Créer un compte</Link>
      </p>
    </form>
  )
}
