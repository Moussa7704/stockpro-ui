/**
 * Clés du cache TanStack Query, centralisées : une modification invalide exactement
 * les listes concernées (ex. queryKeys.members.all après un changement de rôle).
 * Invalider une clé invalide aussi toutes celles qui la prolongent (ex. shops.all → shops.withArchived).
 */
export const queryKeys = {
  company: ['company'] as const,
  shops: {
    all: ['shops'] as const,
    withArchived: ['shops', 'with-archived'] as const,
  },
  paymentMethods: {
    all: ['payment-methods'] as const,
    withInactive: ['payment-methods', 'with-inactive'] as const,
  },
  members: {
    all: ['members'] as const,
    permissions: (memberId: string) => ['members', memberId, 'permissions'] as const,
  },
  roles: { all: ['roles'] as const },
  permissionCatalog: ['permission-catalog'] as const,
  auditLogs: (query: object) => ['audit-logs', query] as const,
}
