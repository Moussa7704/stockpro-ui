import { screen, within } from '@testing-library/react'
import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { getAccessToken } from '../services/api'
import { meResponse, shopsFixture } from '../test/fixtures'
import { renderApp } from '../test/render'
import { server } from '../test/server'
import { restoreSession } from '../store/authSlice'

// L'en-tête charge la liste des boutiques sur toutes les pages connectées
const shopsHandler = () => mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture }))

describe('Connexion de bout en bout', () => {
  it('email + mot de passe, puis code reçu par email → tableau de bord', async () => {
    let otpBody: unknown = null
    server.use(
      shopsHandler(),
      mock.post('/api/auth/login', () =>
        HttpResponse.json({ otpRequired: true, challengeToken: 'challenge-1', sentTo: 'a***@test.com', expiresInSeconds: 600 }),
      ),
      mock.post('/api/auth/login/otp', async ({ request }) => {
        otpBody = await request.json()
        return HttpResponse.json({ accessToken: 'session-token' })
      }),
      mock.get('/api/auth/me', () => HttpResponse.json(meResponse())),
    )
    const { user, router } = renderApp('/login', { session: null })

    await user.type(await screen.findByLabelText('Email'), 'awa@test.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'MotDePasse!2026')
    await user.click(screen.getByRole('button', { name: /se connecter/i }))

    expect(await screen.findByText('Vérifiez vos emails')).toBeInTheDocument()
    expect(screen.getByText('a***@test.com')).toBeInTheDocument()

    // Le curseur est déjà dans la première case : la saisie des 6 chiffres valide toute seule
    await user.keyboard('123456')

    expect(await screen.findByRole('heading', { name: 'Bonjour Awa Diop' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(otpBody).toEqual({ challengeToken: 'challenge-1', code: '123456' })
    expect(getAccessToken()).toBe('session-token')
  })

  it('mauvais mot de passe : message du serveur, on reste sur la page', async () => {
    server.use(
      mock.post('/api/auth/login', () => HttpResponse.json({ error: { message: 'Email ou mot de passe incorrect' } }, { status: 401 })),
    )
    const { user, router } = renderApp('/login', { session: null })

    await user.type(await screen.findByLabelText('Email'), 'awa@test.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'faux')
    await user.click(screen.getByRole('button', { name: /se connecter/i }))

    expect(await screen.findByText('Email ou mot de passe incorrect')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })
})

describe('Gardes de navigation', () => {
  it('visiteur non connecté : renvoyé vers la connexion', async () => {
    const { router } = renderApp('/members', { session: null })

    expect(await screen.findByRole('button', { name: /se connecter/i })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('membre de plusieurs entreprises sans entreprise active : il doit en choisir une', async () => {
    const session = { ...meResponse({ companies: 2 }), activeCompany: null }
    const { router } = renderApp('/', { session })

    expect(await screen.findByText('Choisissez une entreprise')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/select-company')
  })

  it('page réservée à une permission absente : retour au tableau de bord', async () => {
    server.use(shopsHandler())
    const { router } = renderApp('/members', { session: meResponse({ permissions: ['sales.create'], roleCode: 'cashier' }) })

    expect(await screen.findByRole('heading', { name: 'Bonjour Awa Diop' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('le menu n’affiche que ce que l’utilisateur a le droit d’ouvrir', async () => {
    server.use(shopsHandler())
    renderApp('/', { session: meResponse({ permissions: ['users.manage'] }) })

    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Équipe')).toBeInTheDocument()
    expect(within(menu).queryByText('Rôles')).not.toBeInTheDocument()
  })

  it('l’en-tête propose les boutiques accessibles', async () => {
    server.use(shopsHandler())
    renderApp('/', { session: meResponse() })

    expect(await screen.findByLabelText('Boutique active')).toBeInTheDocument()
    expect(screen.getByText('Boutique Centre')).toBeInTheDocument()
  })
})

describe('Mise en page', () => {
  it('en-tête et menu hors de la zone qui défile ; le contenu repart en haut à chaque écran', async () => {
    server.use(shopsHandler())
    const { router } = renderApp('/', { session: meResponse() })

    await screen.findByRole('heading', { name: 'Bonjour Awa Diop' })
    const content = document.querySelector('main.ant-layout-content') as HTMLElement
    expect(content).toHaveClass('overflow-y-auto')
    // L'en-tête (menu utilisateur) et le menu ne sont pas dans le contenu : ils restent visibles
    const nav = screen.getByRole('navigation', { name: 'Menu principal' })
    expect(nav).toHaveClass('overflow-y-auto')
    expect(content).not.toContainElement(screen.getByRole('button', { name: 'Menu utilisateur' }))
    expect(content).not.toContainElement(nav)

    content.scrollTop = 400
    server.use(mock.get('/api/auth/sessions', () => HttpResponse.json({ sessions: [] })))
    await router.navigate('/account')
    await screen.findByRole('heading', { name: /Mon compte/ })
    expect(content.scrollTop).toBe(0)
  })
})

describe('Session et serveur injoignable', () => {
  it('au démarrage, serveur saturé : écran « Serveur injoignable », puis la session est retrouvée', async () => {
    server.use(
      shopsHandler(),
      mock.post('/api/auth/refresh', () => HttpResponse.json({ error: { message: 'Trop de requêtes, réessayez dans quelques minutes' } }, { status: 429 })),
    )
    const { store, user } = renderApp('/', { session: null })
    await store.dispatch(restoreSession())

    expect(await screen.findByText('Serveur injoignable')).toBeInTheDocument()
    expect(screen.getByText(/Trop de requêtes, réessayez dans quelques minutes/)).toBeInTheDocument()
    expect(screen.getByText(/Votre session n’est pas perdue/)).toBeInTheDocument()
    // Surtout pas le formulaire de connexion (le test part d'un état anonyme, d'où l'adresse /login)
    expect(screen.queryByLabelText('Mot de passe')).not.toBeInTheDocument()

    server.use(
      mock.post('/api/auth/refresh', () => HttpResponse.json({ accessToken: 'session-token' })),
      mock.get('/api/auth/me', () => HttpResponse.json(meResponse())),
    )
    await user.click(screen.getByRole('button', { name: /Réessayer maintenant/ }))
    expect(await screen.findByRole('heading', { name: 'Bonjour Awa Diop' })).toBeInTheDocument()
  })

  it('déconnexion : la session est fermée par le serveur, retour à la connexion', async () => {
    let loggedOut = false
    server.use(
      shopsHandler(),
      mock.post('/api/auth/logout', () => {
        loggedOut = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user, router } = renderApp('/', { session: meResponse() })

    await user.click(await screen.findByRole('button', { name: 'Menu utilisateur' }))
    await user.click(await screen.findByText('Se déconnecter'))

    expect(await screen.findByLabelText('Mot de passe')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(loggedOut).toBe(true)
  })

  it('déconnexion sans réponse du serveur : on reste connecté et on le dit', async () => {
    server.use(shopsHandler(), mock.post('/api/auth/logout', () => HttpResponse.error()))
    const { user, router } = renderApp('/', { session: meResponse() })

    await user.click(await screen.findByRole('button', { name: 'Menu utilisateur' }))
    await user.click(await screen.findByText('Se déconnecter'))

    expect(await screen.findByText(/Déconnexion impossible : Impossible de joindre le serveur\. Réessayez\./)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { name: 'Bonjour Awa Diop' })).toBeInTheDocument()
  })
})
