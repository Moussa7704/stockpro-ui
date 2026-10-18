import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../lib/queryClient'
import { makeStore } from '../store'
import { Providers } from '../test/Providers'
import { isOutdatedChunkError } from './chunkErrors'
import { RouteError } from './RouteError'

function renderFailing(error: Error) {
  const Failing = () => {
    throw error
  }
  const router = createMemoryRouter([{ errorElement: <RouteError />, children: [{ path: '/', element: <Failing /> }] }])
  const queryClient = createQueryClient()
  render(
    <Providers store={makeStore({ queryClient })} queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  )
}

describe('Page d’erreur des écrans', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('reconnaît un fichier d’écran disparu après une mise à jour (Chrome, Safari, Firefox)', () => {
    expect(isOutdatedChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/PosPage-a1.js'))).toBe(true)
    expect(isOutdatedChunkError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isOutdatedChunkError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isOutdatedChunkError(new TypeError('O is not a function'))).toBe(false)
  })

  it('erreur d’un écran : message en français, détail pour le support, bouton recharger', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderFailing(new TypeError('O is not a function'))

    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument()
    expect(screen.getByText('O is not a function')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Recharger la page/ })).toBeInTheDocument()
    expect(screen.queryByText(/Hey developer/)).not.toBeInTheDocument()
  })

  it('nouvelle version : recharge tout seul une fois, puis affiche le message si ça recommence', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload })
    const outdated = new TypeError('Failed to fetch dynamically imported module: /assets/PosPage-a1.js')

    renderFailing(outdated)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('après un rechargement déjà tenté : message « nouvelle version » sans boucle', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload })
    sessionStorage.setItem('stockpro:reloaded-after-update', '1')

    renderFailing(new TypeError('Failed to fetch dynamically imported module: /assets/PosPage-a1.js'))

    expect(screen.getByText('Une nouvelle version de StockPro est disponible')).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })
})
