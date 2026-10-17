import type { CompanyStatus, CreateCompanyInput, PlatformCompany, PlatformCompanyDetail, PlatformCompanySummary, PlatformOwner } from '../types/platform'
import { api } from './api'

// Back-office de la plateforme : réservé à l'administrateur SaaS (user.isPlatformAdmin)

export function listCompanies() {
  return api<{ companies: PlatformCompanySummary[] }>('/platform/companies')
}

export function getCompany(id: string) {
  return api<{ company: PlatformCompanyDetail }>(`/platform/companies/${id}`)
}

/** Entreprise, rôles, première boutique et propriétaire : l'invitation part par email. */
export function createCompany(input: CreateCompanyInput) {
  return api<{ company: PlatformCompany; owner: PlatformOwner }>('/platform/companies', { method: 'POST', body: input })
}

/** Renommer, suspendre (plus aucun membre n'y accède) ou réactiver. */
export function updateCompany(id: string, input: { name?: string; status?: CompanyStatus }) {
  return api<{ company: PlatformCompany }>(`/platform/companies/${id}`, { method: 'PATCH', body: input })
}

/** Nouveau lien d'invitation pour le propriétaire qui n'a pas encore activé son compte. */
export function resendOwnerInvitation(id: string) {
  return api<{ sentTo: string }>(`/platform/companies/${id}/owner/invitation`, { method: 'POST' })
}
