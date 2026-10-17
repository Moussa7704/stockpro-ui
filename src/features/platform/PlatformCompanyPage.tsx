import { ArrowLeftOutlined, EditOutlined, MailOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Descriptions, Form, Input, Modal, Popconfirm, Skeleton, Table, Tag, Typography } from 'antd'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as platformService from '../../services/platform.service'
import type { CompanyStatus, PlatformCompanyDetail, PlatformMember } from '../../types/platform'
import { currencyLabel, formatDate } from '../../utils/format'
import { CompanyStatusTag } from './CompanyStatusTag'

/** État du compte d'une personne : invitation en attente ou compte activé (mot + couleur). */
function AccountTag({ pending }: { pending: boolean }) {
  return pending ? <Tag color="warning">Invitation en attente</Tag> : <Tag color="success">Compte activé</Tag>
}

/** Renommer un commerçant (à monter seulement ouvert). */
function RenameModal({ company, onClose }: { company: PlatformCompanyDetail; onClose: () => void }) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<{ name: string }>()
  const rename = useMutation({
    mutationFn: (name: string) => platformService.updateCompany(company.id, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.platform.companies })
      message.success('Commerçant renommé')
      onClose()
    },
  })
  return (
    <Modal open title="Renommer le commerçant" okText="Enregistrer" cancelText="Annuler" onOk={() => form.submit()} confirmLoading={rename.isPending} onCancel={onClose}>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ name: company.name }} onFinish={({ name }) => rename.mutate(name.trim())}>
        <Form.Item
          name="name"
          label="Nom de l’entreprise"
          rules={[
            { required: true, whitespace: true, message: 'Indiquez le nom' },
            { min: 2, max: 150, message: 'Entre 2 et 150 caractères' },
          ]}
        >
          <Input autoFocus />
        </Form.Item>
        {rename.error && <Alert type="error" title={getErrorMessage(rename.error)} showIcon />}
      </Form>
    </Modal>
  )
}

/** Fiche d'un commerçant : informations, propriétaire et son invitation, boutiques, membres. */
export function PlatformCompanyPage() {
  const { id = '' } = useParams()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [renaming, setRenaming] = useState(false)
  const { data: company, error } = useQuery({
    queryKey: queryKeys.platform.company(id),
    queryFn: async () => (await platformService.getCompany(id)).company,
  })

  const changeStatus = useMutation({
    mutationFn: (status: CompanyStatus) => platformService.updateCompany(id, { status }),
    onSuccess: ({ company: saved }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.platform.companies })
      message.success(saved.status === 'suspended' ? 'Commerçant suspendu : ses membres n’ont plus accès' : 'Commerçant réactivé')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })
  const resend = useMutation({
    mutationFn: () => platformService.resendOwnerInvitation(id),
    onSuccess: ({ sentTo }) => message.success(`Nouvelle invitation envoyée à ${sentTo}. L’ancien lien ne fonctionne plus.`),
    onError: (err) => message.error(getErrorMessage(err)),
  })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Link to="/platform" className="inline-flex items-center gap-1">
        <ArrowLeftOutlined /> Tous les commerçants
      </Link>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      {!company ? (
        !error && <Skeleton active />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Typography.Title level={2} className="mb-0">
                {company.name}
              </Typography.Title>
              <CompanyStatusTag status={company.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={<EditOutlined />} onClick={() => setRenaming(true)}>
                Renommer
              </Button>
              {company.status === 'active' ? (
                <Popconfirm
                  title="Suspendre ce commerçant ?"
                  description="Ses membres perdent l’accès immédiatement, données conservées. Vous pourrez le réactiver."
                  okText="Suspendre"
                  okButtonProps={{ danger: true }}
                  cancelText="Annuler"
                  onConfirm={() => changeStatus.mutate('suspended')}
                >
                  <Button danger icon={<PauseCircleOutlined />} loading={changeStatus.isPending}>
                    Suspendre
                  </Button>
                </Popconfirm>
              ) : (
                <Button type="primary" icon={<PlayCircleOutlined />} loading={changeStatus.isPending} onClick={() => changeStatus.mutate('active')}>
                  Réactiver
                </Button>
              )}
            </div>
          </div>

          {company.status === 'suspended' && <Alert type="warning" showIcon title="Commerçant suspendu" description="Aucun de ses membres ne peut se connecter à cette entreprise. Ses données sont conservées." />}

          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <Card title="Informations" className="h-full">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Identifiant">{company.slug}</Descriptions.Item>
                <Descriptions.Item label="Devise">
                  {currencyLabel(company.currency)} ({company.currency})
                </Descriptions.Item>
                <Descriptions.Item label="Fuseau horaire">{company.timezone.replaceAll('_', ' ')}</Descriptions.Item>
                <Descriptions.Item label="Créé le">{formatDate(company.createdAt)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Propriétaire" className="h-full">
              {company.owner ? (
                <div className="flex flex-col gap-3">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Nom">{company.owner.name}</Descriptions.Item>
                    <Descriptions.Item label="Email">{company.owner.email}</Descriptions.Item>
                    <Descriptions.Item label="Compte">
                      <AccountTag pending={company.owner.invitationPending} />
                    </Descriptions.Item>
                  </Descriptions>
                  {company.owner.invitationPending && (
                    <div>
                      <Button icon={<MailOutlined />} loading={resend.isPending} disabled={company.status !== 'active'} onClick={() => resend.mutate()}>
                        Renvoyer l’invitation
                      </Button>
                      <Typography.Paragraph type="secondary" className="mt-2 mb-0 text-xs">
                        {company.status === 'active' ? 'Email perdu ou lien expiré : un nouveau lien remplace l’ancien.' : 'Réactivez le commerçant pour renvoyer l’invitation.'}
                      </Typography.Paragraph>
                    </div>
                  )}
                </div>
              ) : (
                <Alert type="warning" showIcon title="Aucun propriétaire actif" description="Personne ne peut gérer cette entreprise : contactez le support technique." />
              )}
            </Card>
          </div>

          <Card title={`Boutiques (${company.shops.length})`} styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={company.shops}
              columns={[
                { title: 'Code', dataIndex: 'code', width: 110, render: (code: string) => <Tag>{code}</Tag> },
                { title: 'Nom', dataIndex: 'name' },
                { title: 'État', dataIndex: 'archivedAt', width: 150, render: (archivedAt: string | null) => (archivedAt ? <Tag>Archivée</Tag> : <Tag color="success">Ouverte</Tag>) },
              ]}
            />
          </Card>

          <Card title={`Membres (${company.members.length})`} styles={{ body: { padding: 0 } }}>
            <Table<PlatformMember>
              rowKey="membershipId"
              size="small"
              pagination={{ pageSize: 20, hideOnSinglePage: true }}
              dataSource={company.members}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: 'Nom', key: 'name', render: (_, member) => member.user.name },
                { title: 'Email', key: 'email', render: (_, member) => member.user.email },
                { title: 'Rôle', key: 'role', render: (_, member) => member.role.name },
                { title: 'Accès', key: 'status', width: 120, render: (_, member) => (member.status === 'active' ? <Tag color="success">Actif</Tag> : <Tag>Désactivé</Tag>) },
                { title: 'Compte', key: 'account', width: 180, render: (_, member) => <AccountTag pending={member.user.invitationPending} /> },
              ]}
            />
          </Card>

          {renaming && <RenameModal company={company} onClose={() => setRenaming(false)} />}
        </>
      )}
    </div>
  )
}
