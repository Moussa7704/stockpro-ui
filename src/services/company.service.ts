import type { Company, UpdateCompanyInput } from '../types/settings'
import { api } from './api'

/** Entreprise active (lecture pour tout membre ; modification avec company.manage). */
export function getCompany() {
  return api<{ company: Company }>('/company')
}

/** Les réglages sont fusionnés côté serveur : on n'envoie que ce qui change. */
export function updateCompany(input: UpdateCompanyInput) {
  return api<{ company: Company }>('/company', { method: 'PATCH', body: input })
}
