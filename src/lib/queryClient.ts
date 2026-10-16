import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../services/api'

/**
 * Cache des données serveur (TanStack Query). Une erreur 4xx (droits, validation, introuvable)
 * ne se corrige pas en réessayant : on ne réessaie que les pannes réseau ou serveur.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
          return failureCount < 2
        },
      },
      mutations: { retry: false },
    },
  })
}

export const queryClient = createQueryClient()
