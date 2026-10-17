import { http as mock, HttpResponse } from 'msw'
import type { MeResponse } from '../types/auth'
import type { CreateCompanyInput, PlatformCompanyDetail } from '../types/platform'
import { meResponse } from './fixtures'
import { server } from './server'

/** Administrateur de la plateforme, membre ou non d'une entreprise. */
export function platformAdmin(options: { companies?: number } = {}): MeResponse {
  const me = meResponse({ companies: options.companies ?? 1 })
  return { ...me, user: { ...me.user, isPlatformAdmin: true }, activeCompany: options.companies === 0 ? null : me.activeCompany }
}

function company(id: string, name: string, slug: string, overrides: Partial<PlatformCompanyDetail> = {}): PlatformCompanyDetail {
  const owner = { id: `u-${id}`, name: 'Awa Diallo', email: `owner-${slug}@test.com`, invitationPending: false }
  return {
    id,
    name,
    slug,
    currency: 'XOF',
    timezone: 'Africa/Abidjan',
    status: 'active',
    settings: {},
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    shops: [{ id: `s-${id}`, name: 'Boutique principale', code: 'BTQ1', archivedAt: null }],
    members: [{ membershipId: `m-${id}`, status: 'active', role: { code: 'owner', name: 'Propriétaire' }, user: owner }],
    owner,
    ...overrides,
  }
}

/** Fausse API du back-office (avec état) : création, renommage, suspension, renvoi d'invitation. */
export function mockPlatformApi() {
  const pendingOwner = { id: 'u-c2', name: 'Moussa Traoré', email: 'moussa@test.com', invitationPending: true }
  const db = {
    companies: [
      company('c1', 'Épicerie du Centre', 'epicerie-du-centre'),
      company('c2', 'Quincaillerie Traoré', 'quincaillerie-traore', {
        owner: pendingOwner,
        members: [{ membershipId: 'm-c2', status: 'active', role: { code: 'owner', name: 'Propriétaire' }, user: pendingOwner }],
      }),
      company('c3', 'Boutique Fermée', 'boutique-fermee', { status: 'suspended' }),
    ],
    requests: [] as { method: string; path: string; body: unknown }[],
  }
  const record = async (request: Request) => {
    db.requests.push({ method: request.method, path: new URL(request.url).pathname, body: await request.clone().json().catch(() => null) })
  }
  const summary = ({ shops: _shops, members, owner: _owner, ...rest }: PlatformCompanyDetail) => ({ ...rest, activeMembers: members.filter((member) => member.status === 'active').length })

  server.use(
    mock.get('/api/platform/companies', () => HttpResponse.json({ companies: db.companies.map(summary) })),
    mock.get('/api/platform/companies/:id', ({ params }) => {
      const found = db.companies.find((item) => item.id === params.id)
      return found ? HttpResponse.json({ company: found }) : HttpResponse.json({ error: { message: 'Entreprise introuvable' } }, { status: 404 })
    }),
    mock.post('/api/platform/companies', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as CreateCompanyInput
      const owner = { id: 'u-new', name: body.owner.name, email: body.owner.email, invitationPending: true }
      const created = company('c-new', body.name, body.slug ?? 'nouveau-commerce', {
        timezone: body.timezone,
        owner,
        members: [{ membershipId: 'm-new', status: 'active', role: { code: 'owner', name: 'Propriétaire' }, user: owner }],
        shops: [{ id: 's-new', name: body.shopName, code: 'BTQ1', archivedAt: null }],
      })
      db.companies.unshift(created)
      return HttpResponse.json({ company: summary(created), owner }, { status: 201 })
    }),
    mock.patch('/api/platform/companies/:id', async ({ request, params }) => {
      await record(request)
      const body = (await request.json()) as Partial<PlatformCompanyDetail>
      db.companies = db.companies.map((item) => (item.id === params.id ? { ...item, ...body } : item))
      return HttpResponse.json({ company: db.companies.find((item) => item.id === params.id) })
    }),
    mock.post('/api/platform/companies/:id/owner/invitation', async ({ request, params }) => {
      await record(request)
      const found = db.companies.find((item) => item.id === params.id)!
      return HttpResponse.json({ sentTo: found.owner!.email })
    }),
  )
  return db
}
