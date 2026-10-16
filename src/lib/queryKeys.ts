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
  units: {
    all: ['units'] as const,
    withArchived: ['units', 'with-archived'] as const,
  },
  categories: {
    all: ['categories'] as const,
    withArchived: ['categories', 'with-archived'] as const,
  },
  suppliers: {
    all: ['suppliers'] as const,
    list: (query: object) => ['suppliers', 'list', query] as const,
  },
  products: {
    all: ['products'] as const,
    list: (query: object) => ['products', 'list', query] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
  // Tout ce qui touche au stock commence par 'stock' : après un mouvement, on invalide stock.all
  // (niveaux, alertes, journal et documents se rechargent)
  stock: {
    all: ['stock'] as const,
    levels: (query: object) => ['stock', 'levels', query] as const,
    alerts: (shopId?: string) => ['stock', 'alerts', shopId ?? 'all'] as const,
    movements: (query: object) => ['stock', 'movements', query] as const,
    adjustments: (query: object) => ['stock', 'adjustments', query] as const,
    adjustment: (id: string) => ['stock', 'adjustment', id] as const,
    transfers: (query: object) => ['stock', 'transfers', query] as const,
    transfer: (id: string) => ['stock', 'transfer', id] as const,
    inventories: (query: object) => ['stock', 'inventories', query] as const,
    inventory: (id: string) => ['stock', 'inventory', id] as const,
  },
  // Achats : une réception ou un retour validé change aussi le stock (invalider stock.all en plus)
  purchases: {
    all: ['purchases'] as const,
    orders: (query: object) => ['purchases', 'orders', query] as const,
    order: (id: string) => ['purchases', 'order', id] as const,
    receipts: (query: object) => ['purchases', 'receipts', query] as const,
    receipt: (id: string) => ['purchases', 'receipt', id] as const,
    returns: (query: object) => ['purchases', 'returns', query] as const,
    return: (id: string) => ['purchases', 'return', id] as const,
    invoices: (query: object) => ['purchases', 'invoices', query] as const,
    invoice: (id: string) => ['purchases', 'invoice', id] as const,
    balances: ['purchases', 'balances'] as const,
  },
  // Caisse : une vente change le stock et la session (invalider aussi stock.all)
  pos: {
    all: ['pos'] as const,
    currentSession: (shopId: string) => ['pos', 'current-session', shopId] as const,
    session: (id: string) => ['pos', 'session', id] as const,
    sessions: (query: object) => ['pos', 'sessions', query] as const,
    sales: (query: object) => ['pos', 'sales', query] as const,
    sale: (id: string) => ['pos', 'sale', id] as const,
    ticket: (id: string) => ['pos', 'ticket', id] as const,
    customers: (search: string) => ['pos', 'customers', search] as const,
  },
}
