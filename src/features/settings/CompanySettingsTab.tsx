import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Form, Input, InputNumber, Select, Skeleton, Typography } from 'antd'
import { useMemo } from 'react'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as companyService from '../../services/company.service'
import { reloadSession } from '../../store/authSlice'
import { useAppDispatch } from '../../store/hooks'
import type { Company } from '../../types/settings'
import { HEX_COLOR, isReadableBrandColor } from '../../lib/brand'
import { currencyLabel } from '../../utils/format'
import { timezoneOptions } from '../../utils/timezones'
import { BrandColorField } from './BrandColorField'
import { useCompany } from './queries'

interface CompanyValues {
  name: string
  timezone: string
  maxCashierDiscountPercent: number | null
  brandColor: string | null
}

function CompanyForm({ company }: { company: Company }) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()
  const [form] = Form.useForm<CompanyValues>()
  const options = useMemo(() => timezoneOptions(company.timezone), [company.timezone])

  const save = useMutation({
    mutationFn: (values: CompanyValues) =>
      companyService.updateCompany({
        name: values.name,
        timezone: values.timezone,
        settings: { maxCashierDiscountPercent: values.maxCashierDiscountPercent ?? 0, brandColor: values.brandColor?.toLowerCase() ?? null },
      }),
    onSuccess: ({ company: saved }) => {
      queryClient.setQueryData(queryKeys.company, saved)
      // Le nom (en-tête, sélecteur) et la couleur (thème) viennent de la session : on la relit
      const brandChanged = (saved.settings.brandColor ?? null) !== (company.settings.brandColor ?? null)
      // Relecture en échec : l'enregistrement a réussi, la page suivante chargera la session à jour
      if (saved.name !== company.name || brandChanged) dispatch(reloadSession()).catch(() => undefined)
      message.success('Paramètres de l’entreprise enregistrés')
    },
  })

  return (
    <Form<CompanyValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={{
        name: company.name,
        timezone: company.timezone,
        maxCashierDiscountPercent: company.settings.maxCashierDiscountPercent ?? 0,
        brandColor: company.settings.brandColor ?? null,
      }}
      onFinish={(values) => save.mutate(values)}
      className="max-w-xl"
    >
      <Form.Item
        name="name"
        label="Nom de l’entreprise"
        rules={[
          { required: true, whitespace: true, message: 'Indiquez le nom' },
          { min: 2, max: 150, message: 'Entre 2 et 150 caractères' },
        ]}
      >
        <Input />
      </Form.Item>

      <Form.Item label="Devise" extra="Une seule devise pour toute l’entreprise : elle ne se modifie pas.">
        <Input value={`${currencyLabel(company.currency)} (${company.currency})`} disabled />
      </Form.Item>

      <Form.Item
        name="timezone"
        label="Fuseau horaire"
        extra="Les journées des rapports et des relevés suivent ce fuseau."
        rules={[{ required: true, message: 'Choisissez un fuseau horaire' }]}
      >
        <Select showSearch={{ optionFilterProp: 'label' }} options={options} aria-label="Fuseau horaire" />
      </Form.Item>

      <Form.Item
        name="maxCashierDiscountPercent"
        label="Remise maximale d’un caissier"
        extra="Au-delà, il faut la permission « Accorder des remises » (gérant, propriétaire…)."
      >
        <InputNumber min={0} max={100} step={1} suffix="%" className="w-40" aria-label="Remise maximale d’un caissier" />
      </Form.Item>

      <Form.Item
        name="brandColor"
        label="Couleur de l’interface"
        extra="Boutons, liens et menu, pour tous les membres. Les couleurs d’alerte (rupture, erreur) ne changent pas."
        rules={[
          {
            validator: (_, value: string | null) => {
              if (!value) return Promise.resolve()
              if (!HEX_COLOR.test(value)) return Promise.reject(new Error('Couleur invalide : format #RRGGBB attendu'))
              return isReadableBrandColor(value)
                ? Promise.resolve()
                : Promise.reject(new Error('Couleur trop claire : le texte blanc des boutons serait illisible. Choisissez une teinte plus foncée.'))
            },
          },
        ]}
      >
        <BrandColorField />
      </Form.Item>

      {save.error && <Alert type="error" title={getErrorMessage(save.error)} showIcon className="mb-4" />}

      <Button type="primary" htmlType="submit" loading={save.isPending}>
        Enregistrer
      </Button>
    </Form>
  )
}

/** Onglet "Entreprise" : nom, fuseau horaire, plafond de remise en caisse, couleur de l'interface. */
export function CompanySettingsTab() {
  const { data: company, error } = useCompany()

  return (
    <Card>
      <Typography.Paragraph type="secondary">
        Ces réglages s’appliquent à toutes les boutiques de l’entreprise.
      </Typography.Paragraph>
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      {/* key : le formulaire repart des valeurs enregistrées si l'entreprise change */}
      {company ? <CompanyForm key={company.updatedAt} company={company} /> : !error && <Skeleton active />}
    </Card>
  )
}
