import { ReloadOutlined } from '@ant-design/icons'
import { Button, Result } from 'antd'
import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { restoreSession } from '../store/authSlice'

const RETRY_SECONDS = 15

/**
 * Le serveur n'a pas pu vérifier la session au démarrage (réseau, serveur arrêté, trop de
 * requêtes). La session est peut-être toujours valide : on ne renvoie pas vers la connexion,
 * on réessaie tout seul toutes les 15 secondes, ou tout de suite avec le bouton.
 */
export function ServerUnavailable() {
  const dispatch = useAppDispatch()
  const error = useAppSelector((state) => state.auth.error)
  const [seconds, setSeconds] = useState(RETRY_SECONDS)

  useEffect(() => {
    if (seconds <= 0) {
      void dispatch(restoreSession())
      return
    }
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds, dispatch])

  return (
    <div className="flex h-full items-center justify-center px-4">
      <Result
        status="warning"
        title="Serveur injoignable"
        subTitle={
          <>
            {error ?? 'Impossible de joindre le serveur.'}
            <br />
            Votre session n’est pas perdue. Nouvel essai dans {seconds} s.
          </>
        }
        extra={
          <Button type="primary" icon={<ReloadOutlined />} onClick={() => void dispatch(restoreSession())}>
            Réessayer maintenant
          </Button>
        }
      />
    </div>
  )
}
