import type { AuditLogEntry, Paginated } from '../types/settings'
import { api } from './api'

export interface AuditLogQuery {
  page: number
  pageSize: number
  action?: string
  entityType?: string
}

/** Journal d'audit de l'entreprise active (permission audit.view), du plus récent au plus ancien. */
export function listAuditLogs(query: AuditLogQuery) {
  return api<Paginated<AuditLogEntry>>('/audit-logs', { params: { ...query } })
}
