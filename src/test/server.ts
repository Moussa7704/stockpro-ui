import { setupServer } from 'msw/node'

/**
 * Fausse API pour les tests (MSW) : chaque test déclare les réponses dont il a besoin avec
 * server.use(http.get('/api/…', () => HttpResponse.json(…))). Toute requête non prévue échoue.
 */
export const server = setupServer()
