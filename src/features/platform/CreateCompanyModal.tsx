import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Collapse, Form, Input, Modal, Select } from 'antd'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as platformService from '../../services/platform.service'
import type { CreateCompanyInput } from '../../types/platform'
import { timezoneOptions } from '../../utils/timezones'

interface CreateCompanyValues {
  name: string
  slug?: string
  timezone: string
  shopName: string
  ownerName: string
  ownerEmail: string
}

/**
 * Nouveau commerçant : entreprise, première boutique et propriétaire, qui reçoit une invitation
 * par email pour choisir son mot de passe (pas d'inscription publique). À monter seulement ouvert.
 */
export function CreateCompanyModal({ onClose }: { onClose: () => void }) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [form] = Form.useForm<CreateCompanyValues>()
  const options = useMemo(() => timezoneOptions(), [])

  const create = useMutation({
    mutationFn: (values: CreateCompanyValues) => {
      const input: CreateCompanyInput = {
        name: values.name.trim(),
        timezone: values.timezone,
        shopName: values.shopName.trim(),
        owner: { name: values.ownerName.trim(), email: values.ownerEmail.trim() },
        ...(values.slug?.trim() && { slug: values.slug.trim() }),
      }
      return platformService.createCompany(input)
    },
    onSuccess: ({ company, owner }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.platform.companies })
      message.success(owner.invitationPending ? `Commerçant créé. Invitation envoyée à ${owner.email}.` : `Commerçant créé. ${owner.email} a déjà un compte : il est prévenu par email.`)
      onClose()
      navigate(`/platform/companies/${company.id}`)
    },
  })

  return (
    <Modal open title="Nouveau commerçant" okText="Créer et inviter" cancelText="Annuler" onOk={() => form.submit()} confirmLoading={create.isPending} onCancel={onClose} destroyOnHidden>
      <Form<CreateCompanyValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ timezone: 'Africa/Abidjan', shopName: 'Boutique principale' }}
        onFinish={(values) => create.mutate(values)}
      >
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
        <Form.Item name="timezone" label="Fuseau horaire" extra="Les journées des rapports suivent ce fuseau. Le commerçant peut le changer ensuite.">
          <Select showSearch={{ optionFilterProp: 'label' }} options={options} aria-label="Fuseau horaire" />
        </Form.Item>
        <Form.Item name="shopName" label="Première boutique" rules={[{ required: true, whitespace: true, min: 2, max: 120, message: 'Entre 2 et 120 caractères' }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="ownerName"
          label="Nom du propriétaire"
          rules={[{ required: true, whitespace: true, message: 'Indiquez le nom du propriétaire' }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="ownerEmail"
          label="Email du propriétaire"
          extra="Il recevra un lien pour choisir son mot de passe."
          rules={[
            { required: true, message: 'Indiquez l’email du propriétaire' },
            { type: 'email', message: 'Email invalide' },
          ]}
        >
          <Input type="email" autoComplete="off" />
        </Form.Item>
        <Collapse
          ghost
          size="small"
          items={[
            {
              key: 'advanced',
              label: 'Options avancées',
              children: (
                <Form.Item
                  name="slug"
                  label="Identifiant"
                  extra="Facultatif : généré à partir du nom (ex. boutique-chez-awa)."
                  rules={[{ pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/, message: 'Lettres minuscules, chiffres et tirets uniquement' }]}
                >
                  <Input placeholder="boutique-chez-awa" />
                </Form.Item>
              ),
            },
          ]}
        />
        {create.error && <Alert type="error" title={getErrorMessage(create.error)} showIcon className="mt-2" />}
      </Form>
    </Modal>
  )
}
