import { ReloadOutlined } from '@ant-design/icons'
import { Button, Result, Typography } from 'antd'
import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { isOutdatedChunkError } from './chunkErrors'

const RELOADED_KEY = 'stockpro:reloaded-after-update'

function readFlag(): boolean {
  try {
    return sessionStorage.getItem(RELOADED_KEY) === '1'
  } catch {
    return false
  }
}

function writeFlag(value: boolean) {
  try {
    if (value) sessionStorage.setItem(RELOADED_KEY, '1')
    else sessionStorage.removeItem(RELOADED_KEY)
  } catch {
    // stockage indisponible (navigation privée) : on recharge quand même une fois
  }
}

/** Erreur dans un écran : message clair à la place de la page d'erreur technique de React Router. */
export function RouteError() {
  const error = useRouteError()
  const outdated = isOutdatedChunkError(error)
  // Une seule tentative automatique : si l'erreur revient après rechargement, on l'affiche
  const shouldReload = outdated && !readFlag()

  useEffect(() => {
    if (shouldReload) {
      writeFlag(true)
      window.location.reload()
    } else {
      writeFlag(false)
    }
  }, [shouldReload])

  if (shouldReload) return null

  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : String(error)
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <Result
        status={outdated ? 'info' : 'error'}
        title={outdated ? 'Une nouvelle version de StockPro est disponible' : 'Une erreur est survenue'}
        subTitle={outdated ? 'Rechargez la page pour continuer.' : 'Rechargez la page. Si le problème revient, contactez le support en indiquant le message ci-dessous.'}
        extra={
          <div className="flex flex-col items-center gap-3">
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
              Recharger la page
            </Button>
            {!outdated && (
              <Typography.Text type="secondary" code className="text-xs">
                {detail}
              </Typography.Text>
            )}
          </div>
        }
      />
    </div>
  )
}
