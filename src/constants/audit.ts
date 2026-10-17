/**
 * Libellés du journal d'audit : les codes enregistrés par l'API (ex. "member.permissions_update")
 * traduits pour un commerçant. Un code inconnu (nouvelle action côté serveur) s'affiche tel quel.
 */

export const ACTION_LABELS: Record<string, string> = {
  'company.create': 'Entreprise créée',
  'company.settings_update': 'Paramètres de l’entreprise modifiés',
  'company.suspend': 'Entreprise suspendue',
  'company.reactivate': 'Entreprise réactivée',
  'company.update': 'Entreprise modifiée par la plateforme',
  'company.owner_invite': 'Invitation du propriétaire renvoyée',
  'shop.create': 'Boutique créée',
  'shop.update': 'Boutique modifiée',
  'shop.archive': 'Boutique archivée',
  'shop.restore': 'Boutique rouverte',
  'member.invite': 'Membre invité',
  'member.update': 'Membre modifié',
  'member.disable': 'Membre désactivé',
  'member.permissions_update': 'Droits d’un membre ajustés',
  'role.create': 'Rôle créé',
  'role.update': 'Rôle modifié',
  'role.delete': 'Rôle supprimé',
  'payment_method.create': 'Moyen de paiement ajouté',
  'payment_method.update': 'Moyen de paiement modifié',
  'unit.create': 'Unité créée',
  'category.create': 'Catégorie créée',
  'supplier.create': 'Fournisseur créé',
  'product.create': 'Produit créé',
  'product.update': 'Produit modifié',
  'product.price_change': 'Prix de vente modifié',
  'stock.adjust': 'Stock ajusté',
  'transfer.create': 'Transfert préparé',
  'transfer.ship': 'Transfert expédié',
  'transfer.receive': 'Transfert réceptionné',
  'transfer.receive_with_discrepancy': 'Transfert réceptionné avec écart',
  'transfer.cancel': 'Transfert annulé',
  'inventory.create': 'Inventaire ouvert',
  'inventory.validate': 'Inventaire validé',
  'inventory.cancel': 'Inventaire annulé',
  'purchase_order.create': 'Bon de commande créé',
  'purchase_order.update': 'Bon de commande modifié',
  'purchase_order.send': 'Bon de commande envoyé',
  'purchase_order.cancel': 'Bon de commande annulé',
  'purchase_order.close': 'Bon de commande clôturé',
  'goods_receipt.validate': 'Réception validée',
  'goods_receipt.cancel': 'Réception annulée',
  'supplier_return.validate': 'Retour fournisseur validé',
  'supplier_return.cancel': 'Retour fournisseur annulé',
  'supplier_invoice.create': 'Facture fournisseur enregistrée',
  'supplier_invoice.cancel': 'Facture fournisseur annulée',
  'supplier_payment.create': 'Fournisseur payé',
  'cash_session.open': 'Caisse ouverte',
  'cash_session.close': 'Caisse clôturée',
  'cash_session.close_with_difference': 'Caisse clôturée avec écart',
  'sale.create': 'Vente enregistrée',
  'sale.cancel': 'Vente annulée',
  'sale.return': 'Retour client',
  'customer.create': 'Client créé',
  'customer.credit_limit_change': 'Plafond de crédit modifié',
  'customer.payment': 'Règlement client encaissé',
  'expense_category.create': 'Catégorie de dépenses créée',
  'expense.create': 'Dépense enregistrée',
  'expense.cancel': 'Dépense annulée',
}

// Suffixes génériques (archivage et modifications des fiches du catalogue, des clients…)
const SUFFIX_LABELS: Record<string, string> = {
  create: 'créé(e)',
  update: 'modifié(e)',
  archive: 'archivé(e)',
  restore: 'restauré(e)',
}

export const ENTITY_LABELS: Record<string, string> = {
  company: 'Entreprise',
  shop: 'Boutique',
  membership: 'Membre',
  role: 'Rôle',
  payment_method: 'Moyen de paiement',
  unit: 'Unité',
  category: 'Catégorie',
  supplier: 'Fournisseur',
  product: 'Produit',
  stock_adjustment: 'Ajustement de stock',
  stock_transfer: 'Transfert',
  inventory_count: 'Inventaire',
  purchase_order: 'Bon de commande',
  goods_receipt: 'Réception',
  supplier_return: 'Retour fournisseur',
  supplier_invoice: 'Facture fournisseur',
  supplier_payment: 'Paiement fournisseur',
  cash_session: 'Session de caisse',
  sale: 'Vente',
  sale_return: 'Retour client',
  customer: 'Client',
  customer_payment: 'Règlement client',
  expense_category: 'Catégorie de dépenses',
  expense: 'Dépense',
}

/** "member.permissions_update" → "Droits d'un membre ajustés" ; "supplier.archive" → "Fournisseur archivé(e)". */
export function auditActionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]
  const [entity = '', suffix = ''] = action.split('.')
  if (ENTITY_LABELS[entity] && SUFFIX_LABELS[suffix]) return `${ENTITY_LABELS[entity]} ${SUFFIX_LABELS[suffix]}`
  return action
}

export function entityLabel(entityType: string | null): string {
  if (!entityType) return '—'
  return ENTITY_LABELS[entityType] ?? entityType
}

/** Noms des champs enregistrés avant / après une modification. */
export const FIELD_LABELS: Record<string, string> = {
  name: 'Nom',
  code: 'Code',
  email: 'Email',
  role: 'Rôle',
  status: 'Statut',
  allShops: 'Toutes les boutiques',
  shopIds: 'Boutiques',
  grants: 'Permissions ajoutées',
  revokes: 'Permissions retirées',
  permissions: 'Permissions',
  description: 'Description',
  address: 'Adresse',
  phone: 'Téléphone',
  archivedAt: 'Archivé le',
  timezone: 'Fuseau horaire',
  settings: 'Réglages',
  type: 'Type',
  active: 'Actif',
  salePrice: 'Prix de vente',
  creditLimit: 'Plafond de crédit',
  amount: 'Montant',
  reason: 'Motif',
  number: 'Numéro',
  openingFloat: 'Fond de caisse',
  expectedCash: 'Espèces attendues',
  countedCash: 'Espèces comptées',
  difference: 'Écart',
  balance: 'Solde',
}
